// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({})) }));
import { installContextMenu, setSidebarActions } from "./contextmenu";

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

describe("sidebar context menu", () => {
  it("shows calendar actions on the calendar, not Copy/Select all", () => {
    setSidebarActions({
      openNotebookSettings: () => {},
      newNotebook: () => {},
      previousMonth: () => {},
      nextMonth: () => {},
      goToday: () => {},
    });
    const cal = document.createElement("nav");
    cal.id = "calendar";
    document.body.appendChild(cal);
    cal.dispatchEvent(contextmenuEvent(cal));
    const menu = document.querySelector("#context-menu") as HTMLElement;
    const labels = Array.from(menu.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toContain("Previous month");
    expect(labels).toContain("Jump to today");
    expect(labels).toContain("New notebook…");
    expect(labels).not.toContain("Copy");
    expect(labels).not.toContain("Select all");
  });

  it("shows notebook settings on the cover", () => {
    const cover = document.createElement("div");
    cover.id = "cover";
    document.body.appendChild(cover);
    cover.dispatchEvent(contextmenuEvent(cover));
    const menu = document.querySelector("#context-menu") as HTMLElement;
    const labels = Array.from(menu.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toContain("Notebook settings…");
    expect(labels).toContain("Switch notebook…");
  });
});

describe("image context menu", () => {
  it("offers Cut image and Copy image over entry images", () => {
    const host = document.createElement("div");
    host.className = "entry-image";
    const img = document.createElement("img");
    img.dataset.pendingSrc = "../media/x.png";
    host.appendChild(img);
    document.body.appendChild(host);
    host.dispatchEvent(contextmenuEvent(host));
    const menu = document.querySelector("#context-menu") as HTMLElement;
    const labels = Array.from(menu.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toContain("Cut image");
    expect(labels).toContain("Copy image");
    // no stray text-URL copy: the actions run through the clipboard module
    expect(labels).not.toContain("Cut");
    expect(labels).not.toContain("Copy");
  });
});

describe("canvas context menu", () => {
  it("offers sketch cut/copy/delete over the canvas block", () => {
    installContextMenu();
    const host = document.createElement("div");
    host.className = "entry-canvas";
    host.setAttribute("data-canvas", "");
    document.body.appendChild(host);
    host.dispatchEvent(contextmenuEvent(host));
    const menu = document.querySelector("#context-menu") as HTMLElement;
    const labels = Array.from(menu.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toContain("Cut sketch");
    expect(labels).toContain("Copy sketch");
    expect(labels).toContain("Delete sketch");
  });
});
