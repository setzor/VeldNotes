import { invoke } from "@tauri-apps/api/core";

export interface EntryPayload {
  date: string;
  content: string;
  exists: boolean;
}

export interface EntryMeta {
  date: string;
}

export interface MediaPayload {
  markdown: string;
  filename: string;
}

export function todayDate(): Promise<string> {
  return invoke<string>("today_date");
}

export function dataDir(): Promise<string> {
  return invoke<string>("data_dir");
}

export function getEntry(date: string): Promise<EntryPayload> {
  return invoke<EntryPayload>("get_entry", { date });
}

export function saveEntry(date: string, content: string): Promise<EntryPayload> {
  return invoke<EntryPayload>("save_entry", { date, content });
}

export function listEntries(): Promise<EntryMeta[]> {
  return invoke<EntryMeta[]>("list_entries");
}

export function saveMedia(
  bytes: Uint8Array,
  ext: string | null,
): Promise<MediaPayload> {
  return invoke<MediaPayload>("save_media", { bytes, ext });
}

export function mediaPath(reference: string): Promise<string> {
  return invoke<string>("media_path", { reference });
}
