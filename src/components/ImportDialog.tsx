import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EXPECTED_COLUMNS } from "../lib/columns";
import { buildLeads, parseFile, type ParsedTable } from "../lib/parse";
import type { ImportOptions, ImportSummary, Lead } from "../lib/types";
import { cn } from "../lib/utils";
import { Badge, Button, Dialog, Switch } from "./ui";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  existingIds: Set<string>;
  defaultCountry: string;
  onImported: (leads: Lead[], summary: ImportSummary, headers: string[]) => void;
  onLoadSample: () => void;
}

export function ImportDialog({
  open,
  onClose,
  existingIds,
  defaultCountry,
  onImported,
  onLoadSample,
}: ImportDialogProps) {
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [options, setOptions] = useState<ImportOptions>({ importNoPhone: false, importClosed: false });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTable(null);
    setSummary(null);
    setError(null);
    setOptions({ importNoPhone: false, importClosed: false });
  }, [open]);

  const preview = useMemo(() => {
    if (!table) return null;
    return buildLeads(table, options, existingIds, defaultCountry);
  }, [table, options, existingIds, defaultCountry]);

  const reset = () => {
    setTable(null);
    setSummary(null);
    setError(null);
    setParsing(false);
    setImporting(false);
    setOptions({ importNoPhone: false, importClosed: false });
  };

  const close = () => {
    onClose();
    setTimeout(reset, 200);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSummary(null);
    setParsing(true);
    try {
      const parsed = await parseFile(file);
      if (!parsed.rows.length) {
        setError("No data rows found below the header row.");
        setTable(null);
      } else {
        setTable(parsed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that file.");
      setTable(null);
    } finally {
      setParsing(false);
    }
  };

  const commit = async () => {
    if (!table || !preview) return;
    setImporting(true);
    try {
      // Rebuild against the latest ids to avoid double imports on rapid clicks.
      const result = buildLeads(table, options, existingIds, defaultCountry);
      await onImported(result.leads, result.summary, table.headers);
      setSummary(result.summary);
      setTable(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Import leads"
      description="Google Maps CSV or Excel export. Files are parsed locally in your browser."
      size="xl"
      footer={
        summary ? (
          <Button onClick={close}>Done</Button>
        ) : table ? (
          <>
            <Button variant="ghost" onClick={reset} disabled={importing}>
              <ChevronLeft /> Choose another file
            </Button>
            <Button onClick={commit} disabled={importing || !preview?.leads.length}>
              {importing ? <Loader2 className="animate-spin" /> : <UploadCloud />}
              {importing
                ? "Importing…"
                : `Import ${preview?.leads.length ?? 0} ${preview?.leads.length === 1 ? "lead" : "leads"}`}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="outline" onClick={onLoadSample}>
              Load sample data
            </Button>
          </>
        )
      }
    >
      {summary ? (
        <ImportReceipt summary={summary} />
      ) : table && preview ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate text-sm font-medium">{table.fileName}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <Badge variant="secondary" className="tabular">
                {table.rows.length.toLocaleString()} rows
              </Badge>
              <Badge variant={table.matchedHeaders.length === EXPECTED_COLUMNS.length ? "success" : "warning"}>
                {table.matchedHeaders.length}/{EXPECTED_COLUMNS.length} columns mapped
              </Badge>
              {!table.headers.some((h) => h.trim().toLowerCase() === "placeid") && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3" /> placeId missing
                </Badge>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <OptionToggle
              checked={options.importNoPhone}
              onChange={(v) => setOptions((prev) => ({ ...prev, importNoPhone: v }))}
              title="Import leads without a phone"
              description="Kept in the list view and flagged, but excluded from the dial queue."
            />
            <OptionToggle
              checked={options.importClosed}
              onChange={(v) => setOptions((prev) => ({ ...prev, importClosed: v }))}
              title="Import permanently closed leads"
              description="Flagged and excluded from dialing. Useful for a complete archive."
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Will import" value={preview.summary.imported} tone="success" />
            <Stat label="Duplicates" value={preview.summary.duplicates} tone="muted" />
            <Stat label="No phone (skipped)" value={preview.summary.noPhone} tone="warning" />
            <Stat label="Permanently closed" value={preview.summary.permanentlyClosed} tone="muted" />
          </div>

          <details className="group rounded-md border">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              <span>Column mapping ({table.matchedHeaders.length} matched, case-insensitive)</span>
              <span className="text-[11px] group-open:hidden">Show</span>
              <span className="hidden text-[11px] group-open:inline">Hide</span>
            </summary>
            <div className="max-h-64 overflow-y-auto border-t p-3">
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {EXPECTED_COLUMNS.map((column) => {
                  const matched = table.matchedHeaders.includes(column);
                  return (
                    <div
                      key={column}
                      className={cn(
                        "flex items-center gap-1.5 truncate rounded px-1.5 py-1 font-mono text-[10.5px]",
                        matched ? "text-foreground" : "text-muted-foreground/60",
                      )}
                      title={column}
                    >
                      {matched ? (
                        <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                      ) : (
                        <X className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                      )}
                      <span className="truncate">{column}</span>
                    </div>
                  );
                })}
              </div>
              {table.extraHeaders.length > 0 && (
                <div className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{table.extraHeaders.length} extra column(s)</span> will
                  be preserved in exports: {table.extraHeaders.slice(0, 8).join(", ")}
                  {table.extraHeaders.length > 8 ? "…" : ""}
                </div>
              )}
            </div>
          </details>

          <div className="rounded-md border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
            Every column is read as text. Scientific notation such as <code className="text-foreground">4.09416862714352e+18</code>{" "}
            is preserved (and expanded) for id columns — never parsed as a number. Phone numbers are normalized to E.164
            using <span className="text-foreground">{defaultCountry}</span> as the default country.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void handleFile(event.dataTransfer.files[0]);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              dragging ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:border-primary/50",
              parsing && "pointer-events-none opacity-60",
            )}
          >
            {parsing ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
            )}
            <div className="mt-3 text-sm font-medium">
              {parsing ? "Reading file…" : dragging ? "Drop to import" : "Drop your CSV or Excel file here"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">or click to browse · .csv, .xlsx, .xls</div>
            <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/70">
              <span className="h-1 w-1 rounded-full bg-emerald-500" /> Parsed locally · never uploaded
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="text-xs font-medium">Expected columns</div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Headers are matched exactly, case-insensitively. The scraper columns for business identity, phone, hours,
              reviews, claimed status and rank are all recognized. <span className="text-foreground">placeId</span> is
              the unique key; duplicate rows are skipped automatically.
            </p>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function OptionToggle({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-background/40 p-3">
      <div>
        <div className="text-xs font-medium">{title}</div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} label={title} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "muted" }) {
  return (
    <div className="rounded-md border bg-background/40 px-3 py-2">
      <div
        className={cn(
          "text-lg font-semibold tabular",
          tone === "success" ? "text-emerald-500" : tone === "warning" ? "text-amber-500" : "text-foreground",
        )}
      >
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function ImportReceipt({ summary }: { summary: ImportSummary }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        <div>
          <div className="text-sm font-medium">
            {summary.imported.toLocaleString()} lead{summary.imported === 1 ? "" : "s"} imported
          </div>
          <div className="text-[11px] text-muted-foreground">{summary.fileName}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Total rows" value={summary.totalRows} tone="muted" />
        <Stat label="Imported" value={summary.imported} tone="success" />
        <Stat label="Duplicates skipped" value={summary.duplicates} tone="muted" />
        <Stat label="No phone skipped" value={summary.noPhone} tone="warning" />
        <Stat label="Closed skipped" value={summary.permanentlyClosed} tone="muted" />
        <Stat label="Columns mapped" value={summary.headersMatched} tone="muted" />
      </div>
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        Flagged and excluded from the dial queue unless you toggle “Include flagged”:
        <span className="text-foreground"> {summary.temporarilyClosed} temporarily closed</span>,
        <span className="text-foreground"> {summary.emptyCategory} area / uncategorized</span>.
        {summary.missingPlaceId > 0 && (
          <>
            {" "}
            {summary.missingPlaceId} row(s) had no placeId and were keyed by cid or a content hash.
          </>
        )}
      </div>
    </div>
  );
}
