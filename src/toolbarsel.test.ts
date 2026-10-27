// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({})) }));
import { createToolbar } from "./toolbar";
import { createEditor } from "./editor";

describe("toolbar typography dropdowns", () => {
  it("renders per-selection font and size dropdowns with a default option", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    const bar = document.createElement("div");
    document.body.appendChild(bar);
    createToolbar(bar, () => editor);

    const fontSelect = bar.querySelector<HTMLSelectElement>("#font-select");
    const sizeSelect = bar.querySelector<HTMLSelectElement>("#fontsize-select");
    expect(fontSelect).not.toBeNull();
    expect(sizeSelect).not.toBeNull();
    expect(fontSelect!.options.length).toBe(8); // default + 7 fonts
    expect(sizeSelect!.options.length).toBe(5); // default + 4 sizes
    expect(fontSelect!.options[0].textContent).toBe("Default font");

    // applying a font to a selection stores a textStyle mark, not a global
    editor.commands.insertContent("hello");
    editor.chain().setTextSelection({ from: 1, to: 6 }).run();
    fontSelect!.value = "georgia";
    fontSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(editor.isActive("textStyle")).toBe(true);
    expect(editor.getAttributes("textStyle").fontFamily).toContain("Georgia");

    // resetting to default removes the mark
    fontSelect!.value = "default";
    fontSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(editor.getAttributes("textStyle").fontFamily).toBeFalsy();

    sizeSelect!.value = "19";
    sizeSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(editor.getAttributes("textStyle").fontSizePx).toBe(19);
    sizeSelect!.value = "default";
    sizeSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(editor.getAttributes("textStyle").fontSizePx).toBeFalsy();

    editor.destroy();
  });

  it("refresh hides table-only buttons after the editor swaps to a table-less document", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editorA = createEditor(host, "", { onUpdate: () => {} });
    editorA.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
    let current = editorA;
    const bar = document.createElement("div");
    document.body.appendChild(bar);
    const refresh = createToolbar(bar, () => current);
    editorA.chain().focus().setTextSelection(3).run();
    refresh();
    expect(
      bar.querySelector<HTMLButtonElement>('[data-tool="del-table"]')!.hidden,
    ).toBe(false);

    current.destroy();
    const editorB = createEditor(host, "plain text", { onUpdate: () => {} });
    current = editorB;
    refresh();
    for (const id of ["row-above", "row-below", "col-left", "col-right", "del-row", "del-col", "del-table"]) {
      expect(
        bar.querySelector<HTMLButtonElement>(`[data-tool="${id}"]`)!.hidden,
      ).toBe(true);
    }
    editorB.destroy();
  });
});
