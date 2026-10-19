import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import type { Lead } from "./types";

export const TIMEZONE = "America/Chicago";

export function normalizePhone(
  phoneUnformatted: string,
  phoneFormatted: string,
  countryCode: string,
): string {
  const country = (countryCode || "US").trim().toUpperCase() as CountryCode;
  const candidates = [phoneUnformatted, phoneFormatted].map((v) => (v ?? "").trim()).filter(Boolean);

  for (const candidate of candidates) {
    // Keep a leading + if present, otherwise strip formatting.
    const cleaned = candidate.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
    if (!cleaned) continue;
    try {
      const parsed = parsePhoneNumberFromString(cleaned, country);
      if (parsed && parsed.isPossible()) return parsed.number;
    } catch {
      /* fall through */
    }
  }

  const digits = candidates[0]?.replace(/\D/g, "") ?? "";
  if (!digits) return "";
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (candidates[0]?.trim().startsWith("+")) return `+${digits}`;
  const callingCode = COUNTRY_CALLING_CODE[country] ?? "1";
  if (country === "US" || country === "CA") {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  }
  return `+${callingCode}${digits.replace(/^0+/, "")}`;
}

const COUNTRY_CALLING_CODE: Record<string, string> = {
  US: "1",
  CA: "1",
  GB: "44",
  AU: "61",
  NZ: "64",
  IE: "353",
  DE: "49",
  FR: "33",
  ES: "34",
  IT: "39",
  NL: "31",
  SE: "46",
  NO: "47",
  DK: "45",
  CH: "41",
  AT: "43",
  BE: "32",
  PT: "351",
  BR: "55",
  MX: "52",
  IN: "91",
  JP: "81",
  SG: "65",
  ZA: "27",
  AE: "971",
};

export function formatPhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** tel: URI that keeps the E.164 leading +, so softphones dial the right country. */
export function telHref(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return `tel:${cleaned}`;
}

export function ensureProtocol(url: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export function buildAddress(lead: Pick<Lead, "street" | "city" | "state" | "postalCode">): string {
  const cityState = [lead.city, lead.state].filter(Boolean).join(", ");
  const tail = [cityState, lead.postalCode].filter(Boolean).join(" ");
  return [lead.street, tail].filter(Boolean).join(", ");
}

export function parseBool(value: string | undefined | null): boolean {
  if (!value) return false;
  return /^(true|yes|1|y)$/i.test(value.trim());
}

export function parseNum(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value.trim() === "") return null;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Expand scientific notation without losing the textual digits (for ids such as cid). */
export function expandScientific(value: string): string {
  const v = value.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(v);
  if (!match) return value;
  const [, sign, intPart, fracPart = "", expRaw] = match;
  const exp = Number(expRaw);
  let digits = intPart + fracPart;
  let point = intPart.length + exp;
  let out: string;
  if (point <= 0) {
    out = `0.${"0".repeat(-point)}${digits}`;
  } else if (point >= digits.length) {
    out = digits + "0".repeat(point - digits.length);
  } else {
    out = `${digits.slice(0, point)}.${digits.slice(point)}`;
  }
  out = out.replace(/^0+(?=\d)/, "");
  return sign === "-" ? `-${out}` : out;
}

const DISPLAY_DAY: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export function dayKey(day: string): string {
  const d = day.trim().toLowerCase();
  return DISPLAY_DAY[d.slice(0, 3)] ?? day.trim();
}

export function todayInChicago(now = new Date()): { day: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return { day: weekday, minutes: hour * 60 + Number(get("minute")) };
}

function toMinutes(token: string): number | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?m?\.?$/i.exec(token.trim());
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  const suffix = m[3]?.toLowerCase();
  if (suffix === "p" && hour !== 12) hour += 12;
  if (suffix === "a" && hour === 12) hour = 0;
  if (!suffix && hour < 8) hour += 12; // "7 - 9" style: assume PM close
  return hour * 60 + minute;
}

export function formatMinutes(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return minute ? `${h}:${String(minute).padStart(2, "0")} ${suffix}` : `${h} ${suffix}`;
}

export interface HoursParse {
  open: number;
  close: number;
  /** close is the next day (e.g. 11 PM - 2 AM) */
  overnight: boolean;
}

export function parseHoursRange(raw: string | undefined): HoursParse | "closed" | "24h" | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;
  if (/closed/i.test(text)) return "closed";
  if (/24\s*(hours|hrs)|open\s*24/i.test(text)) return "24h";

  // Multiple ranges are common; use the first range for the open/closed pill.
  const first = text.split(/[,;]/)[0].trim();
  const parts = first.split(/\s*(?:–|—|-|to)\s*/i).filter(Boolean);
  if (parts.length < 2) return null;
  const open = toMinutes(parts[0]);
  const close = toMinutes(parts[1]);
  if (open === null || close === null) return null;
  return { open, close, overnight: close <= open };
}

export interface OpenState {
  open: boolean;
  label: string;
  detail?: string;
}

export function getOpenState(
  hours: Record<string, string>,
  now = new Date(),
): OpenState {
  const { day, minutes } = todayInChicago(now);
  const raw = hours[day.toLowerCase()];
  const parsed = parseHoursRange(raw);
  const dayIndex = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].indexOf(day);
  const tomorrow = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][(dayIndex + 1) % 7];

  if (parsed === "24h") return { open: true, label: "Open now", detail: "Open 24 hours" };
  if (parsed === "closed") {
    const tomorrowRaw = hours[tomorrow.toLowerCase()];
    if (tomorrowRaw && !/closed/i.test(tomorrowRaw)) {
      const next = parseHoursRange(tomorrowRaw);
      if (next === "24h") return { open: false, label: "Closed", detail: "Opens tomorrow" };
      if (next && next !== "closed")
        return { open: false, label: "Closed", detail: `Opens tomorrow at ${formatMinutes(next.open)}` };
    }
    return { open: false, label: "Closed", detail: "Closed today" };
  }
  if (!parsed) {
    return { open: false, label: "Hours unavailable" };
  }

  if (parsed.overnight) {
    if (minutes >= parsed.open || minutes < parsed.close) {
      return { open: true, label: "Open now", detail: `Closes ${formatMinutes(parsed.close)}` };
    }
    return { open: false, label: "Closed", detail: `Opens at ${formatMinutes(parsed.open)}` };
  }

  if (minutes >= parsed.open && minutes < parsed.close) {
    return { open: true, label: "Open now", detail: `Closes ${formatMinutes(parsed.close)}` };
  }
  if (minutes < parsed.open) {
    return { open: false, label: "Closed", detail: `Opens at ${formatMinutes(parsed.open)}` };
  }
  const tomorrowRaw = hours[tomorrow.toLowerCase()];
  const next = parseHoursRange(tomorrowRaw);
  if (next === "24h") return { open: false, label: "Closed", detail: "Opens tomorrow" };
  if (next && next !== "closed")
    return { open: false, label: "Closed", detail: `Opens at ${formatMinutes(next.open)} tomorrow` };
  return { open: false, label: "Closed" };
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (minutes < 1) return "just now";
  if (minutes < 60) return formatter.format(diff < 0 ? -minutes : minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return formatter.format(diff < 0 ? -hours : hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 30) return formatter.format(diff < 0 ? -days : days, "day");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
