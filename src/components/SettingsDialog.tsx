import {
  AlertTriangle,
  Bell,
  Database,
  Download,
  FileSpreadsheet,
  Keyboard,
  PhoneCall,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { CALL_METHOD_OPTIONS } from "../lib/call";
import type { AppSettings } from "../lib/types";
import { Badge, Button, Dialog, Input, Label, Select, Switch } from "./ui";

const COUNTRIES = [
  ["US", "United States (+1)"],
  ["CA", "Canada (+1)"],
  ["GB", "United Kingdom (+44)"],
  ["AU", "Australia (+61)"],
  ["NZ", "New Zealand (+64)"],
  ["IE", "Ireland (+353)"],
  ["DE", "Germany (+49)"],
  ["FR", "France (+33)"],
  ["ES", "Spain (+34)"],
  ["IT", "Italy (+39)"],
  ["NL", "Netherlands (+31)"],
  ["SE", "Sweden (+46)"],
  ["MX", "Mexico (+52)"],
  ["BR", "Brazil (+55)"],
  ["IN", "India (+91)"],
  ["JP", "Japan (+81)"],
  ["SG", "Singapore (+65)"],
  ["ZA", "South Africa (+27)"],
  ["AE", "United Arab Emirates (+971)"],
] as const;

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
  onToggleNotifications: (enabled: boolean) => void;
  leadCount: number;
  attemptCount: number;
  onExportWorking: () => void;
  onExportCallLog: () => void;
  onOpenImport: () => void;
  onClearAll: () => void;
  onOpenShortcuts: () => void;
}

export function SettingsDialog({
  open,
  onClose,
  settings,
  onUpdate,
  onToggleNotifications,
  leadCount,
  attemptCount,
  onExportWorking,
  onExportCallLog,
  onOpenImport,
  onClearAll,
  onOpenShortcuts,
}: SettingsDialogProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [permission, setPermission] = useState<string>("default");

  useEffect(() => {
    if (!open) {
      setConfirmClear(false);
      return;
    }
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Settings"
      description="Local preferences. Saved on this device only."
      size="lg"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="space-y-6">
        <Section icon={PhoneCall} title="Calling">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Default country for phone numbers</Label>
              <Select value={settings.defaultCountry} onChange={(event) => onUpdate({ defaultCountry: event.target.value })}>
                {COUNTRIES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Theme</Label>
              <Select
                value={settings.theme}
                onChange={(event) => onUpdate({ theme: event.target.value as AppSettings["theme"] })}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Where calls open</Label>
            <Select
              value={settings.callMethod}
              onChange={(event) => onUpdate({ callMethod: event.target.value as AppSettings["callMethod"] })}
            >
              {CALL_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {CALL_METHOD_OPTIONS.find((option) => option.value === settings.callMethod)?.hint}
            </p>
          </div>
          {settings.callMethod === "custom" && (
            <div>
              <Label>Custom dialer URL</Label>
              <Input
                value={settings.callUrlTemplate}
                onChange={(event) => onUpdate({ callUrlTemplate: event.target.value })}
                placeholder="https://your-dialer.example/call?number={phone}"
                spellCheck={false}
                inputMode="url"
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">{"{phone}"}</code> is replaced with the
                E.164 number (e.g. <span className="font-mono">%2B15122801680</span>) and opened in a new tab. Without
                the placeholder the number is appended as <span className="font-mono">?phone=</span>. Leave empty to keep
                using your phone app.
              </p>
            </div>
          )}
          <ToggleRow
            title="Dialer mode"
            description={
              settings.callMethod === "tel"
                ? "Automatically open the tel: link for the next lead after every disposition. Your softphone must be the default handler."
                : "Automatically open the chosen call destination for the next lead after every disposition."
            }
            checked={settings.dialerMode}
            onChange={(dialerMode) => onUpdate({ dialerMode })}
          />
          <ToggleRow
            title="Callback notifications"
            description={
              permission === "denied"
                ? "Browser notifications are blocked for this site. Enable them in your browser settings."
                : "Show a browser notification when a scheduled callback becomes due."
            }
            checked={settings.notifications}
            onChange={onToggleNotifications}
          />
          {permission === "denied" && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-500">
              <Bell className="h-3 w-3" /> Notification permission denied.
            </div>
          )}
        </Section>

        <Section icon={Zap} title="Cloud phone click-to-call (optional)">
          <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
            Add a webhook URL from Twilio, Aircall, or your dialer. Use{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-foreground">{"{phone}"}</code> where the E.164 number
            should go. POST requests send a form body with <code className="text-foreground">To</code> and{" "}
            <code className="text-foreground">Phone</code>. Nothing is sent until you press Click-to-call.
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_110px]">
            <div>
              <Label>Webhook URL</Label>
              <Input
                value={settings.webhookUrl}
                onChange={(event) => onUpdate({ webhookUrl: event.target.value })}
                placeholder="https://api.example.com/calls?to={phone}"
                spellCheck={false}
              />
            </div>
            <div>
              <Label>Method</Label>
              <Select
                value={settings.webhookMethod}
                onChange={(event) => onUpdate({ webhookMethod: event.target.value as AppSettings["webhookMethod"] })}
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </Select>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {settings.webhookUrl.includes("{phone}") ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Placeholder detected — Click-to-call button
                is active in the dialer.
              </>
            ) : settings.webhookUrl ? (
              <>
                <AlertTriangle className="h-3 w-3 text-amber-500" /> Add{" "}
                <code className="text-foreground">{"{phone}"}</code> to the URL, or it will be appended as a query
                parameter.
              </>
            ) : (
              "No webhook configured. The call button still uses the destination set above."
            )}
          </div>
        </Section>

        <Section icon={Database} title="Data">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border bg-background/40 px-3 py-2">
              <div className="text-lg font-semibold tabular">{leadCount.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Leads in IndexedDB</div>
            </div>
            <div className="rounded-md border bg-background/40 px-3 py-2">
              <div className="text-lg font-semibold tabular">{attemptCount.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Logged attempts</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onOpenImport}>
              <Upload /> Import more leads
            </Button>
            <Button variant="outline" size="sm" onClick={onExportWorking}>
              <FileSpreadsheet /> Working CSV
            </Button>
            <Button variant="outline" size="sm" onClick={onExportCallLog}>
              <Download /> Call log CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={onOpenShortcuts}>
              <Keyboard /> Shortcuts
            </Button>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            All lead data, notes and call history live in this browser. No network requests are made with your leads.
          </p>
          <div className="mt-3 border-t pt-3">
            {!confirmClear ? (
              <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => setConfirmClear(true)}>
                <Trash2 /> Clear all local data
              </Button>
            ) : (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" /> Delete every lead and call log?
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  This removes all {leadCount.toLocaleString()} leads, notes and history from IndexedDB. Export first if
                  you need a copy. This cannot be undone.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" size="xs" onClick={() => setConfirmClear(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="xs"
                    onClick={() => {
                      setConfirmClear(false);
                      onClearAll();
                    }}
                  >
                    <Trash2 /> Delete everything
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Section>

        <div className="flex items-center justify-between border-t pt-3 text-[10px] text-muted-foreground">
          <span>Lead Dialer · local-first · v1.0</span>
          <Badge variant="outline">No account · no tracking</Badge>
        </div>
      </div>
    </Dialog>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Database;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border bg-background/40 p-3">
      <div>
        <div className="text-xs font-medium">{title}</div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} label={title} />
    </div>
  );
}
