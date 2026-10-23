// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  EDITOR_FONTS,
  fontStack,
  loadEditorFont,
  saveEditorFont,
} from "./fonts";

describe("editor fonts", () => {
  it("offers a curated list with unique ids", () => {
    const ids = EDITOR_FONTS.map((f) => f.id);
    expect(new Set(ids).size).toBe(EDITOR_FONTS.length);
    expect(EDITOR_FONTS[0].id).toBe("journal");
  });

  it("persists per notebook and defaults to journal", () => {
    expect(loadEditorFont("nb-x")).toBe("journal");
    saveEditorFont("nb-x", "georgia");
    expect(loadEditorFont("nb-x")).toBe("georgia");
    expect(loadEditorFont("nb-other")).toBe("journal");
    saveEditorFont("nb-x", "journal");
  });

  it("resolves stacks and falls back safely", () => {
    expect(fontStack("mono")).toContain("monospace");
    expect(fontStack("bogus")).toBe(EDITOR_FONTS[0].stack);
  });
});
