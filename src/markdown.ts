import { marked } from "marked";
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import TokenCtor from "markdown-it/lib/token.mjs";
import { getSchema } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Image as BaseImage } from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import {
  MarkdownParser,
  MarkdownSerializer,
  MarkdownSerializerState,
} from "prosemirror-markdown";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import type { Mark } from "@tiptap/pm/model";
import type { ParseSpec } from "prosemirror-markdown";

marked.setOptions({ gfm: true, breaks: false });

const WidthImage = BaseImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const raw = (el as HTMLElement).getAttribute("width");
          if (raw && /^\d+$/.test(raw)) return Number(raw);
          const style = (el as HTMLElement).getAttribute("style") ?? "";
          const m = style.match(/width:\s*(\d+)px/);
          return m ? Number(m[1]) : null;
        },
        renderHTML: (attrs) => {
          const w = attrs.width as number | null;
          return w ? { style: `width: ${w}px` } : {};
        },
      },
    };
  },
});

const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  WidthImage.configure({ inline: true }),
  Table.configure({ resizable: true }),
  TableRow,
  TableCell,
  TableHeader,
];

function schema(): Schema {
  return getSchema(extensions);
}

export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

function listIsTight(tokens: Token[], i: number): boolean {
  while (i < tokens.length) {
    const t = tokens[i];
    if (!t) return false;
    if (t.type === "list_item_open") return true;
    if (t.type !== "list_item_open") return Boolean(t.hidden);
    i++;
  }
  return false;
}

const tokenizer = MarkdownIt({ html: false });

/**
 * Table cells contain bare `inline` tokens, but TipTap's table cell nodes
 * require block content. Wrap each cell's inline token in synthetic
 * paragraph_open/paragraph_close tokens so the parser produces paragraphs.
 */
function wrapCellParagraphs(raw: Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < raw.length; i++) {
    const tok = raw[i];
    if ((tok.type === "th_open" || tok.type === "td_open") && raw[i + 1]?.type === "inline") {
      const inline = raw[i + 1];
      const open = new TokenCtor("paragraph_open", "p", 1);
      const close = new TokenCtor("paragraph_close", "p", -1);
      out.push(tok, open, inline, close);
      i += 1;
    } else {
      out.push(tok);
    }
  }
  return out;
}

const baseTokenize = tokenizer.parse.bind(tokenizer);
tokenizer.parse = (src: string, env: Record<string, unknown>) =>
  wrapCellParagraphs(baseTokenize(src, env));

const tokens: { [name: string]: ParseSpec } = {
  blockquote: { block: "blockquote" },
  paragraph: { block: "paragraph" },
  list_item: { block: "listItem" },
  bullet_list: {
    block: "bulletList",
    getAttrs: (_tok, toks, i) => ({ tight: listIsTight(toks, i) }),
  },
  ordered_list: {
    block: "orderedList",
    getAttrs: (tok, toks, i) => ({
      order: +(tok.attrGet("start") ?? "") || 1,
      tight: listIsTight(toks, i),
    }),
  },
  heading: {
    block: "heading",
    getAttrs: (tok) => ({ level: +tok.tag.slice(1) }),
  },
  code_block: { block: "codeBlock", noCloseToken: true },
  fence: {
    block: "codeBlock",
    getAttrs: (tok) => ({ language: tok.info || null }),
    noCloseToken: true,
  },
  hr: { node: "horizontalRule" },
  image: {
    node: "image",
    getAttrs: (tok) => {
      let alt: string | null = tok.children?.[0]?.content ?? null;
      let width: number | null = null;
      if (alt) {
        const m = alt.match(/^(.*)\|(\d+)$/);
        if (m) {
          alt = m[1] || null;
          width = Number(m[2]);
        }
      }
      return {
        src: tok.attrGet("src"),
        title: tok.attrGet("title") || null,
        alt,
        width,
      };
    },
  },
  hardbreak: { node: "hardBreak" },
  table: { block: "table" },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: "tableRow" },
  th: { block: "tableHeader" },
  td: { block: "tableCell" },
  em: { mark: "italic" },
  strong: { mark: "bold" },
  s: { mark: "strike" },
  code_inline: { mark: "code", noCloseToken: true },
};

/* --- table serialization ---------------------------------------------- */

function tableWidth(node: PMNode): number {
  if (!node.firstChild) return 1;
  return node.firstChild.childCount;
}

function cellToMarkdown(cell: PMNode): string {
  const cellSerializer = new MarkdownSerializer(nodes, marks);
  return cellSerializer
    .serialize(cell, { tightLists: true })
    .replace(/\n/g, " ")
    .trim();
}

