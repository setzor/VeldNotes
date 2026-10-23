import { Extension } from "@tiptap/core";
import { EDITOR_FONTS, fontStack } from "./fonts";

/**
 * Per-selection typography. Font family and size are stored as TextStyle
 * marks on the selected text, mirroring how @tiptap/extension-color stores
 * color. Document-wide defaults remain in app settings (default font and
 * size); anything set here overrides the default for that text only.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    typography: {
      setFontFamily: (fontId: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
      setFontSizePx: (px: number) => ReturnType;
      unsetFontSizePx: () => ReturnType;
    };
  }
}

export const Typography = Extension.create({
  name: "typography",

  addOptions() {
    return {
      types: ["textStyle"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (element) =>
              element.style.fontFamily?.replace(/\"/g, "'") || null,
            renderHTML: (attributes) => {
              if (!attributes.fontFamily) return {};
              return {
                style: `font-family: ${attributes.fontFamily}`,
              };
            },
          },
          fontSizePx: {
            default: null,
            parseHTML: (element) => {
              const raw = element.style.fontSize;
              const m = raw.match(/^([\d.]+)px$/);
              return m ? Number(m[1]) : null;
            },
            renderHTML: (attributes) => {
              if (!attributes.fontSizePx) return {};
              return {
                style: `font-size: ${attributes.fontSizePx}px`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontFamily:
        (fontId: string) =>
        ({ chain }) => {
          const stack = EDITOR_FONTS.some((f) => f.id === fontId)
            ? fontStack(fontId)
            : null;
          if (!stack) return false;
          return chain()
            .setMark("textStyle", { fontFamily: stack })
            .removeEmptyTextStyle()
            .run();
        },
      unsetFontFamily:
        () =>
        ({ chain }) =>
          chain()
            .setMark("textStyle", { fontFamily: null })
            .removeEmptyTextStyle()
            .run(),
      setFontSizePx:
        (px: number) =>
        ({ chain }) => {
          if (!Number.isFinite(px) || px <= 0) return false;
          return chain()
            .setMark("textStyle", { fontSizePx: px })
            .removeEmptyTextStyle()
            .run();
        },
      unsetFontSizePx:
        () =>
        ({ chain }) =>
          chain()
            .setMark("textStyle", { fontSizePx: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});
