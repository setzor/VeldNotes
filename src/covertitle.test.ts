// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { attachCoverTitleEditing } from "./covertitle";

interface Nb {
  id: string;
  name: string;
}

function setup(notebooks: Nb[], activeId: string) {
  const el = document.createElement("div");
  el.contentEditable = "true";
  document.body.appendChild(el);
  const rename = vi.fn(async (id: string, name: string) => ({ id, name }));
  let active = activeId;
  const reverted: string[] = [];
  const renamed: Array<[string, string]> = [];
  attachCoverTitleEditing(el, {
    getNotebook: (id) => notebooks.find((n) => n.id === id),
    getActiveNotebookId: () => active,
    renameNotebook: rename,
    onRenamed: (id, meta) => renamed.push([id, meta.name]),
    onReverted: (name) => reverted.push(name),
  });
  return {
    el,
    rename,
    renamed,
    reverted,
    setActive: (id: string) => (active = id),
  };
}

function focus(el: HTMLElement): void {
  el.dispatchEvent(new FocusEvent("focus"));
}

function blur(el: HTMLElement): void {
  el.dispatchEvent(new FocusEvent("blur"));
}

describe("cover title editing", () => {
  const notebooks = [
    { id: "a", name: "Alpha" },
    { id: "b", name: "Beta" },
  ];

  it("renames the focused notebook on blur", async () => {
    const h = setup(notebooks, "a");
    focus(h.el);
    h.el.textContent = "New Name";
    blur(h.el);
    await vi.waitFor(() => expect(h.rename).toHaveBeenCalled());
    expect(h.rename).toHaveBeenCalledWith("a", "New Name");
    expect(h.renamed).toEqual([["a", "New Name"]]);
  });

  it("reverts the text when the name is unchanged or empty", () => {
    const h = setup(notebooks, "a");
    focus(h.el);
    h.el.textContent = "";
    blur(h.el);
    expect(h.el.textContent).toBe("Alpha");
    expect(h.rename).not.toHaveBeenCalled();
  });

  it("does not rename a different notebook when the active one changed mid-edit", async () => {
    const h = setup(notebooks, "a");
    focus(h.el);
    h.el.textContent = "Renamed Alpha";
    h.setActive("b");
    blur(h.el);
    await new Promise((r) => setTimeout(r, 20));
    expect(h.rename).not.toHaveBeenCalled();
  });

  it("Escape reverts the edited text to the saved name", () => {
    const h = setup(notebooks, "a");
    focus(h.el);
    h.el.textContent = "Mistake";
    h.el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    expect(h.el.textContent).toBe("Alpha");
    expect(h.rename).not.toHaveBeenCalled();
  });
});
