// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({})) }));
import { createEditor } from "./editor";
import { installImagePaste } from "./paste";

describe("freeform drag-move", () => {
  it("repositions a dragged node to the drop point", () => {
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

    // find the image's top-level position and select the node (as a drag would)
    let imgPos = 0;
    editor.state.doc.forEach((node, offset) => {
      if (node.type.name === "image") imgPos = offset;
    });
    editor.chain().setNodeSelection(imgPos).run();

    const view = editor.view;
    const rect = { left: 0, top: 0 } as DOMRect;
    vi.spyOn(view.dom, "getBoundingClientRect").mockReturnValue(rect as DOMRect);

    const dataTransfer = new DataTransfer();
    const event = new DragEvent("drop", { bubbles: true });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    Object.defineProperty(event, "clientX", { value: 300 });
    Object.defineProperty(event, "clientY", { value: 220 });

    const handled = (view.someProp("handleDOMEvents") as unknown) === undefined;
    expect(handled).toBe(false);

    // invoke the editorProps handleDrop directly
    const props = editor.view.props;
    expect(typeof props.handleDrop).toBe("function");
    const result = props.handleDrop?.(view, event, null as never, true);

    expect(result).toBe(true);
    let placed: string | null = null;
    editor.state.doc.forEach((node) => {
      if (node.type.name === "image") {
        placed = (node.attrs.freeformPos as string | null) ?? null;
      }
    });
    expect(placed).toBe("300,220");
    editor.destroy();
  });

  it("ignores drops that are not node selections", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const editor = createEditor(host, "", { onUpdate: () => {} });
    installImagePaste(editor);
    const props = editor.view.props;
    const event = new DragEvent("drop", { clientX: 10, clientY: 10 });
    const result = props.handleDrop?.(editor.view, event, null as never, true);
    expect(result).toBe(false);
    editor.destroy();
  });
});
