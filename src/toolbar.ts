import type { Editor } from "@tiptap/core";
import { saveMedia } from "./api";
import { frostedPrompt } from "./prompt";
import { setPasteNotebook } from "./paste";
import { EDITOR_FONTS } from "./fonts";
import { FONTSIZE_CHOICES } from "./settings";

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
  inTableOnly?: boolean;
  separator?: boolean;
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
    id: "underline",
    label: "U",
    title: "Underline (Ctrl+U)",
    run: (e) => e.chain().focus().toggleUnderline().run(),
    active: (e) => e.isActive("underline"),
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
    id: "highlight",
    label: "\u{1F58D}",
    title: "Highlight",
    run: (e) => e.chain().focus().toggleHighlight().run(),
    active: (e) => e.isActive("highlight"),
    separator: true,
  },
  {
    id: "h1",
    label: "H1",
    title: "Heading 1",
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    active: (e) => e.isActive("heading", { level: 1 }),
    separator: true,
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
    label: "\u2022",
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
    label: "\u275d",
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
    label: "\u2015",
    title: "Divider",
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "align-left",
    label: "\u21e4",
    title: "Align left",
    run: (e) => e.chain().focus().setTextAlign("left").run(),
    active: (e) => e.isActive({ textAlign: "left" }),
    separator: true,
  },
  {
    id: "align-center",
    label: "\u2194",
    title: "Align center",
    run: (e) => e.chain().focus().setTextAlign("center").run(),
    active: (e) => e.isActive({ textAlign: "center" }),
  },
  {
    id: "align-right",
    label: "\u21a6",
    title: "Align right",
    run: (e) => e.chain().focus().setTextAlign("right").run(),
    active: (e) => e.isActive({ textAlign: "right" }),
  },
  {
    id: "link",
    label: "\u{1F517}",
    title: "Add link",
    run: (e) => {
      void (async () => {
        const previous = e.getAttributes("link").href as string | undefined;
        const href = await frostedPrompt("Link URL", previous ?? "https://");
        if (href === null) return;
        if (href === "") {
          e.chain().focus().extendMarkRange("link").unsetLink().run();
          return;
        }
        e
          .chain()
          .focus()
          .extendMarkRange("link")
          .setLink({ href })
          .run();
      })();
    },
    active: (e) => e.isActive("link"),
    separator: true,
  },
  {
    id: "image",
    label: "\ud83d\uddbc",
    title: "Insert image",
    run: (e) => void insertImageFromFile(e),
  },
  {
    id: "canvas",
    label: "\u{1F3A8}",
    title: "Insert canvas sketch",
    run: (e) => e.chain().focus().insertCanvas().run(),
    separator: true,
  },
  {
    id: "table",
    label: "\u25a6",
    title: "Insert table (2x2)",
    run: (e) =>
      e
        .chain()
        .focus()
        .insertTable({ rows: 2, cols: 2, withHeaderRow: true })
        .run(),
  },
  {
    id: "row-above",
    label: "\u21d1\u2261",
    title: "Add row above",
    inTableOnly: true,
    run: (e) => e.chain().focus().addRowBefore().run(),
  },
  {
    id: "row-below",
    label: "\u21d3\u2261",
    title: "Add row below",
    inTableOnly: true,
    run: (e) => e.chain().focus().addRowAfter().run(),
  },
  {
    id: "col-left",
    label: "\u2261\u21d0",
    title: "Add column left",
    inTableOnly: true,
    run: (e) => e.chain().focus().addColumnBefore().run(),
  },
  {
    id: "col-right",
    label: "\u2261\u21d2",
    title: "Add column right",
    inTableOnly: true,
    run: (e) => e.chain().focus().addColumnAfter().run(),
  },
  {
    id: "del-row",
    label: "\u2261\u00d7",
    title: "Delete row",
    inTableOnly: true,
    run: (e) => e.chain().focus().deleteRow().run(),
  },
  {
    id: "del-col",
    label: "\u00d7\u2261",
    title: "Delete column",
    inTableOnly: true,
    run: (e) => e.chain().focus().deleteColumn().run(),
  },
  {
    id: "del-table",
    label: "\u00d7\u25a6",
    title: "Delete table",
    inTableOnly: true,
    run: (e) => e.chain().focus().deleteTable().run(),
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
    const { reference } = await saveMedia(activeNotebook, bytes, ext);
    editor
      .chain()
      .focus()
      .insertContent({ type: "image", attrs: { src: reference, alt: "image" } })
      .run();
  } catch (err) {
    console.error("image insert failed", err);
  }
}

