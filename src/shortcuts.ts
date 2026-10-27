export interface ShortcutGuardOptions {
  isPopoverOpen: () => boolean;
  isDialogOpen: () => boolean;
}

export function shouldSkipShortcut(
  event: KeyboardEvent,
  options: ShortcutGuardOptions,
): boolean {
  if (options.isPopoverOpen() || options.isDialogOpen()) return true;
  const target = event.target;
  if (target instanceof HTMLElement) {
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (target.isContentEditable || target.getAttribute("contenteditable") === "true") {
      return true;
    }
    if (
      (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
      tag === "BUTTON"
    ) {
      return true;
    }
  }
  return false;
}
