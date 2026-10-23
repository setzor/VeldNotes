interface MenuEntry {
  label: string;
  run: () => void;
  disabled?: boolean;
}

function hasSelection(): boolean {
  const sel = window.getSelection();
  return !!sel && !sel.isCollapsed && sel.toString().trim() !== "";
}

function editableTarget(target: HTMLElement): HTMLElement | null {
  return target.closest(
    "input, textarea, [contenteditable]:not([contenteditable='false']), .entry-editor",
  );
}

function buildEntries(target: HTMLElement): MenuEntry[] {
  const entries: MenuEntry[] = [];
  const editable = editableTarget(target);
  const inEditor = !!target.closest(".entry-editor");
  const img = target.closest(".entry-image");

  if (img) {
    entries.push({
      label: "Copy image",
      run: () => {
        void navigator.clipboard
          .writeText((img.querySelector("img")?.dataset.pendingSrc as string) ?? "")
          .catch(() => {});
      },
    });
    return entries;
  }

  if (editable || inEditor) {
    entries.push(
      { label: "Cut", run: () => void document.execCommand("cut") },
      { label: "Copy", run: () => void document.execCommand("copy") },
      {
        label: "Paste",
        run: () => {
          void navigator.clipboard
            .readText()
            .then((text) => document.execCommand("insertText", false, text))
            .catch(() => {});
        },
      },
      {
        label: "Select all",
        run: () => {
          if (editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement) {
            editable.select();
          } else {
            document.execCommand("selectAll");
          }
        },
      },
    );
    if (inEditor) {
      entries.push(
        { label: "Bold", run: () => void document.execCommand("bold") },
        { label: "Italic", run: () => void document.execCommand("italic") },
      );
    }
    return entries;
  }

  entries.push({
    label: "Copy",
    run: () => void document.execCommand("copy"),
    disabled: !hasSelection(),
  });
  entries.push({
    label: "Select all",
    run: () => void document.execCommand("selectAll"),
  });
  return entries;
}

export function installContextMenu(): void {
  const menu = document.createElement("div");
  menu.id = "context-menu";
  menu.hidden = true;
  document.body.appendChild(menu);

  const close = (): void => {
    menu.hidden = true;
    menu.textContent = "";
  };

  document.addEventListener("contextmenu", (event) => {
    const target = event.target as HTMLElement;
    if (!target) return;
    event.preventDefault();
    const entries = buildEntries(target);
    if (entries.length === 0) return;

    menu.textContent = "";
    for (const entry of entries) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "ctx-item" + (entry.disabled ? " disabled" : "");
      item.textContent = entry.label;
      item.disabled = entry.disabled === true;
      item.addEventListener("click", () => {
        close();
        entry.run();
      });
      menu.appendChild(item);
    }

    menu.hidden = false;
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = event.clientX;
    let y = event.clientY;
    if (x + rect.width > vw - 8) x = Math.max(8, vw - rect.width - 8);
    if (y + rect.height > vh - 8) y = Math.max(8, vh - rect.height - 8);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    (menu.firstElementChild as HTMLElement | null)?.focus();
  });

  document.addEventListener("mousedown", (event) => {
    if (!menu.hidden && !menu.contains(event.target as Node)) close();
  });
  window.addEventListener("blur", close);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      close();
      event.stopPropagation();
    }
  });
}
