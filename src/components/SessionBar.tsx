import { Clock, Coffee, Pause, Play, RotateCcw, Sparkles, Target, ThumbsUp, Users, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDuration } from "../lib/format";
import type { SessionState } from "../lib/types";
import type { SessionStats } from "../lib/queue";
import { cn } from "../lib/utils";
import { Badge, Button } from "./ui";

interface SessionBarProps {
  session: SessionState | null;
  stats: SessionStats;
  queueLength: number;
  completed: boolean;
  onStart: () => void;
  onPauseResume: () => void;
  onRestart: () => void;
}

function useElapsed(session: SessionState | null, completed: boolean): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!session?.active && !completed) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [session?.active, completed]);
  if (!session) return 0;
  const end =
    session.active || completed
      ? Date.now()
      : new Date(session.pausedAt ?? session.startedAt).getTime();
  return Math.max(0, end - new Date(session.startedAt).getTime() - (session.totalPausedMs ?? 0));
}

export function SessionBar({ session, stats, queueLength, completed, onStart, onPauseResume, onRestart }: SessionBarProps) {
  const elapsed = useElapsed(session, completed);

  if (!session) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-card/60 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Coffee className="h-4 w-4" />
          <span>
            No session running. Build a queue above and hit start — positions and stats are tracked from that moment.
          </span>
        </div>
        <Button size="sm" onClick={onStart} disabled={queueLength === 0}>
          <Play /> Start session
        </Button>
      </div>
    );
  }

  const paused = !session.active && !completed;

  return (
    <div className="mt-3 rounded-lg border bg-card px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={completed ? "success" : paused ? "warning" : "default"} className="px-2 py-0.5">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                completed ? "bg-emerald-400" : paused ? "bg-amber-400" : "animate-pulse bg-emerald-400",
              )}
            />
            {completed ? "Session complete" : paused ? "Paused" : "Session live"}
          </Badge>
          <span className="text-[11px] text-muted-foreground tabular">
            <Clock className="mr-1 inline h-3 w-3" />
            {formatDuration(elapsed)} elapsed · {queueLength} in queue
          </span>
          {completed && (
            <span className="text-[11px] text-muted-foreground">
              <Sparkles className="mr-1 inline h-3 w-3 text-amber-400" /> Queue finished
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!completed && (
            <Button variant={paused ? "default" : "outline"} size="sm" onClick={onPauseResume}>
              {paused ? <Play /> : <Pause />} {paused ? "Resume" : "Pause"}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onRestart} title="Start a fresh session from the current filters">
            <RotateCcw /> New session
          </Button>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-x-2 gap-y-2 border-t pt-2.5 sm:grid-cols-6">
        <Metric icon={Target} label="Calls" value={stats.calls} />
        <Metric icon={Users} label="Connects" value={stats.connects} />
        <Metric icon={ThumbsUp} label="Interested" value={stats.interested} tone="success" />
        <Metric icon={Clock} label="Callbacks" value={stats.callbacks} tone="violet" />
        <Metric icon={XCircle} label="DNC" value={stats.dnc} tone="danger" />
        <Metric
          icon={Clock}
          label="Avg / call"
          value={stats.calls ? formatDuration(elapsed / stats.calls) : "—"}
          mono
        />
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
  mono,
}: {
  icon: typeof Target;
  label: string;
  value: number | string;
  tone?: "success" | "violet" | "danger";
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon
        className={cn(
          "hidden h-3.5 w-3.5 shrink-0 sm:block",
          tone === "success"
            ? "text-emerald-500"
            : tone === "violet"
              ? "text-violet-400"
              : tone === "danger"
                ? "text-red-400"
                : "text-muted-foreground",
        )}
      />
      <div className="min-w-0">
        <div className={cn("text-sm font-semibold leading-none tabular", mono && "text-xs")}>{value}</div>
        <div className="mt-1 truncate text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
