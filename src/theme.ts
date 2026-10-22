export const THEMES = [
  { id: "kraft", label: "Kraft", swatch: ["#f6f1e7", "#a8862d"] },
  { id: "forest", label: "Forest", swatch: ["#eaf1e6", "#5c8a4c"] },
  { id: "meadow", label: "Meadow", swatch: ["#eef3f8", "#5b84a8"] },
  { id: "dusk", label: "Dusk", swatch: ["#efe6f2", "#8a5ca8"] },
  { id: "rose", label: "Rose", swatch: ["#f8ebe8", "#c46a6a"] },
  { id: "midnight", label: "Midnight", swatch: ["#1c1a24", "#7a6ac9"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type Mode = "light" | "dark" | "auto";

const THEME_KEY = "veldnotes.theme";
const MODE_KEY = "veldnotes.mode";

function isThemeId(v: string): v is ThemeId {
  return THEMES.some((t): boolean => t.id === v);
}

function isMode(v: string): v is Mode {
  return v === "light" || v === "dark" || v === "auto";
}

export function loadThemeId(): ThemeId {
  const stored = localStorage.getItem(THEME_KEY) ?? "";
  return isThemeId(stored) ? stored : "kraft";
}

export function loadMode(): Mode {
  const stored = localStorage.getItem(MODE_KEY) ?? "";
  return isMode(stored) ? stored : "auto";
}

export function applyTheme(id: ThemeId, mode: Mode): void {
  document.documentElement.dataset.theme = id;
  if (mode === "auto") delete document.documentElement.dataset.mode;
  else document.documentElement.dataset.mode = mode;
}

export function saveTheme(id: ThemeId, mode: Mode): void {
  localStorage.setItem(THEME_KEY, id);
  localStorage.setItem(MODE_KEY, mode);
}

export function watchSystemMode(onChange: () => void): void {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", onChange);
}
