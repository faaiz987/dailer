import { telHref } from "./format";
import type { AppSettings, CallMethod } from "./types";

export interface CallTarget {
  /** URL the call button should open. Empty only when a custom URL is not configured. */
  href: string;
  /** Browser dialers open in a new tab so this app keeps its state. */
  newTab: boolean;
  /** The destination has no deep link, so the number must be copied for pasting. */
  copyNumber: boolean;
  /** Short destination name, e.g. "Phone app" or "Google Voice". */
  label: string;
  /** The number lands in the destination's dialpad automatically. */
  prefilled: boolean;
}

export const CALL_METHOD_OPTIONS: Array<{ value: CallMethod; label: string; hint: string }> = [
  {
    value: "tel",
    label: "Phone app (tel: link)",
    hint: "Hands the number to whatever handles tel: on this device — your cell dialer, Dialpad, Aircall, Google Voice app.",
  },
  {
    value: "google-voice",
    label: "Google Voice (web)",
    hint: "Opens Google Voice's call page with the number prefilled. Works best signed in to Voice in this browser (desktop).",
  },
  {
    value: "mightycall",
    label: "MightyCall (web app)",
    hint: "Opens app.mightycall.com and copies the number — paste it into the MightyCall dialpad. MightyCall has no public URL dial link.",
  },
  {
    value: "rynga",
    label: "Rynga (web)",
    hint: "Opens rynga.com and copies the number — paste it into the Rynga dialer. Rynga has no public URL dial link.",
  },
  {
    value: "custom",
    label: "Custom URL",
    hint: "For any web dialer that accepts the number in a URL. Put {phone} where the E.164 number belongs.",
  },
];

export const CALL_METHOD_LABELS: Record<CallMethod, string> = {
  tel: "Phone app",
  "google-voice": "Google Voice",
  mightycall: "MightyCall",
  rynga: "Rynga",
  custom: "Custom URL",
};

const GOOGLE_VOICE_CALL = "https://voice.google.com/u/0/calls?a=nc,";
const MIGHTYCALL_HOME = "https://app.mightycall.com/";
const RYNGA_HOME = "https://www.rynga.com/";

/**
 * Resolve where a call should open for the configured method.
 * `phone` is an E.164 number (with a leading +) when available.
 */
export function buildCallTarget(
  phone: string,
  settings: Pick<AppSettings, "callMethod" | "callUrlTemplate">,
): CallTarget {
  const method: CallMethod = settings.callMethod ?? "tel";
  const encoded = encodeURIComponent(phone);

  switch (method) {
    case "google-voice":
      return {
        href: phone ? GOOGLE_VOICE_CALL + encoded : "https://voice.google.com/",
        newTab: true,
        copyNumber: false,
        label: "Google Voice",
        prefilled: Boolean(phone),
      };
    case "mightycall":
      return {
        href: MIGHTYCALL_HOME,
        newTab: true,
        copyNumber: Boolean(phone),
        label: "MightyCall",
        prefilled: false,
      };
    case "rynga":
      return {
        href: RYNGA_HOME,
        newTab: true,
        copyNumber: Boolean(phone),
        label: "Rynga",
        prefilled: false,
      };
    case "custom": {
      const template = (settings.callUrlTemplate ?? "").trim();
      if (!template) {
        // Nothing configured yet — never leave the call button dead.
        return { href: telHref(phone), newTab: false, copyNumber: false, label: "Phone app", prefilled: false };
      }
      if (template.includes("{phone}")) {
        return {
          href: template.replaceAll("{phone}", encoded),
          newTab: true,
          copyNumber: false,
          label: "your dialer",
          prefilled: Boolean(phone),
        };
      }
      const joined = `${template}${template.includes("?") ? "&" : "?"}phone=${encoded}`;
      return {
        href: phone ? joined : template,
        newTab: true,
        copyNumber: false,
        label: "your dialer",
        prefilled: Boolean(phone),
      };
    }
    default:
      return {
        href: telHref(phone),
        newTab: false,
        copyNumber: false,
        label: "Phone app",
        prefilled: false,
      };
  }
}

/** One-line explanation shown under the call button. */
export function describeCallTarget(target: CallTarget): string {
  if (!target.href) return "Set a custom dialer URL in Settings";
  if (target.copyNumber) return `Opens ${target.label} — number copied, paste it in`;
  if (!target.prefilled && target.label === "Phone app") return "Opens your phone app";
  return `Opens ${target.label}${target.prefilled ? " with this number" : ""}`;
}
