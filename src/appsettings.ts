import { dataDir } from "./api";
import {
  AUTOSAVE_CHOICES,
  FONTSIZE_CHOICES,
  WEEKDAY_CHOICES,
  loadSettings,
  saveSettings,
  type AppSettings,
} from "./settings";
import {
  applyTheme,
  loadMode,
  loadThemeId,
  saveTheme,
  THEMES,
  type Mode,
  type ThemeId,
} from "./theme";

export interface AppSettingsCallbacks {
  onSettingsChanged: (settings: AppSettings) => void;
  onThemeChanged: (theme: ThemeId, mode: Mode) => void;
}

let overlayEl: HTMLDivElement | null = null;
let callbacks: AppSettingsCallbacks | null = null;
let current: AppSettings = loadSettings();
let themeId: ThemeId = loadThemeId();
let mode: Mode = loadMode();

export function installAppSettings(cb: AppSettingsCallbacks): void {
  callbacks = cb;

  overlayEl = document.createElement("div");
  overlayEl.id = "app-settings-overlay";
  overlayEl.hidden = true;

  const dialog = document.createElement("div");
  dialog.id = "app-settings";
  dialog.setAttribute("role", "dialog");
  dialog.innerHTML = `
    <div id="app-settings-title">Settings</div>

    <label class="nb-field">Theme</label>
    <div id="as-themes"></div>

    <label class="nb-field">Colour mode</label>
    <div id="as-modes">
      <button type="button" data-mode="auto">Auto</button>
      <button type="button" data-mode="light">Light</button>
      <button type="button" data-mode="dark">Dark</button>
    </div>

    <label class="nb-field">Editor text size</label>
    <div id="as-fontsizes"></div>

    <label class="nb-field">Autosave</label>
    <div id="as-autosave"></div>

    <label class="nb-field">Calendar starts on</label>
    <div id="as-weekday"></div>

    <label class="nb-field">Journal folder</label>
    <div id="as-datadir" title="">(unknown)</div>

    <div id="nb-actions">
      <button id="as-close" type="button">Done</button>
    </div>
  `;
  overlayEl.appendChild(dialog);
  document.body.appendChild(overlayEl);

  overlayEl.addEventListener("mousedown", (event) => {
    if (event.target === overlayEl) closeAppSettings();
  });
  dialog.querySelector("#as-close")?.addEventListener("click", closeAppSettings);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlayEl!.hidden) {
      closeAppSettings();
      event.stopPropagation();
    }
  });

  void dataDir().then((dir) => {
    const el = dialog.querySelector("#as-datadir");
    if (el) {
      el.textContent = dir;
      el.setAttribute("title", dir);
    }
  });
}

function group(
  host: HTMLElement,
  choices: readonly { value: unknown; label: string; swatch?: string }[],
  isActive: (value: unknown) => boolean,
  onPick: (value: unknown) => void,
): void {
  host.textContent = "";
  for (const choice of choices) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "as-choice" + (isActive(choice.value) ? " active" : "");
    b.textContent = choice.label;
    b.addEventListener("click", (event) => {
      event.stopPropagation();
      host.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      onPick(choice.value);
    });
    if (choice.swatch) b.style.setProperty("--as-swatch", choice.swatch);
    host.appendChild(b);
  }
}

export function openAppSettings(): void {
  if (!overlayEl) return;
  current = loadSettings();
  themeId = loadThemeId();
  mode = loadMode();

  group(
    overlayEl.querySelector<HTMLElement>("#as-themes")!,
    THEMES.map((t) => ({
      value: t.id as unknown,
      label: t.label,
      swatch: t.swatch[0] as string,
    })),
    (v) => v === themeId,
    (v) => {
      themeId = v as ThemeId;
      applyTheme(themeId, mode);
      saveTheme(themeId, mode);
      callbacks?.onThemeChanged(themeId, mode);
    },
  );

  const modesEl = overlayEl.querySelector<HTMLElement>("#as-modes")!;
  modesEl.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
  modesEl.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", (event) => {
      event.stopPropagation();
      modesEl.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      mode = b.dataset.mode as Mode;
      applyTheme(themeId, mode);
      saveTheme(themeId, mode);
      callbacks?.onThemeChanged(themeId, mode);
    }),
  );

  group(
    overlayEl.querySelector<HTMLElement>("#as-fontsizes")!,
    FONTSIZE_CHOICES,
    (v) => v === current.editorFontSize,
    (v) => {
      current.editorFontSize = v as number;
      saveSettings(current);
      callbacks?.onSettingsChanged(current);
    },
  );

  group(
    overlayEl.querySelector<HTMLElement>("#as-autosave")!,
    AUTOSAVE_CHOICES,
    (v) => v === current.autosaveDelayMs,
    (v) => {
      current.autosaveDelayMs = v as number;
      saveSettings(current);
      callbacks?.onSettingsChanged(current);
    },
  );

  group(
    overlayEl.querySelector<HTMLElement>("#as-weekday")!,
    WEEKDAY_CHOICES,
    (v) => v === current.firstWeekday,
    (v) => {
      current.firstWeekday = v as AppSettings["firstWeekday"];
      saveSettings(current);
      callbacks?.onSettingsChanged(current);
    },
  );

  overlayEl.hidden = false;
  (overlayEl.querySelector("#as-themes button") as HTMLElement | null)?.focus();
}

export function closeAppSettings(): void {
  if (overlayEl) overlayEl.hidden = true;
}

export function getAppSettings(): AppSettings {
  return loadSettings();
}
