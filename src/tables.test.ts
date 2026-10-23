// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createEditor } from "./editor";

describe("table structure commands", () => {
  it("grows a table via addRowAfter / addColumnAfter", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
    expect(editor.isActive("table")).toBe(true);
    editor.chain().focus().addRowAfter().run();
    editor.chain().focus().addColumnAfter().run();
    const doc = editor.getJSON();
    const table = doc.content?.[0];
    expect(table?.content?.length).toBe(3);
    expect(table?.content?.[0]?.content?.length).toBe(3);
    editor.chain().focus().deleteRow().run();
    editor.chain().focus().deleteColumn().run();
    const doc2 = editor.getJSON();
    expect(doc2.content?.[0]?.content?.length).toBe(2);
    expect(doc2.content?.[0]?.content?.[0]?.content?.length).toBe(2);
    editor.destroy();
  });

  it("round-trips tables through a saved JSON document", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
    const saved = JSON.stringify(editor.getJSON());
    editor.destroy();
    const editor2 = createEditor(host, saved, { onUpdate: () => {} });
    expect(editor2.isActive("table")).toBe(true);
    expect(editor2.getHTML()).toContain("<table");
    editor2.destroy();
  });
});
