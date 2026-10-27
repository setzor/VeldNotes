// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { shouldSkipShortcut } from "./shortcuts";

const closed = { isPopoverOpen: () => false, isDialogOpen: () => false };

function keyEvent(key: string, target?: HTMLElement): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true });
  if (target) {
    Object.defineProperty(event, "target", { value: target });
  }
  return event;
}

describe("shouldSkipShortcut", () => {
  it("allows plain shortcuts when nothing is open and body has focus", () => {
    expect(shouldSkipShortcut(keyEvent("t"), closed)).toBe(false);
    expect(shouldSkipShortcut(keyEvent("ArrowLeft"), closed)).toBe(false);
  });

  it("skips when the shelf popover or a dialog is open", () => {
    const event = keyEvent("t");
    expect(
      shouldSkipShortcut(event, { ...closed, isPopoverOpen: () => true }),
    ).toBe(true);
    expect(
      shouldSkipShortcut(event, { ...closed, isDialogOpen: () => true }),
    ).toBe(true);
  });

  it("skips text entry contexts: input, textarea, select, contenteditable", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.appendChild(editable);
    for (const el of [input, textarea, select, editable]) {
      expect(shouldSkipShortcut(keyEvent("t", el), closed)).toBe(true);
      expect(shouldSkipShortcut(keyEvent("ArrowLeft", el), closed)).toBe(true);
    }
  });

  it("keeps arrow keys on buttons for focus movement but allows 't'", () => {
    const button = document.createElement("button");
    expect(shouldSkipShortcut(keyEvent("ArrowLeft", button), closed)).toBe(true);
    expect(shouldSkipShortcut(keyEvent("ArrowRight", button), closed)).toBe(true);
    expect(shouldSkipShortcut(keyEvent("t", button), closed)).toBe(false);
  });
});
