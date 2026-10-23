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
): Promise<NotebookMeta> {
  return invoke<NotebookMeta>("create_notebook", { name, cover });
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
