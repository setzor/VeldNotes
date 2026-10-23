// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({})) }));
import { createEditor } from "./editor";
import { installImagePaste } from "./paste";

interface DraggingLike {
  node: { from: number; to: number } | null;
  slice: unknown;
}

type ViewWithDragging = { dragging: DraggingLike | null; dom: HTMLElement };

function dropEvent(x: number, y: number): DragEvent {
  const dt = new DataTransfer();
  const event = new DragEvent("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: dt });
  Object.defineProperty(event, "clientX", { value: x });
  Object.defineProperty(event, "clientY", { value: y });
  return event;
}

describe("freeform drag-move", () => {
  it("moves a dragged image to the drop point without duplicating it", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    installImagePaste(editor);
    editor
      .chain()
      .insertContent({
        type: "image",
        attrs: { src: "../media/move.png", alt: "pic" },
      })
      .run();

    let imgPos = 0;
    editor.state.doc.forEach((node, offset) => {
      if (node.type.name === "image") imgPos = offset;
    });

    // simulate what ProseMirror records at dragstart for an atom drag
    const view = editor.view as unknown as ViewWithDragging;
    view.dragging = {
      node: { from: imgPos, to: imgPos + 2 },
      slice: null,
    };
    vi.spyOn(view.dom, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
    } as DOMRect);

    const props = editor.view.props;
    const result = props.handleDrop?.(
      editor.view,
      dropEvent(300, 220),
      null as never,
      true,
    );

    expect(result).toBe(true);
    let imageCount = 0;
    let placed: string | null = null;
    editor.state.doc.forEach((node) => {
      if (node.type.name === "image") {
        imageCount += 1;
        placed = (node.attrs.freeformPos as string | null) ?? null;
      }
    });
    expect(imageCount).toBe(1); // moved, not copied
    expect(placed).toBe("300,220");
    editor.destroy();
  });

  it("moves a dragged canvas sketch without duplicating it", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    installImagePaste(editor);
    editor
      .chain()
      .insertContent({
        type: "canvasBlock",
        attrs: { scene: '{"elements":[]}', preview: "<svg></svg>" },
      })
      .run();

    let canvasPos = 0;
    editor.state.doc.forEach((node, offset) => {
      if (node.type.name === "canvasBlock") canvasPos = offset;
    });
    const view = editor.view as unknown as ViewWithDragging;
    view.dragging = {
      node: { from: canvasPos, to: canvasPos + 1 },
      slice: null,
    };
    vi.spyOn(view.dom, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
    } as DOMRect);

    const result = editor.view.props.handleDrop?.(
      editor.view,
      dropEvent(500, 400),
      null as never,
      true,
    );
    expect(result).toBe(true);
    let count = 0;
    let placed: string | null = null;
    editor.state.doc.forEach((node) => {
      if (node.type.name === "canvasBlock") {
        count += 1;
        placed = (node.attrs.freeformPos as string | null) ?? null;
      }
    });
    expect(count).toBe(1);
    expect(placed).toBe("500,400");
    editor.destroy();
  });

  it("returns false for non-node drags so the default handler runs", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    installImagePaste(editor);
    (editor.view as unknown as ViewWithDragging).dragging = null;
    const result = editor.view.props.handleDrop?.(
      editor.view,
      dropEvent(10, 10),
      null as never,
      true,
    );
    expect(result).toBe(false);
    editor.destroy();
  });
});
