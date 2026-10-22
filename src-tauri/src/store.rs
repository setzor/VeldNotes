use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::NaiveDate;

use crate::entry;
use crate::media;

#[derive(Debug, Clone)]
pub struct Store {
    root: PathBuf,
}

impl Store {
    pub fn new(root: PathBuf) -> Self {
        Store { root }
    }

    pub fn entries_dir(&self) -> PathBuf {
        self.root.join("entries")
    }

    pub fn media_dir(&self) -> PathBuf {
        self.root.join("media")
    }

    fn entry_path(&self, date: &NaiveDate) -> PathBuf {
        self.entries_dir().join(entry::entry_filename(date))
    }

    /// Read an entry's Markdown. Returns an empty string when the entry does not
    /// exist yet (create-on-first-write: no empty files are created).
    pub fn read_entry(&self, date: &NaiveDate) -> std::io::Result<Option<String>> {
        let path = self.entry_path(date);
        match fs::read_to_string(&path) {
            Ok(content) => Ok(Some(content)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Atomically write an entry. The file only appears once there is actual
    /// content, so no empty-file spam accumulates. Write goes to a temp file in
    /// the same directory followed by a rename, so a kill mid-write can never
    /// leave a truncated entry behind. Returns true when the entry file was
    /// created by this call.
    pub fn save_entry(&self, date: &NaiveDate, content: &str) -> std::io::Result<bool> {
        let entries = self.entries_dir();
        let path = self.entry_path(date);
        let created = !path.exists();
        if content.is_empty() {
            return Ok(false);
        }
        fs::create_dir_all(&entries)?;
        let tmp = entries.join(format!(".{}.tmp", entry::entry_filename(date)));
        {
            let mut f = fs::File::create(&tmp)?;
            f.write_all(content.as_bytes())?;
            f.sync_all()?;
        }
        fs::rename(&tmp, &path)?;
        Ok(created)
    }

    /// List all dates that have an entry file, ascending.
    pub fn list_dates(&self) -> std::io::Result<Vec<NaiveDate>> {
        let entries = self.entries_dir();
        let mut dates = Vec::new();
        match fs::read_dir(&entries) {
            Ok(rd) => {
                for item in rd.flatten() {
                    let name = item.file_name();
                    let Some(name) = name.to_str() else { continue };
                    if let Ok(date) = entry::parse_date(name.trim_end_matches(".md")) {
                        if entry::is_entry_filename(name) {
                            dates.push(date);
                        }
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
    /// identical bytes are written at most once. Returns the Markdown image
    /// reference (relative to the entry file) to insert at the cursor.
    pub fn store_media(&self, bytes: &[u8], ext_hint: Option<&str>) -> std::io::Result<String> {
        let hash = media::hash_bytes(bytes);
        let ext = media::normalize_ext(ext_hint)
            .or_else(|| media::sniff_ext(bytes).map(str::to_string))
            .unwrap_or_else(|| "bin".to_string());
        let filename = media::media_filename(&hash, &ext);
        let dir = self.media_dir();
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
        Ok(format!("![pasted image]({})", media::md_relative_path(&filename)))
    }

    /// Resolve a media reference found in an entry file to an absolute path, but
    /// only when it stays inside the journal's media/ directory. Used to serve
    /// local images to the editor.
    pub fn resolve_media(&self, reference: &str) -> Option<PathBuf> {
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
        let path = self.media_dir().join(name);
        if path.exists() {
            Some(path)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn store() -> (TempDir, Store) {
        let tmp = TempDir::new().unwrap();
        let store = Store::new(tmp.path().join("journal"));
        (tmp, store)
    }

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    #[test]
    fn read_missing_entry_returns_none() {
        let (_tmp, store) = store();
        assert_eq!(store.read_entry(&date(2024, 1, 1)).unwrap(), None);
    }

    #[test]
    fn save_then_read_roundtrip() {
        let (_tmp, store) = store();
        let d = date(2024, 3, 8);
        assert!(store.save_entry(&d, "# Hello\n\nToday was good.\n").unwrap());
        let expected = store.entries_dir().join("2024-03-08.md");
        assert!(expected.exists());
        assert_eq!(store.read_entry(&d).unwrap().unwrap(), "# Hello\n\nToday was good.\n");
    }

    #[test]
    fn save_reports_not_created_on_rewrite() {
        let (_tmp, store) = store();
        let d = date(2024, 3, 8);
        assert!(store.save_entry(&d, "one").unwrap());
        assert!(!store.save_entry(&d, "one two").unwrap());
        assert_eq!(store.read_entry(&d).unwrap().unwrap(), "one two");
    }

    #[test]
    fn empty_save_to_existing_entry_is_noop() {
        let (_tmp, store) = store();
        let d = date(2024, 3, 8);
        store.save_entry(&d, "content").unwrap();
        assert!(!store.save_entry(&d, "").unwrap());
        assert_eq!(store.read_entry(&d).unwrap().unwrap(), "content");
    }

    #[test]
    fn empty_save_to_missing_entry_creates_nothing() {
        let (_tmp, store) = store();
        let d = date(2024, 3, 8);
        assert!(!store.save_entry(&d, "").unwrap());
        assert_eq!(store.read_entry(&d).unwrap(), None);
        assert!(!store.entries_dir().exists());
    }

    #[test]
    fn list_dates_sorted_and_filtered() {
        let (_tmp, store) = store();
        store.save_entry(&date(2024, 3, 2), "b").unwrap();
        store.save_entry(&date(2024, 1, 15), "a").unwrap();
        store.save_entry(&date(2024, 2, 10), "c").unwrap();
        // Noise files that must be ignored:
        let entries = store.entries_dir();
        fs::write(entries.join("notes.md"), "x").unwrap();
        fs::write(entries.join("2024-13-40.md"), "x").unwrap();
        fs::write(entries.join("2024-01-01.md.bak"), "x").unwrap();

        let dates = store.list_dates().unwrap();
        assert_eq!(
            dates,
            vec![date(2024, 1, 15), date(2024, 2, 10), date(2024, 3, 2)]
        );
    }

    #[test]
    fn list_dates_when_no_entries_dir() {
        let (_tmp, store) = store();
        assert_eq!(store.list_dates().unwrap(), Vec::<NaiveDate>::new());
    }

    #[test]
    fn media_dedup_same_bytes_one_file() {
        let (_tmp, store) = store();
        let png = b"\x89PNG\r\n\x1a\n fake png bytes";
        let first = store.store_media(png, None).unwrap();
        let second = store.store_media(png, None).unwrap();
        assert_eq!(first, second);
        let media_dir = store.media_dir();
        let count = fs::read_dir(&media_dir).unwrap().count();
        assert_eq!(count, 1);
        assert!(first.contains("../media/"));
        assert!(first.ends_with(".png)"));
    }

    #[test]
    fn media_uses_hint_ext_and_sniffs_fallback() {
        let (_tmp, store) = store();
        let a = store.store_media(b"\x89PNG\r\n\x1a\n....", Some("PNG")).unwrap();
        assert!(a.ends_with(".png)"));
        let b = store.store_media(b"\xff\xd8\xff\xe0....", None).unwrap();
        assert!(b.ends_with(".jpg)"));
        let c = store.store_media(b"mystery bytes", Some("dat")).unwrap();
        assert!(c.ends_with(".dat)"));
        let d = store.store_media(b"more mystery", None).unwrap();
        assert!(d.ends_with(".bin)"));
    }

    #[test]
    fn media_hash_in_filename() {
        let (_tmp, store) = store();
        let bytes = b"some image";
        let md = store.store_media(bytes, Some("png")).unwrap();
        let hash = media::hash_bytes(bytes);
        assert!(md.contains(&format!("../media/{hash}.png")));
    }

    #[test]
    fn resolve_media_only_inside_media_dir() {
        let (_tmp, store) = store();
        store.store_media(b"\x89PNG\r\n\x1a\nxx", Some("png")).unwrap();
        let md = store.store_media(b"\x89PNG\r\n\x1a\nyy", Some("png")).unwrap();
        let rel = md
            .trim_start_matches("![pasted image](")
            .trim_end_matches(')');
        let resolved = store.resolve_media(rel).unwrap();
        assert!(resolved.starts_with(store.media_dir()));

        assert!(store.resolve_media("../media/../entries/2024-01-01.md").is_none());
        assert!(store.resolve_media("../media/sub/dir.png").is_none());
        assert!(store.resolve_media("../media/.hidden.png").is_none());
        assert!(store.resolve_media("/etc/passwd").is_none());
        assert!(store.resolve_media("../media/does-not-exist.png").is_none());
    }

    #[test]
    fn save_is_atomic_no_tmp_files_left() {
        let (_tmp, store) = store();
        let d = date(2024, 5, 5);
        store.save_entry(&d, "final content").unwrap();
        let names: Vec<String> = fs::read_dir(store.entries_dir())
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec!["2024-05-05.md"]);
    }
}
