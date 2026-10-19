import { ArrowDown, ArrowUp, ArrowUpDown, Search, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime, formatPhone } from "../lib/format";
import { flagsFor, statusLabel } from "../lib/queue";
import type { Lead } from "../lib/types";
import { cn } from "../lib/utils";
import { StatusBadge } from "./status";
import { Badge, Input, Kbd, Select } from "./ui";

function flagBadge(flags: ReturnType<typeof flagsFor>): string | null {
  if (flags.dnc) return "DNC";
  if (flags.closed) return "Closed";
  if (flags.noPhone) return "No phone";
  if (flags.area) return "Area";
  return null;
}

type SortKey = "rank" | "title" | "category" | "rating" | "reviews" | "claimed" | "status" | "attempts" | "lastCalled";
type SortDir = "asc" | "desc";

const HEADER_HEIGHT = 38;
const ROW_HEIGHT = 46;

interface ListViewProps {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "queue", label: "Dialable" },
  { value: "new", label: "New" },
  { value: "attempted", label: "Called at least once" },
  { value: "callback", label: "Callback" },
  { value: "interested", label: "Interested" },
  { value: "flagged", label: "Flagged / excluded" },
  { value: "dnc", label: "Do not call" },
];

export function ListView({ leads, onSelect }: ListViewProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(560);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measure = () => setViewportHeight(element.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setScrollTop(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [search, status, sortKey, sortDir]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = leads.filter((lead) => {
      const flags = flagsFor(lead);
      if (status === "new" && lead.status !== "new") return false;
      if (status === "callback" && lead.status !== "callback") return false;
      if (status === "interested" && lead.status !== "interested") return false;
      if (status === "attempted" && lead.attempts === 0) return false;
      if (status === "dnc" && lead.status !== "dnc") return false;
      if (status === "flagged" && !(flags.flagged || flags.dnc)) return false;
      if (status === "queue" && (flags.dnc || flags.flagged)) return false;
      if (query) {
        const haystack = `${lead.title} ${lead.categoryName} ${lead.phone} ${lead.city} ${lead.state} ${lead.postalCode} ${lead.neighborhood} ${formatPhone(lead.phone)}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    const value = (lead: Lead): string | number => {
      switch (sortKey) {
        case "title":
          return lead.title.toLowerCase();
        case "category":
          return (lead.categoryName || "").toLowerCase();
        case "rating":
          return lead.totalScore ?? -1;
        case "reviews":
          return lead.reviewsCount ?? -1;
        case "claimed":
          return lead.claimThisBusiness ? 1 : 0;
        case "status":
          return statusLabel(lead.status).toLowerCase();
        case "attempts":
          return lead.attempts;
        case "lastCalled":
          return lead.lastCalledAt ? new Date(lead.lastCalledAt).getTime() : -1;
        case "rank":
        default:
          return lead.rank ?? Number.MAX_SAFE_INTEGER;
      }
    };

    filtered.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      let result = 0;
      if (typeof va === "string" && typeof vb === "string") result = va.localeCompare(vb);
      else result = Number(va) - Number(vb);
      if (result === 0) result = a.title.localeCompare(b.title);
      return sortDir === "asc" ? result : -result;
    });
    return filtered;
  }, [leads, search, status, sortKey, sortDir]);

  const start = Math.max(0, Math.floor(Math.max(0, scrollTop - HEADER_HEIGHT) / ROW_HEIGHT) - 6);
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + 12;
  const visible = rows.slice(start, start + visibleCount);
  const totalHeight = rows.length * ROW_HEIGHT;

  const sortBy = (key: SortKey) => {
    if (key === sortKey) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "title" || key === "category" || key === "rank" || key === "status" ? "asc" : "desc");
    }
  };

  const sortIcon = (key: SortKey) => {
    if (key !== sortKey) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <H>
            <Users className="h-4 w-4 text-primary" /> Leads
          </H>
          <Badge variant="secondary" className="tabular">
            {rows.length.toLocaleString()} shown
          </Badge>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">{leads.length.toLocaleString()} total</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter all leads…"
              className="w-[210px] pl-8"
            />
          </div>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-[170px]">
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        className="max-h-[calc(100vh-250px)] min-h-[400px] overflow-auto"
      >
        <div className="sticky top-0 z-10 min-w-[1120px] border-b bg-card/95 backdrop-blur">
          <div className="grid-table h-[38px] items-center px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <SortHeader label="Business" active={sortKey === "title"} onClick={() => sortBy("title")} icon={sortIcon("title")} />
            <SortHeader label="Category" active={sortKey === "category"} onClick={() => sortBy("category")} icon={sortIcon("category")} />
            <span>Phone</span>
            <SortHeader label="Rating" active={sortKey === "rating"} onClick={() => sortBy("rating")} icon={sortIcon("rating")} />
            <SortHeader label="Reviews" active={sortKey === "reviews"} onClick={() => sortBy("reviews")} icon={sortIcon("reviews")} />
            <SortHeader label="Claimed" active={sortKey === "claimed"} onClick={() => sortBy("claimed")} icon={sortIcon("claimed")} />
            <SortHeader label="Status" active={sortKey === "status"} onClick={() => sortBy("status")} icon={sortIcon("status")} />
            <SortHeader label="Tries" active={sortKey === "attempts"} onClick={() => sortBy("attempts")} icon={sortIcon("attempts")} />
            <SortHeader label="Last called" active={sortKey === "lastCalled"} onClick={() => sortBy("lastCalled")} icon={sortIcon("lastCalled")} />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <Search className="mb-3 h-6 w-6 text-muted-foreground/50" />
            <div className="text-sm font-medium">No leads match these filters</div>
            <div className="mt-1 text-xs text-muted-foreground">Try a different search or status filter.</div>
          </div>
        ) : (
          <div className="relative min-w-[1120px]" style={{ height: totalHeight }}>
            <div style={{ transform: `translateY(${start * ROW_HEIGHT}px)` }}>
              {visible.map((lead) => {
                const flags = flagsFor(lead);
                return (
                  <div
                    key={lead.placeId}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(lead)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onSelect(lead);
                      }
                    }}
                    style={{ height: ROW_HEIGHT }}
                    className={cn(
                      "grid-table cursor-pointer items-center border-b border-border/50 px-3 text-xs transition-colors hover:bg-accent/50 focus-visible:bg-accent/60 focus-visible:outline-none",
                      flags.dnc && "opacity-60",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-1.5 pr-3">
                      <span className="truncate font-medium text-foreground">{lead.title}</span>
                      {flagBadge(flags) && (
                        <Badge
                          variant={flags.dnc ? "destructive" : "warning"}
                          className="h-4 shrink-0 px-1 py-0 text-[9px]"
                          title={flags.reason ?? "Excluded from queue"}
                        >
                          {flagBadge(flags)}
                        </Badge>
                      )}
                      {lead.notes && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" title="Has notes" />}
                    </div>
                    <div className="truncate pr-3 text-muted-foreground">{lead.categoryName || "—"}</div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {lead.phone ? formatPhone(lead.phone) : <span className="text-amber-500/80">No phone</span>}
                    </div>
                    <div className="flex items-center gap-1 tabular">
                      <span className={cn(lead.totalScore != null ? "text-amber-400" : "text-muted-foreground")}>★</span>
                      {lead.totalScore?.toFixed(1) ?? "—"}
                    </div>
                    <div className="tabular text-muted-foreground">{lead.reviewsCount?.toLocaleString() ?? "—"}</div>
                    <div>
                      <span className={lead.claimThisBusiness ? "text-emerald-500" : "text-amber-500"}>
                        {lead.claimThisBusiness ? "Claimed" : "Unclaimed"}
                      </span>
                    </div>
                    <div>
                      <StatusBadge status={lead.status} />
                    </div>
                    <div className="tabular text-muted-foreground">{lead.attempts || "—"}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {lead.lastCalledAt ? formatDateTime(lead.lastCalledAt) : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-[10px] text-muted-foreground">
        <span>
          Virtualized · {rows.length.toLocaleString()} rows · click a row to open it in the dialer
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          scroll
        </span>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-left uppercase tracking-wider transition-colors hover:text-foreground",
        active && "text-foreground",
      )}
    >
      {label}
      {icon}
    </button>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center gap-1.5 text-sm font-semibold">{children}</span>;
}
