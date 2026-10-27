import "./styles.css";
import { Editor } from "@tiptap/core";
import {
  createNotebook,
  deleteEntry,
  getEntry,
  listEntries,
  listNotebooks,
  renameNotebook,
  saveEntry,
  todayDate,
  type NotebookMeta,
} from "./api";
import { Autosave, SaveStatus } from "./autosave";
import { createEditor } from "./editor";
import {
  addMonths,
  calendarGrid,
  formatLong,
  isValidDateString,
  monthKey,
  monthLabel,
  localeFirstWeekday,
  shiftDate,
  weekdayLabels,
} from "./dates";
import {
  applyTheme,
  loadMode,
  loadThemeId,
  Mode,
  ThemeId,
  watchSystemMode,
} from "./theme";
import {
  coverColors,
  COVER_EMOJIS,
  fetchNotebooks,
  loadLastNotebook,
  renderCoverChoices,
  renderShelf,
  saveLastNotebook,
} from "./shelf";
import { createToolbar, setToolbarNotebook } from "./toolbar";
import { attachCoverTitleEditing } from "./covertitle";
import { shouldSkipShortcut } from "./shortcuts";
import { applyNotebookMeta } from "./notebookmeta";
import { installAppSettings, openAppSettings, getAppSettings } from "./appsettings";
import type { AppSettings } from "./settings";
import { applyDefaultFontStack, fontStack } from "./fonts";
import { installContextMenu, setEditorAccessor, setSidebarActions } from "./contextmenu";
import { installNotebookSettings, openNotebookSettings } from "./notebooksettings";
import { loadSubtitleFor, saveSubtitleFor } from "./subtitle";
import type { JSONContent } from "@tiptap/core";

let currentDate = "";
let todayStr = "";
let viewedMonth = "";
let activeNotebookId = "default";
let notebooks: NotebookMeta[] = [];
let editor: Editor | null = null;
let autosave: Autosave | null = null;
let refreshToolbar: (() => void) | null = null;
let datesWithEntries = new Set<string>();
let firstWeekday = localeFirstWeekday();

const calGridEl = document.querySelector<HTMLDivElement>("#cal-grid")!;
const calWeekdaysEl = document.querySelector<HTMLDivElement>("#cal-weekdays")!;
const calTitleEl = document.querySelector<HTMLButtonElement>("#cal-title")!;
const calPrevEl = document.querySelector<HTMLButtonElement>("#cal-prev")!;
const calNextEl = document.querySelector<HTMLButtonElement>("#cal-next")!;
const coverEl = document.querySelector<HTMLDivElement>("#cover")!;
const coverBrandEl = document.querySelector<HTMLDivElement>("#cover-brand")!;
const coverSubEl = document.querySelector<HTMLDivElement>("#cover-sub")!;
const coverStatsEl = document.querySelector<HTMLDivElement>("#cover-stats")!;
const entryDateEl = document.querySelector<HTMLSpanElement>("#entry-date")!;
const saveStateEl = document.querySelector<HTMLSpanElement>("#save-state")!;
const editorHostEl = document.querySelector<HTMLDivElement>("#editor-host")!;
const prevDayEl = document.querySelector<HTMLButtonElement>("#prev-day")!;
const nextDayEl = document.querySelector<HTMLButtonElement>("#next-day")!;
const todayBtnEl = document.querySelector<HTMLButtonElement>("#today-btn")!;
const deleteBtnEl = document.querySelector<HTMLButtonElement>("#delete-btn")!;
const confirmOverlayEl = document.querySelector<HTMLDivElement>("#confirm-overlay")!;
const confirmTitleEl = document.querySelector<HTMLDivElement>("#confirm-title")!;
const confirmBodyEl = document.querySelector<HTMLDivElement>("#confirm-body")!;
const confirmOkEl = document.querySelector<HTMLButtonElement>("#confirm-ok")!;
const confirmCancelEl = document.querySelector<HTMLButtonElement>("#confirm-cancel")!;
const settingsBtnEl = document.querySelector<HTMLButtonElement>("#settings-btn")!;
const toolbarEl = document.querySelector<HTMLDivElement>("#toolbar")!;
const shelfPopEl = document.querySelector<HTMLDivElement>("#shelf-popover")!;
const shelfGridEl = document.querySelector<HTMLDivElement>("#shelf-grid")!;
const shelfFormEl = document.querySelector<HTMLFormElement>("#shelf-form")!;
const shelfNameEl = document.querySelector<HTMLInputElement>("#shelf-name")!;
const shelfCoversEl = document.querySelector<HTMLDivElement>("#shelf-covers")!;
const shelfEmojisEl = document.querySelector<HTMLDivElement>("#shelf-emojis")!;
const coverEmojiEl = document.querySelector<HTMLSpanElement>("#cover-emoji")!;

