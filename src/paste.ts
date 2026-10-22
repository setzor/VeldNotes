import { Editor } from "@tiptap/core";
import { saveMedia } from "./api";

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
      handleDrop(view, event) {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const file = files[0];
        if (!file.type.startsWith("image/")) return false;
        event.preventDefault();
        const coordinates = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        void insertImageFile(editor, file, coordinates?.pos);
        return true;
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
    const { markdown } = await saveMedia(bytes, ext);
    const at = pos ?? editor.state.selection.from;
    editor
      .chain()
      .insertContentAt(at, {
        type: "image",
        attrs: { src: markdownImageSrc(markdown), alt: "pasted image" },
      })
      .focus()
      .run();
  } catch (err) {
    console.error("image paste failed", err);
  }
}

export function markdownImageSrc(markdown: string): string {
  const match = markdown.match(/\]\(([^)]+)\)/);
  return match ? match[1] : "";
}
