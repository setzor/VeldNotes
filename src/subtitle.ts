const COVER_SUB_KEY_PREFIX = "veldnotes.cover.subtitle.";
export const DEFAULT_SUBTITLE = "a cozy daily journal";

export function loadSubtitleFor(notebookId: string | undefined): string {
  if (!notebookId) return DEFAULT_SUBTITLE;
  return localStorage.getItem(COVER_SUB_KEY_PREFIX + notebookId) || DEFAULT_SUBTITLE;
}

export function saveSubtitleFor(notebookId: string, value: string): void {
  localStorage.setItem(COVER_SUB_KEY_PREFIX + notebookId, value);
}
