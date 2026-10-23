import type { Editor } from "@tiptap/core";
import { readMedia } from "./api";

/**
 * Clipboard helpers for media blocks. Two layers:
 *
 * 1. OS clipboard: write the actual image bytes as a clipboard file/blob so
 *    pasting into other apps (or back into VeldNotes) yields the image, not
 *    a text path.
 * 2. Editor clipboard: select the ProseMirror node and let the editor's own
 *    copy machinery put the serialized node on the clipboard, so in-app
 *    cut/paste re-inserts the exact same block (the media store dedupes by
 *    content hash, so no duplicate files are created).
 */

let activeNotebook = "default";

export function setClipboardNotebook(notebook: string): void {
  activeNotebook = notebook;
}

/**
 * Write the image to the system clipboard with everything a consumer needs:
 * the real image bytes (so other apps paste the picture) and a text/html
 * payload carrying the local media reference (so pasting back into VeldNotes
 * reconstructs the exact same image node). The media store dedupes by content
 * hash, so re-inserting the same bytes reuses the stored file.
 */
async function writeImageToClipboard(reference: string): Promise<boolean> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    return false;
  }
  try {
    const { data, mime } = await readMedia(activeNotebook, reference);
    const bytes = new Uint8Array(data);
    const type = mime.startsWith("image/") ? mime : "image/png";
    const blob = new Blob([bytes], { type });
    const html =
      `<img src="${reference.replace(/"/g, "&quot;")}" alt="pasted image">`;
    const htmlBlob = new Blob([html], { type: "text/html" });
    const itemPayload: Record<string, Blob> = { [type]: blob };
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ ...itemPayload, "text/html": htmlBlob }),
      ]);
    } catch {
      // Some engines only accept image types in ClipboardItem.
      await navigator.clipboard.write([
        new ClipboardItem(itemPayload),
      ]);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy an image node. The in-app (ProseMirror) copy runs synchronously within
 * the user gesture first, so pasting back into a note always reconstructs a
 * valid image node; the real image bytes are then written to the OS
 * clipboard best-effort (some engines reject async clipboard writes once
 * the gesture context is gone).
 */
export async function copyImage(
  editor: Editor | null,
  reference: string,
): Promise<void> {
  if (editor) {
    selectNodeBySrc(editor, reference, true);
    triggerCopy();
  }
  await writeImageToClipboard(reference);
}

/**
 * Cut an image node. The in-app copy and the removal run synchronously within
 * the user gesture (so the cut feels instant and the ProseMirror clipboard
 * always holds the node); the OS-clipboard write of the real bytes continues
 * in the background.
 */
export async function cutImage(
  editor: Editor | null,
  reference: string,
): Promise<void> {
  if (editor) {
    selectNodeBySrc(editor, reference, true);
    triggerCopy();
  }
  removeImage(editor, reference);
  await writeImageToClipboard(reference);
}

/** Remove the first image node whose src matches the reference. */
export function removeImage(
  editor: Editor | null,
  reference: string,
): void {
  if (!editor || !reference) return;
  const doc = editor.state.doc;
  let targetPos: number | null = null;
  doc.descendants((node, pos) => {
    if (targetPos !== null) return false;
    if (node.type.name === "image" && node.attrs.src === reference) {
      targetPos = pos;
      return false;
    }
    return true;
  });
  if (targetPos === null) return;
  editor
    .chain()
    .focus()
    .setNodeSelection(targetPos)
    .deleteSelection()
    .run();
}

function selectNodeBySrc(
  editor: Editor,
  reference: string,
  focus = true,
): boolean {
  let targetPos: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (targetPos !== null) return false;
    if (node.type.name === "image" && node.attrs.src === reference) {
      targetPos = pos;
      return false;
    }
    return true;
  });
  if (targetPos === null) return false;
  const chain = editor.chain();
  if (focus) chain.focus();
  return chain.setNodeSelection(targetPos).run();
}

/** Select and copy a canvas sketch node (in-app clipboard round-trip). */
export function copyCanvas(
  editor: Editor | null,
  canvasDom: HTMLElement,
): void {
  if (!editor) return;
  const pos = findCanvasPos(editor, canvasDom);
  if (pos === null) return;
  editor.chain().focus().setNodeSelection(pos).run();
  triggerCopy();
}

/** Fire a copy so ProseMirror serializes the node selection to the clipboard. */
function triggerCopy(): void {
  try {
    void document.execCommand("copy");
  } catch {
    // execCommand unavailable (e.g. test environments): selection remains, so
    // Ctrl+C still copies via the editor's own keyboard handler.
  }
}

/** Select, copy, then remove a canvas sketch node. */
export function cutCanvas(
  editor: Editor | null,
  canvasDom: HTMLElement,
): void {
  if (!editor) return;
  copyCanvas(editor, canvasDom);
  const pos = findCanvasPos(editor, canvasDom);
  if (pos === null) return;
  editor
    .chain()
    .focus()
    .setNodeSelection(pos)
    .deleteSelection()
    .run();
}

/** Remove a canvas sketch node. */
export function deleteCanvas(
  editor: Editor | null,
  canvasDom: HTMLElement,
): void {
  if (!editor) return;
  const pos = findCanvasPos(editor, canvasDom);
  if (pos === null) return;
  editor
    .chain()
    .focus()
    .setNodeSelection(pos)
    .deleteSelection()
    .run();
}

function findCanvasPos(
  editor: Editor,
  canvasDom: HTMLElement,
): number | null {
  let targetPos: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (targetPos !== null) return false;
    if (node.type.name !== "canvasBlock") return true;
    const dom = editor.view.nodeDOM(pos);
    if (dom === canvasDom || (dom instanceof HTMLElement && dom.contains(canvasDom))) {
      targetPos = pos;
      return false;
    }
    return true;
  });
  return targetPos;
}
