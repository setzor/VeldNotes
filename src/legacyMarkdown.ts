import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import TokenCtor from "markdown-it/lib/token.mjs";
import { getSchema } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Image as BaseImage } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { MarkdownParser } from "prosemirror-markdown";
import type { Schema } from "@tiptap/pm/model";
import type { ParseSpec } from "prosemirror-markdown";

/**
 * One-time import of legacy Markdown entries. VeldNotes persists entries as
 * TipTap JSON documents now; this module only reads the old `.md` files so
 * they convert transparently the first time they are opened.
 */

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
  Link.configure({ openOnClick: false }),
  Table.configure({ resizable: true }),
  TableRow,
  TableCell,
  TableHeader,
];

function schema(): Schema {
  return getSchema(extensions);
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
  link: { mark: "link", getAttrs: (tok) => ({ href: tok.attrGet("href") }) },
};

const parser = new MarkdownParser(schema(), tokenizer, tokens);

/** Parse a legacy Markdown entry into a TipTap document. */
export function tiptapContentFromMarkdown(
  markdown: string,
): JSONContent | null {
  if (!markdown.trim()) return null;
  const doc = parser.parse(markdown);
  if (!doc) return null;
  return doc.toJSON() as unknown as JSONContent;
}
