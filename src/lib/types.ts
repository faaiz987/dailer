export const DISPOSITIONS = {
  no_answer: "No answer",
  voicemail: "Left voicemail",
  callback: "Callback scheduled",
  interested: "Interested",
  not_interested: "Not interested",
  wrong_number: "Wrong number",
  dnc: "Do not call",
} as const;

export type Disposition = keyof typeof DISPOSITIONS;

export type LeadStatus = "new" | Disposition;

export interface Dict<T> {
  [key: string]: T;
}

export interface HistoryEntry {
  id: string;
  at: string;
  disposition: Disposition;
  note?: string;
  callbackAt?: string;
}

export interface Lead {
  placeId: string;
  title: string;
  categoryName: string;
  phone: string;
  phoneRaw: string;
  phoneUnformatted: string;
  totalScore: number | null;
  reviewsCount: number | null;
  /** 1..5 star counts */
  reviewsDistribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  neighborhood: string;
  countryCode: string;
  formattedAddress: string;
  url: string;
  website: string;
  claimThisBusiness: boolean;
  price: string;
  permanentlyClosed: boolean;
  temporarilyClosed: boolean;
  description: string;
  ownerDescription: string;
  /** lowercased day name -> raw hours text */
  hours: Record<string, string>;
  rank: number | null;
  lat: number | null;
  lng: number | null;
  raw: Record<string, string>;
  status: LeadStatus;
  attempts: number;
  lastCalledAt: string | null;
  nextCallbackAt: string | null;
  snoozeUntil: string | null;
  notes: string;
  history: HistoryEntry[];
  importedAt: string;
  searchString: string;
}

export type SortKey = "rank" | "rating" | "reviews" | "random";

export interface QueueConfig {
  category: string;
  minRating: string;
  maxRating: string;
  minReviews: string;
  maxReviews: string;
  claimed: "any" | "claimed" | "unclaimed";
  location: string;
  search: string;
  sort: SortKey;
  randomSeed: number;
  includeFlagged: boolean;
  includeSnoozed: boolean;
}

export const DEFAULT_QUEUE: QueueConfig = {
  category: "all",
  minRating: "",
  maxRating: "",
  minReviews: "",
  maxReviews: "",
  claimed: "any",
  location: "",
  search: "",
  sort: "rank",
  randomSeed: 1,
  includeFlagged: false,
  includeSnoozed: false,
};

export type WebhookMethod = "GET" | "POST";

export interface AppSettings {
  theme: "dark" | "light";
  dialerMode: boolean;
  defaultCountry: string;
  notifications: boolean;
  webhookUrl: string;
  webhookMethod: WebhookMethod;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  dialerMode: false,
  defaultCountry: "US",
  notifications: false,
  webhookUrl: "",
  webhookMethod: "POST",
};

export interface ImportOptions {
  importNoPhone: boolean;
  importClosed: boolean;
}

export interface ImportSummary {
  fileName: string;
  totalRows: number;
  imported: number;
  duplicates: number;
  noPhone: number;
  permanentlyClosed: number;
  temporarilyClosed: number;
  emptyCategory: number;
  missingPlaceId: number;
  headersMatched: number;
  headersTotal: number;
  at: string;
}

export interface SessionState {
  active: boolean;
  queue: string[];
  index: number;
  startedAt: string;
  pausedAt: string | null;
  /** Total time spent paused, excluded from the live clock and average. */
  totalPausedMs?: number;
}

export interface Toast {
  id: string;
  title: string;
  tone: "info" | "success" | "error";
}

export const DISPOSITION_KEYS: Record<string, Disposition> = {
  "1": "no_answer",
  "2": "voicemail",
  "3": "callback",
  "4": "interested",
  "5": "not_interested",
  "6": "wrong_number",
  "9": "dnc",
};

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
