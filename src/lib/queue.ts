import type { HistoryEntry, Lead, QueueConfig } from "./types";

export interface LeadFlags {
  dnc: boolean;
  closed: boolean;
  noPhone: boolean;
  area: boolean;
  flagged: boolean;
  /** Human-readable reason the lead is excluded from the dial queue. */
  reason: string | null;
}

export function flagsFor(lead: Lead): LeadFlags {
  const dnc = lead.status === "dnc";
  const closed = lead.permanentlyClosed || lead.temporarilyClosed;
  const noPhone = !lead.phone;
  const area = !lead.categoryName || /^area$/i.test(lead.categoryName);
  const reasons: string[] = [];
  if (dnc) reasons.push("Do not call");
  if (lead.permanentlyClosed) reasons.push("Permanently closed");
  if (lead.temporarilyClosed) reasons.push("Temporarily closed");
  if (noPhone) reasons.push("No phone");
  if (area) reasons.push("Area, not a business");
  return {
    dnc,
    closed,
    noPhone,
    area,
    flagged: closed || noPhone || area,
    reason: reasons.length ? reasons.join(" · ") : null,
  };
}

export function isDueCallback(lead: Lead, now = Date.now()): boolean {
  return (
    lead.status === "callback" &&
    !!lead.nextCallbackAt &&
    new Date(lead.nextCallbackAt).getTime() <= now &&
    !isSnoozed(lead, now)
  );
}

export function isSnoozed(lead: Lead, now = Date.now()): boolean {
  return !!lead.snoozeUntil && new Date(lead.snoozeUntil).getTime() > now;
}

export function buildQueue(leads: Lead[], config: QueueConfig, now = Date.now()): Lead[] {
  const search = config.search.trim().toLowerCase();
  const minRating = config.minRating === "" ? null : Number(config.minRating);
  const maxRating = config.maxRating === "" ? null : Number(config.maxRating);
  const minReviews = config.minReviews === "" ? null : Number(config.minReviews);
  const maxReviews = config.maxReviews === "" ? null : Number(config.maxReviews);
  const location = config.location.trim().toLowerCase();

  const filtered = leads.filter((lead) => {
    const flags = flagsFor(lead);
    if (flags.dnc) return false;
    if (flags.flagged && !config.includeFlagged) return false;
    if (isSnoozed(lead, now) && !config.includeSnoozed) return false;
    if (config.category !== "all" && lead.categoryName !== config.category) return false;
    if (minRating !== null && (lead.totalScore ?? 0) < minRating) return false;
    if (maxRating !== null && (lead.totalScore ?? 0) > maxRating) return false;
    if (minReviews !== null && (lead.reviewsCount ?? 0) < minReviews) return false;
    if (maxReviews !== null && (lead.reviewsCount ?? 0) > maxReviews) return false;
    if (config.claimed === "claimed" && !lead.claimThisBusiness) return false;
    if (config.claimed === "unclaimed" && lead.claimThisBusiness) return false;
    if (
      location &&
      ![lead.neighborhood, lead.city, lead.postalCode, lead.state, lead.formattedAddress]
        .join(" ")
        .toLowerCase()
        .includes(location)
    ) {
      return false;
    }
    if (search && !lead.searchString.includes(search)) return false;
    return true;
  });

  switch (config.sort) {
    case "rating":
      filtered.sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
      break;
    case "reviews":
      filtered.sort((a, b) => (b.reviewsCount ?? -1) - (a.reviewsCount ?? -1));
      break;
    case "random": {
      let seed = config.randomSeed || 1;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
      for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
      }
      break;
    }
    case "rank":
    default:
      filtered.sort((a, b) => {
        const ra = a.rank ?? Number.MAX_SAFE_INTEGER;
        const rb = b.rank ?? Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
        return a.title.localeCompare(b.title);
      });
  }
  return filtered;
}

export function categoriesOf(leads: Lead[]): string[] {
  const set = new Set<string>();
  leads.forEach((lead) => {
    if (lead.categoryName && !/^area$/i.test(lead.categoryName)) set.add(lead.categoryName);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function allHistory(leads: Lead[]): Array<HistoryEntry & { lead: Lead }> {
  return leads
    .flatMap((lead) => lead.history.map((entry) => ({ ...entry, lead })))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export interface SessionStats {
  calls: number;
  connects: number;
  interested: number;
  callbacks: number;
  dnc: number;
  avgMs: number;
}

const CONNECT = new Set(["interested", "not_interested", "callback", "wrong_number", "dnc"]);

export function sessionStats(leads: Lead[], startedAt: string, now = Date.now()): SessionStats {
  const start = new Date(startedAt).getTime();
  const entries = allHistory(leads).filter((entry) => new Date(entry.at).getTime() >= start);
  const calls = entries.length;
  return {
    calls,
    connects: entries.filter((e) => CONNECT.has(e.disposition)).length,
    interested: entries.filter((e) => e.disposition === "interested").length,
    callbacks: entries.filter((e) => e.disposition === "callback").length,
    dnc: entries.filter((e) => e.disposition === "dnc").length,
    avgMs: calls ? Math.max(0, now - start) / calls : 0,
  };
}

export function statusLabel(status: Lead["status"]): string {
  switch (status) {
    case "new":
      return "New";
    case "no_answer":
      return "No answer";
    case "voicemail":
      return "Voicemail";
    case "callback":
      return "Callback";
    case "interested":
      return "Interested";
    case "not_interested":
      return "Not interested";
    case "wrong_number":
      return "Wrong number";
    case "dnc":
      return "DNC";
  }
}
