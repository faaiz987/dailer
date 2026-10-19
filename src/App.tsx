import {
  Ban,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Keyboard,
  List,
  Moon,
  Phone,
  PhoneCall,
  Settings,
  Sun,
  Upload,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialer } from "./components/Dialer";
import { DncView } from "./components/DncView";
import { ImportDialog } from "./components/ImportDialog";
import { ListView } from "./components/ListView";
import { QueueBuilder } from "./components/QueueBuilder";
import { SessionBar } from "./components/SessionBar";
import { SettingsDialog } from "./components/SettingsDialog";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { DueCallbacksCard, SideRail } from "./components/SideRail";
import { Badge, Button, Kbd, useToast } from "./components/ui";
import {
  loadImportHeaders,
  loadLeads,
  loadSession,
  loadSettings,
  putLead,
  putLeads,
  saveImportHeaders,
  saveSession,
  saveSettings,
  wipeAll,
} from "./lib/db";
import { buildCallLogCsv, buildWorkingCsv, downloadCsv, exportStamp, mergeHeaderNames } from "./lib/export";
import { digitsOnly, formatPhone } from "./lib/format";
import { buildLeads, parseFile } from "./lib/parse";
import { buildQueue, categoriesOf, isDueCallback, isSnoozed, sessionStats } from "./lib/queue";
import { createSampleCsv } from "./lib/sample";
import type {
  AppSettings,
  Disposition,
  HistoryEntry,
  ImportSummary,
  Lead,
  QueueConfig,
  SessionState,
} from "./lib/types";
import { DEFAULT_QUEUE, DEFAULT_SETTINGS, DISPOSITIONS } from "./lib/types";
import { uid } from "./lib/utils";
import { cn } from "./lib/utils";

type View = "dialer" | "leads" | "dnc";

const EMPTY_STATS = { calls: 0, connects: 0, interested: 0, callbacks: 0, dnc: 0, avgMs: 0 };

