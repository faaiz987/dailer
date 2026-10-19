import { ArrowLeft, ArrowRight, Keyboard, Search } from "lucide-react";
import { Dialog, Kbd } from "./ui";

const DISPOSITIONS = [
  ["1", "No answer"],
  ["2", "Left voicemail"],
  ["3", "Callback scheduled"],
  ["4", "Interested"],
  ["5", "Not interested"],
  ["6", "Wrong number"],
  ["9", "Do not call"],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Built for calling without leaving the keyboard. Shortcuts pause while you type in a field."
      size="md"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Keyboard className="h-3.5 w-3.5" /> Navigation
          </h3>
          <div className="space-y-1.5">
            <Row keys={["Space"]} label="Skip to next lead" alt={<ArrowRight className="h-3 w-3" />} />
            <Row keys={["→"]} label="Next lead" />
            <Row keys={["←"]} label="Previous lead" alt={<ArrowLeft className="h-3 w-3" />} />
            <Row keys={["/"]} label="Focus queue search" alt={<Search className="h-3 w-3" />} />
            <Row keys={["?"]} label="This cheatsheet" />
            <Row keys={["Esc"]} label="Close dialog" />
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Log a disposition
          </h3>
          <div className="space-y-1.5">
            {DISPOSITIONS.map(([key, label]) => (
              <Row key={key} keys={[key]} label={label} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 rounded-md border bg-muted/30 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Dispositions stamp the time, increment attempts, save the outcome to the lead's history and advance the queue.
        Scheduling a callback with <Kbd>3</Kbd> opens a date picker; <Kbd>9</Kbd> asks for confirmation before the lead
        is permanently excluded.
      </div>
    </Dialog>
  );
}

function Row({ keys, label, alt }: { keys: string[]; label: string; alt?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded px-1 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
        {alt}
      </span>
    </div>
  );
}
