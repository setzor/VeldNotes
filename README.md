# VeldNotes

A cozy, local-first daily journaling app for Windows and Linux desktop/laptop.

Open it and it's today's page. Type. Close it. That's the whole loop.

## Download

Grab the latest release from the [Releases](https://github.com/setzor/VeldNotes/releases) page.

| Platform | Format | Install |
|---|---|---|
| Linux (any distro) | `.AppImage` | `chmod +x VeldNotes_*.AppImage && ./VeldNotes_*.AppImage` |
| Debian / Ubuntu / Mint | `.deb` | `sudo dpkg -i VeldNotes_*.deb` (or double-click) |
| Fedora / RHEL / openSUSE | `.rpm` | `sudo rpm -i VeldNotes-*.rpm` (or `sudo dnf install VeldNotes-*.rpm`) |
| Windows | `.msi` | Double-click the `.msi` installer |

VeldNotes is inspired by the calm minimalism of a pocket notebook: warm
kraft-paper tones, grass-gold accents, a readable serif, generous whitespace.
No streaks, no badges, no guilt. Your journal is a plain folder of rich-text
files that you own — plain JSON, greppable, and easy to back up.

## Tech stack

- **[Tauri 2](https://tauri.app)** app shell (WebView2 on Windows, WebKitGTK on Linux)
- **Rust** core — all app logic (storage, entries, media, autosave coordination)
  lives in Tauri commands under `src-tauri/src/`. The frontend is a thin UI layer.
- **TypeScript** frontend (`src/`) with a **[TipTap](https://tiptap.dev)** editor
  (chosen over Milkdown for its smaller dependency surface, excellent ProseMirror
  integration, and straightforward extension API for our custom image node)
- Plain CSS for the cozy theme (light + dark, follows system preference)

## Data format (your files, your data)

Everything lives in a single plain folder:

```
<data-dir>/
├── entries/
│   ├── 2024-01-05.json    ← one rich-text document per day, named YYYY-MM-DD.json
│   ├── 2024-03-08.json
│   └── ...
└── media/
    ├── <sha256>.png       ← pasted images, content-hash filenames (deduplicated)
    └── ...
```

- **Entries** are rich-text documents (TipTap/ProseMirror JSON) — headings,
  bold/italic/underline, highlights, colors, alignment, links, lists, quotes,
  code, tables, images, and free-form canvas sketches. Expressive formatting
  survives save/load round-trips losslessly, which Markdown could not
  represent. Older Markdown entries (`YYYY-MM-DD.md`) are imported
  automatically the first time they are opened.
- **Media** pasted into an entry is written to `media/` under its SHA-256
  content hash, so identical images are stored once. The entry file references
  it with a relative media reference: `../media/<sha256>.png`.
  Images are never base64-embedded.
- **Data directory**: on Linux `~/.local/share/veldnotes/`, on Windows
  `%APPDATA%\com.veldnotes.app\` (resolved via Tauri's path APIs — no hardcoded
  paths). You can point `grep` or any JSON tooling at this folder.

## Development

Prerequisites: [Rust](https://rustup.rs), [Node.js](https://nodejs.org) +
[pnpm](https://pnpm.io), and the Tauri system dependencies
([Linux](https://tauri.app/start/prerequisites/#linux) — `libwebkit2gtk-4.1-dev`,
`libgtk-3-dev`, `libsoup-3.0-dev`, `librsvg2-dev`; Windows needs the
[WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) runtime,
usually preinstalled).

```bash
pnpm install
pnpm tauri dev        # dev workflow (Vite + Rust, hot reload)
```

Other commands:

```bash
pnpm test             # frontend unit tests (vitest)
pnpm typecheck        # TypeScript check
pnpm build            # production frontend build
pnpm tauri build      # bundle installers (.deb/.rpm/.AppImage, .msi/.exe)
cd src-tauri && cargo test   # Rust core unit tests
```

## Project structure

```
src-tauri/            Rust core (Tauri commands, storage, media)
  src/entry.rs        date handling + entry file naming (YYYY-MM-DD.json)
  src/media.rs        SHA-256 hashing, extension sniffing, dedup filenames
  src/store.rs        filesystem layer: atomic entry writes, media store
  src/commands.rs     Tauri commands exposed to the frontend
  src/lib.rs          app wiring
src/                  TypeScript frontend (thin UI layer)
  main.ts             boot: open today's entry, date strip
  editor.ts           TipTap editor + expressive formatting + canvas block
  freeform.ts         type-anywhere sheet: click to place blocks (OneNote-style)
  typography.ts       per-selection font family/size marks
  legacyMarkdown.ts   one-time import of old Markdown entries
  canvas.ts           free-form canvas editor overlay (Excalidraw, MIT)
  autosave.ts         debounced autosave with in-flight chaining
  paste.ts            image paste/drop -> Rust media store
  api.ts              typed wrappers around Tauri commands
  dates.ts            date helpers
  styles.css          cozy theme (light + dark)
```

## Design notes for future mobile

All storage and logic live in the Rust core (Tauri commands); the frontend only
calls commands. UI components avoid desktop-only assumptions where cheap. No
desktop-only dependencies are in the core. Tauri 2 supports iOS/Android later
with the same Rust core and web UI (reference architecture:
[Meron](https://github.com/nonbili/meron)).

## Out of scope (v0.1)

Sync, accounts, encryption, PDF export, search, streaks,
plugins.

## License

See [LICENSE](LICENSE).
