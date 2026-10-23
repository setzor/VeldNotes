use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::Local;
use serde::{Deserialize, Serialize};

use crate::entry;
use crate::media;

const MANIFEST_FILE: &str = "notebooks.json";
const ID_CHARS: &str = "abcdefghijklmnopqrstuvwxyz0123456789-";
const MAX_NOTEBOOKS: usize = 64;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotebookMeta {
    pub id: String,
    pub name: String,
    pub cover: String,
    #[serde(default)]
    pub emoji: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Manifest {
    notebooks: Vec<NotebookMeta>,
}

#[derive(Debug, Clone)]
pub struct Store {
    root: PathBuf,
}

fn sanitize_name(name: &str) -> String {
    let mut out = String::new();
    for ch in name.trim().chars() {
        if ch.is_alphanumeric() || ch == ' ' || ch == '-' || ch == '_' {
            out.push(ch);
        }
    }
    let cleaned: String = out.split_whitespace().collect::<Vec<_>>().join(" ");
    let cut = cleaned
        .char_indices()
        .take(48)
        .last()
        .map_or(0, |(i, c)| i + c.len_utf8());
    cleaned[..cut].to_string()
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| ID_CHARS.contains(c))
}

fn valid_cover(cover: &str) -> bool {
    valid_id(cover)
}

/// A cover emoji must be a single grapheme-ish cluster (few chars, no
/// control characters) or absent entirely. Stored as the literal emoji.
fn valid_emoji(emoji: Option<&str>) -> Option<String> {
    let raw = emoji?.trim();
    if raw.is_empty() || raw.chars().count() > 8 {
        return None;
    }
    if raw.chars().any(|c| c.is_control()) {
        return None;
    }
    Some(raw.to_string())
}

impl Store {
    pub fn new(root: PathBuf) -> Self {
        Store { root }
    }

    fn manifest_path(&self) -> PathBuf {
        self.root.join(MANIFEST_FILE)
    }

    fn notebook_root(&self, id: &str) -> PathBuf {
        self.root.join(id)
    }

    pub fn entries_dir(&self, notebook: &str) -> PathBuf {
        self.notebook_root(notebook).join("entries")
    }

    pub fn media_dir(&self, notebook: &str) -> PathBuf {
        self.notebook_root(notebook).join("media")
    }

    /// Ensure the manifest exists. Migrates a legacy flat layout
    /// (`<root>/entries`, `<root>/media`) into a "default" notebook the first
    /// time the app runs with the new format.
    pub fn init(&self) -> std::io::Result<()> {
        fs::create_dir_all(&self.root)?;
        let path = self.manifest_path();
        if path.exists() {
            return Ok(());
        }
        let manifest = Manifest {
            notebooks: vec![NotebookMeta {
                id: "default".to_string(),
                name: "My Journal".to_string(),
                cover: "kraft".to_string(),
                emoji: None,
            }],
        };
        let legacy_entries = self.root.join("entries");
        let legacy_media = self.root.join("media");
        if legacy_entries.exists() || legacy_media.exists() {
            let default_root = self.notebook_root("default");
            fs::create_dir_all(&default_root)?;
            if legacy_entries.exists() {
                fs::rename(&legacy_entries, default_root.join("entries"))?;
            }
            if legacy_media.exists() {
                fs::rename(&legacy_media, default_root.join("media"))?;
            }
        }
        self.write_manifest(&manifest)
    }

