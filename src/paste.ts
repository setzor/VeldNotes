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

/** Extract a local media reference from pasted clipboard HTML. */
function mediaReferenceFromHtml(html: string): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]*src="([^"]+)"/i);
  if (!match) return null;
  const src = match[1];
  return src.startsWith("../media/") ? src : null;
}

interface SliceLike {
  content?: { childCount?: number; forEach?: (cb: (n: { type?: { name?: string } }) => void) => void };
}

/** True when the parsed paste slice already contains an image node. */
function sliceHasImage(slice: unknown): boolean {
  const s = slice as SliceLike | null;
  if (!s?.content?.forEach) return false;
  let found = false;
  s.content.forEach((node) => {
    if (node?.type?.name === "image") found = true;
  });
  return found;
}

/**
 * Insert a clipboard image file only after verifying its magic bytes.
 * Webviews occasionally hand back empty or unreadable clipboard files (size 0
 * or unknown bytes); storing those produced a broken-image node.
 */
async function insertValidatedImageFile(
  editor: Editor,
  file: File,
  pos?: number,
): Promise<void> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (!looksLikeImage(bytes)) {
      console.warn("ignoring clipboard image with unrecognised bytes");
      return;
    }
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

/** Check magic bytes for the image formats the media store accepts. */
export function looksLikeImage(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true; // PNG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true; // JPEG
  const gif = String.fromCharCode(...bytes.slice(0, 6));
  if (gif === "GIF87a" || gif === "GIF89a") return true; // GIF
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return true; // BMP
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return true; // WebP
  const head = String.fromCharCode(...bytes.slice(0, 4)).trim().toLowerCase();
  if (head === "<svg" || head.startsWith("<?xm")) return true; // SVG
  return false;
}

export function installImagePaste(editor: Editor): void {
  editor.setOptions({
    editorProps: {
      handlePaste(_view, event, slice) {
        // 1. An in-app copy (Cut/Copy image) carries the media reference as
        //    text/html. Reuse the existing media file instead of round-tripping
        //    clipboard bytes through the media store - webview clipboard files
        //    are frequently unreadable or empty, which produced broken images.
        const html = event.clipboardData?.getData("text/html") ?? "";
        const ref = mediaReferenceFromHtml(html);
        if (ref) {
          event.preventDefault();
          const ok = editor
            .chain()
            .focus()
            .insertContent({
              type: "image",
              attrs: { src: ref, alt: "pasted image" },
            })
            .run();
          return ok || true;
        }
        // 2. A pasted slice that already parsed into image nodes (e.g. PM
        //    round-trips of its own clipboard HTML) is left to the default
        //    paste handling.
        if (sliceHasImage(slice)) return false;
        // 3. External image file on the clipboard: validate the bytes before
        //    storing, so an unreadable webview clipboard file can never become
        //    a broken node.
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind !== "file") continue;
          const file = item.getAsFile();
          if (!file || !file.type.startsWith("image/")) continue;
          event.preventDefault();
          void insertValidatedImageFile(editor, file);
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


