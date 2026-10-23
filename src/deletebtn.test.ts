// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({})) }));
import { createEditor } from "./editor";
import type { JSONContent } from "@tiptap/core";

// mirror of main.ts entryHasContent
function entryHasContent(doc: JSONContent): boolean {
  const blocks = doc.content;
  if (!blocks?.length) return false;
  return blocks.some((block) => {
    if (block.type === "paragraph" || block.type === "heading") {
      return !!block.content?.length || !!block.attrs?.freeformPos;
    }
    return true;
  });
}

describe("delete button visibility", () => {
  it("hides for an empty day", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    expect(entryHasContent(editor.getJSON())).toBe(false);
    editor.destroy();
  });

  it("shows for an image-only day", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    editor
      .chain()
      .insertContent({
        type: "image",
        attrs: { src: "../media/only.png", alt: "pic" },
      })
      .run();
    expect(entryHasContent(editor.getJSON())).toBe(true);
    editor.destroy();
  });

  it("shows for a canvas-only day", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    editor.chain().insertCanvas().run();
    expect(entryHasContent(editor.getJSON())).toBe(true);
    editor.destroy();
  });

  it("shows for a placed empty paragraph", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    editor
      .chain()
      .insertContent({
        type: "paragraph",
        attrs: { freeformPos: "100,150" },
      })
      .run();
    expect(entryHasContent(editor.getJSON())).toBe(true);
    editor.destroy();
  });
});
