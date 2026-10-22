import { marked } from "marked";
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import { getSchema } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { MarkdownParser, MarkdownSerializer, MarkdownSerializerState } from "prosemirror-markdown";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import type { Mark } from "@tiptap/pm/model";
import type { ParseSpec } from "prosemirror-markdown";

marked.setOptions({ gfm: true, breaks: false });

const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Image.configure({ inline: true }),
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

const tokenizer = MarkdownIt("commonmark", { html: false });

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
    getAttrs: (tok) => ({
      src: tok.attrGet("src"),
      title: tok.attrGet("title") || null,
      alt: tok.children?.[0]?.content || null,
    }),
  },
  hardbreak: { node: "hardBreak" },
  em: { mark: "italic" },
  strong: { mark: "bold" },
  s: { mark: "strike" },
  code_inline: { mark: "code", noCloseToken: true },
};

const parser = new MarkdownParser(schema(), tokenizer, tokens);

export function markdownToTiptapContent(markdown: string): string {
  if (!markdown.trim()) return "";
  const doc = parser.parse(markdown);
  if (!doc) return markdown;
  return JSON.stringify(doc.toJSON());
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
  image(state, node) {
    const src = (node.attrs.src as string).replace(/[()]/g, "\\$&");
    const alt = state.esc((node.attrs.alt as string) || "");
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
