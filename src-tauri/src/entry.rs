use chrono::{Local, NaiveDate};

pub const DATE_FORMAT: &str = "%Y-%m-%d";
const FILENAME_LEN: usize = 10 + ".md".len();

#[derive(Debug, PartialEq, Eq)]
pub struct InvalidDate(pub String);

impl std::fmt::Display for InvalidDate {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "invalid date: {:?}", self.0)
    }
}

impl std::error::Error for InvalidDate {}

pub fn parse_date(raw: &str) -> Result<NaiveDate, InvalidDate> {
    let parsed = NaiveDate::parse_from_str(raw, DATE_FORMAT).map_err(|_| InvalidDate(raw.into()))?;
    if parsed.format(DATE_FORMAT).to_string() == raw {
        Ok(parsed)
    } else {
        Err(InvalidDate(raw.into()))
    }
}

pub fn entry_filename(date: &NaiveDate) -> String {
    format!("{}.md", date.format(DATE_FORMAT))
}

pub fn is_entry_filename(name: &str) -> bool {
    name.len() == FILENAME_LEN
        && name.ends_with(".md")
        && parse_date(&name[..FILENAME_LEN - 3]).is_ok()
}

pub fn today_local() -> NaiveDate {
    Local::now().date_naive()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn today_local_is_plausible() {
        let now = Local::now().date_naive();
        assert!((today_local() - now).num_days().abs() <= 1);
    }

    #[test]
    fn parses_canonical_date() {
        let d = parse_date("2024-02-29").unwrap();
        assert_eq!(d, NaiveDate::from_ymd_opt(2024, 2, 29).unwrap());
    }

    #[test]
    fn rejects_malformed_dates() {
        for raw in [
            "2024-13-01",
            "2024-02-30",
            "2024-1-1",
            "2024/01/01",
            "../2024-01-01",
            "2024-01-01.md",
            "",
            "not-a-date",
        ] {
            assert!(parse_date(raw).is_err(), "should reject {raw:?}");
        }
    }

    #[test]
    fn filename_roundtrip() {
        let d = NaiveDate::from_ymd_opt(2024, 1, 5).unwrap();
        assert_eq!(entry_filename(&d), "2024-01-05.md");
        assert!(is_entry_filename("2024-01-05.md"));
        assert!(!is_entry_filename("2024-01-05.txt"));
        assert!(!is_entry_filename("2024-1-5.md"));
        assert!(!is_entry_filename("notes.md"));
        assert!(!is_entry_filename("2024-01-05.md.bak"));
    }
}