function refreshDeleteButton(): void {
  if (!editor) {
    deleteBtnEl.hidden = true;
    return;
  }
  // Content is more than text: days holding only images or canvas sketches
  // must still show the delete button.
  deleteBtnEl.hidden = !entryHasContent(editor.getJSON());
}

function entryHasContent(doc: JSONContent): boolean {
  const blocks = doc.content;
  if (!blocks?.length) return false;
  return blocks.some((block) => {
    if (block.type === "paragraph" || block.type === "heading") {
      // any text, or an explicitly placed block on the freeform sheet
      return (
        !!block.content?.length || !!block.attrs?.freeformPos
      );
    }
    return true;
  });
}

function setSaveStatus(status: SaveStatus): void {
  const labels: Record<SaveStatus, string> = {
    idle: "",
    saving: "saving…",
    saved: "saved",
    error: "save failed",
  };
  saveStateEl.textContent = labels[status];
  saveStateEl.dataset.status = status;
}

function activeNotebook(): NotebookMeta | undefined {
  return notebooks.find((n) => n.id === activeNotebookId);
}

function renderCover(): void {
  const nb = activeNotebook();
  const [a, b] = coverColors(nb?.cover ?? "kraft");
  coverEl.style.setProperty("--cover-a", a);
  coverEl.style.setProperty("--cover-b", b);
  coverEmojiEl.textContent = nb?.emoji ?? "";
  coverEmojiEl.hidden = !nb?.emoji;
  coverBrandEl.textContent = nb?.name ?? "My Journal";
  const count = datesWithEntries.size;
  coverStatsEl.textContent =
    count === 1 ? "1 entry written" : `${count} entries written`;
}

async function refreshEntries(): Promise<void> {
  const metas = await listEntries(activeNotebookId);
  datesWithEntries = new Set(metas.map((m) => m.date));
  renderCover();
}

function renderWeekdays(): void {
  calWeekdaysEl.textContent = "";
  for (const label of weekdayLabels(firstWeekday)) {
    const span = document.createElement("span");
    span.textContent = label;
    calWeekdaysEl.appendChild(span);
  }
}

function renderCalendar(): void {
  calTitleEl.textContent = monthLabel(viewedMonth);
  calGridEl.textContent = "";
  for (const date of calendarGrid(viewedMonth, firstWeekday)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cal-day";
    btn.dataset.date = date;
    btn.textContent = String(Number(date.slice(8, 10)));
    btn.title = formatLong(date);
    if (monthKey(date) !== viewedMonth) btn.classList.add("outside");
    if (date === todayStr) btn.classList.add("today");
    if (datesWithEntries.has(date)) btn.classList.add("has-entry");
    if (date === currentDate) btn.classList.add("active");
    btn.addEventListener("click", () => void openDate(date));
    calGridEl.appendChild(btn);
  }
}

function setViewedMonth(month: string): void {
  viewedMonth = month;
  renderCalendar();
}

