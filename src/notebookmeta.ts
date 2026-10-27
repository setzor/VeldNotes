import type { NotebookMeta } from "./api";

/** Sync a notebook entry in the in-memory list with fresh backend metadata. */
export function applyNotebookMeta(
  notebooks: NotebookMeta[],
  meta: NotebookMeta,
): NotebookMeta | null {
  const nb = notebooks.find((n) => n.id === meta.id);
  if (!nb) return null;
  nb.name = meta.name;
  nb.cover = meta.cover;
  if (meta.emoji !== undefined) nb.emoji = meta.emoji;
  return nb;
}
