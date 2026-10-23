import { invoke } from "@tauri-apps/api/core";

export interface EntryPayload {
  date: string;
  content: string;
  exists: boolean;
}

export interface EntryMeta {
  date: string;
}

export interface NotebookMeta {
  id: string;
  name: string;
  cover: string;
  emoji?: string | null;
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

export function listNotebooks(): Promise<NotebookMeta[]> {
  return invoke<NotebookMeta[]>("list_notebooks");
}

export function createNotebook(
  name: string,
  cover: string,
  emoji?: string | null,
): Promise<NotebookMeta> {
  return invoke<NotebookMeta>("create_notebook", { name, cover, emoji: emoji ?? null });
}

export function setNotebookEmoji(
  id: string,
  emoji: string | null,
): Promise<NotebookMeta> {
  return invoke<NotebookMeta>("set_notebook_emoji", { id, emoji });
}

export function renameNotebook(
  id: string,
  name: string,
): Promise<NotebookMeta> {
  return invoke<NotebookMeta>("rename_notebook", { id, name });
}

export function setNotebookCover(
  id: string,
  cover: string,
): Promise<NotebookMeta> {
  return invoke<NotebookMeta>("set_notebook_cover", { id, cover });
}

export function getEntry(
  notebook: string,
  date: string,
): Promise<EntryPayload> {
  return invoke<EntryPayload>("get_entry", { notebook, date });
}

export function saveEntry(
  notebook: string,
  date: string,
  content: string,
): Promise<EntryPayload> {
  return invoke<EntryPayload>("save_entry", { notebook, date, content });
}

export function deleteEntry(notebook: string, date: string): Promise<boolean> {
  return invoke<boolean>("delete_entry", { notebook, date });
}

export function listEntries(notebook: string): Promise<EntryMeta[]> {
  return invoke<EntryMeta[]>("list_entries", { notebook });
}

export function saveMedia(
  notebook: string,
  bytes: Uint8Array,
  ext: string | null,
): Promise<MediaPayload> {
  return invoke<MediaPayload>("save_media", { notebook, bytes, ext });
}

export function mediaPath(
  notebook: string,
  reference: string,
): Promise<string> {
  return invoke<string>("media_path", { notebook, reference });
}

export interface MediaData {
  data: number[];
  mime: string;
}

export function readMedia(
  notebook: string,
  reference: string,
): Promise<MediaData> {
  return invoke<MediaData>("read_media", { notebook, reference });
}

export function mediaDataUrl(data: number[], mime: string): string {
  const bytes = new Uint8Array(data);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