export function createToolbar(
  container: HTMLElement,
  getEditor: () => Editor | null,
): () => void {
  container.textContent = "";
  for (const btn of BUTTONS) {
    if (btn.separator) {
      const sep = document.createElement("span");
      sep.className = "tool-sep";
      container.appendChild(sep);
    }
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

  const fontSelect = document.createElement("select");
  fontSelect.id = "font-select";
  fontSelect.title = "Font (selected text)";
  {
    const opt = document.createElement("option");
    opt.value = "default";
    opt.textContent = "Default font";
    fontSelect.appendChild(opt);
    for (const font of EDITOR_FONTS) {
      const o = document.createElement("option");
      o.value = font.id;
      o.textContent = font.label;
      fontSelect.appendChild(o);
    }
  }
  fontSelect.addEventListener("mousedown", (event) => event.stopPropagation());
  fontSelect.addEventListener("change", () => {
    const editor = getEditor();
    if (!editor) return;
    if (fontSelect.value === "default") {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(fontSelect.value).run();
    }
    update();
  });
  container.appendChild(fontSelect);

  const sizeSelect = document.createElement("select");
  sizeSelect.id = "fontsize-select";
  sizeSelect.title = "Text size (selected text)";
  {
    const opt = document.createElement("option");
    opt.value = "default";
    opt.textContent = "Default size";
    sizeSelect.appendChild(opt);
    for (const choice of FONTSIZE_CHOICES) {
      const o = document.createElement("option");
      o.value = String(choice.value);
      o.textContent = choice.label;
      sizeSelect.appendChild(o);
    }
  }
  sizeSelect.addEventListener("mousedown", (event) => event.stopPropagation());
  sizeSelect.addEventListener("change", () => {
    const editor = getEditor();
    if (!editor) return;
    if (sizeSelect.value === "default") {
      editor.chain().focus().unsetFontSizePx().run();
    } else {
      editor.chain().focus().setFontSizePx(Number(sizeSelect.value)).run();
    }
    update();
  });
  container.appendChild(sizeSelect);

  const update = (): void => {
    const editor = getEditor();
    watchToolbarEditor(editor, update);
    const inTable = editor ? editor.isActive("table") : false;

    if (editor) {
      const family = editor.getAttributes("textStyle").fontFamily as
        | string
        | undefined;
      const activeFont = EDITOR_FONTS.find(
        (f) =>
          family && f.stack.replace(/\"/g, "'") === family,
      );
      fontSelect.value = activeFont?.id ?? "default";
      const sizePx = editor.getAttributes("textStyle").fontSizePx as
        | number
        | undefined;
      sizeSelect.value =
        sizePx && FONTSIZE_CHOICES.some((c) => c.value === sizePx)
          ? String(sizePx)
          : "default";
    } else {
      fontSelect.value = "default";
      sizeSelect.value = "default";
    }

    for (const el of Array.from(
      container.querySelectorAll<HTMLButtonElement>(".tool-btn"),
    )) {
      const btn = BUTTONS.find((b) => b.id === el.dataset.tool);
      if (!btn) continue;
      if (btn.inTableOnly) {
        el.hidden = !inTable;
        continue;
      }
      if (btn.active && editor) {
        el.classList.toggle("active", btn.active(editor));
      }
    }
  };
  document.addEventListener("selectionchange", update);
  update();
  return update;
}

const toolbarWatchers = new WeakMap<Editor, boolean>();

function watchToolbarEditor(
  editor: Editor | null,
  update: () => void,
): void {
  if (!editor || toolbarWatchers.has(editor)) return;
  toolbarWatchers.set(editor, true);
  editor.on("transaction", () => update());
}
