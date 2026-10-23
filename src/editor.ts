import { Editor, Extension } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { convertFileSrc } from "@tauri-apps/api/core";
import { mediaPath } from "./api";
import { installImagePaste } from "./paste";
import {
  reviveSavedContent,
  tiptapContentFromMarkdown,
  tiptapDocToMarkdown,
} from "./markdown";

let activeNotebook = "default";

export function setActiveNotebook(notebook: string): void {
  activeNotebook = notebook;
}

const LocalMediaImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: (el) => el.getAttribute("src"),
        renderHTML: (attrs) => ({ src: attrs.src as string }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "img[src]",
        getAttrs: (el) => {
          const src = (el as HTMLElement).getAttribute("src") ?? "";
          if (!src.startsWith("../media/")) return false;
          return { src, alt: (el as HTMLElement).getAttribute("alt") };
        },
      },
    ];
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImage:
        (options: { src: string; alt?: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addNodeView() {
    return ({ node }) => {
      const img = document.createElement("img");
      const src = node.attrs.src as string;
      if (src.startsWith("../media/")) {
        img.dataset.pendingSrc = src;
        void mediaPath(activeNotebook, src)
          .then((abs) => {
            img.src = convertFileSrc(abs);
          })
          .catch(() => {
            img.alt = "image unavailable";
          });
      } else {
        img.src = src;
      }
      if (node.attrs.alt) img.alt = node.attrs.alt as string;
      const dom = document.createElement("div");
      dom.className = "entry-image";
      dom.appendChild(img);
      return { dom };
    };
  },
});

export interface EditorCallbacks {
  onUpdate: (markdown: string) => void;
}

/**
 * TipTap treats string content as HTML, so both markdown and any legacy
 * raw-JSON entry must be converted to a parsed doc object before mounting.
 */
function resolveEditorContent(raw: string): JSONContent | "" {
  const revived = reviveSavedContent(raw);
  if (typeof revived !== "string") return revived;
  return tiptapContentFromMarkdown(revived) ?? "";
}

export function createEditor(
  element: HTMLElement,
  content: string,
  callbacks: EditorCallbacks,
): Editor {
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      LocalMediaImage.configure({ inline: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({
        placeholder: "Open the page and write…",
      }),
      Extension.create({
        name: "autosaveBridge",
        onUpdate() {
          callbacks.onUpdate(tiptapDocToMarkdown(editor.getJSON()));
        },
      }),
    ],
    content: resolveEditorContent(content),
    autofocus: true,
    editorProps: {
      attributes: {
        class: "entry-editor",
        spellcheck: "true",
      },
    },
  });
  installImagePaste(editor);
  return editor;
}
