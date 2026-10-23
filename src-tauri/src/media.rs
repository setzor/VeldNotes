use sha2::{Digest, Sha256};

pub fn hash_bytes(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

pub fn normalize_ext(hint: Option<&str>) -> Option<String> {
    let cleaned: String = hint
        .unwrap_or("")
        .trim()
        .trim_start_matches('.')
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(5)
        .collect::<String>()
        .to_lowercase();
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

pub fn sniff_ext(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("png")
    } else if bytes.starts_with(b"\xff\xd8\xff") {
        Some("jpg")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("gif")
    } else if bytes.starts_with(b"BM") {
        Some("bmp")
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("webp")
    } else {
        None
    }
}

pub fn media_filename(hash: &str, ext: &str) -> String {
    format!("{hash}.{ext}")
}

/// Path stored in the entry's Markdown, relative to the entry file in `entries/`.
pub fn md_relative_path(filename: &str) -> String {
    format!("../media/{filename}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_known_vectors() {
        assert_eq!(
            hash_bytes(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            hash_bytes(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn dedup_same_bytes_same_hash() {
        let a = hash_bytes(b"same image bytes");
        let b = hash_bytes(b"same image bytes");
        assert_eq!(a, b);
        assert_ne!(a, hash_bytes(b"different bytes"));
    }

    #[test]
    fn ext_normalization() {
        assert_eq!(normalize_ext(Some("PNG")), Some("png".into()));
        assert_eq!(normalize_ext(Some(".Jpg")), Some("jpg".into()));
        assert_eq!(normalize_ext(Some(" webp ")), Some("webp".into()));
        assert_eq!(normalize_ext(Some("x/../../etc")), Some("xetc".into()));
        assert_eq!(normalize_ext(Some("")), None);
        assert_eq!(normalize_ext(None), None);
        assert_eq!(normalize_ext(Some("..")), None);
    }

    #[test]
    fn sniffs_common_image_formats() {
        assert_eq!(sniff_ext(b"\x89PNG\r\n\x1a\n...."), Some("png"));
        assert_eq!(sniff_ext(b"\xff\xd8\xff\xe0...."), Some("jpg"));
        assert_eq!(sniff_ext(b"GIF89a...."), Some("gif"));
        assert_eq!(sniff_ext(b"BM...."), Some("bmp"));
        assert_eq!(sniff_ext(b"RIFF....WEBP"), Some("webp"));
        assert_eq!(sniff_ext(b"RIFF....XXXX"), None);
        assert_eq!(sniff_ext(b""), None);
    }

    #[test]
    fn filename_and_relative_path() {
        assert_eq!(media_filename("abc123", "png"), "abc123.png");
        assert_eq!(md_relative_path("abc123.png"), "../media/abc123.png");
    }
}

/// Best-effort MIME sniffing from magic bytes, for serving media back to
/// the webview as data URLs.
pub fn sniff_mime(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        "image/png"
    } else if bytes.starts_with(b"\xff\xd8\xff") {
        "image/jpeg"
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        "image/gif"
    } else if bytes.starts_with(b"BM") {
        "image/bmp"
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        "image/webp"
    } else if bytes.starts_with(b"<svg") || bytes.starts_with(b"<?xml") {
        "image/svg+xml"
    } else {
        "application/octet-stream"
    }
}
