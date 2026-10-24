import { Extension } from "@tiptap/core";
import type { MarkType } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
import type { Mark as PMMark, Node as PMNode } from "@tiptap/pm/model";
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
      removeEmptyTextStyleTextOnly: () => ReturnType;
      setFontFamily: (fontId: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
      setFontSizePx: (px: number) => ReturnType;
      unsetFontSizePx: () => ReturnType;
    };
  }
}

/**
 * Remove `textStyle` marks that no longer carry any attribute. Scoped to text
 * nodes only: tiptap's `removeEmptyTextStyle` also strips marks across
 * non-textblock ancestors such as list containers, which would undo a font
 * change applied to list items.
 */
function removeEmptyTextStyle(tr: Transaction, textStyle: MarkType | undefined): void {
  const { selection } = tr;
  if (!textStyle) return;
  tr.doc.nodesBetween(
    selection.from,
    selection.to,
    (node: PMNode, pos: number) => {
      if (
        node.isText &&
        node.marks.some(
          (mark: PMMark) =>
            mark.type === textStyle &&
            Object.values(mark.attrs).every((value) => !value),
        )
      ) {
        tr.removeMark(pos, pos + node.nodeSize, textStyle);
      }
    },
  );
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
      removeEmptyTextStyleTextOnly:
        () =>
        ({ tr, state }) => {
          removeEmptyTextStyle(tr, state.schema.marks.textStyle);
          return true;
        },
      setFontFamily:
        (fontId: string) =>
        ({ chain }) => {
          const stack = EDITOR_FONTS.some((f) => f.id === fontId)
            ? fontStack(fontId)
            : null;
          if (!stack) return false;
          return chain()
            .setMark("textStyle", { fontFamily: stack })
            .removeEmptyTextStyleTextOnly()
            .run();
        },
      unsetFontFamily:
        () =>
        ({ chain }) => {
          return chain()
            .setMark("textStyle", { fontFamily: null })
            .removeEmptyTextStyleTextOnly()
            .run();
        },
      setFontSizePx:
        (px: number) =>
        ({ chain }) => {
          if (!Number.isFinite(px) || px <= 0) return false;
          return chain()
            .setMark("textStyle", { fontSizePx: px })
            .removeEmptyTextStyleTextOnly()
            .run();
        },
      unsetFontSizePx:
        () =>
        ({ chain }) => {
          return chain()
            .setMark("textStyle", { fontSizePx: null })
            .removeEmptyTextStyleTextOnly()
            .run();
        },
    };
  },
});
