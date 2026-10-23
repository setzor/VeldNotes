// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({})) }));
import { createEditor } from "./editor";

function clipboardEventWithImageFile(): ClipboardEvent {
  const pngBytes = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
  ]);
  const file = new File([pngBytes], "pasted.png", { type: "image/png" });
  const dt = new DataTransfer();
  dt.items.add(file);
  const event = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, "clipboardData", { value: dt });
  return event;
}

describe("image paste round-trip", () => {
  it("pasting a clipboard image file inserts an image node, not text", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });

    const handled = (editor.view.props as { handlePaste?: unknown }).handlePaste;
    expect(typeof handled).toBe("function");

    const event = clipboardEventWithImageFile();
    const result = (handled as (
      view: unknown,
      event: ClipboardEvent,
    ) => boolean | void)(editor.view, event);
    expect(result).toBe(true);

    await vi.waitFor(() => {
      const hasImage = editor
        .getJSON()
        .content?.some((n) => n.type === "image");
      expect(hasImage).toBe(true);
    });
    // the pasted content must never surface as a text URL
    expect(editor.getText()).not.toContain("media/");
    editor.destroy();
  });
});
