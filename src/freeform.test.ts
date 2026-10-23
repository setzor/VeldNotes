// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({})) }));
import { createEditor } from "./editor";
import { parsePos, placeNewBlock } from "./freeform";

describe("freeform sheet", () => {
  it("parses positions", () => {
    expect(parsePos("120,80")).toEqual({ x: 120, y: 80 });
    expect(parsePos("0,0")).toEqual({ x: 0, y: 0 });
    expect(parsePos(null)).toBeNull();
    expect(parsePos("garbage")).toBeNull();
  });

  it("places a new block at a clicked position and focuses it", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    const view = editor.view;
    placeNewBlock(view, 240, 130);
    const doc = editor.getJSON();
    const placed = doc.content?.find(
      (n) => n.attrs?.freeformPos === "240,130",
    );
    expect(placed).toBeDefined();
    expect(placed?.type).toBe("paragraph");
    expect(view.hasFocus()).toBe(true);
    editor.destroy();
  });

  it("renders placed blocks absolutely positioned", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    const view = editor.view;
    placeNewBlock(view, 60, 40);
    const doc = view.state.doc;
    let placedOffset = 0;
    doc.forEach((node, offset) => {
      if (node.attrs.freeformPos === "60,40") placedOffset = offset;
    });
    const dom = view.nodeDOM(placedOffset) as HTMLElement | null;
    expect(dom).not.toBeNull();
    expect(dom!.style.position).toBe("absolute");
    expect(dom!.style.left).toBe("60px");
    expect(dom!.style.top).toBe("40px");
    editor.destroy();
  });

  it("round-trips placed positions through a saved document", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    placeNewBlock(editor.view, 100, 200);
    const saved = JSON.stringify(editor.getJSON());
    editor.destroy();

    const host2 = document.createElement("div");
    document.body.appendChild(host2);
    const editor2 = createEditor(host2, saved, { onUpdate: () => {} });
    const found = editor2.getJSON().content?.find(
      (n) => n.attrs?.freeformPos === "100,200",
    );
    expect(found).toBeDefined();
    editor2.destroy();
  });
});

describe("image alignment", () => {
  it("applies text alignment to image blocks", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    editor
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: { src: "../media/abc.png", alt: "pic" },
      })
      .setTextAlign("center")
      .run();
    const ok = true;
    expect(ok).toBe(true);
    const image = editor.getJSON().content?.find((n) => n.type === "image");
    expect(image?.attrs?.textAlign).toBe("center");
    editor.destroy();
  });
});

describe("sheet growth", () => {
  it("pads the sheet height only when blocks are placed low", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    const view = editor.view;
    placeNewBlock(view, 100, 2000);
    const sheet = view.dom as HTMLElement;
    const set = sheet.style.getPropertyValue("--sheet-min-height");
    expect(set).toContain("px");
    editor.destroy();
  });

  it("keeps the natural height for empty pages", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    const sheet = editor.view.dom as HTMLElement;
    editor.commands.insertContent("just text");
    expect(sheet.style.getPropertyValue("--sheet-min-height")).toBe("");
    editor.destroy();
  });
});
