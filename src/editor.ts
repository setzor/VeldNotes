import { Editor, Extension, Node, mergeAttributes } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Highlight } from "@tiptap/extension-highlight";
import { Underline } from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { TextAlign } from "@tiptap/extension-text-align";
import { Link } from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { mediaDataUrl, readMedia } from "./api";
import { installImagePaste } from "./paste";
import { openCanvasEditor, showCanvasError } from "./canvas";
import { Typography } from "./typography";
import { FreeformSheet } from "./freeform";
import { tiptapContentFromMarkdown } from "./legacyMarkdown";

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
      textAlign: {
        default: null,
        parseHTML: (el) =>
          (el as HTMLElement).getAttribute("data-text-align") ?? null,
        renderHTML: (attrs) => {
          const align = attrs.textAlign as string | null;
          return align ? { "data-text-align": align } : {};
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

      const applyAlign = (align: string | null): void => {
        dom.style.marginLeft = align === "center" || align === "right" ? "auto" : "";
        dom.style.marginRight = align === "center" || align === "left" ? "auto" : "";
      };
      applyAlign(node.attrs.textAlign as string | null);

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
          applyAlign(updated.attrs.textAlign as string | null);
          return true;
        },
      };
    };
  },
});

/* --- free-form canvas block (Excalidraw) ---------------------------------- */

const MAX_PREVIEW_CHARS = 120_000;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    canvasBlock: {
      insertCanvas: () => ReturnType;
    };
  }
}

const CanvasBlock = Node.create({
  name: "canvasBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      scene: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-scene") ?? "",
        renderHTML: () => ({}),
      },
      preview: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-preview") ?? "",
        renderHTML: () => ({}),
      },
      textAlign: {
        default: null,
        parseHTML: (el) =>
          (el as HTMLElement).getAttribute("data-text-align") ?? null,
        renderHTML: (attrs) => {
          const align = attrs.textAlign as string | null;
          return align ? { "data-text-align": align } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-canvas]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-canvas": "" }, HTMLAttributes),
      0,
    ];
  },

  addNodeView() {
    return ({ node, editor: ed, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "entry-canvas";
      dom.setAttribute("data-canvas", "");

      const applyAlign = (align: string | null): void => {
        dom.style.marginLeft = align === "center" || align === "right" ? "auto" : "";
        dom.style.marginRight = align === "center" || align === "left" ? "auto" : "";
      };
      applyAlign(node.attrs.textAlign as string | null);

      const preview = document.createElement("div");
      preview.className = "entry-canvas-preview";
      const applyPreview = (svg: string): void => {
        if (svg) {
          preview.innerHTML = svg;
          dom.classList.add("has-preview");
        } else {
          preview.innerHTML = "";
          dom.classList.remove("has-preview");
        }
      };
      applyPreview(node.attrs.preview as string);

      const label = document.createElement("div");
      label.className = "entry-canvas-label";
      label.textContent = "Canvas sketch";
      const hint = document.createElement("div");
      hint.className = "entry-canvas-hint";
      hint.textContent = "Double-click to draw";

      dom.append(preview, label, hint);

      let busy = false;
      const edit = (): void => {
        if (busy) return;
        busy = true;
        openCanvasEditor(node.attrs.scene as string)
          .then((result) => {
            busy = false;
            if (!result) return;
            const pos = typeof getPos === "function" ? getPos() : null;
            if (pos === null) return;
            const scene = result.scene.slice(0, 2_000_000);
            const svg =
              result.preview.length > MAX_PREVIEW_CHARS
                ? ""
                : result.preview;
            applyPreview(svg);
            ed.view.dispatch(
              ed.view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                scene,
                preview: svg,
              }),
            );
          })
          .catch((err: unknown) => {
            busy = false;
            console.error("canvas editor failed", err);
            showCanvasError(
              "The canvas could not be opened. Please try again.",
            );
          });
      };

      dom.addEventListener("dblclick", edit);
      dom.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          edit();
        }
      });
      dom.title = "Canvas sketch — double-click to draw";
      dom.tabIndex = 0;

      return {
        dom,
        update(updated) {
          if (updated.type.name !== "canvasBlock") return false;
          node = updated;
          applyPreview(updated.attrs.preview as string);
          applyAlign(updated.attrs.textAlign as string | null);
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      insertCanvas:
        () =>
        ({ commands }: { commands: { insertContent: (c: unknown) => boolean } }) =>
          commands.insertContent({ type: this.name, attrs: {} }),
    } as unknown as Partial<Record<string, unknown>>;
  },
});

export interface EditorCallbacks {
  onUpdate: (docJson: string) => void;
}

/**
 * Entries are persisted as serialized TipTap JSON documents. Legacy Markdown
 * entries (and raw JSON from even older builds) are resolved here before the
 * editor mounts.
 */
function resolveEditorContent(raw: string): JSONContent | "" {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { type?: string };
      if (parsed && parsed.type === "doc") {
        return parsed as unknown as JSONContent;
      }
    } catch {
      // fall through: treat as legacy markdown
    }
  }
  return tiptapContentFromMarkdown(trimmed) ?? "";
}

export function createEditor(
  element: HTMLElement,
  content: string,
  callbacks: EditorCallbacks,
): Editor {
  let self: Editor | null = null;
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Typography,
      Color,
      TextAlign.configure({
        types: ["heading", "paragraph", "image", "canvasBlock"],
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      LocalMediaImage.configure({ inline: false }),
      CanvasBlock,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      FreeformSheet,
      Placeholder.configure({
        placeholder: "Open the page and write…",
      }),
      Extension.create({
        name: "autosaveBridge",
        onUpdate() {
          callbacks.onUpdate(JSON.stringify(self?.getJSON()));
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
  self = editor;
  installImagePaste(editor);
  return editor;
}
