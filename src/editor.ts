import { Editor, Extension } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { mediaDataUrl, readMedia } from "./api";
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
      width: {
        default: null,
        parseHTML: (el) => {
          const raw = (el as HTMLElement).getAttribute("width");
          if (raw && /^\d+$/.test(raw)) return Number(raw);
          const style = (el as HTMLElement).getAttribute("style") ?? "";
          const m = style.match(/width:\s*(\d+)px/);
          return m ? Number(m[1]) : null;
        },
        renderHTML: (attrs) => {
          const w = attrs.width as number | null;
          return w ? { style: `width: ${w}px` } : {};
        },
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
    return ({ node, editor: ed, getPos }) => {
      const img = document.createElement("img");
      const src = node.attrs.src as string;
      if (src.startsWith("../media/")) {
        img.dataset.pendingSrc = src;
        void readMedia(activeNotebook, src)
          .then(({ data, mime }) => {
            img.src = mediaDataUrl(data, mime);
          })
          .catch(() => {
            img.alt = "image unavailable";
          });
      } else {
        img.src = src;
      }
      if (node.attrs.alt) img.alt = node.attrs.alt as string;
      const w = node.attrs.width as number | null;
      if (w) img.style.width = `${w}px`;

      const dom = document.createElement("div");
      dom.className = "entry-image";
      dom.appendChild(img);

      const MIN_W = 40;
      const commit = (px: number): void => {
        const pos = typeof getPos === "function" ? getPos() : null;
        if (pos === null) return;
        ed.view.dispatch(
          ed.view.state.tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            width: px,
          }),
        );
      };

      const startDrag = (event: MouseEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startWidth = img.getBoundingClientRect().width;
        const containerW =
          dom.parentElement?.getBoundingClientRect().width ?? startWidth;
        const onMove = (ev: MouseEvent): void => {
          let next = startWidth + (ev.clientX - startX);
          next = Math.max(MIN_W, Math.min(next, containerW));
          apply(Math.round(next));
        };
        const onUp = (): void => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          commit(Math.round(img.getBoundingClientRect().width));
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      };

      const apply = (px: number): void => {
        img.style.width = `${px}px`;
      };

      const corner = document.createElement("div");
      corner.className = "img-resize-handle corner";
      corner.addEventListener("mousedown", startDrag);
      const edge = document.createElement("div");
      edge.className = "img-resize-handle edge";
      edge.addEventListener("mousedown", startDrag);
      dom.append(corner, edge);

      return {
        dom,
        update(updated) {
          if (updated.type.name !== "image") return false;
          node = updated;
          const nw = updated.attrs.width as number | null;
          if (nw) img.style.width = `${nw}px`;
          else img.style.width = "";
          return true;
        },
      };
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
