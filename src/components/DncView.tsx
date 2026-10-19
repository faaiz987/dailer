import { Ban, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDateTime, formatPhone } from "../lib/format";
import type { Lead } from "../lib/types";
import { Badge, Button, Dialog, Input } from "./ui";

interface DncViewProps {
  leads: Lead[];
  onRestore: (lead: Lead) => void;
  onSelect: (lead: Lead) => void;
}

export function DncView({ leads, onRestore, onSelect }: DncViewProps) {
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<Lead | null>(null);

  const dnc = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads
      .filter((lead) => lead.status === "dnc")
      .filter((lead) =>
        query
          ? `${lead.title} ${lead.phone} ${lead.city} ${lead.categoryName}`.toLowerCase().includes(query)
          : true,
      )
      .sort((a, b) => {
        const aDate = a.history.filter((h) => h.disposition === "dnc").at(-1)?.at ?? "";
        const bDate = b.history.filter((h) => h.disposition === "dnc").at(-1)?.at ?? "";
        return bDate.localeCompare(aDate);
      });
  }, [leads, search]);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="h-4 w-4 text-red-400" /> Do Not Call list
            <Badge variant="destructive">{dnc.length}</Badge>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Hard-excluded from every queue and session. Kept for compliance and exports.
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search DNC…"
            className="w-[220px] pl-8"
          />
        </div>
      </div>

      {dnc.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border bg-muted/40">
            <Ban className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium">No leads on the DNC list</div>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Log “Do not call” (shortcut 9) on a lead and it will land here, permanently excluded from dialing.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="border-b bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Business</th>
                <th className="px-3 py-2.5 font-semibold">Category</th>
                <th className="px-3 py-2.5 font-semibold">Phone</th>
                <th className="px-3 py-2.5 font-semibold">Attempts</th>
                <th className="px-3 py-2.5 font-semibold">Added to DNC</th>
                <th className="px-3 py-2.5 font-semibold">Note</th>
                <th className="px-4 py-2.5 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dnc.map((lead) => {
                const dncEntry = lead.history.filter((entry) => entry.disposition === "dnc").at(-1);
                return (
                  <tr key={lead.placeId} className="transition-colors hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => onSelect(lead)} className="text-left font-medium hover:text-primary">
                        {lead.title}
                      </button>
                      <div className="text-[10px] text-muted-foreground">
                        {[lead.city, lead.state].filter(Boolean).join(", ")}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{lead.categoryName || "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                      {formatPhone(lead.phone) || "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular text-muted-foreground">{lead.attempts}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatDateTime(dncEntry?.at ?? null)}</td>
                    <td className="max-w-[240px] truncate px-3 py-2.5 text-muted-foreground" title={dncEntry?.note || lead.notes}>
                      {dncEntry?.note || lead.notes || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="xs" onClick={() => setPending(lead)}>
                        <RotateCcw /> Restore
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={!!pending}
        onClose={() => setPending(null)}
        title="Remove from Do Not Call?"
        description="Only do this if the request was logged in error or the lead explicitly re-consented."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pending) onRestore(pending);
                setPending(null);
              }}
            >
              <RotateCcw /> Restore lead
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{pending?.title}</span> will return to the dialable pool with
          status “New”. Its DNC history entry is retained for audit purposes.
        </p>
      </Dialog>
    </div>
  );
}
