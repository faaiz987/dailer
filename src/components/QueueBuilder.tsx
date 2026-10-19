import { ChevronDown, Dices, Play, Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { DEFAULT_QUEUE, type QueueConfig } from "../lib/types";
import { cn } from "../lib/utils";
import { Badge, Button, Input, Kbd, Label, Select, Switch } from "./ui";

interface QueueBuilderProps {
  config: QueueConfig;
  onChange: (patch: Partial<QueueConfig>) => void;
  onReset: () => void;
  categories: string[];
  matchCount: number;
  totalCount: number;
  sessionActive: boolean;
  onStartSession: () => void;
}

export function QueueBuilder({
  config,
  onChange,
  onReset,
  categories,
  matchCount,
  totalCount,
  sessionActive,
  onStartSession,
}: QueueBuilderProps) {
  const [open, setOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 768);

  const activeFilters = [
    config.category !== "all",
    config.minRating !== "",
    config.maxRating !== "",
    config.minReviews !== "",
    config.maxReviews !== "",
    config.claimed !== "any",
    config.location !== "",
    config.search !== "",
    config.includeFlagged,
    config.includeSnoozed,
  ].filter(Boolean).length;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Queue builder
          {activeFilters > 0 && <Badge variant="default">{activeFilters} filters</Badge>}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
        </button>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="tabular">
            <span className="font-medium text-foreground">{matchCount.toLocaleString()}</span> of {totalCount.toLocaleString()} leads match
          </span>
          {activeFilters > 0 && (
            <Button variant="ghost" size="xs" onClick={onReset} className="text-muted-foreground">
              <X /> Clear
            </Button>
          )}
          <Button size="sm" onClick={onStartSession} disabled={matchCount === 0}>
            <Play /> {sessionActive ? "Rebuild queue" : "Start session"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="grid gap-x-3 gap-y-2.5 border-t px-3 py-3 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Label htmlFor="queue-search">
              Search <Kbd className="ml-1">/</Kbd>
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="queue-search"
                value={config.search}
                onChange={(event) => onChange({ search: event.target.value })}
                placeholder="Business name, phone, city…"
                className="pl-8"
              />
            </div>
          </div>
          <div className="lg:col-span-2">
            <Label>Category</Label>
            <Select value={config.category} onChange={(event) => onChange({ category: event.target.value })}>
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:col-span-2">
            <div>
              <Label>Min rating</Label>
              <Input
                type="number"
                min={0}
                max={5}
                step={0.1}
                placeholder="0"
                value={config.minRating}
                onChange={(event) => onChange({ minRating: event.target.value })}
              />
            </div>
            <div>
              <Label>Max rating</Label>
              <Input
                type="number"
                min={0}
                max={5}
                step={0.1}
                placeholder="5"
                value={config.maxRating}
                onChange={(event) => onChange({ maxRating: event.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:col-span-2">
            <div>
              <Label>Min reviews</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={config.minReviews}
                onChange={(event) => onChange({ minReviews: event.target.value })}
              />
            </div>
            <div>
              <Label>Max reviews</Label>
              <Input
                type="number"
                min={0}
                placeholder="∞"
                value={config.maxReviews}
                onChange={(event) => onChange({ maxReviews: event.target.value })}
              />
            </div>
          </div>
          <div className="lg:col-span-2">
            <Label>Claimed</Label>
            <Select
              value={config.claimed}
              onChange={(event) => onChange({ claimed: event.target.value as QueueConfig["claimed"] })}
            >
              <option value="any">Any</option>
              <option value="claimed">Claimed</option>
              <option value="unclaimed">Unclaimed</option>
            </Select>
          </div>
          <div className="lg:col-span-3">
            <Label>Neighborhood / ZIP</Label>
            <Input
              value={config.location}
              onChange={(event) => onChange({ location: event.target.value })}
              placeholder="South Lamar, 78704…"
            />
          </div>
          <div className="lg:col-span-2">
            <Label>Order by</Label>
            <div className="flex gap-1.5">
              <Select
                value={config.sort}
                onChange={(event) => {
                  const sort = event.target.value as QueueConfig["sort"];
                  onChange({ sort, ...(sort === "random" ? { randomSeed: Date.now() % 1000000 } : {}) });
                }}
              >
                <option value="rank">Spreadsheet rank</option>
                <option value="rating">Rating (high → low)</option>
                <option value="reviews">Review count</option>
                <option value="random">Random</option>
              </Select>
              {config.sort === "random" && (
                <Button
                  variant="outline"
                  size="icon"
                  title="Reshuffle"
                  onClick={() => onChange({ randomSeed: Date.now() % 1000000 })}
                >
                  <Dices />
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-x-5 gap-y-2 pb-0.5 sm:col-span-2 lg:col-span-7">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={config.includeFlagged}
                onCheckedChange={(includeFlagged) => onChange({ includeFlagged })}
                label="Include flagged leads"
              />
              Include flagged (closed, area, no phone)
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={config.includeSnoozed}
                onCheckedChange={(includeSnoozed) => onChange({ includeSnoozed })}
                label="Include snoozed leads"
              />
              Include snoozed
            </label>
            <span className="hidden text-[10px] text-muted-foreground/60 xl:inline">
              DNC is always excluded · defaults: {DEFAULT_QUEUE.sort}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
