import { describe, expect, it } from "vitest";
import { markdownToHtml, markdownToTiptapContent, tiptapDocToMarkdown } from "./markdown";

describe("markdownToHtml", () => {
  it("renders headings, bold, italic, lists, quotes, code", () => {
    const md = [
      "# Title",
      "",
      "Some **bold** and *italic* text.",
      "",
      "- one",
      "- two",
      "",
      "> a quiet quote",
      "",
      "`inline code`",
    ].join("\n");
    const html = markdownToHtml(md);
    expect(html).toContain("<h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<code>inline code</code>");
  });

  it("renders images with relative media paths", () => {
    const html = markdownToHtml("![pasted image](../media/abc.png)");
    expect(html).toContain('src="../media/abc.png"');
  });
});

describe("markdown round-trip", () => {
  it("parses markdown into a doc and serializes back", () => {
    const md = "# Hello\n\nSome **bold** text and a list:\n\n- a\n- b\n";
    const content = markdownToTiptapContent(md);
    expect(content).not.toBe(md);
    const doc = JSON.parse(content);
    expect(doc.type).toBe("doc");
    const out = tiptapDocToMarkdown(doc);
    expect(out).toContain("# Hello");
    expect(out).toContain("**bold**");
    expect(out).toContain("- a");
    expect(out).toContain("- b");
  });

  it("round-trips an image node as a relative media reference", () => {
    const md = "![pasted image](../media/deadbeef.png)\n";
    const doc = JSON.parse(markdownToTiptapContent(md));
    const out = tiptapDocToMarkdown(doc);
    expect(out).toContain("![pasted image](../media/deadbeef.png)");
  });

  it("round-trips blockquotes and code blocks", () => {
    const md = "> wise words\n\n```\nlet x = 1;\n```\n";
    const doc = JSON.parse(markdownToTiptapContent(md));
    const out = tiptapDocToMarkdown(doc);
    expect(out).toContain("> wise words");
    expect(out).toContain("```");
    expect(out).toContain("let x = 1;");
  });

  it("empty markdown yields empty doc and empty output", () => {
    expect(markdownToTiptapContent("")).toBe("");
    expect(tiptapDocToMarkdown({ type: "doc", content: [{ type: "paragraph" }] })).toBe("\n");
  });
});
