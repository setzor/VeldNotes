export interface EditorFont {
  id: string;
  label: string;
  stack: string;
}

/** Curated editor fonts — system/webview font stacks, no downloads. */
export const EDITOR_FONTS: EditorFont[] = [
  {
    id: "journal",
    label: "Journal (default)",
    stack: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
  },
  {
    id: "georgia",
    label: "Georgia",
    stack: 'Georgia, "Times New Roman", serif',
  },
  {
    id: "garamond",
    label: "Garamond",
    stack: '"EB Garamond", Garamond, "Apple Garamond", "Palatino Linotype", serif',
  },
  {
    id: "didone",
    label: "Didone",
    stack: '"Didot", "Bodoni MT", "Playfair Display", "Times New Roman", serif',
  },
  {
    id: "sans",
    label: "Clean Sans",
    stack: '"Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif',
  },
  {
    id: "grotesque",
    label: "Grotesque",
    stack: '"Helvetica Neue", Helvetica, Arial, "Segoe UI", sans-serif',
  },
  {
    id: "mono",
    label: "Monospace",
    stack: '"Cascadia Mono", "SF Mono", Consolas, "DejaVu Sans Mono", monospace',
  },
];

const STORAGE_PREFIX = "veldnotes.editor.font.";

export function loadEditorFont(notebookId: string): string {
  const stored = localStorage.getItem(STORAGE_PREFIX + notebookId);
  return EDITOR_FONTS.some((f) => f.id === stored) ? (stored as string) : "journal";
}

export function saveEditorFont(notebookId: string, fontId: string): void {
  localStorage.setItem(STORAGE_PREFIX + notebookId, fontId);
}

export function fontStack(fontId: string): string {
  return EDITOR_FONTS.find((f) => f.id === fontId)?.stack ?? EDITOR_FONTS[0].stack;
}

/** Apply the editor font for a notebook to the editor root element. */
export function applyEditorFont(notebookId: string): void {
  document.documentElement.style.setProperty(
    "--editor-font",
    fontStack(loadEditorFont(notebookId)),
  );
}