function serializeTable(state: MarkdownSerializerState, node: PMNode): void {
  const width = tableWidth(node);
  const lines: string[] = [];
  let sawHeader = false;
  node.forEach((row) => {
    const cells: string[] = [];
    row.forEach((cell) => {
      cells.push(cellToMarkdown(cell).replace(/\|/g, "\\|"));
    });
    while (cells.length < width) cells.push("");
    lines.push("| " + cells.join(" | ") + " |");
    if (!sawHeader) {
      lines.push("|" + " --- |".repeat(width));
      sawHeader = true;
    }
  });
  state.write(lines.join("\n"));
  state.closeBlock(node);
}

const parser = new MarkdownParser(schema(), tokenizer, tokens);

export function tiptapContentFromMarkdown(
  markdown: string,
): JSONContent | null {
  if (!markdown.trim()) return null;
  const doc = parser.parse(markdown);
  if (!doc) return null;
  return doc.toJSON() as unknown as JSONContent;
}

/**
 * Legacy support: entries saved by older builds could contain a raw TipTap
 * JSON document string instead of Markdown. Detect that and return the parsed
 * object so the editor renders it instead of showing literal JSON text.
 */
export function reviveSavedContent(raw: string): JSONContent | string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.includes('"type":"doc"')) {
    try {
      const parsed = JSON.parse(trimmed) as { type?: string };
      if (parsed && parsed.type === "doc") {
        return parsed as unknown as JSONContent;
      }
    } catch {
      // fall through: treat as markdown
    }
  }
  return raw;
}

type NodeSerializer = (
  state: MarkdownSerializerState,
  node: PMNode,
  parent: PMNode,
  index: number,
) => void;

const nodes: Record<string, NodeSerializer> = {
  paragraph(state, node) {
    state.renderInline(node);
    state.closeBlock(node);
  },
  heading(state, node) {
    state.write(state.repeat("#", node.attrs.level as number) + " ");
    state.renderInline(node, false);
    state.closeBlock(node);
  },
  blockquote(state, node) {
    state.wrapBlock("> ", null, node, () => state.renderContent(node));
  },
  codeBlock(state, node) {
    state.write("```" + ((node.attrs.language as string) || "") + "\n");
    state.text(node.textContent, false);
    state.ensureNewLine();
    state.write("```");
    state.closeBlock(node);
  },
  bulletList(state, node) {
    state.renderList(node, "  ", () => "- ");
  },
  orderedList(state, node) {
    const start = (node.attrs.order as number) || 1;
    state.renderList(node, "  ", (i) => `${start + i}. `);
  },
  listItem(state, node) {
    state.renderContent(node);
  },
  horizontalRule(_state, _node, parent) {
    return parent.type.name === "doc" ? "---\n" : "\n---\n";
  },
  table: serializeTable,
  tableRow() {},
  tableHeader() {},
  tableCell() {},
  image(state, node) {
    const src = (node.attrs.src as string).replace(/[()]/g, "\\$&");
    let alt = state.esc((node.attrs.alt as string) || "");
    const width = node.attrs.width as number | null;
    if (width) alt = `${alt}|${width}`;
    const title = node.attrs.title as string | null;
    state.write(
      `![${alt}](${src}` +
        (title ? ` "${title.replace(/"/g, '\\"')}"` : "") +
        ")",
    );
  },
  hardBreak(state, node, parent, index) {
    for (let i = index + 1; i < parent.childCount; i++) {
      const next = parent.child(i);
      if (next.type !== node.type) {
        state.write("\\\n");
        return;
      }
    }
  },
  text(state, node) {
    state.text(node.text ?? "", false);
  },
};

function backticksFor(text: string): string {
  const runs = text.match(/`+/g) ?? [];
  const longest = runs.reduce((a, r) => Math.max(a, r.length), 0);
  return "`".repeat(Math.max(longest + 1, 1));
}

const marks = {
  bold: { open: "**", close: "**", expelEnclosingWhitespace: true },
  italic: { open: "*", close: "*", expelEnclosingWhitespace: true },
  strike: { open: "~~", close: "~~", expelEnclosingWhitespace: true },
  code: {
    open(
      _state: MarkdownSerializerState,
      _mark: Mark,
      parent: PMNode,
      index: number,
    ) {
      return backticksFor(parent.child(index ?? 0).text ?? "");
    },
    close(
      _state: MarkdownSerializerState,
      _mark: Mark,
      parent: PMNode,
      index: number,
    ) {
      return backticksFor(parent.child(index ?? 0).text ?? "");
    },
    escape: false,
  },
  link: {
    open() {
      return "[";
    },
    close(_state: MarkdownSerializerState, mark: Mark) {
      return "](" + (mark.attrs.href as string) + ")";
    },
  },
};

const serializer = new MarkdownSerializer(nodes, marks);

export function tiptapDocToMarkdown(doc: unknown): string {
  const pmSchema = schema();
  const node = pmSchema.nodeFromJSON(doc as never);
  return serializer.serialize(node, { tightLists: true }).trimEnd() + "\n";
}
