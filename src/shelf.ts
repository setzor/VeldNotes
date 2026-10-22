import {
  createNotebook,
  listNotebooks,
  renameNotebook,
  setNotebookCover,
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
          void renameNotebook(nb.id, newName).then(() => {
            name.textContent = newName;
            nb.name = newName;
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

    const coverPick = document.createElement("div");
    coverPick.className = "shelf-cover-pick";
    for (const style of COVER_STYLES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cover-dot";
      b.title = style.label;
      b.style.background = `linear-gradient(135deg, ${style.colors[0]}, ${style.colors[1]})`;
      b.addEventListener("click", (event) => {
        event.stopPropagation();
        void setNotebookCover(nb.id, style.id).then(() => {
          const [a, c] = style.colors;
          swatch.style.background = `linear-gradient(150deg, ${a}, ${c})`;
        });
      });
      coverPick.appendChild(b);
    }
    item.appendChild(coverPick);

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
