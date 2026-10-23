// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string) => {
    if (cmd === "data_dir") return "/home/user/.local/share/com.veldnotes.app";
    return {};
  }),
}));
import { installAppSettings, openAppSettings, closeAppSettings } from "./appsettings";
import { loadSettings } from "./settings";

describe("app settings dialog", () => {
  it("opens, shows all setting groups, and closes", async () => {
    let changed: unknown = null;
    installAppSettings({
      onSettingsChanged: (s) => {
        changed = s;
      },
      onThemeChanged: () => {},
    });
    openAppSettings();
    await new Promise((r) => setTimeout(r, 10));
    const overlay = document.querySelector("#app-settings-overlay") as HTMLElement;
    expect(overlay.hidden).toBe(false);
    const dialog = document.querySelector("#app-settings") as HTMLElement;
    expect(dialog.querySelectorAll("#as-themes button").length).toBe(6);
    expect(dialog.querySelectorAll("#as-modes button").length).toBe(3);
    expect(dialog.querySelectorAll("#as-autosave button").length).toBe(4);
    expect(dialog.querySelectorAll("#as-weekday button").length).toBe(3);
    expect(dialog.querySelector("#as-datadir")?.textContent).toContain("com.veldnotes.app");

    // picking an autosave choice fires onSettingsChanged and persists
    const lazy = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>("#as-autosave button"),
    ).find((b) => b.textContent?.includes("Lazy"))!;
    lazy.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect((changed as { autosaveDelayMs: number }).autosaveDelayMs).toBe(4000);
    expect(loadSettings().autosaveDelayMs).toBe(4000);

    closeAppSettings();
    expect(overlay.hidden).toBe(true);
  });
});