async function openDate(date: string): Promise<void> {
  if (!isValidDateString(date) || date === currentDate) return;
  if ((await autosave?.flushNow()) === false) return;
  const payload = await getEntry(activeNotebookId, date);
  currentDate = payload.date;
  entryDateEl.textContent = formatLong(payload.date);
  editor?.destroy();
  editor = createEditor(editorHostEl, payload.content, {
    onUpdate: (docJson) => {
      autosave?.update(docJson);
      refreshDeleteButton();
    },
  });
  autosave = new Autosave(
    (content) => saveEntry(activeNotebookId, currentDate, content),
    setSaveStatus,
    appSettings.autosaveDelayMs,
  );
  autosave.markLoaded(payload.content);
  setSaveStatus("idle");
  todayBtnEl.disabled = currentDate === todayStr;
  if (monthKey(currentDate) !== viewedMonth) {
    setViewedMonth(monthKey(currentDate));
  } else {
    renderCalendar();
  }
  refreshDeleteButton();
  refreshToolbar?.();
  editor?.commands.focus("end");
}

/* --- notebook shelf --------------------------------------------------------- */

let newNotebookCover = "kraft";

function renderShelfPopover(): void {
  renderShelf(shelfGridEl, notebooks, activeNotebookId, {
    onSwitch: (id) => {
      void switchNotebook(id);
      shelfPopEl.hidden = true;
    },
    onMetaChange: (meta) => {
      if (applyNotebookMeta(notebooks, meta)) renderCover();
    },
  });
}

async function switchNotebook(id: string): Promise<void> {
  if (id === activeNotebookId) return;
  if ((await autosave?.flushNow()) === false) return;
  activeNotebookId = id;
  saveLastNotebook(id);
  setToolbarNotebook(id);
  currentDate = "";
  await refreshEntries();
  renderCover();
  renderCoverSubtitle();
  setViewedMonth(monthKey(todayStr));
  await openDate(todayStr);
}

coverEl.addEventListener("click", () => {
  renderShelfPopover();
  shelfPopEl.hidden = !shelfPopEl.hidden;
});

/* --- editable cover text --------------------------------------------------- */

 

function renderCoverSubtitle(): void {
  coverSubEl.textContent = loadSubtitleFor(activeNotebookId);
}

renderCoverSubtitle();

for (const el of [coverBrandEl, coverSubEl]) {
  el.addEventListener("click", (event) => event.stopPropagation());
  el.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      el.blur();
    }
  });
}

attachCoverTitleEditing(coverBrandEl, {
  getNotebook: (id) => notebooks.find((n) => n.id === id),
  getActiveNotebookId: () => activeNotebookId,
  renameNotebook: (id, name) => renameNotebook(id, name),
  onRenamed: (id, meta) => {
    const nb = notebooks.find((n) => n.id === id);
    if (nb) nb.name = meta.name;
    renderCover();
    renderShelfPopover();
  },
  onReverted: () => {},
});

let subtitleEditNotebookId: string | null = null;

coverSubEl.addEventListener("focus", () => {
  subtitleEditNotebookId = activeNotebookId;
});

coverSubEl.addEventListener("blur", () => {
  const editId = subtitleEditNotebookId;
  subtitleEditNotebookId = null;
  const value = (coverSubEl.textContent ?? "").trim();
  if (editId && editId === activeNotebookId) {
    saveSubtitleFor(editId, value);
  }
});

document.addEventListener("click", (event) => {
  if (!shelfPopEl.hidden) {
    const target = event.target as HTMLElement;
    if (!shelfPopEl.contains(target) && !coverEl.contains(target)) {
      shelfPopEl.hidden = true;
    }
  }
});

shelfFormEl.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = shelfNameEl.value.trim();
  if (!name) return;
  void createNotebook(name, newNotebookCover, newNotebookEmoji).then(async (meta) => {
    notebooks = await fetchNotebooks();
    shelfNameEl.value = "";
    renderShelfPopover();
    await switchNotebook(meta.id);
    shelfPopEl.hidden = true;
  });
});

