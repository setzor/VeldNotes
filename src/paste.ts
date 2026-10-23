import { Editor } from "@tiptap/core";
import { saveMedia } from "./api";
import { setActiveNotebook } from "./editor";
import { setClipboardNotebook } from "./clipboard";

interface NodeSelectionLike {
  from: number;
  to: number;
}

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
        // Internal drags must be resolved BEFORE looking at
        // dataTransfer.files: Chromium-family engines place the dragged
        // <img> into the file list on in-page drags, so a files-first check
        // treats a move as a fresh file drop and inserts a copy. Note that
        // the `moved` flag is false whenever a copy modifier is held
        // (Ctrl/Alt), so the reliable internal-drag signal is
        // view.dragging.node - ProseMirror itself ignores clipboard files
        // whenever an internal drag is in progress.
        const dragging = (
          view as unknown as {
            dragging: { node: NodeSelectionLike } | null;
          }
        ).dragging;
        const draggedSel = dragging?.node;
        if (draggedSel) {
          const pos = draggedSel.from;
          const node = view.state.doc.nodeAt(pos);
          if (node && (node.type.name === "image" || node.type.name === "canvasBlock")) {
            const rect = view.dom.getBoundingClientRect();
            const x = Math.max(0, Math.round(event.clientX - rect.left));
            const y = Math.max(0, Math.round(event.clientY - rect.top));
            event.preventDefault();
            view.dispatch(
              view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                freeformPos: `${x},${y}`,
              }),
            );
            return true;
          }
          return false;
        }
        void moved;
        // External file drop (from the OS): store and insert as a new image.
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


