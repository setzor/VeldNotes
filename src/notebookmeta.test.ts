import { describe, expect, it } from "vitest";
import { applyNotebookMeta } from "./notebookmeta";
import type { NotebookMeta } from "./api";

describe("applyNotebookMeta", () => {
  const notebooks: NotebookMeta[] = [
    { id: "a", name: "Alpha", cover: "kraft", emoji: "🌷" },
    { id: "b", name: "Beta", cover: "navy" },
  ];

  it("syncs name, cover and emoji from fresh meta", () => {
    const nb = applyNotebookMeta(notebooks, {
      id: "a",
      name: "Renamed",
      cover: "navy",
      emoji: "🌙",
    });
    expect(nb).toMatchObject({ id: "a", name: "Renamed", cover: "navy", emoji: "🌙" });
    expect(notebooks[0].emoji).toBe("🌙");
  });

  it("clears the emoji when meta reports null", () => {
    applyNotebookMeta(notebooks, { id: "a", name: "Renamed", cover: "navy", emoji: null });
    expect(notebooks[0].emoji).toBeNull();
  });

  it("keeps the existing emoji when meta omits it", () => {
    applyNotebookMeta(notebooks, { id: "b", name: "Beta", cover: "kraft", emoji: "🔥" });
    applyNotebookMeta(notebooks, { id: "b", name: "Beta 2", cover: "kraft" });
    expect(notebooks[1].name).toBe("Beta 2");
    expect(notebooks[1].emoji).toBe("🔥");
  });

  it("returns null for an unknown id", () => {
    expect(applyNotebookMeta(notebooks, { id: "zz", name: "x", cover: "kraft" })).toBeNull();
  });
});
