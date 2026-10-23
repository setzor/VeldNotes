import { describe, expect, it } from "vitest";
import { tiptapContentFromMarkdown } from "./legacyMarkdown";

describe("legacy markdown import", () => {
  it("returns null for empty or whitespace-only markdown", () => {
    expect(tiptapContentFromMarkdown("")).toBeNull();
    expect(tiptapContentFromMarkdown("   \n\n")).toBeNull();
  });

  it("imports headings, emphasis, lists and links", () => {
    const doc = tiptapContentFromMarkdown(
      "# Title\n\nSome **bold** and *soft* text with a [link](https://example.com).\n\n- a\n- b\n",
    );
    expect(doc).not.toBeNull();
    expect(doc?.type).toBe("doc");
    const types = (doc?.content ?? []).map((n) => n.type);
    expect(types).toContain("heading");
    expect(types).toContain("bulletList");
    const paragraph = doc?.content?.find((n) => n.type === "paragraph");
    const marks = (paragraph?.content ?? []).flatMap((n) =>
      (n.marks ?? []).map((m) => m.type),
    );
    expect(marks).toContain("bold");
    expect(marks).toContain("italic");
    expect(marks).toContain("link");
  });

  it("imports images with their media reference intact", () => {
    const doc = tiptapContentFromMarkdown(
      "![pasted image](../media/abc123.png)",
    );
    const img = doc?.content?.[0]?.content?.find((n) => n.type === "image");
    expect(img?.attrs?.src).toBe("../media/abc123.png");
  });

  it("imports tables as table nodes", () => {
    const doc = tiptapContentFromMarkdown(
      "| a | b |\n| --- | --- |\n| 1 | 2 |\n",
    );
    expect(doc?.content?.[0]?.type).toBe("table");
    expect(doc?.content?.[0]?.content?.[0]?.type).toBe("tableRow");
  });
});