export default function App() {
  const { push } = useToast();
  const [ready, setReady] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const leadsRef = useRef<Lead[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [queueConfig, setQueueConfig] = useState<QueueConfig>(DEFAULT_QUEUE);
  const [session, setSessionState] = useState<SessionState | null>(null);
  const sessionRef = useRef<SessionState | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [queueFinished, setQueueFinished] = useState(false);
  const [view, setView] = useState<View>("dialer");
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const exportRef = useRef<HTMLDivElement>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  /* ---------------------------------- Load --------------------------------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedLeads, storedSettings, headers, storedSession] = await Promise.all([
          loadLeads(),
          loadSettings(),
          loadImportHeaders(),
          loadSession(),
        ]);
        if (cancelled) return;
        leadsRef.current = storedLeads;
        setLeads(storedLeads);
        setSettings({ ...DEFAULT_SETTINGS, ...(storedSettings ?? {}) });
        const fullHeaders = mergeHeaderNames(headers, ...storedLeads.map((lead) => Object.keys(lead.raw)));
        setImportHeaders(fullHeaders);
        if (fullHeaders.length !== headers.length) void saveImportHeaders(fullHeaders);
        if (storedSession && storedSession.queue?.length) {
          const ids = new Set(storedLeads.map((lead) => lead.placeId));
          const queue = storedSession.queue.filter((id) => ids.has(id));
          if (queue.length) {
            const restored: SessionState = {
              ...storedSession,
              queue,
              index: Math.min(storedSession.index, queue.length),
              totalPausedMs: storedSession.totalPausedMs ?? 0,
            };
            sessionRef.current = restored;
            setSessionState(restored);
          }
        }
      } catch (error) {
        console.error(error);
        push("Could not open the local database. Private browsing may block IndexedDB.", "error");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
    try {
      localStorage.setItem("lead-dialer-theme", settings.theme);
    } catch {
      /* ignore */
    }
    if (ready) void saveSettings(settings);
  }, [settings, ready]);

  useEffect(() => {
    if (!exportOpen) return;
    const handler = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  /* ------------------------------ Persistence ------------------------------ */

  const persistSession = (next: SessionState | null) => {
    sessionRef.current = next;
    setSessionState(next);
    if (ready) void saveSession(next);
  };

  const replaceLead = (updated: Lead) => {
    const next = leadsRef.current.map((lead) => (lead.placeId === updated.placeId ? updated : lead));
    leadsRef.current = next;
    setLeads(next);
    void putLead(updated).catch(() => push("Could not save this lead locally", "error"));
  };

  const mutateLead = (placeId: string, patch: Partial<Lead> | ((lead: Lead) => Partial<Lead>)) => {
    const current = leadsRef.current.find((lead) => lead.placeId === placeId);
    if (!current) return null;
    const changes = typeof patch === "function" ? patch(current) : patch;
    const updated = { ...current, ...changes };
    replaceLead(updated);
    return updated;
  };

  /* --------------------------------- Queue --------------------------------- */

  const previewQueue = useMemo(() => buildQueue(leads, queueConfig, now), [leads, queueConfig, now]);
  const categories = useMemo(() => categoriesOf(leads), [leads]);
  const leadsMap = useMemo(() => new Map(leads.map((lead) => [lead.placeId, lead])), [leads]);

  const activeQueueIds = session ? session.queue : previewQueue.map((lead) => lead.placeId);
  const defaultId = session
    ? (session.queue[session.index] ?? null)
    : queueFinished
      ? null
      : (previewQueue[0]?.placeId ?? null);
  const effectiveId = currentId ?? defaultId;
  const currentLead = effectiveId ? (leadsMap.get(effectiveId) ?? null) : null;
  const queueIndex = currentLead ? activeQueueIds.indexOf(currentLead.placeId) : -1;
  const position =
    currentLead && queueIndex >= 0 ? { index: queueIndex, total: activeQueueIds.length } : null;
  const completed = !!session && session.index >= session.queue.length;
  const stats = session ? sessionStats(leads, session.startedAt, now) : EMPTY_STATS;
  const dueCallbacks = useMemo(
    () =>
      leads
        .filter((lead) => isDueCallback(lead, now))
        .sort((a, b) => (a.nextCallbackAt ?? "").localeCompare(b.nextCallbackAt ?? "")),
    [leads, now],
  );
  const upcomingCallbacks = useMemo(
    () =>
      leads.filter(
        (lead) =>
          lead.status === "callback" &&
          !!lead.nextCallbackAt &&
          new Date(lead.nextCallbackAt).getTime() > now,
      ).length,
    [leads, now],
  );
  const attemptCount = useMemo(() => leads.reduce((sum, lead) => sum + lead.history.length, 0), [leads]);
  const activeQueue = activeQueueIds
    .map((id) => leadsMap.get(id))
    .filter((lead): lead is Lead => !!lead && lead.status !== "dnc");
  const dncCount = leads.filter((lead) => lead.status === "dnc").length;

  useEffect(() => {
    if (!sessionRef.current) {
      setCurrentId(null);
      setQueueFinished(false);
    }
  }, [queueConfig]);

  /* -------------------------------- Actions -------------------------------- */

  const startSession = () => {
    const queue = buildQueue(leadsRef.current, queueConfig, Date.now());
    if (!queue.length) {
      push("No leads match the current queue filters", "error");
      return;
    }
    const fresh: SessionState = {
      active: true,
      queue: queue.map((lead) => lead.placeId),
      index: 0,
      startedAt: new Date().toISOString(),
      pausedAt: null,
      totalPausedMs: 0,
    };
    persistSession(fresh);
    setCurrentId(queue[0].placeId);
    setQueueFinished(false);
    setView("dialer");
    push(`Session started · ${queue.length} leads in queue`, "success");
  };

  const pauseResume = () => {
    const active = sessionRef.current;
    if (!active) {
      startSession();
      return;
    }
    if (active.index >= active.queue.length) {
      startSession();
      return;
    }
    if (active.active) {
      persistSession({ ...active, active: false, pausedAt: new Date().toISOString() });
    } else {
      const pausedMs = active.pausedAt
        ? Math.max(0, Date.now() - new Date(active.pausedAt).getTime())
        : 0;
      persistSession({
        ...active,
        active: true,
        pausedAt: null,
        totalPausedMs: (active.totalPausedMs ?? 0) + pausedMs,
      });
    }
  };

  const findNextIndex = (ids: string[], startIndex: number): number => {
    const byId = new Map(leadsRef.current.map((lead) => [lead.placeId, lead]));
    for (let i = Math.max(0, startIndex); i < ids.length; i++) {
      const lead = byId.get(ids[i]);
      if (!lead) continue;
      if (lead.status === "dnc") continue;
      if (isSnoozed(lead)) continue;
      return i;
    }
    return -1;
  };

  const advanceFrom = (leadId: string | null, mode: "next" | "back" = "next"): Lead | null => {
    const activeSession = sessionRef.current;
    const ids = activeSession ? activeSession.queue : previewQueue.map((lead) => lead.placeId);
    const from = leadId ? ids.indexOf(leadId) : -1;
    let target = -1;

    if (mode === "back") {
      const start = from >= 0 ? from - 1 : Math.min(ids.length - 1, (activeSession?.index ?? 0) - 1);
      for (let i = start; i >= 0; i--) {
        const lead = leadsMap.get(ids[i]);
        if (lead && lead.status !== "dnc") {
          target = i;
          break;
        }
      }
      if (target < 0) {
        push("You're at the start of the queue", "info");
        return null;
      }
    } else {
      if (!leadId && queueFinished && !activeSession) {
        push("Queue complete — start a new session to call again", "info");
        return null;
      }
      const start = from >= 0 ? from + 1 : activeSession ? activeSession.index : 0;
      target = findNextIndex(ids, start);
    }

    if (target < 0) {
      setCurrentId(null);
      setQueueFinished(true);
      if (activeSession) {
        persistSession({ ...activeSession, index: ids.length, active: false, pausedAt: null });
      } else {
        push("Queue complete", "success");
      }
      return null;
    }

    const nextLead = leadsMap.get(ids[target]) ?? null;
    setCurrentId(nextLead?.placeId ?? null);
    setQueueFinished(false);
    if (activeSession) persistSession({ ...activeSession, index: target });
    return nextLead;
  };

  const skip = () => {
    if (!currentLead) {
      if (queueFinished) {
        push("Queue complete — start a new session", "info");
        return;
      }
      const ids = sessionRef.current?.queue ?? previewQueue.map((lead) => lead.placeId);
      const target = findNextIndex(ids, 0);
      if (target >= 0) {
        setCurrentId(ids[target]);
        setQueueFinished(false);
        const activeSession = sessionRef.current;
        if (activeSession) persistSession({ ...activeSession, index: target });
      }
      return;
    }
    advanceFrom(currentLead.placeId);
  };

  const back = () => advanceFrom(currentLead?.placeId ?? null, "back");

  const dispose = (
    lead: Lead,
    disposition: Disposition,
    opts?: { callbackAt?: string; note?: string },
  ) => {
    const at = new Date().toISOString();
    const entry: HistoryEntry = {
      id: uid(),
      at,
      disposition,
      ...(opts?.note ? { note: opts.note } : {}),
      ...(disposition === "callback" && opts?.callbackAt ? { callbackAt: opts.callbackAt } : {}),
    };
    const updated: Lead = {
      ...lead,
      status: disposition,
      attempts: lead.attempts + 1,
      lastCalledAt: at,
      nextCallbackAt: disposition === "callback" ? (opts?.callbackAt ?? null) : null,
      snoozeUntil: null,
      notes: opts?.note !== undefined ? opts.note : lead.notes,
      history: [...lead.history, entry],
    };
    replaceLead(updated);

    // DNC is a hard exclusion — drop it from the live session snapshot as well.
    if (disposition === "dnc") {
      const activeSession = sessionRef.current;
      if (activeSession) {
        const removedAt = activeSession.queue.indexOf(lead.placeId);
        if (removedAt >= 0) {
          const queue = activeSession.queue.filter((id) => id !== lead.placeId);
          const index = removedAt < activeSession.index ? activeSession.index - 1 : activeSession.index;
          persistSession({ ...activeSession, queue, index });
        }
      }
    }

    push(
      `${DISPOSITIONS[disposition]} · ${lead.title}`,
      disposition === "interested" ? "success" : disposition === "dnc" ? "info" : "info",
    );

    const nextLead = advanceFrom(lead.placeId);
    if (settings.dialerMode && nextLead?.phone) {
      const phone = digitsOnly(nextLead.phone);
      window.setTimeout(() => {
        window.location.href = `tel:${phone}`;
      }, 60);
    }
  };

  const snooze = (lead: Lead) => {
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mutateLead(lead.placeId, { snoozeUntil: until });
    push(`${lead.title} snoozed for 1 hour`, "info");
    if (currentLead?.placeId === lead.placeId) {
      setCurrentId(null);
      advanceFrom(lead.placeId);
    }
  };

  const selectLead = (lead: Lead) => {
    setCurrentId(lead.placeId);
    setQueueFinished(false);
    const activeSession = sessionRef.current;
    if (activeSession) {
      const index = activeSession.queue.indexOf(lead.placeId);
      if (index >= 0) persistSession({ ...activeSession, index });
    }
    setView("dialer");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const restoreDnc = (lead: Lead) => {
    mutateLead(lead.placeId, { status: "new", nextCallbackAt: null, snoozeUntil: null });
    push(`${lead.title} restored from DNC`, "success");
  };

  const saveNotes = (placeId: string, notes: string) => mutateLead(placeId, { notes });

  const updateSettings = (patch: Partial<AppSettings>) => setSettings((prev) => ({ ...prev, ...patch }));

  const toggleNotifications = async (enabled: boolean) => {
    if (!enabled) {
      updateSettings({ notifications: false });
      return;
    }
    if (typeof Notification === "undefined") {
      push("This browser does not support notifications", "error");
      return;
    }
    let permission = Notification.permission;
    if (permission === "default") permission = await Notification.requestPermission();
    if (permission !== "granted") {
      updateSettings({ notifications: false });
      push("Notification permission was not granted", "error");
      return;
    }
    updateSettings({ notifications: true });
    push("Callback notifications enabled", "success");
  };

  useEffect(() => {
    if (!ready || !settings.notifications) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const check = () => {
      leadsRef.current
        .filter((lead) => isDueCallback(lead, Date.now()))
        .forEach((lead) => {
          if (notifiedRef.current.has(lead.placeId)) return;
          notifiedRef.current.add(lead.placeId);
          try {
            new Notification("Callback due", {
              body: `${lead.title} · ${formatPhone(lead.phone)}`,
              tag: `callback-${lead.placeId}`,
            });
          } catch {
            /* notifications can fail in some contexts */
          }
        });
    };
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, [ready, settings.notifications]);

  /* -------------------------------- Import --------------------------------- */

  const handleImported = async (newLeads: Lead[], summary: ImportSummary, headers: string[]) => {
    await putLeads(newLeads);
    const merged = [...leadsRef.current, ...newLeads];
    leadsRef.current = merged;
    setLeads(merged);
    const mergedHeaders = mergeHeaderNames(importHeaders, headers);
    setImportHeaders(mergedHeaders);
    await saveImportHeaders(mergedHeaders);
    push(
      `${summary.imported.toLocaleString()} lead${summary.imported === 1 ? "" : "s"} imported${
        summary.duplicates ? ` · ${summary.duplicates} duplicate${summary.duplicates === 1 ? "" : "s"} skipped` : ""
      }`,
      "success",
    );
  };

  const loadSample = async () => {
    try {
      const file = new File([createSampleCsv()], "sample-google-maps-leads.csv", { type: "text/csv" });
      const table = await parseFile(file);
      const existing = new Set(leadsRef.current.map((lead) => lead.placeId));
      const result = buildLeads(
        table,
        { importNoPhone: true, importClosed: true },
        existing,
        settings.defaultCountry,
      );
      if (!result.leads.length) {
        push("Sample leads are already loaded", "info");
        setImportOpen(false);
        return;
      }
      await handleImported(result.leads, result.summary, table.headers);
      setImportOpen(false);
      setView("dialer");
      push(`Sample data ready · ${result.summary.duplicates} duplicate skipped on import`, "success");
    } catch (error) {
      console.error(error);
      push("Could not load the sample data", "error");
    }
  };

  const clearAllData = async () => {
    try {
      await wipeAll();
      leadsRef.current = [];
      setLeads([]);
      persistSession(null);
      setCurrentId(null);
      setQueueFinished(false);
      setImportHeaders([]);
      setQueueConfig(DEFAULT_QUEUE);
      setSettings((prev) => ({ ...DEFAULT_SETTINGS, theme: prev.theme }));
      setSettingsOpen(false);
      push("All local lead data deleted", "success");
    } catch {
      push("Could not clear local data", "error");
    }
  };

  /* -------------------------------- Export --------------------------------- */

  const exportWorking = () => {
    const currentLeads = leadsRef.current;
    if (!currentLeads.length) {
      push("No leads to export yet", "error");
      return;
    }
    const csv = buildWorkingCsv(currentLeads, importHeaders);
    downloadCsv(`lead-dialer-working-${exportStamp()}.csv`, csv);
    push(`${currentLeads.length.toLocaleString()} leads exported`, "success");
    setExportOpen(false);
  };

  const exportCallLog = () => {
    const currentLeads = leadsRef.current;
    const calls = currentLeads.reduce((sum, lead) => sum + lead.history.length, 0);
    if (!calls) {
      push("No calls logged yet — the call log is empty", "error");
      return;
    }
    downloadCsv(`lead-dialer-call-log-${exportStamp()}.csv`, buildCallLogCsv(currentLeads));
    push(`${calls.toLocaleString()} call attempts exported`, "success");
    setExportOpen(false);
  };

  const callWebhook = (phone: string) => {
    const configured = settings.webhookUrl.trim();
    if (!configured) return;
    const replaced = configured.includes("{phone}")
      ? configured.replaceAll("{phone}", encodeURIComponent(phone))
      : `${configured}${configured.includes("?") ? "&" : "?"}phone=${encodeURIComponent(phone)}`;

    if (settings.webhookMethod === "GET") {
      window.open(replaced, "_blank", "noopener,noreferrer");
      push("Opening cloud phone system…", "info");
      return;
    }
    void fetch(replaced, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: phone, Phone: phone }).toString(),
    })
      .then(() => push(`Click-to-call sent · ${formatPhone(phone)}`, "success"))
      .catch(() => push("Click-to-call request failed", "error"));
  };

  const focusSearch = () => {
    setView("dialer");
    window.setTimeout(() => document.getElementById("queue-search")?.focus(), 60);
  };

  /* ------------------------------- Shortcuts ------------------------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const typing =
        tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable === true;
      const modalOpen = !!document.querySelector('[role="dialog"][aria-modal="true"]');
      if (event.metaKey || event.ctrlKey) {
        if (event.key.toLowerCase() === "k" && !modalOpen) {
          event.preventDefault();
          focusSearch();
        }
        return;
      }
      if (typing) return;
      if (event.key === "/" && !modalOpen) {
        event.preventDefault();
        focusSearch();
      } else if (event.key === "?" && !modalOpen) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const queueConfigChange = (patch: Partial<QueueConfig>) =>
    setQueueConfig((prev) => ({ ...prev, ...patch }));

  const resetQueue = () => {
    setQueueConfig(DEFAULT_QUEUE);
    if (!sessionRef.current) {
      setCurrentId(null);
      setQueueFinished(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-card">
          <PhoneCall className="h-5 w-5 animate-pulse text-primary" />
        </div>
        <div className="text-sm text-muted-foreground">Opening local lead database…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-12 max-w-[1560px] items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <PhoneCall className="h-4 w-4" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tracking-tight">Lead Dialer</span>
              <Badge variant="outline" className="hidden font-mono text-[9px] sm:inline-flex">
                LOCAL
              </Badge>
            </div>
          </div>

          <nav className="hidden items-center gap-0.5 rounded-md border bg-card/60 p-0.5 md:flex">
            <Tab active={view === "dialer"} onClick={() => setView("dialer")} icon={<Phone className="h-3.5 w-3.5" />}>
              Dialer
            </Tab>
            <Tab active={view === "leads"} onClick={() => setView("leads")} icon={<List className="h-3.5 w-3.5" />}>
              Leads <span className="tabular text-muted-foreground">{leads.length}</span>
            </Tab>
            <Tab active={view === "dnc"} onClick={() => setView("dnc")} icon={<Ban className="h-3.5 w-3.5" />}>
              DNC {dncCount > 0 && <span className="tabular text-red-400">{dncCount}</span>}
            </Tab>
          </nav>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="hidden sm:inline-flex">
              <Upload /> Import
            </Button>
            <Button
              variant="outline"
              size="iconSm"
              onClick={() => setImportOpen(true)}
              className="sm:hidden"
              aria-label="Import leads"
            >
              <Upload />
            </Button>
            <div className="relative flex" ref={exportRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={exportWorking}
                aria-label="Export working leads CSV"
                className="rounded-r-none"
              >
                <Download /> <span className="hidden sm:inline">Export</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportOpen((open) => !open)}
                aria-label="More export options"
                className="rounded-l-none border-l-0 px-1.5"
              >
                <ChevronDown className="!h-3.5 !w-3.5" />
              </Button>
              {exportOpen && (
                <div className="absolute right-0 z-40 mt-1 w-60 overflow-hidden rounded-md border bg-popover p-1 shadow-xl">
                  <MenuItem
                    icon={<FileSpreadsheet />}
                    title="Working leads CSV"
                    subtitle="Original columns + status, attempts, notes"
                    onClick={exportWorking}
                  />
                  <MenuItem
                    icon={<Download />}
                    title="Call log CSV"
                    subtitle="One row per attempt"
                    onClick={exportCallLog}
                  />
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => updateSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
              title={settings.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {settings.theme === "dark" ? <Sun /> : <Moon />}
            </Button>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => setShortcutsOpen(true)}
              title="Keyboard shortcuts (?)"
              className="hidden sm:inline-flex"
            >
              <Keyboard />
            </Button>
            <Button variant="ghost" size="iconSm" onClick={() => setSettingsOpen(true)} title="Settings">
              <Settings />
            </Button>
          </div>
        </div>

        <nav className="flex items-center gap-0.5 border-t px-3 py-1.5 md:hidden">
          <Tab active={view === "dialer"} onClick={() => setView("dialer")} icon={<Phone className="h-3.5 w-3.5" />}>
            Dialer
          </Tab>
          <Tab active={view === "leads"} onClick={() => setView("leads")} icon={<List className="h-3.5 w-3.5" />}>
            Leads <span className="tabular text-muted-foreground">{leads.length}</span>
          </Tab>
          <Tab active={view === "dnc"} onClick={() => setView("dnc")} icon={<Ban className="h-3.5 w-3.5" />}>
            DNC {dncCount > 0 && <span className="tabular text-red-400">{dncCount}</span>}
          </Tab>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1560px] flex-1 px-3 py-4 sm:px-5">
        {view === "dialer" && (
          <>
            {leads.length > 0 && (
              <QueueBuilder
                config={queueConfig}
                onChange={queueConfigChange}
                onReset={resetQueue}
                categories={categories}
                matchCount={previewQueue.length}
                totalCount={leads.length}
                sessionActive={!!session}
                onStartSession={startSession}
              />
            )}
            {leads.length > 0 && (
              <SessionBar
                session={session}
                stats={stats}
                queueLength={completed ? 0 : activeQueueIds.length}
                completed={completed}
                onStart={startSession}
                onPauseResume={pauseResume}
                onRestart={startSession}
              />
            )}

            {leads.length > 0 && dueCallbacks.length > 0 && (
              <div className="mt-3 xl:hidden">
                <DueCallbacksCard dueCallbacks={dueCallbacks} onSelect={selectLead} onSnooze={snooze} />
              </div>
            )}

            <div
              className={cn(
                "mt-3 grid gap-3",
                leads.length > 0 && "xl:grid-cols-[minmax(0,1fr)_312px]",
              )}
            >
              <Dialer
                lead={currentLead}
                position={position}
                hasLeads={leads.length > 0}
                queueCount={previewQueue.length}
                activeFilteredCount={previewQueue.length}
                sessionActive={!!session?.active}
                sessionPaused={!!session && !session.active && !completed}
                settings={settings}
                onDispose={dispose}
                onSkip={skip}
                onBack={back}
                onSnooze={snooze}
                onSaveNotes={saveNotes}
                onToggleDialerMode={() => updateSettings({ dialerMode: !settings.dialerMode })}
                onStartSession={startSession}
                onClearFilters={resetQueue}
                onImport={() => setImportOpen(true)}
                onLoadSample={() => void loadSample()}
                onOpenShortcuts={() => setShortcutsOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
                onWebhookCall={callWebhook}
                onFocusSearch={focusSearch}
              />
              {leads.length > 0 && (
                <SideRail
                  dueCallbacks={dueCallbacks}
                  upcomingCallbacks={upcomingCallbacks}
                  queue={activeQueue}
                  currentId={currentLead?.placeId ?? null}
                  completed={completed}
                  onSelect={selectLead}
                  onSnooze={snooze}
                  onOpenAllLeads={() => setView("leads")}
                  onOpenShortcuts={() => setShortcutsOpen(true)}
                />
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                100% local · {leads.length.toLocaleString()} leads · {attemptCount.toLocaleString()} attempts logged
              </span>
              <span className="flex items-center gap-1">
                <Kbd>/</Kbd> search <Kbd>1</Kbd>–<Kbd>6</Kbd> dispositions <Kbd>9</Kbd> DNC <Kbd>?</Kbd> help
              </span>
            </div>
          </>
        )}

        {view === "leads" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <Users className="h-4 w-4 text-primary" /> All leads
                </h1>
                <p className="text-xs text-muted-foreground">
                  Every imported lead, including flagged and DNC records. Click a row to open it in the dialer.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload /> Import
                </Button>
                <Button variant="outline" size="sm" onClick={exportWorking}>
                  <Download /> Export
                </Button>
              </div>
            </div>
            {leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/60 px-6 py-20 text-center">
                <Users className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <div className="text-sm font-medium">No leads yet</div>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Import your Google Maps spreadsheet or load the sample dataset to see the list.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => setImportOpen(true)}>Import leads</Button>
                  <Button variant="outline" onClick={() => void loadSample()}>
                    Load sample data
                  </Button>
                </div>
              </div>
            ) : (
              <ListView leads={leads} onSelect={selectLead} />
            )}
          </div>
        )}

        {view === "dnc" && (
          <DncView leads={leads} onRestore={restoreDnc} onSelect={selectLead} />
        )}
      </main>

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existingIds={new Set(leads.map((lead) => lead.placeId))}
        defaultCountry={settings.defaultCountry}
        onImported={handleImported}
        onLoadSample={() => void loadSample()}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdate={updateSettings}
        onToggleNotifications={(enabled) => void toggleNotifications(enabled)}
        leadCount={leads.length}
        attemptCount={attemptCount}
        onExportWorking={exportWorking}
        onExportCallLog={exportCallLog}
        onOpenImport={() => {
          setSettingsOpen(false);
          setImportOpen(true);
        }}
        onClearAll={() => void clearAllData()}
        onOpenShortcuts={() => {
          setSettingsOpen(false);
          setShortcutsOpen(true);
        }}
      />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors md:flex-none",
        active ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function MenuItem({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2 rounded px-2 py-2 text-left transition-colors hover:bg-accent"
    >
      <span className="mt-0.5 text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      <span>
        <span className="block text-xs font-medium">{title}</span>
        <span className="block text-[10px] text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  );
}
