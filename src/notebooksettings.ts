import {
  renameNotebook,
  setNotebookCover,
  setNotebookEmoji,
  type NotebookMeta,
} from "./api";
import { COVER_EMOJIS, COVER_STYLES, coverColors } from "./shelf";
import { loadSubtitleFor, saveSubtitleFor } from "./subtitle";

export interface SettingsCallbacks {
  onSaved: (meta: NotebookMeta) => void;
}

let dialogEl: HTMLDivElement | null = null;
let overlayEl: HTMLDivElement | null = null;
let activeTarget: NotebookMeta | null = null;
let callbacks: SettingsCallbacks | null = null;

export function installNotebookSettings(cb: SettingsCallbacks): void {
  callbacks = cb;

  overlayEl = document.createElement("div");
  overlayEl.id = "nb-settings-overlay";
  overlayEl.hidden = true;

  dialogEl = document.createElement("div");
  dialogEl.id = "nb-settings";
  dialogEl.setAttribute("role", "dialog");
  dialogEl.innerHTML = `
    <div id="nb-settings-title">Notebook settings</div>
    <div id="nb-preview">
      <div class="cover-spine"></div>
      <span id="nb-preview-emoji"></span>
      <div class="cover-body">
        <div id="nb-preview-name">My Journal</div>
        <div class="cover-rule"></div>
        <div id="nb-preview-sub">a cozy daily journal</div>
      </div>
    </div>
    <label class="nb-field">Name</label>
    <input id="nb-name" type="text" maxlength="48" />
    <label class="nb-field">Subtitle</label>
    <input id="nb-sub" type="text" maxlength="48" />
    <label class="nb-field">Cover colour</label>
    <div id="nb-covers"></div>
    <label class="nb-field">Sticker</label>
    <div id="nb-emojis"></div>
    <div id="nb-actions">
      <button id="nb-cancel" type="button">Cancel</button>
      <button id="nb-save" type="button">Save</button>
    </div>
  `;
  overlayEl.appendChild(dialogEl);
  document.body.appendChild(overlayEl);

  overlayEl.addEventListener("mousedown", (event) => {
    if (event.target === overlayEl) closeSettings();
  });
  dialogEl.querySelector("#nb-cancel")?.addEventListener("click", closeSettings);
  dialogEl.querySelector("#nb-save")?.addEventListener("click", save);

  dialogEl.querySelector("#nb-name")?.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") save();
  });
  dialogEl.querySelector("#nb-name")?.addEventListener("input", updatePreview);
  dialogEl.querySelector("#nb-sub")?.addEventListener("input", updatePreview);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlayEl!.hidden) {
      closeSettings();
      event.stopPropagation();
    }
  });

}

let chosenCover = "kraft";
let chosenEmoji: string | null = null;

export function openNotebookSettings(nb: NotebookMeta): void {
  if (!dialogEl || !overlayEl) return;
  activeTarget = nb;
  chosenCover = nb.cover;
  chosenEmoji = nb.emoji ?? null;

  const nameInput = dialogEl.querySelector<HTMLInputElement>("#nb-name")!;
  nameInput.value = nb.name;
  const subInput = dialogEl.querySelector<HTMLInputElement>("#nb-sub")!;
  subInput.value = loadSubtitleFor(nb.id);

  renderCoverChoices();
  renderEmojiChoices();
  updatePreview();

  overlayEl.hidden = false;
  nameInput.focus();
  nameInput.select();
}

export function closeSettings(): void {
  if (overlayEl) overlayEl.hidden = true;
  activeTarget = null;
}

async function save(): Promise<void> {
  const nameInput = dialogEl?.querySelector<HTMLInputElement>("#nb-name");
  if (!nameInput || !activeTarget || !callbacks) return;
  const name = nameInput.value.trim();
  if (!name) return;

  let meta = activeTarget;
  if (name !== meta.name) {
    meta = await renameNotebook(meta.id, name);
  }
  const subInput = dialogEl?.querySelector<HTMLInputElement>("#nb-sub");
  if (subInput) saveSubtitleFor(meta.id, subInput.value.trim());
  if (chosenCover !== meta.cover) {
    meta = await setNotebookCover(meta.id, chosenCover);
  }
  const emojiNow = meta.emoji ?? null;
  if ((chosenEmoji ?? null) !== emojiNow) {
    meta = await setNotebookEmoji(meta.id, chosenEmoji);
  }
  callbacks.onSaved(meta);
  closeSettings();
}

function renderCoverChoices(): void {
  const host = dialogEl?.querySelector<HTMLDivElement>("#nb-covers");
  if (!host) return;
  host.textContent = "";
  for (const style of COVER_STYLES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cover-dot big" + (style.id === chosenCover ? " active" : "");
    b.title = style.label;
    b.style.background = `linear-gradient(135deg, ${style.colors[0]}, ${style.colors[1]})`;
    b.addEventListener("click", () => {
      chosenCover = style.id;
      host.querySelectorAll(".cover-dot").forEach((d) => d.classList.remove("active"));
      b.classList.add("active");
      updatePreview();
    });
    host.appendChild(b);
  }
}

function renderEmojiChoices(): void {
  const host = dialogEl?.querySelector<HTMLDivElement>("#nb-emojis");
  if (!host) return;
  host.textContent = "";
  const none = document.createElement("button");
  none.type = "button";
  none.className = "emoji-none" + (chosenEmoji === null ? " active" : "");
  none.title = "No sticker";
  none.textContent = "\u00d7";
  none.addEventListener("click", () => {
    chosenEmoji = null;
    refreshActive(host, none);
    updatePreview();
  });
  host.appendChild(none);
  for (const em of COVER_EMOJIS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "emoji-pick" + (em === chosenEmoji ? " active" : "");
    b.title = "sticker";
    b.textContent = em;
    b.addEventListener("click", () => {
      chosenEmoji = em;
      refreshActive(host, b);
      updatePreview();
    });
    host.appendChild(b);
  }
}

function refreshActive(host: HTMLElement, active: HTMLElement): void {
  host.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
  active.classList.add("active");
}

function updatePreview(): void {
  const preview = dialogEl?.querySelector<HTMLElement>("#nb-preview");
  if (!preview || !activeTarget) return;
  const [a, b] = coverColors(chosenCover);
  preview.style.setProperty("--cover-a", a);
  preview.style.setProperty("--cover-b", b);
  const emojiEl = preview.querySelector<HTMLElement>("#nb-preview-emoji");
  if (emojiEl) {
    emojiEl.textContent = chosenEmoji ?? "";
    emojiEl.hidden = !chosenEmoji;
  }
  const nameEl = preview.querySelector<HTMLElement>("#nb-preview-name");
  const input = dialogEl?.querySelector<HTMLInputElement>("#nb-name");
  if (nameEl && input) nameEl.textContent = input.value.trim() || activeTarget.name;
  const subEl = preview.querySelector<HTMLElement>("#nb-preview-sub");
  const subInput = dialogEl?.querySelector<HTMLInputElement>("#nb-sub");
  if (subEl && subInput) subEl.textContent = subInput.value.trim() || "";
}