newNotebookCover = renderCoverChoices(shelfCoversEl);

let newNotebookEmoji: string | null = null;
{
  const none = document.createElement("button");
  none.type = "button";
  none.className = "emoji-none";
  none.title = "No emoji";
  none.textContent = "\u00d7";
  none.addEventListener("click", () => {
    newNotebookEmoji = null;
    shelfEmojisEl.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    none.classList.add("active");
  });
  shelfEmojisEl.appendChild(none);
  for (const em of COVER_EMOJIS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "emoji-pick";
    b.title = "sticker";
    b.textContent = em;
    b.addEventListener("click", () => {
      newNotebookEmoji = em;
      shelfEmojisEl.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    });
    shelfEmojisEl.appendChild(b);
  }
}

/* --- app settings --------------------------------------------------------- */

let currentThemeId: ThemeId = loadThemeId();
let currentMode: Mode = loadMode();
let appSettings: AppSettings = getAppSettings();

function refreshFirstWeekday(): void {
  firstWeekday =
    appSettings.firstWeekday === "locale"
      ? localeFirstWeekday()
      : appSettings.firstWeekday;
}

function applyEditorDefaults(): void {
  document.documentElement.style.setProperty(
    "--editor-font-size",
    `${appSettings.editorFontSize}px`,
  );
  applyDefaultFontStack(fontStack(appSettings.editorFontId || "journal"));
}

installAppSettings({
  onSettingsChanged: (updated) => {
    appSettings = updated;
    applyEditorDefaults();
    refreshFirstWeekday();
    renderWeekdays();
    renderCalendar();
  },
  onThemeChanged: (theme, mode) => {
    currentThemeId = theme;
    currentMode = mode;
  },
});

refreshFirstWeekday();
applyEditorDefaults();

settingsBtnEl.addEventListener("click", () => {
  openAppSettings();
});

watchSystemMode(() => {
  if (currentMode === "auto") applyTheme(currentThemeId, currentMode);
});

/* --- frosted custom context menu --------------------------------------------- */

installContextMenu();
setEditorAccessor(() => editor);

setSidebarActions({
  openNotebookSettings: () => {
    const nb = activeNotebook();
    if (nb) openNotebookSettings(nb);
  },
  newNotebook: () => {
    renderShelfPopover();
    shelfPopEl.hidden = false;
    shelfNameEl.focus();
  },
  previousMonth: () => setViewedMonth(addMonths(viewedMonth, -1)),
  nextMonth: () => setViewedMonth(addMonths(viewedMonth, 1)),
  goToday: () => {
    setViewedMonth(monthKey(todayStr));
    void openDate(todayStr);
  },
});

installNotebookSettings({
  onSaved: (meta) => {
    const nb = notebooks.find((n) => n.id === meta.id);
    if (nb) {
      nb.name = meta.name;
      nb.cover = meta.cover;
      nb.emoji = meta.emoji ?? null;
    }
    if (meta.id === activeNotebookId) {
      renderCover();
      renderCoverSubtitle();
    }
    renderShelfPopover();
  },
});

window.addEventListener("veldnotes:edit-notebook", (event) => {
  const id = (event as CustomEvent<{ id: string }>).detail.id;
  const nb = notebooks.find((n) => n.id === id);
  if (nb) {
    shelfPopEl.hidden = true;
    openNotebookSettings(nb);
  }
});

window.addEventListener("veldnotes:open-shelf", () => {
  renderShelfPopover();
  shelfPopEl.hidden = false;
});

// The toolbar font/size dropdowns now apply per-selection (see typography.ts);
// the document-wide defaults live in app settings and are applied via CSS vars.

/* --- delete day's note with confirmation ------------------------------------ */

