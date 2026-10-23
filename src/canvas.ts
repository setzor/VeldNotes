/**
 * Free-form canvas powered by Excalidraw (MIT). The editor overlay keeps the
 * app's frosted-glass chrome; Excalidraw mounts inside it as a local-only
 * canvas. Assets are bundled locally (public/excalidraw-assets) so drawing
 * works fully offline.
 *
 * Asset path notes: Excalidraw's dev bundle builds chunk/font URLs as
 * EXCALIDRAW_ASSET_PATH + "excalidraw-assets/<file>", while the production
 * bundle resolves them relative to the page root. The bundled assets live at
 * /excalidraw-assets/ and the path is set to "/" so both variants resolve to
 * files we ship - no CDN, fully offline.
 */

import type { ReactElement } from "react";

export interface CanvasResult {
  scene: string;
  preview: string;
}

let excalidrawModule: typeof import("@excalidraw/excalidraw") | null = null;
let reactModule: typeof import("react") | null = null;
let reactDomModule: typeof import("react-dom/client") | null = null;

function ensureAssetPath(): void {
  const w = window as unknown as Record<string, unknown>;
  w.EXCALIDRAW_ASSET_PATH = "/";
}

async function loadModules(): Promise<void> {
  ensureAssetPath();
  if (!excalidrawModule) {
    excalidrawModule = await import("@excalidraw/excalidraw");
  }
  if (!reactModule) {
    reactModule = await import("react");
  }
  if (!reactDomModule) {
    reactDomModule = await import("react-dom/client");
  }
}

/**
 * exportToSvg points its embedded @font-face rules at the CDN-style path
 * `<assetPath>/dist/excalidraw-assets/<font>.woff2`, which does not match the
 * bundled asset layout. Rewrite those URLs to the local bundled fonts so
 * previews keep the hand-drawn look offline.
 */
function localizeSvgFonts(svg: string): string {
  return svg.replace(
    /url\("[^"]*\/([A-Za-z-]+\.woff2)"\)/g,
    'url("/excalidraw-assets/$1")',
  );
}

function showCanvasError(message: string): void {
  const existing = document.querySelector("#canvas-error");
  existing?.remove();
  const toast = document.createElement("div");
  toast.id = "canvas-error";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

export async function openCanvasEditor(
  sceneJson: string,
): Promise<CanvasResult | null> {
  await loadModules();
  const { Excalidraw, exportToSvg } = excalidrawModule!;
  const React = reactModule!;
  const { createRoot } = reactDomModule!;

  return new Promise<CanvasResult | null>((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "canvas-overlay";
    const dialog = document.createElement("div");
    dialog.className = "canvas-dialog";
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    let closed = false;

    const finish = (result: CanvasResult | null): void => {
      if (closed) return;
      closed = true;
      root.unmount();
      backdrop.remove();
      resolve(result);
    };

    const root = createRoot(dialog);

    const CanvasEditor = (): ReactElement => {
      const apiRef = React.useRef<unknown>(null);
      const latest = React.useRef<readonly unknown[]>([]);

      const save = async (): Promise<void> => {
        const api = apiRef.current as {
          getSceneElementsIncludingDeleted?: () => readonly unknown[];
        } | null;
        const elements =
          api?.getSceneElementsIncludingDeleted?.() ?? latest.current;
        const sceneStr = JSON.stringify({
          type: "excalidraw",
          version: 2,
          elements,
        });
        let preview = "";
        try {
          const svg = await exportToSvg({
            elements: elements as never[],
            files: null,
            appState: { exportBackground: true, viewBackgroundColor: "#ffffff" },
          });
          preview = localizeSvgFonts(svg.outerHTML);
        } catch {
          preview = "";
        }
        finish({ scene: sceneStr, preview });
      };

      return React.createElement(
        "div",
        { className: "canvas-frame" },
        React.createElement(
          "div",
          { className: "canvas-header" },
          React.createElement("span", { className: "canvas-title" }, "Canvas"),
          React.createElement(
            "div",
            { className: "canvas-actions" },
            React.createElement(
              "button",
              {
                className: "canvas-btn",
                type: "button",
                onClick: () => finish(null),
              },
              "Cancel",
            ),
            React.createElement(
              "button",
              {
                className: "canvas-btn primary",
                type: "button",
                onClick: () => void save(),
              },
              "Save",
            ),
          ),
        ),
        React.createElement(
          "div",
          { className: "canvas-body" },
          React.createElement(Excalidraw, {
            initialData: sceneJson ? (JSON.parse(sceneJson) as object) : {},
            onChange: (elements: readonly unknown[]) => {
              latest.current = elements;
            },
            excalidrawAPI: (api: unknown) => {
              apiRef.current = api;
            },
          }),
        ),
      );
    };

    root.render(React.createElement(CanvasEditor));
  });
}

export { showCanvasError };
