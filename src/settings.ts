export interface AppSettings {
  autosaveDelayMs: number;
  editorFontSize: number;
  firstWeekday: number | "locale";
}

const KEY = "veldnotes.appsettings";

const DEFAULTS: AppSettings = {
  autosaveDelayMs: 600,
  editorFontSize: 17,
  firstWeekday: "locale",
};

function isSettings(v: unknown): v is AppSettings {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Partial<AppSettings>;
  return (
    typeof s.autosaveDelayMs === "number" &&
    typeof s.editorFontSize === "number" &&
    (s.firstWeekday === "locale" ||
      (typeof s.firstWeekday === "number" && s.firstWeekday >= 0 && s.firstWeekday <= 6))
  );
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    if (isSettings(parsed)) return { ...DEFAULTS, ...parsed };
  } catch {
    // fall through
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

export const AUTOSAVE_CHOICES = [
  { value: 300, label: "Fast (0.3s)" },
  { value: 600, label: "Default (0.6s)" },
  { value: 1500, label: "Relaxed (1.5s)" },
  { value: 4000, label: "Lazy (4s)" },
] as const;

export const FONTSIZE_CHOICES = [
  { value: 15, label: "Small (15px)" },
  { value: 17, label: "Default (17px)" },
  { value: 19, label: "Large (19px)" },
  { value: 21, label: "Cozy (21px)" },
] as const;

export const WEEKDAY_CHOICES = [
  { value: "locale" as const, label: "Locale default" },
  { value: 0 as const, label: "Sunday" },
  { value: 1 as const, label: "Monday" },
] as const;
