import { ClipboardPaste, Copy, Delete, Phone, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buildCallTarget, describeCallTarget } from "../lib/call";
import { formatPhone, normalizePhone, telHref } from "../lib/format";
import type { AppSettings, Lead } from "../lib/types";
import { cn } from "../lib/utils";
import { Button, Dialog, Input, Kbd, buttonVariants, useToast } from "./ui";

const KEYS: Array<{ digit: string; letters: string }> = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "*", letters: "" },
  { digit: "0", letters: "+" },
  { digit: "#", letters: "" },
];

const MAX_LENGTH = 24;

function sanitize(raw: string): string {
  return raw.replace(/[^\d+*#().\-\s]/g, "").slice(0, MAX_LENGTH);
}

export function Dialpad({
  open,
  onClose,
  initialNumber,
  settings,
  lead,
  onWebhookCall,
}: {
  open: boolean;
  onClose: () => void;
  initialNumber?: string;
  settings: AppSettings;
  lead?: Lead | null;
  onWebhookCall: (phone: string) => void;
}) {
  const { push } = useToast();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(sanitize(initialNumber ?? ""));
  }, [open, initialNumber]);

  const digits = value.replace(/\D/g, "");
  const isDialableNumber = /^[\d+()\-.\s]+$/.test(value.trim()) && digits.length >= 7;
  const e164 = isDialableNumber ? normalizePhone(value, "", settings.defaultCountry) : "";
  const dialTarget = e164 || value.trim();
  const formatted = e164 ? formatPhone(e164) : value;
  const canCall = digits.length > 0;
  const callTarget = buildCallTarget(canCall ? dialTarget : "", settings);

  const append = (chunk: string) => {
    setValue((prev) => sanitize(prev + chunk));
  };

  const backspace = () => setValue((prev) => prev.slice(0, -1));

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        push("Clipboard is empty", "info");
        return;
      }
      setValue(sanitize(text));
    } catch {
      push("Clipboard blocked — paste into the number field instead", "error");
      inputRef.current?.focus();
    }
  };

  const copy = async () => {
    if (!canCall) return;
    try {
      await navigator.clipboard.writeText(e164 || value.trim());
      push("Number copied", "success");
    } catch {
      push("Could not copy — select the number and copy manually", "error");
    }
  };

  const announce = () => {
    if (!canCall) {
      push("Type or tap a number first", "error");
      return;
    }
    push(`Opening ${callTarget.label} · ${formatted}`, "info");
    window.setTimeout(onClose, 280);
  };

  const dial = () => {
    if (!canCall) {
      push("Type or tap a number first", "error");
      return;
    }
    announce();
    if (callTarget.copyNumber) void copy();
    if (callTarget.newTab) {
      const win = window.open(callTarget.href, "_blank", "noopener,noreferrer");
      if (!win) push("Pop-up blocked — allow pop-ups for this site", "error");
      return;
    }
    window.location.href = callTarget.href;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Dialpad"
      description={`Manual dialing for numbers that aren't in your list. Calls open in ${callTarget.label} — nothing is uploaded.`}
      size="sm"
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-primary/25 bg-primary/[0.06] px-3 pb-2 pt-1.5">
          <Input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(sanitize(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                dial();
              }
            }}
            inputMode="tel"
            autoComplete="off"
            spellCheck={false}
            placeholder="(512) 280-1680"
            aria-label="Phone number"
            data-dialog-autofocus
            className="h-12 border-0 bg-transparent px-0 text-center text-[clamp(1.25rem,6vw,1.65rem)] font-semibold tracking-wide shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
          />
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="truncate font-mono">{e164 || "E.164 preview"}</span>
            <span className="shrink-0 tabular">
              {digits.length} digit{digits.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="xs" onClick={() => append("+")} title="Add a country code prefix">
            +
          </Button>
          <Button variant="outline" size="xs" onClick={() => void paste()} title="Paste a number from the clipboard">
            <ClipboardPaste /> Paste
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="iconSm" onClick={backspace} aria-label="Backspace" title="Backspace">
              <Delete />
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setValue("")} disabled={!value}>
              Clear
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {KEYS.map(({ digit, letters }) => (
            <button
              key={digit}
              type="button"
              onClick={() => append(digit)}
              aria-label={letters ? `${digit} (${letters})` : digit}
              className="flex h-12 flex-col items-center justify-center rounded-md border bg-background/50 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.98] sm:h-[52px]"
            >
              <span className="text-lg font-medium leading-none">{digit}</span>
              <span className="mt-0.5 h-2.5 text-[9px] tracking-[0.18em] text-muted-foreground">{letters}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {canCall ? (
            <a
              href={callTarget.href}
              target={callTarget.newTab ? "_blank" : undefined}
              rel={callTarget.newTab ? "noreferrer" : undefined}
              onClick={() => {
                if (callTarget.copyNumber) void copy();
                announce();
              }}
              className={cn(buttonVariants({ size: "lg" }), "h-12 flex-1 text-base")}
              title={describeCallTarget(callTarget)}
              data-testid="dialpad-call-button"
            >
              <Phone />
              Call {formatted}
            </a>
          ) : (
            <Button size="lg" className="h-12 flex-1 text-base" disabled>
              <Phone />
              Call
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12"
            onClick={() => void copy()}
            disabled={!canCall}
            aria-label="Copy number"
            title="Copy number"
          >
            <Copy />
          </Button>
        </div>

        {settings.callMethod !== "tel" && (
          <button
            type="button"
            disabled={!canCall}
            onClick={() => {
              if (!canCall) return;
              window.location.href = telHref(e164 || dialTarget);
              onClose();
            }}
            className="w-full text-center text-[11px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground disabled:opacity-50"
          >
            {callTarget.label} not working? Use the phone app instead
          </button>
        )}

        {settings.webhookUrl && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={!canCall}
            onClick={() => {
              if (!canCall) return;
              onWebhookCall(e164 || dialTarget);
              onClose();
            }}
            title="Send this number to your cloud phone system"
          >
            <Zap /> Send to cloud phone system
          </Button>
        )}

        {lead?.phone && lead.phone !== (e164 || value) && (
          <button
            type="button"
            onClick={() => setValue(sanitize(lead.phone))}
            className="flex w-full items-center justify-between gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <span className="truncate">Use this lead's number · {lead.title}</span>
            <span className="shrink-0 font-mono">{formatPhone(lead.phone)}</span>
          </button>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {settings.callMethod === "tel" ? (
            <>
              <Kbd>tel:</Kbd> links open your default softphone (Dialpad, Aircall, Google Voice, FaceTime) or your cell.
              Enter dials, <Kbd>Esc</Kbd> closes. If nothing happens on your phone, switch “Where calls open” in Settings
              to a browser dialer.
            </>
          ) : (
            <>
              Calls open in <span className="text-foreground">{callTarget.label}</span> — change that under “Where calls
              open” in Settings. Enter dials, <Kbd>Esc</Kbd> closes.
            </>
          )}
        </p>
      </div>
    </Dialog>
  );
}