    fn read_manifest(&self) -> std::io::Result<Manifest> {
        let raw = fs::read_to_string(self.manifest_path())?;
        serde_json::from_str(&raw)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))
    }

    fn write_manifest(&self, manifest: &Manifest) -> std::io::Result<()> {
        let tmp = self.root.join(format!(".{MANIFEST_FILE}.tmp"));
        {
            let mut f = fs::File::create(&tmp)?;
            f.write_all(serde_json::to_string_pretty(manifest)?.as_bytes())?;
            f.sync_all()?;
        }
        fs::rename(&tmp, self.manifest_path())
    }

    /// Set a notebook's cover emoji. Pass None to remove the sticker.
    pub fn set_notebook_emoji(
        &self,
        id: &str,
        emoji: Option<&str>,
    ) -> std::io::Result<NotebookMeta> {
        let mut manifest = self.read_manifest()?;
        let meta = self.find(&manifest, id)?;
        let emoji = valid_emoji(emoji);
        for n in manifest.notebooks.iter_mut() {
            if n.id == id {
                n.emoji = emoji.clone();
            }
        }
        self.write_manifest(&manifest)?;
        Ok(NotebookMeta {
            emoji,
            ..meta
        })
    }

    fn find(&self, manifest: &Manifest, id: &str) -> std::io::Result<NotebookMeta> {
        manifest
            .notebooks
            .iter()
            .find(|n| n.id == id)
            .cloned()
            .ok_or_else(|| {
                std::io::Error::new(std::io::ErrorKind::NotFound, "notebook not found")
            })
    }

    pub fn list_notebooks(&self) -> std::io::Result<Vec<NotebookMeta>> {
        Ok(self.read_manifest()?.notebooks)
    }

    pub fn create_notebook(
        &self,
        name: &str,
        cover: &str,
        emoji: Option<&str>,
    ) -> std::io::Result<NotebookMeta> {
        let name = sanitize_name(name);
        if name.is_empty() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "notebook name is empty",
            ));
        }
        if !valid_cover(cover) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "invalid cover id",
            ));
        }
        let mut manifest = self.read_manifest()?;
        if manifest.notebooks.len() >= MAX_NOTEBOOKS {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "too many notebooks",
            ));
        }
        let stamp = Local::now().format("%Y%m%d%H%M%S");
        let mut id = format!("nb-{stamp}");
        while manifest.notebooks.iter().any(|n| n.id == id) {
            id.push('x');
        }
        let meta = NotebookMeta {
            id: id.clone(),
            name,
            cover: cover.to_string(),
            emoji: valid_emoji(emoji),
        };
        fs::create_dir_all(self.entries_dir(&id))?;
        manifest.notebooks.push(meta.clone());
        self.write_manifest(&manifest)?;
        Ok(meta)
    }

    pub fn rename_notebook(&self, id: &str, name: &str) -> std::io::Result<NotebookMeta> {
        let name = sanitize_name(name);
        if name.is_empty() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "notebook name is empty",
            ));
        }
        let mut manifest = self.read_manifest()?;
        let meta = self.find(&manifest, id)?;
        for n in manifest.notebooks.iter_mut() {
            if n.id == id {
                n.name = name.clone();
            }
        }
        self.write_manifest(&manifest)?;
        Ok(NotebookMeta { name, ..meta })
    }

    pub fn set_notebook_cover(&self, id: &str, cover: &str) -> std::io::Result<NotebookMeta> {
        if !valid_cover(cover) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "invalid cover id",
            ));
        }
        let mut manifest = self.read_manifest()?;
        let meta = self.find(&manifest, id)?;
        for n in manifest.notebooks.iter_mut() {
            if n.id == id {
                n.cover = cover.to_string();
            }
        }
        self.write_manifest(&manifest)?;
        Ok(NotebookMeta {
            cover: cover.to_string(),
            ..meta
        })
    }

    fn require_notebook(&self, id: &str) -> std::io::Result<()> {
        let manifest = self.read_manifest()?;
        self.find(&manifest, id).map(|_| ())
    }

    fn entry_path(&self, notebook: &str, date: &chrono::NaiveDate) -> std::io::Result<PathBuf> {
        if !valid_id(notebook) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "invalid notebook id",
            ));
        }
        Ok(self
            .entries_dir(notebook)
            .join(entry::entry_filename(date)))
    }

    fn legacy_entry_path(
        &self,
        notebook: &str,
        date: &chrono::NaiveDate,
    ) -> std::io::Result<PathBuf> {
        if !valid_id(notebook) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "invalid notebook id",
            ));
        }
        Ok(self
            .entries_dir(notebook)
            .join(entry::legacy_entry_filename(date)))
    }

    /// Read an entry's content. The current format is a TipTap JSON document;
    /// a legacy Markdown entry is returned as-is so the frontend can import
    /// it. Returns an empty string when the entry does not exist yet
    /// (create-on-first-write: no empty files are created).
    pub fn read_entry(
        &self,
        notebook: &str,
        date: &chrono::NaiveDate,
    ) -> std::io::Result<Option<String>> {
        let path = self.entry_path(notebook, date)?;
        match fs::read_to_string(&path) {
            Ok(content) => Ok(Some(content)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                let legacy = self.legacy_entry_path(notebook, date)?;
                match fs::read_to_string(&legacy) {
                    Ok(content) => Ok(Some(content)),
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
                    Err(e) => Err(e),
                }
            }
            Err(e) => Err(e),
        }
    }

    /// Atomically write an entry as a TipTap JSON document. The file only
    /// appears once there is actual content, so no empty-file spam accumulates.
    /// Any legacy Markdown entry for the same date is removed once the JSON
    /// version is saved. Returns true when the entry file was created by this
    /// call.
    pub fn save_entry(
        &self,
        notebook: &str,
        date: &chrono::NaiveDate,
        content: &str,
    ) -> std::io::Result<bool> {
        self.require_notebook(notebook)?;
        let path = self.entry_path(notebook, date)?;
        let created = !path.exists();
        if content.is_empty() {
            return Ok(false);
        }
        let entries = self.entries_dir(notebook);
        fs::create_dir_all(&entries)?;
        let tmp = entries.join(format!(".{}.tmp", entry::entry_filename(date)));
        {
            let mut f = fs::File::create(&tmp)?;
            f.write_all(content.as_bytes())?;
            f.sync_all()?;
        }
        fs::rename(&tmp, &path)?;
        let legacy = self.legacy_entry_path(notebook, date)?;
        if legacy.exists() {
            let _ = fs::remove_file(&legacy);
        }
        Ok(created)
    }

    /// Delete an entry file. Returns true when a file was removed, false when
    /// no entry existed for that date. Refuses to delete anything outside the
    /// notebook's entries directory (entry_path validates the notebook id).
    pub fn delete_entry(
        &self,
        notebook: &str,
        date: &chrono::NaiveDate,
    ) -> std::io::Result<bool> {
        self.require_notebook(notebook)?;
        let path = self.entry_path(notebook, date)?;
        match fs::remove_file(&path) {
            Ok(()) => Ok(true),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(e) => Err(e),
        }
    }

    /// List all dates that have an entry file, ascending.
    pub fn list_dates(&self, notebook: &str) -> std::io::Result<Vec<chrono::NaiveDate>> {
        self.require_notebook(notebook)?;
        let entries = self.entries_dir(notebook);
        let mut dates = Vec::new();
        match fs::read_dir(&entries) {
            Ok(rd) => {
                for item in rd.flatten() {
                    let name = item.file_name();
                    let Some(name) = name.to_str() else { continue };
                    if let Some(date) = entry::entry_filename_date(name) {
                        dates.push(date);
                    }
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e),
        }
        dates.sort_unstable();
        dates.dedup();
        Ok(dates)
    }

    /// Store pasted image bytes under a content-hash filename. Deduplicated:
    /// identical bytes are written at most once. Returns the stored filename;
    /// the media reference relative to the entry file is
    /// `../media/<filename>`.
    pub fn store_media(
        &self,
        notebook: &str,
        bytes: &[u8],
        ext_hint: Option<&str>,
    ) -> std::io::Result<String> {
        self.require_notebook(notebook)?;
        let hash = media::hash_bytes(bytes);
        let ext = media::normalize_ext(ext_hint)
            .or_else(|| media::sniff_ext(bytes).map(str::to_string))
            .unwrap_or_else(|| "bin".to_string());
        let filename = media::media_filename(&hash, &ext);
        let dir = self.media_dir(notebook);
        fs::create_dir_all(&dir)?;
        let path = dir.join(&filename);
        if !path.exists() {
            let tmp = dir.join(format!(".{filename}.tmp"));
            {
                let mut f = fs::File::create(&tmp)?;
                f.write_all(bytes)?;
                f.sync_all()?;
            }
            fs::rename(&tmp, &path)?;
        }
        Ok(filename)
    }

    /// Resolve a media reference found in an entry file to an absolute path, but
    /// only when it stays inside the notebook's media/ directory.
    pub fn resolve_media(&self, notebook: &str, reference: &str) -> Option<PathBuf> {
        if !valid_id(notebook) {
            return None;
        }
        let raw = reference.trim();
        let stripped = raw.strip_prefix("../media/")?;
        let candidate = Path::new(stripped);
        if candidate.components().count() != 1 {
            return None;
        }
        let name = candidate.file_name()?.to_str()?;
        if name.starts_with('.') || name.contains('/') || name.contains('\\') {
            return None;
        }
        let path = self.media_dir(notebook).join(name);
        if path.exists() {
            Some(path)
        } else {
            None
        }
    }

    /// Read a media file's bytes and sniffed MIME type for display in the
    /// webview. Only files inside the notebook's media/ directory are served.
    pub fn read_media(
        &self,
        notebook: &str,
        reference: &str,
    ) -> Option<(Vec<u8>, &'static str)> {
        let path = self.resolve_media(notebook, reference)?;
        let bytes = fs::read(path).ok()?;
        let mime = media::sniff_mime(&bytes);
        Some((bytes, mime))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn store() -> (TempDir, Store) {
        let tmp = TempDir::new().unwrap();
        let store = Store::new(tmp.path().join("journal"));
        store.init().unwrap();
        (tmp, store)
    }

    fn date(y: i32, m: u32, d: u32) -> chrono::NaiveDate {
        chrono::NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    #[test]
    fn init_creates_default_notebook() {
        let (_tmp, store) = store();
        let books = store.list_notebooks().unwrap();
        assert_eq!(books.len(), 1);
        assert_eq!(books[0].id, "default");
        assert_eq!(books[0].cover, "kraft");
    }

    #[test]
    fn init_migrates_legacy_layout() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path().join("journal");
        let entries = root.join("entries");
        fs::create_dir_all(&entries).unwrap();
        fs::write(entries.join("2024-01-05.md"), "# old\n").unwrap();
        let media = root.join("media");
        fs::create_dir_all(&media).unwrap();
        fs::write(media.join("abc.png"), b"img").unwrap();

        let store = Store::new(root.clone());
        store.init().unwrap();
        let books = store.list_notebooks().unwrap();
        assert_eq!(books[0].id, "default");
        let migrated = root.join("default").join("entries").join("2024-01-05.md");
        assert!(migrated.exists());
        assert!(root.join("default").join("media").join("abc.png").exists());
        assert!(!root.join("entries").exists());
        assert_eq!(
            store.read_entry("default", &date(2024, 1, 5)).unwrap(),
            Some("# old\n".to_string())
        );
    }

    #[test]
    fn create_rename_cover_notebook() {
        let (_tmp, store) = store();
        let meta = store.create_notebook("Travel 2025", "forest", None).unwrap();
        assert_ne!(meta.id, "default");
        assert!(meta.id.starts_with("nb-"));
        assert_eq!(meta.name, "Travel 2025");
        assert_eq!(store.list_notebooks().unwrap().len(), 2);

        let renamed = store.rename_notebook(&meta.id, "Trips").unwrap();
        assert_eq!(renamed.name, "Trips");

        let recolored = store.set_notebook_cover(&meta.id, "dusk").unwrap();
        assert_eq!(recolored.cover, "dusk");
        assert_eq!(
            store
                .list_notebooks()
                .unwrap()
                .iter()
                .find(|n| n.id == meta.id)
                .unwrap()
                .name,
            "Trips"
        );
    }

    #[test]
    fn emoji_sticker_roundtrip() {
        let (_tmp, store) = store();
        let meta = store
            .create_notebook("Garden", "forest", Some("\u{1F341}"))
            .unwrap();
        assert_eq!(meta.emoji.as_deref(), Some("\u{1F341}"));

        let changed = store.set_notebook_emoji(&meta.id, Some("\u{1F98A}")).unwrap();
        assert_eq!(changed.emoji.as_deref(), Some("\u{1F98A}"));

        let cleared = store.set_notebook_emoji(&meta.id, None).unwrap();
        assert!(cleared.emoji.is_none());

        // invalid emoji values are dropped, not stored
        let long = "x".repeat(20);
        let bad = store.create_notebook("Bad", "kraft", Some(&long)).unwrap();
        assert!(bad.emoji.is_none());
    }

    #[test]
    fn manifest_without_emoji_field_still_loads() {
        let tmp = tempfile::TempDir::new().unwrap();
        let root = tmp.path().join("journal");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(
            root.join("notebooks.json"),
            r#"{"notebooks":[{"id":"default","name":"Old","cover":"kraft"}]}"#,
        )
        .unwrap();
        let store = Store::new(root);
        let books = store.list_notebooks().unwrap();
        assert_eq!(books.len(), 1);
        assert!(books[0].emoji.is_none());
    }

    #[test]
    fn create_rejects_empty_and_bad_cover() {
        let (_tmp, store) = store();
        assert!(store.create_notebook("   ", "kraft", None).is_err());
        assert!(store.create_notebook("ok", "../evil", None).is_err());
    }

    #[test]
    fn unknown_notebook_operations_fail() {
        let (_tmp, store) = store();
        let d = date(2024, 3, 8);
        assert!(store.save_entry("nope", &d, "x").is_err());
        assert!(store.list_dates("nope").is_err());
        assert!(store.store_media("nope", b"x", None).is_err());
        assert!(store.rename_notebook("nope", "x").is_err());
    }

    #[test]
    fn rejects_invalid_notebook_ids() {
        let (_tmp, store) = store();
        let d = date(2024, 3, 8);
        assert!(store.save_entry("../etc", &d, "x").is_err());
        assert!(store.read_entry("sub/dir", &d).is_err());
        assert!(store.resolve_media("..", "../media/x.png").is_none());
    }

    #[test]
    fn entries_are_notebook_scoped() {
        let (_tmp, store) = store();
        let d = date(2024, 3, 8);
        store.save_entry("default", &d, "work note").unwrap();
        assert_eq!(
            store.read_entry("default", &d).unwrap().unwrap(),
            "work note"
        );
        assert_eq!(store.read_entry("default", &date(2024, 1, 1)).unwrap(), None);

        let nb = store.create_notebook("Personal", "rose", None).unwrap();
        assert_eq!(store.read_entry(&nb.id, &d).unwrap(), None);
        store.save_entry(&nb.id, &d, "personal note").unwrap();
        assert_eq!(
            store.read_entry(&nb.id, &d).unwrap().unwrap(),
            "personal note"
        );
        assert_eq!(
            store.read_entry("default", &d).unwrap().unwrap(),
            "work note"
        );

        assert_eq!(store.list_dates("default").unwrap(), vec![d]);
        assert_eq!(store.list_dates(&nb.id).unwrap(), vec![d]);
    }

    #[test]
    fn media_is_notebook_scoped() {
        let (_tmp, store) = store();
        let nb = store.create_notebook("Photos", "meadow", None).unwrap();
        let a = store
            .store_media("default", b"\x89PNG\r\n\x1a\nxx", Some("png"))
            .unwrap();
        let b = store
            .store_media(&nb.id, b"\x89PNG\r\n\x1a\nyy", Some("png"))
            .unwrap();
        let rel_a = format!("../media/{a}");
        let rel_b = format!("../media/{b}");
        assert!(store.resolve_media("default", &rel_a).is_some());
        assert!(store.resolve_media(&nb.id, &rel_b).is_some());
        assert!(store.media_dir(&nb.id).join(&b).exists());
    }

    #[test]
    fn read_media_returns_bytes_and_mime() {
        let (_tmp, store) = store();
        let name = store
            .store_media("default", b"\x89PNG\r\n\x1a\nxx", Some("png"))
            .unwrap();
        let rel = format!("../media/{name}");
        let (bytes, mime) = store.read_media("default", &rel).unwrap();
        assert_eq!(bytes, b"\x89PNG\r\n\x1a\nxx");
        assert_eq!(mime, "image/png");
        assert!(store.read_media("default", "../media/none.png").is_none());
        assert!(store.read_media("nope", &rel).is_none());
    }

    #[test]
    fn reads_legacy_md_entry_and_replaces_it_on_save() {
        let (_tmp, store) = store();
        let d = date(2024, 2, 29);
        let legacy = store.entries_dir("default");
        fs::create_dir_all(&legacy).unwrap();
        fs::write(legacy.join("2024-02-29.md"), "# old markdown\n").unwrap();

        assert_eq!(
            store.read_entry("default", &d).unwrap(),
            Some("# old markdown\n".to_string())
        );
        assert_eq!(store.list_dates("default").unwrap(), vec![d]);

        store
            .save_entry("default", &d, "{\"type\":\"doc\"}")
            .unwrap();
        assert!(!legacy.join("2024-02-29.md").exists());
        assert!(legacy.join("2024-02-29.json").exists());
        assert_eq!(
            store.read_entry("default", &d).unwrap(),
            Some("{\"type\":\"doc\"}".to_string())
        );
    }

    #[test]
    fn delete_entry_removes_and_is_idempotent() {
        let (_tmp, store) = store();
        let d = date(2024, 3, 8);
        store.save_entry("default", &d, "doomed").unwrap();
        assert!(store.delete_entry("default", &d).unwrap());
        assert_eq!(store.read_entry("default", &d).unwrap(), None);
        // second delete: nothing there, still Ok(false)
        assert!(!store.delete_entry("default", &d).unwrap());
        // unknown notebook rejected
        assert!(store.delete_entry("nope", &d).is_err());
    }

    #[test]
    fn save_is_atomic_no_tmp_files_left() {
        let (_tmp, store) = store();
        let d = date(2024, 5, 5);
        store.save_entry("default", &d, "final content").unwrap();
        let names: Vec<String> = fs::read_dir(store.entries_dir("default"))
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec!["2024-05-05.json"]);
    }

    #[test]
    fn empty_save_creates_nothing() {
        let (_tmp, store) = store();
        let d = date(2024, 3, 8);
        assert!(!store.save_entry("default", &d, "").unwrap());
        assert_eq!(store.read_entry("default", &d).unwrap(), None);
        assert!(!store.entries_dir("default").exists());
    }
}