function askConfirm(title: string, body: string): Promise<boolean> {
  return new Promise((resolve) => {
    confirmTitleEl.textContent = title;
    confirmBodyEl.textContent = body;
    confirmOverlayEl.hidden = false;
    confirmCancelEl.focus();
    const done = (answer: boolean): void => {
      confirmOverlayEl.hidden = true;
      confirmOkEl.removeEventListener("click", onOk);
      confirmCancelEl.removeEventListener("click", onCancel);
      confirmOverlayEl.removeEventListener("mousedown", onOverlay);
      window.removeEventListener("keydown", onKey);
      resolve(answer);
    };
    const onOk = (): void => done(true);
    const onCancel = (): void => done(false);
    const onOverlay = (event: MouseEvent): void => {
      if (event.target === confirmOverlayEl) done(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") done(false);
      if (event.key === "Enter") done(true);
    };
    confirmOkEl.addEventListener("click", onOk);
    confirmCancelEl.addEventListener("click", onCancel);
    confirmOverlayEl.addEventListener("mousedown", onOverlay);
    window.addEventListener("keydown", onKey);
  });
}

deleteBtnEl.addEventListener("click", () => {
  void (async () => {
    if (!currentDate || !autosave) return;
    const label = formatLong(currentDate);
    const sure = await askConfirm(
      "Delete this note?",
      `This permanently deletes the entry for ${label} from this notebook. This cannot be undone.`,
    );
    if (!sure) return;
    autosave.cancel();
    try {
      await deleteEntry(activeNotebookId, currentDate);
    } catch (err) {
      console.error("delete failed", err);
      return;
    }
    editor?.destroy();
    editor = null;
    const deletedDate = currentDate;
    currentDate = "";
    setSaveStatus("idle");
    await refreshEntries();
    renderCover();
    await openDate(deletedDate);
  })();
});

/* --- navigation -------------------------------------------------------------- */

calPrevEl.addEventListener("click", () =>
  setViewedMonth(addMonths(viewedMonth, -1)),
);
calNextEl.addEventListener("click", () =>
  setViewedMonth(addMonths(viewedMonth, 1)),
);
calTitleEl.addEventListener("click", () => setViewedMonth(monthKey(todayStr)));
prevDayEl.addEventListener("click", () =>
  void openDate(shiftDate(currentDate, -1)),
);
nextDayEl.addEventListener("click", () =>
  void openDate(shiftDate(currentDate, 1)),
);
todayBtnEl.addEventListener("click", () => void openDate(todayStr));

const OVERLAY_IDS = [
  "app-settings-overlay",
  "nb-settings-overlay",
  "prompt-overlay",
  "context-menu",
];

window.addEventListener("keydown", (event) => {
  if (
    shouldSkipShortcut(event, {
      isPopoverOpen: () => !shelfPopEl.hidden,
      isDialogOpen: () => {
        if (!confirmOverlayEl.hidden) return true;
        return OVERLAY_IDS.some((id) => {
          const el = document.getElementById(id);
          return el !== null && !el.hidden;
        });
      },
    })
  ) {
    return;
  }
  if (event.key === "ArrowLeft") void openDate(shiftDate(currentDate, -1));
  else if (event.key === "ArrowRight") void openDate(shiftDate(currentDate, 1));
  else if (event.key === "t") void openDate(todayStr);
});

/* --- boot --------------------------------------------------------------------- */

async function boot(): Promise<void> {
  todayStr = await todayDate();
  notebooks = await listNotebooks();
  const last = loadLastNotebook();
  activeNotebookId = notebooks.some((n) => n.id === last) ? last : notebooks[0].id;
  setToolbarNotebook(activeNotebookId);
  await refreshEntries();
  renderCover();
  renderWeekdays();
  setViewedMonth(monthKey(todayStr));
  await openDate(todayStr);
}

window.addEventListener("DOMContentLoaded", () => {
  applyTheme(currentThemeId, currentMode);
  refreshToolbar = createToolbar(toolbarEl, () => editor);
  void boot();
});

window.addEventListener("beforeunload", () => {
  void autosave?.flushNow();
});
