import { AlarmClock, ArrowRight, CalendarClock, ChevronRight, Clock, Keyboard, PhoneCall } from "lucide-react";
import { formatDateTime, formatPhone } from "../lib/format";
import type { Lead } from "../lib/types";
import { cn } from "../lib/utils";
import { Badge, Button, Card, Kbd } from "./ui";

interface SideRailProps {
  dueCallbacks: Lead[];
  upcomingCallbacks: number;
  queue: Lead[];
  currentId: string | null;
  completed: boolean;
  onSelect: (lead: Lead) => void;
  onSnooze: (lead: Lead) => void;
  onOpenAllLeads: () => void;
  onOpenShortcuts: () => void;
}

export function SideRail({
  dueCallbacks,
  upcomingCallbacks,
  queue,
  currentId,
  completed,
  onSelect,
  onSnooze,
  onOpenAllLeads,
  onOpenShortcuts,
}: SideRailProps) {
  const currentIndex = currentId ? queue.findIndex((lead) => lead.placeId === currentId) : -1;
  const upNext = completed
    ? []
    : queue.slice(Math.max(0, currentIndex + 1), Math.max(0, currentIndex + 1) + 7);

  return (
    <aside className="space-y-3 xl:sticky xl:top-[72px] xl:self-start">
      <DueCallbacksCard
        dueCallbacks={dueCallbacks}
        onSelect={onSelect}
        onSnooze={onSnooze}
        className="hidden xl:block"
      />

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Up next
          </div>
          <span className="text-[10px] tabular text-muted-foreground">
            {completed ? 0 : queue.length} in queue
          </span>
        </div>
        {upNext.length ? (
          <div className="divide-y">
            {upNext.map((lead, index) => (
              <button
                key={lead.placeId}
                type="button"
                onClick={() => onSelect(lead)}
                className="group flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-accent/60"
              >
                <span className="w-4 shrink-0 text-right text-[10px] tabular text-muted-foreground">
                  {(currentIndex >= 0 ? currentIndex + 2 : 0) + index}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium group-hover:text-primary">{lead.title}</span>
                  <span className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                    {lead.totalScore ? `${lead.totalScore.toFixed(1)}★` : "—"}
                    <span className="text-border">·</span>
                    {lead.categoryName || "Uncategorized"}
                  </span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-foreground" />
              </button>
            ))}
          </div>
        ) : (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            {completed
              ? "Queue complete — start a new session."
              : queue.length
                ? "You're at the end of this queue."
                : "No leads in the active queue."}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
          <span className="text-[10px] text-muted-foreground">
            {upcomingCallbacks > 0
              ? `${upcomingCallbacks} upcoming callback${upcomingCallbacks === 1 ? "" : "s"}`
              : "No upcoming callbacks"}
          </span>
          <Button variant="ghost" size="xs" onClick={onOpenAllLeads} className="text-muted-foreground">
            All leads <ArrowRight />
          </Button>
        </div>
      </Card>

      <Card className="hidden px-3 py-2.5 xl:block">
        <button
          type="button"
          onClick={onOpenShortcuts}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Keyboard className="h-3.5 w-3.5" /> Keyboard-first
          </span>
          <span className="flex items-center gap-1">
            <Kbd>1</Kbd>
            <Kbd>4</Kbd>
            <Kbd>9</Kbd>
            <Kbd>?</Kbd>
          </span>
        </button>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
          <CalendarClock className="h-3 w-3" />
          Callback leads resurface automatically in this rail.
        </div>
      </Card>
    </aside>
  );
}

export function DueCallbacksCard({
  dueCallbacks,
  onSelect,
  onSnooze,
  className,
}: {
  dueCallbacks: Lead[];
  onSelect: (lead: Lead) => void;
  onSnooze: (lead: Lead) => void;
  className?: string;
}) {
  if (!dueCallbacks.length) return null;
  return (
    <Card className={cn("overflow-hidden border-violet-500/30", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-violet-500/20 bg-violet-500/10 px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-violet-300">
          <AlarmClock className="h-3.5 w-3.5" />
          Due callbacks
        </div>
        <Badge variant="violet">{dueCallbacks.length}</Badge>
      </div>
      <div className="max-h-64 divide-y overflow-y-auto">
        {dueCallbacks.map((lead) => (
          <div key={lead.placeId} className="px-3 py-2">
            <button type="button" onClick={() => onSelect(lead)} className="group w-full text-left">
              <div className="truncate text-xs font-medium group-hover:text-primary">{lead.title}</div>
              <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="truncate">{formatPhone(lead.phone) || "No phone"}</span>
                <span className="shrink-0 text-violet-400">{formatDateTime(lead.nextCallbackAt)}</span>
              </div>
            </button>
            <div className="mt-1.5 flex items-center gap-1">
              <Button variant="outline" size="xs" onClick={() => onSelect(lead)}>
                <PhoneCall /> Call now
              </Button>
              <Button variant="ghost" size="xs" onClick={() => onSnooze(lead)} className="text-muted-foreground">
                Snooze 1h
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
