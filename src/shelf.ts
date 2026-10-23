import {
  createNotebook,
  listNotebooks,
  renameNotebook,
  type NotebookMeta,
} from "./api";

export const COVER_STYLES = [
  { id: "kraft", label: "Kraft", colors: ["#a8862d", "#7d5f16"] },
  { id: "forest", label: "Forest", colors: ["#4a7a3c", "#2f5226"] },
  { id: "meadow", label: "Meadow", colors: ["#3e6a8f", "#274b68"] },
  { id: "dusk", label: "Dusk", colors: ["#74499a", "#4e2f68"] },
  { id: "rose", label: "Rose", colors: ["#b35656", "#8a3a3a"] },
  { id: "midnight", label: "Midnight", colors: ["#5648a8", "#372d75"] },
  { id: "sage", label: "Sage", colors: ["#7d9b76", "#55704f"] },
  { id: "ember", label: "Ember", colors: ["#c26a3a", "#8f4420"] },
] as const;

export type CoverId = (typeof COVER_STYLES)[number]["id"];

/** Curated sticker emojis offered for notebook covers. */
export const COVER_EMOJIS = [
  "\u{1F342}", // fallen leaf
  "\u{1F33F}", // herb
  "\u{1F343}", // leaf fluttering in wind
  "\u{1F41C}", // bug
  "\u{1F426}", // bird
  "\u{1F98A}", // fox
  "\u{1F43C}", // panda
  "\u{1F42F}", // tiger
  "\u{1F308}", // rainbow
  "\u{2B50}",  // star
  "\u{1F31F}", // glowing star
  "\u{1F4AB}", // dizzy
  "\u{1F31E}", // sun with face
  "\u{1F319}", // crescent moon
  "\u{2600}\u{FE0F}",  // sunny
  "\u{26C4}",  // snowman
  "\u{1F341}", // maple leaf
  "\u{1F353}", // strawberry
  "\u{1F347}", // grapes
  "\u{1F34C}", // banana
  "\u{2615}",  // coffee
  "\u{1F37C}", // milk glass? beer mug
  "\u{1F4DA}", // books
  "\u{1F58D}\u{FE0F}", // crayon
  "\u{270D}\u{FE0F}",  // writing hand
  "\u{1F3AF}", // dart
  "\u{1F6F6}", // canoe
  "\u{1F680}", // rocket
  "\u{1FA91}", // chair
  "\u{1F9ED}", // compass
] as const;

export function coverColors(cover: string): readonly [string, string] {
  const found = COVER_STYLES.find((c) => c.id === cover);
  return (found?.colors ?? COVER_STYLES[0].colors) as readonly [string, string];
}

export function coverLabel(cover: string): string {
  return COVER_STYLES.find((c) => c.id === cover)?.label ?? "Kraft";
}

const LAST_KEY = "veldnotes.lastNotebook";

export function loadLastNotebook(): string {
  return localStorage.getItem(LAST_KEY) || "default";
}

export function saveLastNotebook(id: string): void {
  localStorage.setItem(LAST_KEY, id);
}

export function makeCoverSwatch(
  cover: string,
  tag?: "div" | "span" | "button",
): HTMLElement {
  const el = document.createElement(tag ?? "div");
  const [a, b] = coverColors(cover);
  el.style.background = `linear-gradient(150deg, ${a}, ${b})`;
  return el;
}

export interface ShelfCallbacks {
  onSwitch: (id: string) => void;
  onMetaChange?: (meta: NotebookMeta) => void;
}

export function renderShelf(
  grid: HTMLElement,
  notebooks: NotebookMeta[],
  activeId: string,
  callbacks: ShelfCallbacks,
): void {
  grid.textContent = "";
  for (const nb of notebooks) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "shelf-item" + (nb.id === activeId ? " active" : "");
    item.dataset.id = nb.id;

    const swatch = makeCoverSwatch(nb.cover, "div");
    swatch.className = "shelf-cover";
    const spine = document.createElement("div");
    spine.className = "shelf-cover-spine";
    swatch.prepend(spine);
    if (nb.emoji) {
      const sticker = document.createElement("span");
      sticker.className = "shelf-cover-emoji";
      sticker.textContent = nb.emoji;
      swatch.appendChild(sticker);
    }
    const name = document.createElement("span");
    name.className = "shelf-name";
    name.textContent = nb.name;
    item.append(swatch, name);

    item.addEventListener("click", () => {
      if (nb.id !== activeId) callbacks.onSwitch(nb.id);
    });
    item.addEventListener("dblclick", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = nb.name;
      input.className = "shelf-rename";
      input.maxLength = 48;
      name.replaceWith(input);
      input.focus();
      input.select();
      const commit = () => {
        const newName = input.value.trim();
        input.replaceWith(name);
        if (newName && newName !== nb.name) {
          void renameNotebook(nb.id, newName).then((meta) => {
            name.textContent = meta.name;
            nb.name = meta.name;
            callbacks.onMetaChange?.(meta);
          });
        }
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") input.blur();
        if (event.key === "Escape") {
          input.removeEventListener("blur", commit);
          input.replaceWith(name);
        }
      });
    });

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "shelf-edit-btn";
    editBtn.title = "Notebook settings";
    editBtn.textContent = "\u270e";
    editBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      window.dispatchEvent(
        new CustomEvent("veldnotes:edit-notebook", { detail: { id: nb.id } }),
      );
    });
    swatch.appendChild(editBtn);

    grid.appendChild(item);
  }
}

export function renderCoverChoices(container: HTMLElement): string {
  let selected = COVER_STYLES[0].id as string;
  container.textContent = "";
  for (const style of COVER_STYLES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cover-dot";
    b.title = style.label;
    b.style.background = `linear-gradient(135deg, ${style.colors[0]}, ${style.colors[1]})`;
    b.addEventListener("click", () => {
      selected = style.id;
      container
        .querySelectorAll(".cover-dot")
        .forEach((el) => el.classList.remove("active"));
      b.classList.add("active");
    });
    if (style.id === selected) b.classList.add("active");
    container.appendChild(b);
  }
  return selected;
}

export async function submitNewNotebook(
  name: string,
  cover: string,
): Promise<NotebookMeta> {
  return createNotebook(name, cover);
}

export async function fetchNotebooks(): Promise<NotebookMeta[]> {
  return listNotebooks();
}
