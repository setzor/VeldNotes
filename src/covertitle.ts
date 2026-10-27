export interface CoverTitleEditingOptions {
  getNotebook: (id: string | null) => { id: string; name: string } | undefined;
  getActiveNotebookId: () => string;
  renameNotebook: (id: string, name: string) => Promise<{ name: string }>;
  onRenamed: (id: string, meta: { name: string }) => void;
  onReverted: (name: string) => void;
}

export function attachCoverTitleEditing(
  el: HTMLElement,
  options: CoverTitleEditingOptions,
): void {
  let editNotebookId: string | null = null;

  const commit = (): void => {
    const id = editNotebookId;
    editNotebookId = null;
    const nb = options.getNotebook(id);
    if (!nb) return;
    const newName = (el.textContent ?? "").trim();
    if (newName && newName !== nb.name) {
      if (id !== options.getActiveNotebookId()) return;
      void options.renameNotebook(id, newName).then((meta) => {
        options.onRenamed(id, meta);
      });
    } else {
      el.textContent = nb.name;
      options.onReverted(nb.name);
    }
  };

  el.addEventListener("focus", () => {
    editNotebookId = options.getActiveNotebookId();
  });

  el.addEventListener("blur", commit);

  el.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      const nb = options.getNotebook(editNotebookId);
      if (nb) el.textContent = nb.name;
      editNotebookId = null;
      el.blur();
    }
  });
}
