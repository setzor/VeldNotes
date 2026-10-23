import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/**
 * Freeform sheet behaviour (OneNote-style): the document is a canvas on
 * which top-level blocks can be placed at arbitrary x/y positions.
 *
 * - A block with a `freeformPos` of "x,y" (px) renders absolutely
 *   positioned on the sheet ("placed").
 * - Blocks without it keep normal document flow, so existing entries stay
 *   readable and migrate organically.
 * - Clicking empty sheet space creates a paragraph at the click point and
 *   focuses it, so you can click anywhere and start typing.
 * - Enter at the end of a placed block stacks the new block below it
 *   (x inherited, y advanced by the previous block's rendered height).
 */

export const freeformKey = new PluginKey("freeformSheet");

const PLACED_TYPES = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "image",
  "canvasBlock",
];

const GUTTER = 14;
const FALLBACK_HEIGHT = 56;

export interface XY {
  x: number;
  y: number;
}

export function parsePos(value: unknown): XY | null {
  if (typeof value !== "string") return null;
  const m = value.match(/^(-?\d+),(-?\d+)$/);
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]) };
}

function posAttrs(value: unknown): Record<string, string> {
  const xy = parsePos(value);
  if (!xy) return {};
  return {
    "data-placed": "",
    "data-x": String(xy.x),
    "data-y": String(xy.y),
    style: `position: absolute; left: ${xy.x}px; top: ${xy.y}px;`,
  };
}

/** Measure the on-screen height of a rendered top-level block. */
function blockHeight(view: EditorView, pos: number): number | null {
  try {
    const dom = view.nodeDOM(pos);
    if (dom instanceof HTMLElement) {
      const h = dom.getBoundingClientRect().height;
      if (h > 0) return h;
    }
  } catch {
    // not rendered
  }
  return null;
}

/** Insert an empty paragraph at (x, y) and focus it. */
export function placeNewBlock(view: EditorView, x: number, y: number): void {
  const { state } = view;
  const paragraphType = state.schema.nodes.paragraph;
  if (!paragraphType) return;
  const pos = state.doc.content.size;
  const tr = state.tr;
  tr.insert(pos, paragraphType.create({ freeformPos: `${x},${y}` }));
  tr.setSelection(
    TextSelection.near(tr.doc.resolve(pos + 1), 1),
  );
  view.dispatch(tr);
  view.focus();
}

const SHEET_PAD = 320;

/**
 * Keep the sheet tall enough that placed blocks never fall off the bottom,
 * while leaving empty pages at a natural height (no forced scrolling). The
 * min-height CSS variable is raised only when content actually needs it.
 */
function growSheet(view: EditorView): void {
  let maxY = 0;
  view.state.doc.forEach((node) => {
    const xy = parsePos(node.attrs.freeformPos);
    if (xy) maxY = Math.max(maxY, xy.y);
  });
  const host = view.dom as HTMLElement;
  if (maxY > 0) {
    host.style.setProperty("--sheet-min-height", `${maxY + SHEET_PAD}px`);
  } else {
    host.style.removeProperty("--sheet-min-height");
  }
}

/**
 * When a block is created right after a placed block (e.g. Enter), give it
 * coordinates so it stacks below instead of overlapping. Only newly added
 * flow blocks (indexes beyond the previous state) are stacked - existing
 * blocks keep their position so later edits never teleport content.
 */
function stackNewBlocks(
  view: EditorView,
  prevChildCount: number,
): void {
  const { state } = view;
  const doc = state.doc;
  const tr = state.tr;
  let changed = false;

  let prev: { pos: number; xy: XY } | null = null;
  let index = 0;
  doc.forEach((node, offset) => {
    const xy = parsePos(node.attrs.freeformPos);
    const isNew = index >= prevChildCount;
    if (!xy && prev && isNew) {
      const height = blockHeight(view, prev.pos) ?? FALLBACK_HEIGHT;
      const newY = prev.xy.y + height + GUTTER;
      tr.setNodeMarkup(offset, undefined, {
        ...node.attrs,
        freeformPos: `${prev.xy.x},${newY}`,
      });
      changed = true;
      prev = { pos: offset, xy: { x: prev.xy.x, y: newY } };
    } else if (xy) {
      prev = { pos: offset, xy };
    } else {
      prev = null;
    }
    index += 1;
  });

  if (changed) {
    view.dispatch(tr);
  }
}

export const FreeformSheet = Extension.create({
  name: "freeformSheet",

  addGlobalAttributes() {
    return [
      {
        types: PLACED_TYPES,
        attributes: {
          freeformPos: {
            default: null,
            parseHTML: (el) => {
              const host = el as HTMLElement;
              const x = host.getAttribute("data-x");
              const y = host.getAttribute("data-y");
              if (x === null || y === null) return null;
              return `${Number(x)},${Number(y)}`;
            },
            renderHTML: (attrs) => posAttrs(attrs.freeformPos),
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: freeformKey,
        view() {
          return {
            update(view, prevState) {
              if (view.state.doc.eq(prevState.doc)) return;
              if (editor.isDestroyed) return;
              if (view.state.doc.childCount > prevState.doc.childCount) {
                stackNewBlocks(view, prevState.doc.childCount);
              }
              growSheet(view);
            },
          };
        },
        props: {
          handleDOMEvents: {
            mousedown(view, event) {
              const target = event.target as HTMLElement;
              if (target !== view.dom) return false;
              const rect = view.dom.getBoundingClientRect();
              const x = Math.max(0, Math.round(event.clientX - rect.left));
              const y = Math.max(0, Math.round(event.clientY - rect.top));
              placeNewBlock(view, x, y);
              return true;
            },
          },
        },
      }),
    ];
  },
});
