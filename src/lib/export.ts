import Papa from "papaparse";
import type { Lead } from "./types";
import { DISPOSITIONS } from "./types";

export const EXTRA_COLUMNS = [
  "status",
  "attempts",
  "last_called_at",
  "next_callback_at",
  "notes",
  "disposition_history",
] as const;

export function mergeHeaderNames(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const group of groups) {
    for (const header of group) {
      const key = header.trim().toLowerCase();
      if (!header.trim() || seen.has(key)) continue;
      seen.add(key);
      merged.push(header);
    }
  }
  return merged;
}

export function buildWorkingCsv(leads: Lead[], importHeaders: string[]): string {
  // Union of every import's headers and every raw row, so a partial import never
  // drops columns that exist on other leads.
  const rawHeaders = mergeHeaderNames(importHeaders, ...leads.map((lead) => Object.keys(lead.raw)));
  const headers = [...rawHeaders];
  for (const extra of EXTRA_COLUMNS) {
    if (!headers.some((h) => h.trim().toLowerCase() === extra)) headers.push(extra);
  }

  const rows = leads.map((lead) => {
    const row: Record<string, string> = {};
    for (const header of rawHeaders) {
      row[header] = lead.raw[header] ?? "";
    }
    row.status = lead.status;
    row.attempts = String(lead.attempts);
    row.last_called_at = lead.lastCalledAt ?? "";
    row.next_callback_at = lead.nextCallbackAt ?? "";
    row.notes = lead.notes;
    row.disposition_history = JSON.stringify(
      lead.history.map((entry) => ({
        at: entry.at,
        disposition: entry.disposition,
        note: entry.note ?? "",
        callback_at: entry.callbackAt ?? "",
      })),
    );
    return row;
  });

  return Papa.unparse({ fields: headers, data: rows.map((row) => headers.map((h) => row[h] ?? "")) });
}

export function buildCallLogCsv(leads: Lead[]): string {
  const rows: string[][] = [];
  const sorted = [...leads].sort((a, b) => a.title.localeCompare(b.title));
  for (const lead of sorted) {
    for (const entry of lead.history) {
      rows.push([
        entry.at,
        lead.title,
        lead.placeId,
        lead.phone,
        DISPOSITIONS[entry.disposition],
        entry.note ?? "",
        entry.callbackAt ?? "",
      ]);
    }
  }
  rows.sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
  return Papa.unparse({
    fields: ["timestamp", "lead", "place_id", "phone", "disposition", "note", "next_callback_at"],
    data: rows,
  });
}

export function downloadCsv(fileName: string, content: string): void {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}
