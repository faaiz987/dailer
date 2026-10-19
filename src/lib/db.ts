import { openDB, type IDBPDatabase } from "idb";
import type { AppSettings, Lead, SessionState } from "./types";

const DB_NAME = "lead-dialer";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("leads")) {
          db.createObjectStore("leads", { keyPath: "placeId" });
        }
        if (!db.objectStoreNames.contains("kv")) {
          db.createObjectStore("kv", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export async function loadLeads(): Promise<Lead[]> {
  const db = await getDB();
  return (await db.getAll("leads")) as Lead[];
}

export async function putLead(lead: Lead): Promise<void> {
  const db = await getDB();
  await db.put("leads", lead);
}

export async function putLeads(leads: Lead[]): Promise<void> {
  if (!leads.length) return;
  const db = await getDB();
  const tx = db.transaction("leads", "readwrite");
  for (const lead of leads) tx.store.put(lead);
  await tx.done;
}

export async function clearLeads(): Promise<void> {
  const db = await getDB();
  await db.clear("leads");
}

export async function deleteLead(placeId: string): Promise<void> {
  const db = await getDB();
  await db.delete("leads", placeId);
}

export async function getKV<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const row = (await db.get("kv", key)) as { key: string; value: T } | undefined;
  return row?.value;
}

export async function setKV<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put("kv", { key, value });
}

export async function loadSettings(): Promise<AppSettings | undefined> {
  return getKV<AppSettings>("settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await setKV("settings", settings);
}

export async function loadSession(): Promise<SessionState | undefined> {
  return getKV<SessionState>("session");
}

export async function saveSession(session: SessionState | null): Promise<void> {
  await setKV("session", session);
}

export async function loadImportHeaders(): Promise<string[]> {
  return (await getKV<string[]>("importHeaders")) ?? [];
}

export async function saveImportHeaders(headers: string[]): Promise<void> {
  await setKV("importHeaders", headers);
}

export async function wipeAll(): Promise<void> {
  const db = await getDB();
  await Promise.all([db.clear("leads"), db.clear("kv")]);
}
