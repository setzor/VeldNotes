// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({})) }));
import { installContextMenu } from "./contextmenu";

function contextmenuEvent(_target: HTMLElement): MouseEvent {
  return new MouseEvent("contextmenu", { bubbles: true, clientX: 100, clientY: 100 });
}

describe("custom context menu", () => {
  it("opens a frosted menu with entries, closes on outside mousedown and Escape", () => {
    installContextMenu();
    const p = document.createElement("p");
    p.textContent = "hello world";
    document.body.appendChild(p);
    p.dispatchEvent(contextmenuEvent(p));
    const menu = document.querySelector("#context-menu") as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.hidden).toBe(false);
    const items = Array.from(menu.querySelectorAll("button"));
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].textContent).toBe("Copy");

    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(menu.hidden).toBe(true);

    // reopen then Escape
    p.dispatchEvent(contextmenuEvent(p));
    expect(menu.hidden).toBe(false);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(menu.hidden).toBe(true);
  });

  it("offers paste actions inside the editor", () => {
    installContextMenu();
    const ed = document.createElement("div");
    ed.className = "entry-editor";
    document.body.appendChild(ed);
    ed.dispatchEvent(contextmenuEvent(ed));
    const menu = document.querySelector("#context-menu") as HTMLElement;
    const labels = Array.from(menu.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toContain("Cut");
    expect(labels).toContain("Paste");
    expect(labels).toContain("Bold");
  });
});
