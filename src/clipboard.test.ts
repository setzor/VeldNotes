// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";

const invoke = vi.fn(async (cmd: string, _args?: Record<string, unknown>) => {
  if (cmd === "read_media") {
    // 1x1 PNG
    const png = [
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0,
      1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 28, 21, 196, 3, 0, 0, 0, 10, 73, 68, 65,
      84, 120, 156, 99, 250, 207, 192, 80, 12, 0, 15, 204, 2, 73, 131, 44,
      223, 243, 216, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ];
    return { data: png, mime: "image/png" };
  }
  return {};
});
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: unknown, args: unknown) =>
    invoke(cmd as string, args as Record<string, unknown> | undefined),
}));

import { createEditor } from "./editor";
import {
  cutImage,
  copyImage,
  removeImage,
  copyCanvas,
  cutCanvas,
  deleteCanvas,
  setClipboardNotebook,
} from "./clipboard";

function insertImage(editor: ReturnType<typeof createEditor>, src: string): void {
  editor
    .chain()
    .insertContent({ type: "image", attrs: { src, alt: "pic" } })
    .run();
}

function insertCanvas(editor: ReturnType<typeof createEditor>): void {
  editor.chain().insertCanvas().run();
}

describe("image clipboard", () => {
  beforeEach(() => {
    invoke.mockClear();
    setClipboardNotebook("default");
  });

  it("cut removes the image node after copying", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    insertImage(editor, "../media/cutme.png");
    expect(editor.state.doc.childCount).toBeGreaterThan(0);

    await cutImage(editor, "../media/cutme.png");
    const remaining = editor
      .getJSON()
      .content?.some((n) => n.attrs?.src === "../media/cutme.png");
    expect(remaining).toBeFalsy();
    editor.destroy();
  });

  it("copy leaves the image node in place", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    insertImage(editor, "../media/keepme.png");
    await copyImage(editor, "../media/keepme.png");
    const still = editor
      .getJSON()
      .content?.some((n) => n.attrs?.src === "../media/keepme.png");
    expect(still).toBe(true);
    editor.destroy();
  });

  it("removeImage deletes only the matching image", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    insertImage(editor, "../media/a.png");
    editor.chain().insertContent("some text").run();
    insertImage(editor, "../media/b.png");
    removeImage(editor, "../media/a.png");
    const json = editor.getJSON();
    expect(
      json.content?.some((n) => n.attrs?.src === "../media/a.png"),
    ).toBeFalsy();
    expect(
      json.content?.some((n) => n.attrs?.src === "../media/b.png"),
    ).toBe(true);
    editor.destroy();
  });
});

describe("canvas clipboard", () => {
  beforeEach(() => {
    setClipboardNotebook("default");
  });

  it("cut removes the sketch node", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    insertCanvas(editor);
    expect(
      editor.getJSON().content?.some((n) => n.type === "canvasBlock"),
    ).toBe(true);
    const canvasDom = editor.view.dom.querySelector(
      ".entry-canvas",
    ) as HTMLElement;
    expect(canvasDom).not.toBeNull();
    cutCanvas(editor, canvasDom);
    expect(
      editor.getJSON().content?.some((n) => n.type === "canvasBlock"),
    ).toBeFalsy();
    editor.destroy();
  });

  it("copy keeps the sketch node", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    insertCanvas(editor);
    const canvasDom = editor.view.dom.querySelector(
      ".entry-canvas",
    ) as HTMLElement;
    copyCanvas(editor, canvasDom);
    expect(
      editor.getJSON().content?.some((n) => n.type === "canvasBlock"),
    ).toBe(true);
    editor.destroy();
  });

  it("deleteCanvas removes the sketch node", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    insertCanvas(editor);
    const canvasDom = editor.view.dom.querySelector(
      ".entry-canvas",
    ) as HTMLElement;
    deleteCanvas(editor, canvasDom);
    expect(
      editor.getJSON().content?.some((n) => n.type === "canvasBlock"),
    ).toBeFalsy();
    editor.destroy();
  });

  it("serializes scene and preview so in-app clipboard round-trips", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    editor
      .chain()
      .insertContent({
        type: "canvasBlock",
        attrs: {
          scene: '{"type":"excalidraw","elements":[]}',
          preview: "<svg></svg>",
        },
      })
      .run();
    const html = editor.getHTML();
    expect(html).toContain("data-scene");
    expect(html).toContain("data-preview");
    editor.destroy();
  });
});
