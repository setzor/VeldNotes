// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, _args: Record<string, unknown>) => {
    if (cmd === "read_media") {
      return { data: Array.from(new Uint8Array([137, 80, 78, 71])), mime: "image/png" };
    }
    return {};
  }),
}));

import { createEditor } from "./editor";
import { reviveSavedContent, tiptapDocToMarkdown } from "./markdown";

describe("editor flow", () => {
  it("boot empty, type, switch day, come back", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let saved: string[] = [];
    let editor = createEditor(host, "", {
      onUpdate: (md) => saved.push(md),
    });
    editor.commands.insertContent("Today was a day");
    const stored = saved[saved.length - 1] ?? tiptapDocToMarkdown(editor.getJSON());
    expect(stored).toBe("Today was a day\n");

    editor.destroy();
    const editor2 = createEditor(host, stored, {
      onUpdate: () => {},
    });
    expect(editor2.getText()).toBe("Today was a day");
  });

  it("revives entries saved as raw JSON by the old build", () => {
    const corrupted =
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Today was a day"}]}]}';
    const revived = reviveSavedContent(corrupted);
    expect(revived).not.toBe(corrupted);
    const host = document.createElement("div");
    const editor = createEditor(host, corrupted, { onUpdate: () => {} });
    expect(editor.getText()).toBe("Today was a day");
  });

  it("treats regular markdown as markdown, never as HTML/JSON text", () => {
    const md = "# Hello\n\nSome **bold** text.\n";
    const revived = reviveSavedContent(md);
    expect(revived).toBe(md);
    const host = document.createElement("div");
    const editor = createEditor(host, md, { onUpdate: () => {} });
    expect(editor.getText()).toContain("Hello");
    expect(editor.getText()).toContain("bold");
    expect(editor.getHTML()).toContain("<h1>");
  });
});

describe("image rendering", () => {
  it("resolves media to a data URL for display", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(
      host,
      "Before\n\n![pasted image](../media/abc123.png)\n\nAfter\n",
      { onUpdate: () => {} },
    );
    await new Promise((r) => setTimeout(r, 30));
    const imgs = Array.from(host.querySelectorAll("img"));
    const real = imgs.find((i) => i.dataset.pendingSrc);
    expect(real).toBeDefined();
    await vi.waitFor(() => {
      expect(real!.src.startsWith("data:image/png;base64,")).toBe(true);
    });
    editor.destroy();
  });
});
