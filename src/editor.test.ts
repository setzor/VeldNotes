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

describe("editor flow", () => {
  it("boot empty, type, switch day, come back", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let saved: string[] = [];
    let editor = createEditor(host, "", {
      onUpdate: (docJson) => saved.push(docJson),
    });
    editor.commands.insertContent("Today was a day");
    const stored = saved[saved.length - 1] ?? JSON.stringify(editor.getJSON());
    const doc = JSON.parse(stored) as { type: string };
    expect(doc.type).toBe("doc");

    editor.destroy();
    const editor2 = createEditor(host, stored, {
      onUpdate: () => {},
    });
    expect(editor2.getText()).toBe("Today was a day");
    editor2.destroy();
  });

  it("keeps expressive formatting through a save/load round-trip", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    editor.commands.insertContent("colorful words");
    editor.chain().setTextSelection({ from: 1, to: 9 }).run();
    editor.chain().toggleHighlight().run();
    editor.chain().toggleUnderline().run();
    const saved = JSON.stringify(editor.getJSON());
    editor.destroy();

    const editor2 = createEditor(host, saved, { onUpdate: () => {} });
    expect(editor2.getHTML()).toContain("<mark");
    expect(editor2.getHTML()).toContain("<u");
    expect(editor2.isActive("highlight", { from: 1, to: 9 })).toBe(false);
    editor2.chain().setTextSelection({ from: 1, to: 9 }).run();
    expect(editor2.isActive("highlight")).toBe(true);
    expect(editor2.isActive("underline")).toBe(true);
    editor2.destroy();
  });

  it("keeps text alignment through a save/load round-trip", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    editor.commands.insertContent("centered");
    editor.chain().setTextAlign("center").run();
    const saved = JSON.stringify(editor.getJSON());
    editor.destroy();

    const editor2 = createEditor(host, saved, { onUpdate: () => {} });
    expect(editor2.getHTML()).toContain("text-align: center");
    editor2.destroy();
  });

  it("revives entries saved as raw JSON by the old build", () => {
    const corrupted =
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Today was a day"}]}]}';
    const host = document.createElement("div");
    const editor = createEditor(host, corrupted, { onUpdate: () => {} });
    expect(editor.getText()).toBe("Today was a day");
    editor.destroy();
  });

  it("imports legacy markdown entries", () => {
    const md = "# Hello\n\nSome **bold** text.\n";
    const host = document.createElement("div");
    const editor = createEditor(host, md, { onUpdate: () => {} });
    expect(editor.getText()).toContain("Hello");
    expect(editor.getText()).toContain("bold");
    expect(editor.getHTML()).toContain("<h1>");
    expect(editor.getHTML()).toContain("<strong>");
    editor.destroy();
  });
});

describe("image rendering", () => {
  it("resolves media to a data URL for display", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(
      host,
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"image","attrs":{"src":"../media/abc123.png","alt":"pasted image"}}]}]}',
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

describe("image resize commit", () => {
  it("merges the resize width with the node's current attrs", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    editor.commands.setImage({ src: "pic.png", alt: "pic" });
    const before = editor.getJSON();
    const imgNode = before.content?.[0];
    expect(imgNode?.type).toBe("image");

    const el = host.querySelector<HTMLElement>(".entry-image .img-resize-handle.corner");
    expect(el).not.toBeNull();
    const img = host.querySelector<HTMLImageElement>(".entry-image img")!;
    Object.defineProperty(img, "getBoundingClientRect", {
      value: () => ({ width: 250, height: 100 } as DOMRect),
    });

    el!.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 160 }));
    document.dispatchEvent(new MouseEvent("mouseup"));

    const after = editor.getJSON();
    const saved = after.content?.[0];
    expect(saved?.type).toBe("image");
    expect(saved?.attrs?.width).toBe(250);
    expect(saved?.attrs?.alt).toBe("pic");
    expect(saved?.attrs?.src).toBe("pic.png");
    editor.destroy();
  });
});
