import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarClock,
  Check,
  ClipboardCopy,
  Clock,
  ExternalLink,
  Globe,
  Grid3x3,
  Keyboard,
  MapPin,
  MessageSquare,
  Phone,
  PhoneOff,
  SkipForward,
  Star,
  StickyNote,
  Voicemail,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildAddress,
  formatDateTime,
  formatPhone,
  getOpenState,
  telHref,
  todayInChicago,
} from "../lib/format";
import { flagsFor } from "../lib/queue";
import type { AppSettings, Disposition, HistoryEntry, Lead } from "../lib/types";
import { DAY_NAMES, DISPOSITIONS, DISPOSITION_KEYS } from "../lib/types";
import { cn } from "../lib/utils";
import { ClaimedBadge, StatusBadge } from "./status";
import { Badge, Button, Collapsible, Dialog, Input, Kbd, Label, RatingStars, Switch, Textarea, useToast } from "./ui";

interface DialerProps {
  lead: Lead | null;
  position: { index: number; total: number } | null;
  hasLeads: boolean;
  queueCount: number;
  activeFilteredCount: number;
  sessionActive: boolean;
  sessionPaused: boolean;
  settings: AppSettings;
  onDispose: (lead: Lead, disposition: Disposition, opts?: { callbackAt?: string; note?: string }) => void;
  onSkip: () => void;
  onBack: () => void;
  onSnooze: (lead: Lead) => void;
  onSaveNotes: (placeId: string, notes: string) => void;
  onToggleDialerMode: () => void;
  onStartSession: () => void;
  onClearFilters: () => void;
  onImport: () => void;
  onLoadSample: () => void;
  onOpenShortcuts: () => void;
  onOpenSettings: () => void;
  onWebhookCall: (phone: string) => void;
  onOpenDialpad: (seed?: string) => void;
  onFocusSearch: () => void;
}

const DISPOSITION_UI: Array<{
  key: string;
  disposition: Disposition;
  icon: typeof Phone;
  className: string;
}> = [
  { key: "1", disposition: "no_answer", icon: PhoneOff, className: "hover:border-zinc-400/60 hover:bg-zinc-500/10" },
  {
    key: "2",
    disposition: "voicemail",
    icon: Voicemail,
    className: "hover:border-sky-400/60 hover:bg-sky-500/10",
  },
  {
    key: "3",
    disposition: "callback",
    icon: CalendarClock,
    className: "hover:border-violet-400/60 hover:bg-violet-500/10",
  },
  {
    key: "4",
    disposition: "interested",
    icon: Star,
    className: "hover:border-emerald-400/60 hover:bg-emerald-500/10",
  },
  {
    key: "5",
    disposition: "not_interested",
    icon: Ban,
    className: "hover:border-amber-400/60 hover:bg-amber-500/10",
  },
  {
    key: "6",
    disposition: "wrong_number",
    icon: Building2,
    className: "hover:border-slate-400/60 hover:bg-slate-500/10",
  },
  {
    key: "9",
    disposition: "dnc",
    icon: Ban,
    className: "text-red-400 hover:border-red-400/60 hover:bg-red-500/10",
  },
];

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

function nextHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function tomorrowMorning(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function Dialer({
  lead,
  position,
  hasLeads,
  queueCount,
  activeFilteredCount,
  sessionActive,
  sessionPaused,
  settings,
  onDispose,
  onSkip,
  onBack,
  onSnooze,
  onSaveNotes,
  onToggleDialerMode,
  onStartSession,
  onClearFilters,
  onImport,
  onLoadSample,
  onOpenShortcuts,
  onOpenSettings,
  onWebhookCall,
  onOpenDialpad,
  onFocusSearch,
}: DialerProps) {
  const { push } = useToast();
  const now = useNow();
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [callbackValue, setCallbackValue] = useState(toLocalInput(nextHour()));
  const [dncOpen, setDncOpen] = useState(false);
  const notesTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setNotes(lead?.notes ?? "");
    setNotesDirty(false);
    setNotesSaved(false);
  }, [lead?.placeId, lead?.notes]);

  useEffect(() => () => window.clearTimeout(notesTimer.current), []);

  const flags = lead ? flagsFor(lead) : null;
  const openState = lead ? getOpenState(lead.hours, now) : null;
  const today = todayInChicago(now).day;
  const address = lead ? lead.formattedAddress || buildAddress(lead) : "";
  const mapsUrl = lead
    ? lead.url ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.title} ${address}`)}`
    : "";

  const distribution = useMemo(() => {
    if (!lead) return [];
    const values = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: lead.reviewsDistribution[String(star) as "1" | "2" | "3" | "4" | "5"] ?? 0,
    }));
    const max = Math.max(1, ...values.map((v) => v.count));
    const total = values.reduce((sum, v) => sum + v.count, 0) || lead.reviewsCount || 0;
    return values.map((v) => ({
      ...v,
      width: Math.round((v.count / max) * 100),
      percent: total ? Math.round((v.count / total) * 100) : 0,
    }));
  }, [lead]);

  const saveNotes = () => {
    if (!lead || !notesDirty) return;
    onSaveNotes(lead.placeId, notes);
    setNotesDirty(false);
    setNotesSaved(true);
    window.clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(() => setNotesSaved(false), 2000);
  };

  const copyPhone = async () => {
    if (!lead?.phone) return;
    try {
      await navigator.clipboard.writeText(lead.phone);
      push("Phone number copied", "success");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = lead.phone;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      push("Phone number copied", "success");
    }
  };

  const openCallback = () => {
    setCallbackValue(toLocalInput(nextHour()));
    setCallbackOpen(true);
  };

  const confirmCallback = () => {
    if (!lead) return;
    const date = new Date(callbackValue);
    if (Number.isNaN(date.getTime())) {
      push("Pick a valid callback date and time", "error");
      return;
    }
    setCallbackOpen(false);
    onDispose(lead, "callback", {
      callbackAt: date.toISOString(),
      note: notes.trim() ? notes.trim() : undefined,
    });
  };

  const runAction = (disposition: Disposition) => {
    if (!lead) return;
    if (disposition === "callback") {
      openCallback();
      return;
    }
    if (disposition === "dnc") {
      setDncOpen(true);
      return;
    }
    onDispose(lead, disposition, { note: notes.trim() ? notes.trim() : undefined });
  };

  // Keyboard-first dialing: dispositions, skip/next, back. Inputs and dialogs are excluded.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (!lead || callbackOpen || dncOpen) return;

      if (event.key === " " || event.key === "ArrowRight") {
        event.preventDefault();
        onSkip();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onBack();
        return;
      }
      const disposition = DISPOSITION_KEYS[event.key];
      if (disposition && lead.status !== "dnc" && !sessionPaused) {
        event.preventDefault();
        runAction(disposition);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead, notes, callbackOpen, dncOpen, sessionPaused, onSkip, onBack]);

  const todayHours = lead?.hours[today.toLowerCase()];

  if (!lead) {
    return (
      <CardShell>
        <EmptyDialer
          hasLeads={hasLeads}
          queueCount={queueCount}
          activeFilteredCount={activeFilteredCount}
          onStartSession={onStartSession}
          onClearFilters={onClearFilters}
          onImport={onImport}
          onLoadSample={onLoadSample}
          onOpenDialpad={() => onOpenDialpad()}
          onFocusSearch={onFocusSearch}
        />
      </CardShell>
    );
  }

  return (
    <CardShell>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          {position ? (
            <Badge variant="outline" className="tabular">
              Lead {position.index + 1} of {position.total}
            </Badge>
          ) : (
            <Badge variant="warning">Off-queue lead</Badge>
          )}
          <StatusBadge status={lead.status} />
          {lead.attempts > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {lead.attempts} attempt{lead.attempts === 1 ? "" : "s"}
            </span>
          )}
          {lead.nextCallbackAt && lead.status === "callback" && (
            <Badge variant="violet">
              <CalendarClock className="h-3 w-3" /> {formatDateTime(lead.nextCallbackAt)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
            Auto-dial
            <Switch checked={settings.dialerMode} onCheckedChange={onToggleDialerMode} label="Auto dial on advance" />
          </label>
          <Button variant="ghost" size="iconSm" onClick={onOpenShortcuts} title="Keyboard shortcuts (?)">
            <Keyboard />
          </Button>
          <Button variant="ghost" size="iconSm" onClick={onOpenSettings} title="Settings">
            <Zap />
          </Button>
        </div>
      </div>

      {position && position.total > 0 && (
        <div className="h-0.5 w-full bg-muted">
          <div
            className="h-full bg-primary/70 transition-all"
            style={{ width: `${Math.min(100, ((position.index + 1) / position.total) * 100)}%` }}
          />
        </div>
      )}

      {sessionPaused && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-300 sm:px-5">
          <span className="font-medium">Session paused</span>
          <span className="text-current/80"> · Resume to log dispositions. Notes and navigation still work.</span>
        </div>
      )}

      {flags?.reason && (
        <div
          className={cn(
            "border-b px-4 py-2 text-xs sm:px-5",
            flags.dnc
              ? "border-red-500/20 bg-red-500/10 text-red-300"
              : "border-amber-500/20 bg-amber-500/10 text-amber-300",
          )}
        >
          <span className="font-medium">{flags.dnc ? "Do not call" : "Excluded from dial queue"}</span>
          <span className="text-current/80"> · {flags.reason}</span>
        </div>
      )}

      <div className="space-y-4 p-4 sm:p-5">
        {/* Identity */}
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                {lead.title}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {lead.categoryName || "Uncategorized"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <RatingStars value={lead.totalScore} />
                  <span className="font-medium text-foreground">{lead.totalScore?.toFixed(1) ?? "—"}</span>
                  <span>({lead.reviewsCount?.toLocaleString() ?? 0})</span>
                </span>
                {lead.price && <span className="font-medium text-foreground">{lead.price}</span>}
                <ClaimedBadge claimed={lead.claimThisBusiness} />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge
                variant={openState?.open ? "success" : "secondary"}
                className="px-2.5 py-1 text-xs"
                title={openState?.detail}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", openState?.open ? "bg-emerald-400" : "bg-zinc-500")}
                />
                {openState?.label ?? "Hours unavailable"}
              </Badge>
              {openState?.detail && <span className="text-[11px] text-muted-foreground">{openState.detail}</span>}
            </div>
          </div>
        </div>

        {/* Phone */}
        <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {lead.phone ? (
              <a
                href={telHref(lead.phone)}
                className="group inline-flex max-w-full items-center gap-3 rounded-md text-[clamp(1.45rem,6.5vw,2.6rem)] font-semibold tracking-tight text-primary transition-colors hover:text-primary/80"
                title="Call with your default phone app"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105 sm:h-12 sm:w-12">
                  <Phone className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <span className="tabular leading-none">{formatPhone(lead.phone)}</span>
              </a>
            ) : (
              <div className="flex items-center gap-2 text-lg text-muted-foreground">
                <PhoneOff className="h-5 w-5" /> No phone number
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenDialpad(lead.phone || undefined)}
                title="Open the dialpad to type or paste a number"
              >
                <Grid3x3 /> Dialpad
              </Button>
              {lead.phone && (
                <Button variant="outline" size="sm" onClick={copyPhone} title="Copy E.164 number">
                  <ClipboardCopy /> Copy number
                </Button>
              )}
              {lead.phone && settings.webhookUrl && (
                <Button variant="outline" size="sm" onClick={() => onWebhookCall(lead.phone)} title="Send to cloud phone system">
                  <Zap /> Click-to-call
                </Button>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="font-mono">{lead.phone || "—"}</span>
            <span className="text-border">|</span>
            <span>
              Click the number to call · auto-dial is {settings.dialerMode ? "on" : "off"}
            </span>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid gap-4 md:grid-cols-5">
          <div className="space-y-3 md:col-span-3">
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="leading-snug">{address || "No address on file"}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {lead.neighborhood && <span>{lead.neighborhood}</span>}
                  {lead.city && <span>{lead.city}, {lead.state}</span>}
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Open in Google Maps <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              {lead.website ? (
                <a
                  href={/^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-[260px] items-center gap-1.5 truncate text-muted-foreground hover:text-foreground hover:underline"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{lead.website.replace(/^https?:\/\//i, "").replace(/\/$/, "")}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" /> No website
                </span>
              )}
              {lead.price && <span className="text-muted-foreground">Price: {lead.price}</span>}
            </div>

            <Collapsible
              title={
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Today · {today}
                  <span className="text-[11px] text-foreground/80">{todayHours ?? "Not listed"}</span>
                </span>
              }
              defaultOpen
            >
              <div className="divide-y divide-border/60">
                {DAY_NAMES.map((day) => {
                  const raw = lead.hours[day.toLowerCase()];
                  const isToday = day === today;
                  return (
                    <div
                      key={day}
                      className={cn(
                        "flex items-center justify-between gap-4 px-1 py-1.5 text-xs",
                        isToday ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {isToday && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                        {day}
                      </span>
                      <span className="tabular">{raw || "—"}</span>
                    </div>
                  );
                })}
              </div>
            </Collapsible>
          </div>

          {/* Reviews */}
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Reviews</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold">{lead.totalScore?.toFixed(1) ?? "—"}</span>
                  <RatingStars value={lead.totalScore} />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {lead.reviewsCount?.toLocaleString() ?? 0} reviews
                </div>
              </div>
            </div>
            <div className="space-y-1 pt-1">
              {distribution.map((row) => (
                <div key={row.star} className="flex items-center gap-2 text-[11px]">
                  <span className="w-3 text-right tabular text-muted-foreground">{row.star}</span>
                  <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-amber-400/80"
                      style={{ width: `${row.width}%` }}
                      title={`${row.count} reviews (${row.percent}%)`}
                    />
                  </div>
                  <span className="w-9 text-right tabular text-muted-foreground">{row.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* About */}
        {(lead.description || lead.ownerDescription) && (
          <Collapsible
            title={
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> About
              </span>
            }
          >
            <div className="space-y-3">
              {lead.description && <p className="leading-relaxed text-muted-foreground">{lead.description}</p>}
              {lead.ownerDescription && (
                <div>
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    From the owner
                  </div>
                  <p className="leading-relaxed text-muted-foreground">{lead.ownerDescription}</p>
                </div>
              )}
            </div>
          </Collapsible>
        )}

        {/* Notes */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="mb-0 flex items-center gap-1.5">
              <StickyNote className="h-3 w-3" /> Notes
            </Label>
            <span className="h-4 text-[11px] text-muted-foreground">
              {notesSaved ? (
                <span className="inline-flex items-center gap-1 text-emerald-500">
                  <Check className="h-3 w-3" /> Saved
                </span>
              ) : notesDirty ? (
                "Unsaved · saves on blur"
              ) : (
                "Autosaves on blur"
              )}
            </span>
          </div>
          <Textarea
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setNotesDirty(true);
            }}
            onBlur={saveNotes}
            placeholder="Gatekeeper name, best time to reach, objection notes…"
            rows={2}
            className="min-h-[64px] text-sm"
          />
        </div>

        {/* Dispositions */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Log outcome</div>
            <div className="text-[11px] text-muted-foreground">
              <Kbd>1</Kbd>–<Kbd>6</Kbd> · <Kbd>9</Kbd> shortcuts
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {DISPOSITION_UI.map(({ key, disposition, icon: Icon, className }) => (
              <button
                key={key}
                type="button"
                disabled={lead.status === "dnc" || sessionPaused}
                onClick={() => runAction(disposition)}
                className={cn(
                  "group flex h-12 items-center justify-between gap-2 rounded-md border bg-background/40 px-3 text-left text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
                  className,
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100" />
                  {DISPOSITIONS[disposition]}
                </span>
                <Kbd className="border-border/60 bg-muted/60">{key}</Kbd>
              </button>
            ))}
            <div className="hidden items-center justify-center rounded-md border border-dashed text-[11px] text-muted-foreground lg:flex">
              Auto-advance after logging
            </div>
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft /> Back <Kbd className="ml-1">←</Kbd>
            </Button>
            <Button variant="outline" size="sm" onClick={onSkip}>
              Skip <SkipForward /> <Kbd className="ml-1">Space</Kbd>
            </Button>
            <Button variant="outline" size="sm" onClick={() => onSnooze(lead)}>
              Snooze 1h
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={onOpenShortcuts} className="text-muted-foreground">
            <Keyboard /> Shortcuts <Kbd className="ml-1">?</Kbd>
          </Button>
        </div>

        {lead.history.length > 0 && (
          <Collapsible
            title={`Activity history (${lead.history.length})`}
            badge={
              sessionActive && !sessionPaused ? (
                <Badge variant="success" className="ml-1">
                  Session active
                </Badge>
              ) : undefined
            }
          >
            <div className="space-y-2">
              {[...lead.history].reverse().map((entry: HistoryEntry) => (
                <div key={entry.id} className="flex items-start justify-between gap-3 text-xs">
                  <div>
                    <span className="font-medium">{DISPOSITIONS[entry.disposition]}</span>
                    {entry.note && <span className="text-muted-foreground"> — {entry.note}</span>}
                    {entry.callbackAt && (
                      <span className="text-violet-400"> · due {formatDateTime(entry.callbackAt)}</span>
                    )}
                  </div>
                  <span className="shrink-0 tabular text-muted-foreground">{formatDateTime(entry.at)}</span>
                </div>
              ))}
            </div>
          </Collapsible>
        )}
      </div>

      {/* Callback dialog */}
      <Dialog
        open={callbackOpen}
        onClose={() => setCallbackOpen(false)}
        title="Schedule a callback"
        description={`${lead.title} · ${formatPhone(lead.phone)}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCallbackOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmCallback}>
              <CalendarClock /> Schedule callback
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="callback-at">Callback date &amp; time</Label>
            <Input
              id="callback-at"
              type="datetime-local"
              data-dialog-autofocus
              value={callbackValue}
              onChange={(event) => setCallbackValue(event.target.value)}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Stored in local time. It will surface in Due callbacks when the time arrives.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const d = new Date();
                d.setHours(d.getHours() + 1);
                d.setMinutes(0, 0, 0);
                setCallbackValue(toLocalInput(d));
              }}
            >
              In 1 hour
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCallbackValue(toLocalInput(tomorrowMorning()))}>
              Tomorrow 9 AM
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() + 3);
                d.setHours(9, 0, 0, 0);
                setCallbackValue(toLocalInput(d));
              }}
            >
              In 3 days, 9 AM
            </Button>
          </div>
          {notes.trim() && (
            <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
              Note will be attached: <span className="text-foreground">{notes.trim()}</span>
            </div>
          )}
        </div>
      </Dialog>

      {/* DNC confirm */}
      <Dialog
        open={dncOpen}
        onClose={() => setDncOpen(false)}
        title="Add to Do Not Call?"
        description="This is a hard exclusion. The lead will never appear in a dial queue again."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDncOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDncOpen(false);
                onDispose(lead, "dnc", { note: notes.trim() ? notes.trim() : undefined });
              }}
            >
              <Ban /> Add to DNC
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{lead.title}</span> will be moved to the DNC list and excluded
          from all queues. You can still see it in the DNC view and in exports.
        </p>
      </Dialog>
    </CardShell>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-lg border bg-card shadow-card">{children}</div>;
}

function EmptyDialer({
  hasLeads,
  queueCount,
  activeFilteredCount,
  onStartSession,
  onClearFilters,
  onImport,
  onLoadSample,
  onOpenDialpad,
  onFocusSearch,
}: {
  hasLeads: boolean;
  queueCount: number;
  activeFilteredCount: number;
  onStartSession: () => void;
  onClearFilters: () => void;
  onImport: () => void;
  onLoadSample: () => void;
  onOpenDialpad: () => void;
  onFocusSearch: () => void;
}) {
  if (!hasLeads) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border bg-muted/50">
          <Phone className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Start your first calling session</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Import a Google Maps CSV or XLSX export, or load sample leads to explore the dialer. Everything stays in this
          browser — nothing is uploaded.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={onImport}>
            <ClipboardCopy /> Import leads
          </Button>
          <Button variant="outline" onClick={onLoadSample}>
            Load sample data
          </Button>
          <Button variant="outline" onClick={onOpenDialpad}>
            <Grid3x3 /> Open dialpad
          </Button>
        </div>
        <div className="mt-6 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Local-only · IndexedDB · No account
        </div>
      </div>
    );
  }

  if (activeFilteredCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border bg-muted/50">
          <SkipForward className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">Queue is empty</h2>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          No leads match the current filters. Widen the queue filters, include flagged leads, or rebuild the session
          after importing more data.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
          <Button variant="outline" onClick={onFocusSearch}>
            Edit search
          </Button>
          <Button onClick={onStartSession} disabled={queueCount === 0}>
            Start new session
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
        <Check className="h-5 w-5 text-emerald-500" />
      </div>
      <h2 className="text-lg font-semibold">Queue complete</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        You've reached the end of this session queue. Nice work. Start a new session with the current filters, or review
        your leads.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button onClick={onStartSession}>Start new session</Button>
        <Button variant="outline" onClick={onClearFilters}>
          Clear filters
        </Button>
      </div>
    </div>
  );
}
