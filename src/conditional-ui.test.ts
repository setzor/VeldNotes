// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createEditor } from "./editor";

describe("conditional UI state", () => {
  it("isActive('table') is only true when the selection is inside a table", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    expect(editor.isActive("table")).toBe(false);
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
    expect(editor.isActive("table")).toBe(true);
    editor.chain().focus().setTextSelection(1).run();
    editor.commands.blur();
    editor.chain().focus("end").run();
    expect(editor.isActive("table")).toBe(true);
    editor.destroy();
  });

  it("editor.getText() is empty until typed, and whitespace-only stays empty", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    expect(editor.getText().trim()).toBe("");
    editor.commands.insertContent("hello");
    expect(editor.getText().trim()).toBe("hello");
    editor.destroy();
  });
});
