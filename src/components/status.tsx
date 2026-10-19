import { Badge } from "./ui";
import { statusLabel } from "../lib/queue";
import type { LeadStatus } from "../lib/types";

const VARIANTS: Record<
  LeadStatus,
  "secondary" | "warning" | "violet" | "success" | "outline" | "destructive" | "blue"
> = {
  new: "secondary",
  no_answer: "outline",
  voicemail: "blue",
  callback: "violet",
  interested: "success",
  not_interested: "warning",
  wrong_number: "outline",
  dnc: "destructive",
};

export function StatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <Badge variant={VARIANTS[status]} className={className}>
      {statusLabel(status)}
    </Badge>
  );
}

export function ClaimedBadge({ claimed }: { claimed: boolean }) {
  return claimed ? (
    <Badge variant="success">Claimed</Badge>
  ) : (
    <Badge variant="warning">Unclaimed</Badge>
  );
}
