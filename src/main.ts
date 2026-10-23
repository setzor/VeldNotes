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
  saveTheme,
  THEMES,
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

let currentDate = "";
let todayStr = "";
let viewedMonth = "";
let activeNotebookId = "default";
let notebooks: NotebookMeta[] = [];
let editor: Editor | null = null;
let autosave: Autosave | null = null;
let datesWithEntries = new Set<string>();
const firstWeekday = localeFirstWeekday();

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
const themeBtnEl = document.querySelector<HTMLButtonElement>("#theme-btn")!;
const themePopEl = document.querySelector<HTMLDivElement>("#theme-popover")!;
const themeChoicesEl = document.querySelector<HTMLDivElement>("#theme-choices")!;
const modeChoicesEl = document.querySelector<HTMLDivElement>("#mode-choices")!;
const toolbarEl = document.querySelector<HTMLDivElement>("#toolbar")!;
const shelfPopEl = document.querySelector<HTMLDivElement>("#shelf-popover")!;
const shelfGridEl = document.querySelector<HTMLDivElement>("#shelf-grid")!;
const shelfFormEl = document.querySelector<HTMLFormElement>("#shelf-form")!;
const shelfNameEl = document.querySelector<HTMLInputElement>("#shelf-name")!;
const shelfCoversEl = document.querySelector<HTMLDivElement>("#shelf-covers")!;
const shelfEmojisEl = document.querySelector<HTMLDivElement>("#shelf-emojis")!;
const coverEmojiEl = document.querySelector<HTMLSpanElement>("#cover-emoji")!;

function refreshDeleteButton(): void {
  deleteBtnEl.hidden = !editor || editor.getText().trim() === "";
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
  await autosave?.flushNow();
  const payload = await getEntry(activeNotebookId, date);
  currentDate = payload.date;
  entryDateEl.textContent = formatLong(payload.date);
  editor?.destroy();
  editor = createEditor(editorHostEl, payload.content, {
    onUpdate: (markdown) => {
      autosave?.update(markdown);
      refreshDeleteButton();
    },
  });
  autosave = new Autosave(
    (content) => saveEntry(activeNotebookId, currentDate, content),
    setSaveStatus,
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
      const nb = notebooks.find((n) => n.id === meta.id);
      if (nb) {
        nb.name = meta.name;
        nb.cover = meta.cover;
      }
      renderCover();
    },
  });
}

async function switchNotebook(id: string): Promise<void> {
  if (id === activeNotebookId) return;
  await autosave?.flushNow();
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

const COVER_SUB_KEY_PREFIX = "veldnotes.cover.subtitle.";
const DEFAULT_SUBTITLE = "a cozy daily journal";

function subtitleKey(notebookId: string): string {
  return COVER_SUB_KEY_PREFIX + notebookId;
}

function loadSubtitleFor(notebookId: string | undefined): string {
  if (!notebookId) return DEFAULT_SUBTITLE;
  return localStorage.getItem(subtitleKey(notebookId)) || DEFAULT_SUBTITLE;
}

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

coverBrandEl.addEventListener("blur", () => {
  const nb = activeNotebook();
  const newName = (coverBrandEl.textContent ?? "").trim();
  if (!nb) return;
  if (newName && newName !== nb.name) {
    void renameNotebook(nb.id, newName).then((meta) => {
      nb.name = meta.name;
      renderCover();
      renderShelfPopover();
    });
  } else {
    coverBrandEl.textContent = nb.name;
  }
});

coverSubEl.addEventListener("blur", () => {
  const value = (coverSubEl.textContent ?? "").trim();
  if (activeNotebookId) {
    localStorage.setItem(subtitleKey(activeNotebookId), value);
  }
});

document.addEventListener("click", (event) => {
  for (const pop of [themePopEl, shelfPopEl]) {
    if (pop.hidden) continue;
    const target = event.target as HTMLElement;
    if (pop.contains(target)) continue;
    if (pop === themePopEl && themeBtnEl.contains(target)) continue;
    if (pop === shelfPopEl && coverEl.contains(target)) continue;
    pop.hidden = true;
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

/* --- theme popover --------------------------------------------------------- */

let currentThemeId: ThemeId = loadThemeId();
let currentMode: Mode = loadMode();

function renderThemePopover(): void {
  themeChoicesEl.textContent = "";
  for (const t of THEMES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-choice" + (t.id === currentThemeId ? " active" : "");
    const swatch = document.createElement("span");
    swatch.className = "theme-swatch";
    swatch.style.background = `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)`;
    const label = document.createElement("span");
    label.textContent = t.label;
    btn.append(swatch, label);
    btn.addEventListener("click", () => {
      currentThemeId = t.id;
      applyTheme(currentThemeId, currentMode);
      saveTheme(currentThemeId, currentMode);
      renderThemePopover();
    });
    themeChoicesEl.appendChild(btn);
  }
  for (const btn of Array.from(modeChoicesEl.querySelectorAll("button"))) {
    btn.classList.toggle("active", btn.dataset.mode === currentMode);
  }
}

modeChoicesEl.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "button[data-mode]",
  );
  if (!btn) return;
  currentMode = btn.dataset.mode as Mode;
  applyTheme(currentThemeId, currentMode);
  saveTheme(currentThemeId, currentMode);
  renderThemePopover();
});

themeBtnEl.addEventListener("click", () => {
  themePopEl.hidden = !themePopEl.hidden;
});

watchSystemMode(() => {
  if (currentMode === "auto") applyTheme(currentThemeId, currentMode);
});

/* --- suppress the webview's devtools context menu --------------------------- */

document.addEventListener(
  "contextmenu",
  (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, [contenteditable], .entry-editor")) {
      return;
    }
    event.preventDefault();
  },
  true,
);

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

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLElement) {
    const tag = event.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || event.target.isContentEditable) {
      return;
    }
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
  renderThemePopover();
  createToolbar(toolbarEl, () => editor);
  void boot();
});

window.addEventListener("beforeunload", () => {
  void autosave?.flushNow();
});
