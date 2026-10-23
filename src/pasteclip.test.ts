// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
const invoke = vi.fn(async (cmd: string) => {
  if (cmd === "save_media") {
    return { reference: "../media/storedhash.png", filename: "storedhash.png" };
  }
  if (cmd === "read_media") {
    return { data: [137, 80, 78, 71], mime: "image/png" };
  }
  return {};
});
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: unknown) => invoke(cmd as string),
}));
import { createEditor } from "./editor";
import { looksLikeImage } from "./paste";

function pngFile(bytes?: Uint8Array): File {
  return new File(
    [bytes ?? new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82])],
    "pasted.png",
    { type: "image/png" },
  );
}

function pasteEvent(dt: DataTransfer): ClipboardEvent {
  const event = new Event("paste", {
    bubbles: true,
    cancelable: true,
  }) as ClipboardEvent;
  Object.defineProperty(event, "clipboardData", { value: dt });
  return event;
}

function htmlPasteEvent(html: string): ClipboardEvent {
  const dt = new DataTransfer();
  dt.setData("text/html", html);
  return pasteEvent(dt);
}

describe("image paste round-trip", () => {
  it("pasting an external clipboard image file inserts an image node, not text", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });

    const handled = (editor.view.props as { handlePaste?: unknown }).handlePaste;
    expect(typeof handled).toBe("function");

    const dt = new DataTransfer();
    dt.items.add(pngFile());
    const result = (handled as (v: unknown, e: ClipboardEvent) => boolean)(
      editor.view,
      pasteEvent(dt),
    );
    expect(result).toBe(true);

    await vi.waitFor(() => {
      expect(
        editor.getJSON().content?.some((n) => n.type === "image"),
      ).toBe(true);
    });
    expect(editor.getText()).not.toContain("media/");
    editor.destroy();
  });

  it("reuses the stored media when the clipboard carries our reference HTML", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    invoke.mockClear();

    const handled = (editor.view.props as { handlePaste?: unknown }).handlePaste as (
      v: unknown,
      e: ClipboardEvent,
      slice?: unknown,
    ) => boolean;
    const event = htmlPasteEvent(
      '<img src="../media/existing.png" alt="pasted image">',
    );
    invoke.mockClear();
    const result = handled(editor.view, event, null);
    expect(result).toBe(true);

    const inserted = editor
      .getJSON()
      .content?.find((n) => n.type === "image");
    expect(inserted?.attrs?.src).toBe("../media/existing.png");
    // no new media stored: the existing file is reused
    expect(invoke).not.toHaveBeenCalledWith("save_media", expect.anything());
    editor.destroy();
  });

  it("rejects unreadable clipboard image files instead of inserting broken nodes", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    invoke.mockClear();

    const handled = (editor.view.props as { handlePaste?: unknown }).handlePaste as (
      v: unknown,
      e: ClipboardEvent,
      slice?: unknown,
    ) => boolean;

    const dt = new DataTransfer();
    // tiny junk payload with an image MIME type - the webview-clipboard
    // failure mode that used to produce a "?" image
    dt.items.add(
      new File([new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])], "x.png", {
        type: "image/png",
      }),
    );
    const result = handled(editor.view, pasteEvent(dt), null);
    expect(result).toBe(true);

    await new Promise((r) => setTimeout(r, 100));
    expect(
      editor.getJSON().content?.some((n) => n.type === "image"),
    ).toBeFalsy();
    expect(invoke).not.toHaveBeenCalledWith("save_media", expect.anything());
    editor.destroy();
  });

  it("detects image magic bytes", () => {
    expect(
      looksLikeImage(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...Array(8).fill(0)])),
    ).toBe(true);
    expect(
      looksLikeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array(12).fill(0)])),
    ).toBe(true);
    expect(looksLikeImage(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false);
    expect(looksLikeImage(new Uint8Array(4))).toBe(false);
  });
});
