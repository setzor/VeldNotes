/** Frosted in-app prompt. Replaces window.prompt, which Tauri webviews do
 * not reliably support. Resolves null on cancel, string on confirm. */

export function frostedPrompt(
  title: string,
  defaultValue = "",
): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "prompt-overlay";
    overlay.hidden = false;
    const dialog = document.createElement("div");
    dialog.id = "prompt-dialog";
    dialog.setAttribute("role", "alertdialog");

    const label = document.createElement("div");
    label.id = "prompt-title";
    label.textContent = title;

    const input = document.createElement("input");
    input.id = "prompt-input";
    input.type = "text";
    input.value = defaultValue;

    const actions = document.createElement("div");
    actions.id = "prompt-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    const ok = document.createElement("button");
    ok.type = "button";
    ok.id = "prompt-ok";
    ok.textContent = "OK";

    actions.append(cancel, ok);
    dialog.append(label, input, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    input.focus();
    input.select();

    const done = (answer: string | null): void => {
      overlay.remove();
      window.removeEventListener("keydown", onKey);
      resolve(answer);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") done(null);
      if (event.key === "Enter") done(input.value);
    };
    ok.addEventListener("click", () => done(input.value));
    cancel.addEventListener("click", () => done(null));
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) done(null);
    });
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
    });
    window.addEventListener("keydown", onKey);
  });
}
