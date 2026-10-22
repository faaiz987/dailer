# Lead Dialer

A local-first, single-page cold-calling workspace for a Google Maps lead export. No backend, no auth, no API keys, and no lead data ever leaves the browser.

![stack](https://img.shields.io/badge/React-18-149eca) ![stack](https://img.shields.io/badge/TypeScript-5-3178c6) ![stack](https://img.shields.io/badge/Vite-6-646cff)

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Other scripts:

```bash
npm run build      # typecheck + production build
npm run typecheck
npm test           # parser / queue / export tests (Vitest)
npm run preview
```

Click **Load sample data** to demo without a file. The sample exercises all 73 columns, duplicate handling, flagged leads, hours, review distributions and a full queue.

## What it does

- **Import** `.csv`, `.xlsx` or `.xls` by drag-and-drop or file picker. Every cell is read as text: scientific-notation ids (`4.09416862714352e+18`) stay text and are expanded without floating-point rounding. Headers match exactly, case-insensitively.
- **Dedupe** on `placeId`; rows without one fall back to `cid` or a content hash. Duplicate counts are reported.
- **Normalize phones** to E.164 with `libphonenumber-js`, using `countryCode` / the Settings default country. Falls back to the formatted `phone` column.
- **Hours** are pivoted from `openingHours/0..6` into a per-day map and evaluated in `America/Chicago` for a live Open/Closed/Opens-at pill.
- **Flags** permanently closed, temporarily closed, Area/empty category and no-phone leads. They remain visible in the list with a badge but are excluded from the dial queue unless “Include flagged” is enabled. DNC is never in a queue.
- **Dialer** shows one lead at a time with click-to-call, copy, maps link, website, claimed badge, price, weekly hours, review bars, about text, notes and queue position. Click-to-call opens whatever destination you set under Settings → **Where calls open** (phone app, Google Voice web, MightyCall, Rynga, or a custom URL).
- **Dialpad** (the button beside the number, the header button, or `D`) types or pastes any number, shows the E.164 preview and dials through the same call destination — prefilled with the current lead's number when opened from the lead card. Useful when your softphone needs DTMF-style entry or the number isn't in your list.
- **Dispositions** `1`–`6` and `9`: timestamp, attempts++, per-lead history, callback date, DNC confirmation, auto-advance, optional auto-dial. Notes autosave on blur.
- **Queue builder** filters by category, rating range, review range, claimed, location/zip and text; orders by rank, rating, reviews or a deterministic random seed. Session snapshots keep their own queue and stats.
- **List view** is a sortable, filterable, virtualized table of every lead (including flagged/DNC).
- **Due callbacks** surface in the rail, with optional browser notifications. DNC has its own list and an explicit restore flow.
- **Export** the working CSV (original columns + `status`, `attempts`, `last_called_at`, `next_callback_at`, `notes`, `disposition_history`) or a call-log CSV with one row per attempt.
- **Keyboard-first**: `Space`/`→` next, `←` back, `1`–`6`/`9` dispositions, `D` dialpad, `/` search, `?` cheatsheet, `Esc` close dialogs.
- **Settings**: where calls open (phone app `tel:`, Google Voice web, MightyCall, Rynga, or a custom `{phone}` URL), default country, dark/light theme, dialer mode, callback notifications, optional cloud-phone webhook with a `{phone}` placeholder (GET opens the URL; POST sends `To` / `Phone` as a form body only when you click).
- Fully responsive: dense desktop CRM layout with a stacked dialer and sticky actions on phones.

## Data model (IndexedDB)

Database `lead-dialer`, version 1:

| Store | Key | Contents |
| --- | --- | --- |
| `leads` | `placeId` | Normalized lead, raw original header map, status, attempts, notes, callback/snooze timestamps, `history[]` |
| `kv` | `key` | `settings` (`AppSettings`), `session` (`SessionState`), `importHeaders` (`string[]`) |

A history entry:

```ts
{
  id: string;
  at: string;              // ISO timestamp
  disposition: "no_answer" | "voicemail" | "callback" | "interested"
             | "not_interested" | "wrong_number" | "dnc";
  note?: string;
  callbackAt?: string;     // ISO, only for callbacks
}
```

Status is the latest disposition (`new` until the first call). `attempts` increments once per disposition. A DNC status hard-excludes the lead from every derived queue and adds it to the DNC view; restoring is an explicit, confirmed action that keeps the audit history.

### Import rules

| Condition | Behavior |
| --- | --- |
| Duplicate `placeId` | Skipped and reported |
| No phone | Skipped by default; toggle to import (then flagged) |
| Permanently closed | Skipped by default; toggle to import (then flagged) |
| Temporarily closed | Imported, flagged, excluded from queue |
| Category `Area` or empty | Imported, flagged, excluded from queue |
| DNC | Never added to a queue; visible in DNC view and exports |

Skipped no-phone/closed rows are counted in the import receipt. The mapping panel shows all 73 expected columns and which were matched; extra columns are preserved in exports.

## Project layout

```
src/
  App.tsx                 state, sessions, dispositions, persistence, exports
  components/
    Dialer.tsx            lead card, dispositions, callback/DNC dialogs
    Dialpad.tsx           manual keypad, E.164 preview, tel:/webhook dialing
    ImportDialog.tsx      dropzone, mapping, options, import receipt
    QueueBuilder.tsx      filters and ordering
    SessionBar.tsx        live session stats
    SideRail.tsx          due callbacks / up next
    ListView.tsx          virtualized all-leads table
    DncView.tsx           DNC list + restore
    SettingsDialog.tsx    calling, webhook, data management
    ShortcutsDialog.tsx   cheatsheet
    ui.tsx                shadcn-style primitives + toaster
  lib/
    columns.ts            the 73 exact expected columns
    db.ts                 IndexedDB schema and accessors
    parse.ts              CSV/XLSX reading, normalization, dedupe, flags
    call.ts               call destinations: tel:, Google Voice, web dialers, custom URL
    format.ts             E.164, hours/Chicago time, addresses, durations
    queue.ts              queue filters/sorts, flags, session stats
    export.ts             working CSV + call log CSV
    sample.ts             20 demo leads (plus a deliberate duplicate row)
    types.ts              domain types, defaults, disposition map
    __tests__/            Vitest coverage for the core logic
```

### Notes and limits

- Google Maps exports sometimes store large numeric ids as numbers. If the spreadsheet already lost precision, the textual digits can’t be recovered; Lead Dialer preserves and expands whatever text the export contains and never converts ids to JS numbers.
- **Calling needs a handler.** The default `tel:` handoff goes to whatever app/browser handles `tel:` links on your device. On a phone browser that is usually the native dialer; if nothing happens or you would rather use a web service, switch Settings → **Where calls open** to Google Voice (prefilled call page, best signed in on desktop), MightyCall or Rynga (opens the web app and copies the number for pasting, since neither publishes a dial URL), or a custom `{phone}` URL for any other web dialer. Auto-dial is opt-in and uses the same destination.
- Browser dialers open in a new tab so the dialer screen keeps its place. If a pop-up is blocked, allow pop-ups for this site or tap the number yourself.
- Browser notifications require permission and a secure context; the optional webhook is the only outbound request and only fires on explicit Click-to-call.
- IndexedDB may be blocked in strict private/incognito modes. The app reports a failure instead of pretending data was saved.
- Clearing local data in Settings deletes leads and call history from this browser after a second confirmation. Export first.
