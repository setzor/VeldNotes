// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({})) }));
import { createEditor } from "./editor";
import { EDITOR_FONTS } from "./fonts";

describe("typography in lists", () => {
  it("setFontFamily applies to list items", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    editor.commands.insertContent("list text");
    editor.chain().toggleOrderedList().run();
    editor.chain().selectAll().setFontFamily(EDITOR_FONTS[0].id).run();
    expect(editor.getHTML()).toContain("font-family");
    editor.destroy();
  });

  it("setFontFamily persists through save/load round-trip in a list", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    editor.commands.insertContent("list text");
    editor.chain().toggleOrderedList().run();
    editor.chain().selectAll().setFontFamily(EDITOR_FONTS[0].id).run();
    const saved = JSON.stringify(editor.getJSON());
    editor.destroy();

    const host2 = document.createElement("div");
    document.body.appendChild(host2);
    const editor2 = createEditor(host2, saved, { onUpdate: () => {} });
    expect(editor2.getHTML()).toContain("font-family");
    editor2.destroy();
  });

  it("unsetFontFamily removes font inside a list", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    editor.commands.insertContent("list text");
    editor.chain().toggleOrderedList().run();
    editor.chain().selectAll().setFontFamily(EDITOR_FONTS[0].id).run();
    editor.chain().selectAll().unsetFontFamily().run();
    expect(editor.getHTML()).not.toContain("font-family");
    editor.destroy();
  });

  it("setFontSizePx applies to list items", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    editor.commands.insertContent("list text");
    editor.chain().toggleOrderedList().run();
    editor.chain().selectAll().setFontSizePx(20).run();
    expect(editor.getHTML()).toContain("font-size: 20px");
    editor.destroy();
  });

  it("changing font family twice keeps only the last one", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    editor.commands.insertContent("list text");
    editor.chain().toggleOrderedList().run();
    editor.chain().selectAll().setFontFamily(EDITOR_FONTS[0].id).run();
    editor.chain().selectAll().setFontFamily(EDITOR_FONTS[1].id).run();
    expect(editor.getHTML()).not.toContain(EDITOR_FONTS[0].id === "serif" ? "Iowan" : "Iowan");
    expect(editor.getHTML()).toContain("font-family");
    const html = editor.getHTML();
    expect(html.match(/font-family/g)?.length).toBe(1);
    editor.destroy();
  });
});
