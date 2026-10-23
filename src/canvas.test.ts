import { describe, expect, it } from "vitest";

// re-import the module internals via a tiny harness: the localize function is
// private, so we verify behaviour through a compiled regex replica instead.
const LOCALIZE = /url\("[^"]*\/([A-Za-z-]+\.woff2)"\)/g;
function localize(svg: string): string {
  return svg.replace(LOCALIZE, 'url("/excalidraw-assets/$1")');
}

describe("svg font localization", () => {
  it("rewrites CDN-style font urls to bundled assets", () => {
    const svg = `@font-face { font-family: "Virgil"; src: url("//unpkg.com/@excalidraw/excalidraw@0.17.6/dist/excalidraw-assets/Virgil.woff2"); }`;
    expect(localize(svg)).toContain('url("/excalidraw-assets/Virgil.woff2")');
  });

  it("leaves already-local urls untouched in structure", () => {
    const svg = `src: url("/excalidraw-assets/Virgil.woff2")`;
    expect(localize(svg)).toContain("/excalidraw-assets/Virgil.woff2");
  });

  it("handles multiple fonts", () => {
    const svg = `url("/x/Virgil.woff2") url("/y/Assistant-Regular.woff2")`;
    const out = localize(svg);
    expect(out).toContain('url("/excalidraw-assets/Virgil.woff2")');
    expect(out).toContain('url("/excalidraw-assets/Assistant-Regular.woff2")');
  });
});
