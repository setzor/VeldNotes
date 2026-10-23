import { Editor } from "@tiptap/core";
import { saveMedia } from "./api";
import { setActiveNotebook } from "./editor";
import { setClipboardNotebook } from "./clipboard";

let currentNotebook = "default";

export function setPasteNotebook(notebook: string): void {
  currentNotebook = notebook;
  setActiveNotebook(notebook);
  setClipboardNotebook(notebook);
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
};

export function installImagePaste(editor: Editor): void {
  editor.setOptions({
    editorProps: {
      handlePaste(_view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind !== "file") continue;
          const file = item.getAsFile();
          if (!file || !file.type.startsWith("image/")) continue;
          event.preventDefault();
          void insertImageFile(editor, file);
          return true;
        }
        return false;
      },
      handleDrop(view, event, _slice, moved) {
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
          const file = files[0];
          if (!file.type.startsWith("image/")) return false;
          event.preventDefault();
          const coordinates = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          void insertImageFile(editor, file, coordinates?.pos);
          return true;
        }
        // In-editor drag of an existing block (image, canvas sketch): update
        // its freeform coordinates to the drop point instead of reordering the
        // document, so blocks can be repositioned freely on the sheet.
        if (moved) {
          const sel = view.state.selection;
          const isNodeSel =
            typeof sel === "object" &&
            sel !== null &&
            "node" in sel &&
            (sel as { node?: unknown }).node != null;
          if (isNodeSel) {
            const draggedPos = sel.from as unknown as number;
            const node = view.state.doc.nodeAt(draggedPos);
            if (node && (node.type.name === "image" || node.type.name === "canvasBlock")) {
              const rect = view.dom.getBoundingClientRect();
              const x = Math.max(0, Math.round(event.clientX - rect.left));
              const y = Math.max(0, Math.round(event.clientY - rect.top));
              event.preventDefault();
              view.dispatch(
                view.state.tr.setNodeMarkup(draggedPos, undefined, {
                  ...node.attrs,
                  freeformPos: `${x},${y}`,
                }),
              );
              return true;
            }
          }
        }
        return false;
      },
    },
  });
}

async function insertImageFile(
  editor: Editor,
  file: File,
  pos?: number,
): Promise<void> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const ext = EXT_BY_MIME[file.type] ?? null;
    const { reference } = await saveMedia(currentNotebook, bytes, ext);
    const at = pos ?? editor.state.selection.from;
    editor
      .chain()
      .insertContentAt(at, {
        type: "image",
        attrs: { src: reference, alt: "pasted image" },
      })
      .focus()
      .run();
  } catch (err) {
    console.error("image paste failed", err);
  }
}


