import "./styles.css";
import { Editor } from "@tiptap/core";
import { getEntry, listEntries, saveEntry, todayDate } from "./api";
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
  loadCoverSubtitle,
  loadCoverTitle,
  loadMode,
  loadThemeId,
  Mode,
  saveCoverText,
  saveTheme,
  THEMES,
  ThemeId,
  watchSystemMode,
} from "./theme";

let currentDate = "";
let todayStr = "";
let viewedMonth = "";
let editor: Editor | null = null;
let autosave: Autosave | null = null;
let datesWithEntries = new Set<string>();
const firstWeekday = localeFirstWeekday();

const calGridEl = document.querySelector<HTMLDivElement>("#cal-grid")!;
const calWeekdaysEl = document.querySelector<HTMLDivElement>("#cal-weekdays")!;
const calTitleEl = document.querySelector<HTMLButtonElement>("#cal-title")!;
const calPrevEl = document.querySelector<HTMLButtonElement>("#cal-prev")!;
const calNextEl = document.querySelector<HTMLButtonElement>("#cal-next")!;
const coverStatsEl = document.querySelector<HTMLDivElement>("#cover-stats")!;
const coverBrandEl = document.querySelector<HTMLDivElement>("#cover-brand")!;
const coverSubEl = document.querySelector<HTMLDivElement>("#cover-sub")!;
const entryDateEl = document.querySelector<HTMLSpanElement>("#entry-date")!;
const saveStateEl = document.querySelector<HTMLSpanElement>("#save-state")!;
const editorHostEl = document.querySelector<HTMLDivElement>("#editor-host")!;
const prevDayEl = document.querySelector<HTMLButtonElement>("#prev-day")!;
const nextDayEl = document.querySelector<HTMLButtonElement>("#next-day")!;
const todayBtnEl = document.querySelector<HTMLButtonElement>("#today-btn")!;
const themeBtnEl = document.querySelector<HTMLButtonElement>("#theme-btn")!;
const themePopEl = document.querySelector<HTMLDivElement>("#theme-popover")!;
const themeChoicesEl = document.querySelector<HTMLDivElement>("#theme-choices")!;
const modeChoicesEl = document.querySelector<HTMLDivElement>("#mode-choices")!;

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

async function refreshEntries(): Promise<void> {
  const metas = await listEntries();
  datesWithEntries = new Set(metas.map((m) => m.date));
  renderCoverStats();
}

function renderCoverStats(): void {
  const count = datesWithEntries.size;
  coverStatsEl.textContent =
    count === 1 ? "1 entry written" : `${count} entries written`;
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
  const payload = await getEntry(date);
  currentDate = payload.date;
  entryDateEl.textContent = formatLong(payload.date);
  editor?.destroy();
  editor = createEditor(editorHostEl, payload.content, {
    onUpdate: (markdown) => autosave?.update(markdown),
  });
  autosave = new Autosave(
    (content) => saveEntry(currentDate, content),
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
  editor?.commands.focus("end");
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

document.addEventListener("click", (event) => {
  if (themePopEl.hidden) return;
  const target = event.target as HTMLElement;
  if (themePopEl.contains(target) || themeBtnEl.contains(target)) return;
  themePopEl.hidden = true;
});

watchSystemMode(() => {
  if (currentMode === "auto") applyTheme(currentThemeId, currentMode);
});

/* --- customizable cover text ----------------------------------------------- */

function initCoverText(): void {
  coverBrandEl.textContent = loadCoverTitle();
  coverSubEl.textContent = loadCoverSubtitle();
  for (const el of [coverBrandEl, coverSubEl]) {
    el.addEventListener("input", () =>
      saveCoverText(coverBrandEl.textContent ?? "", coverSubEl.textContent ?? ""),
    );
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        (event.target as HTMLElement).blur();
      }
    });
  }
}

/* --- suppress the webview's devtools context menu --------------------------- */

document.addEventListener(
  "contextmenu",
  (event) => {
    const target = event.target as HTMLElement;
    if (
      target.closest("input, textarea, [contenteditable], .entry-editor")
    ) {
      return;
    }
    event.preventDefault();
  },
  true,
);

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
  await refreshEntries();
  renderWeekdays();
  setViewedMonth(monthKey(todayStr));
  await openDate(todayStr);
}

window.addEventListener("DOMContentLoaded", () => {
  applyTheme(currentThemeId, currentMode);
  renderThemePopover();
  initCoverText();
  void boot();
});

window.addEventListener("beforeunload", () => {
  void autosave?.flushNow();
});
