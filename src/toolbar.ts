import type { Editor } from "@tiptap/core";
import { saveMedia } from "./api";
import { setPasteNotebook } from "./paste";

let activeNotebook = "default";

export function setToolbarNotebook(notebook: string): void {
  activeNotebook = notebook;
  setPasteNotebook(notebook);
}

interface ToolButton {
  id: string;
  label: string;
  title: string;
  run: (editor: Editor) => void;
  active?: (editor: Editor) => boolean;
}

const BUTTONS: ToolButton[] = [
  {
    id: "bold",
    label: "B",
    title: "Bold (Ctrl+B)",
    run: (e) => e.chain().focus().toggleBold().run(),
    active: (e) => e.isActive("bold"),
  },
  {
    id: "italic",
    label: "I",
    title: "Italic (Ctrl+I)",
    run: (e) => e.chain().focus().toggleItalic().run(),
    active: (e) => e.isActive("italic"),
  },
  {
    id: "strike",
    label: "S",
    title: "Strikethrough",
    run: (e) => e.chain().focus().toggleStrike().run(),
    active: (e) => e.isActive("strike"),
  },
  {
    id: "code",
    label: "</>",
    title: "Inline code",
    run: (e) => e.chain().focus().toggleCode().run(),
    active: (e) => e.isActive("code"),
  },
  {
    id: "h1",
    label: "H1",
    title: "Heading 1",
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    active: (e) => e.isActive("heading", { level: 1 }),
  },
  {
    id: "h2",
    label: "H2",
    title: "Heading 2",
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    active: (e) => e.isActive("heading", { level: 2 }),
  },
  {
    id: "h3",
    label: "H3",
    title: "Heading 3",
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    active: (e) => e.isActive("heading", { level: 3 }),
  },
  {
    id: "bullet",
    label: "•",
    title: "Bullet list",
    run: (e) => e.chain().focus().toggleBulletList().run(),
    active: (e) => e.isActive("bulletList"),
  },
  {
    id: "numbered",
    label: "1.",
    title: "Numbered list",
    run: (e) => e.chain().focus().toggleOrderedList().run(),
    active: (e) => e.isActive("orderedList"),
  },
  {
    id: "quote",
    label: "❝",
    title: "Quote",
    run: (e) => e.chain().focus().toggleBlockquote().run(),
    active: (e) => e.isActive("blockquote"),
  },
  {
    id: "codeblock",
    label: "{}",
    title: "Code block",
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
    active: (e) => e.isActive("codeBlock"),
  },
  {
    id: "hr",
    label: "―",
    title: "Divider",
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "image",
    label: "🖼",
    title: "Insert image",
    run: (e) => void insertImageFromFile(e),
  },
  {
    id: "table",
    label: "▦",
    title: "Insert table (2x2)",
    run: (e) =>
      e
        .chain()
        .focus()
        .insertTable({ rows: 2, cols: 2, withHeaderRow: true })
        .run(),
  },
];

async function insertImageFromFile(editor: Editor): Promise<void> {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/gif,image/webp,image/bmp,image/svg+xml";
  input.style.display = "none";
  document.body.appendChild(input);
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) void insertFile(editor, file);
    input.remove();
  });
  input.click();
}

async function insertFile(editor: Editor, file: File): Promise<void> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const ext = file.type.split("/")[1] ?? null;
    const { markdown } = await saveMedia(activeNotebook, bytes, ext);
    const match = markdown.match(/\]\(([^)]+)\)/);
    const src = match ? match[1] : "";
    editor
      .chain()
      .focus()
      .insertContent({ type: "image", attrs: { src, alt: "image" } })
      .run();
  } catch (err) {
    console.error("image insert failed", err);
  }
}

export function createToolbar(
  container: HTMLElement,
  getEditor: () => Editor | null,
): void {
  container.textContent = "";
  for (const btn of BUTTONS) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "tool-btn";
    el.dataset.tool = btn.id;
    el.title = btn.title;
    el.textContent = btn.label;
    el.addEventListener("mousedown", (event) => event.preventDefault());
    el.addEventListener("click", () => {
      const editor = getEditor();
      if (editor) btn.run(editor);
    });
    container.appendChild(el);
  }

  const update = (): void => {
    const editor = getEditor();
    for (const el of Array.from(
      container.querySelectorAll<HTMLButtonElement>(".tool-btn"),
    )) {
      const btn = BUTTONS.find((b) => b.id === el.dataset.tool);
      if (!btn?.active || !editor) continue;
      el.classList.toggle("active", btn.active(editor));
    }
  };
  document.addEventListener("selectionchange", update);
  window.setTimeout(update, 0);
}

