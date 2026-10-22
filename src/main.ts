import "./styles.css";
import { Editor } from "@tiptap/core";
import {
  getEntry,
  listEntries,
  saveEntry,
  todayDate,
} from "./api";
import { Autosave, SaveStatus } from "./autosave";
import { createEditor } from "./editor";
import { formatLong, formatShort, isValidDateString, shiftDate } from "./dates";

let currentDate = "";
let editor: Editor | null = null;
let autosave: Autosave | null = null;
let datesWithEntries = new Set<string>();

const dateStripEl = document.querySelector<HTMLDivElement>("#date-strip")!;
const entryDateEl = document.querySelector<HTMLSpanElement>("#entry-date")!;
const saveStateEl = document.querySelector<HTMLSpanElement>("#save-state")!;
const editorHostEl = document.querySelector<HTMLDivElement>("#editor-host")!;

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

async function refreshDateStrip(): Promise<void> {
  const metas = await listEntries();
  datesWithEntries = new Set(metas.map((m) => m.date));
  renderDateStrip();
}

function renderDateStrip(): void {
  dateStripEl.textContent = "";
  const today = currentDate;
  const days: string[] = [];
  for (let back = 13; back >= 0; back--) days.push(shiftDate(today, -back));
  for (const date of days) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "date-cell";
    btn.dataset.date = date;
    btn.title = formatLong(date);
    const [mon, day] = formatShort(date).split(" ");
    const m = document.createElement("span");
    m.className = "date-mon";
    m.textContent = mon;
    const d = document.createElement("span");
    d.className = "date-day";
    d.textContent = day;
    btn.append(m, d);
    if (date === today) btn.classList.add("today");
    if (date === currentDate) btn.classList.add("active");
    if (datesWithEntries.has(date)) btn.classList.add("has-entry");
    btn.addEventListener("click", () => void openDate(date));
    dateStripEl.appendChild(btn);
  }
  const active = dateStripEl.querySelector(".active");
  active?.scrollIntoView({ inline: "center", block: "nearest" });
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
  await refreshDateStrip();
  editor?.commands.focus("end");
}

async function boot(): Promise<void> {
  const today = await todayDate();
  currentDate = today;
  await refreshDateStrip();
  await openDate(today);
}

window.addEventListener("DOMContentLoaded", () => {
  void boot();
});

window.addEventListener("beforeunload", () => {
  void autosave?.flushNow();
});
