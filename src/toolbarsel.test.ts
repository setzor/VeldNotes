// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({})) }));
import { createToolbar } from "./toolbar";
import { createEditor } from "./editor";

describe("toolbar typography dropdowns", () => {
  it("renders font and size dropdowns that dispatch change events", () => {
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
    expect(fontSelect!.options.length).toBeGreaterThanOrEqual(7);
    expect(sizeSelect!.options.length).toBe(4);

    const events: string[] = [];
    window.addEventListener("veldnotes:set-font", () => events.push("font"));
    window.addEventListener("veldnotes:set-fontsize", () => events.push("size"));
    fontSelect!.value = "georgia";
    fontSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    sizeSelect!.value = "19";
    sizeSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    expect(events).toEqual(["font", "size"]);
    editor.destroy();
  });
});
