// Interim path for submitting an observation while we wait on production
// access to the National Avalanche Center's API.
//
// Direct submission currently points at NAC's *staging* host, which means a
// "submitted" observation would never reach a forecaster. Rather than quietly
// posting into a test system, the app explains that and offers to send the
// same observation to the center by email, with the PDF copy attached — so
// the observer's work still gets where it was going.

import * as MailComposer from "expo-mail-composer";

import {
  ACTIVITY_OPTIONS,
  ASPECT_OPTIONS,
  AVALANCHE_TRIGGER_OPTIONS,
  AVALANCHE_TYPE_OPTIONS,
  BED_SURFACE_OPTIONS,
  D_SIZE_OPTIONS,
  type Option,
} from "./constants";
import type { ObservationForm } from "./schema";

// Public observation addresses we have actually verified. Deliberately sparse:
// a wrong address sends someone's field observation into a void, which is worse
// than asking them to pick the right one. More get added as the center-outreach
// effort (docs/CENTER_OUTREACH.md) confirms them.
const VERIFIED_CENTER_EMAIL: Record<string, string> = {
  HPAC: "info@hpavalanche.org",
};

export function centerEmail(centerId: string | undefined): string | null {
  if (!centerId) return null;
  return VERIFIED_CENTER_EMAIL[centerId] ?? null;
}

const labelOf = (opts: readonly Option[], v: string | undefined) =>
  opts.find((o) => o.value === v)?.label ?? v ?? "";

function line(label: string, value: unknown): string {
  const v = String(value ?? "").trim();
  return v ? `${label}: ${v}\n` : "";
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

export function emailSubject(form: ObservationForm): string {
  const where = form.location_name?.trim() || "Backcountry";
  return `Public observation — ${where} — ${fmtDate(form.start_date)}`;
}

export function emailBody(form: ObservationForm, centerId: string): string {
  const inst = form.instability;
  const avalanches = form.avalanches
    .map(
      (a, i) =>
        `\nAvalanche ${i + 1}\n` +
        line("  Date", fmtDate(a.date)) +
        line("  Location", a.location) +
        line("  Trigger", labelOf(AVALANCHE_TRIGGER_OPTIONS, a.trigger)) +
        line("  Type", labelOf(AVALANCHE_TYPE_OPTIONS, a.avalanche_type)) +
        line("  Bed surface", labelOf(BED_SURFACE_OPTIONS, a.bed_sfc)) +
        line("  Aspect", labelOf(ASPECT_OPTIONS, a.aspect)) +
        line("  Size", labelOf(D_SIZE_OPTIONS, a.d_size)) +
        line("  Elevation", a.elevation ? `${a.elevation} ft` : "not recorded") +
        line("  How many", a.number) +
        line("  Comments", a.comments),
    )
    .join("");

  return (
    `Hello,\n\n` +
    `Here is a public observation from ${form.start_date ? fmtDate(form.start_date) : "the field"}. ` +
    `It was written in Whumpf, an app that compares avalanche forecasts. Direct submission ` +
    `through avalanche.org isn't enabled for the app yet, so I'm sending it to you directly. ` +
    `A formatted PDF is attached.\n\n` +
    `OBSERVER\n` +
    line("Name", form.name) +
    line("Email", form.email) +
    line("Phone", form.phone) +
    line("Name may be shown publicly", form.show_name ? "Yes" : "No") +
    `\nWHEN AND WHERE\n` +
    line("Date", fmtDate(form.start_date)) +
    line("Activity", form.activity.map((a) => labelOf(ACTIVITY_OPTIONS, a)).join(", ")) +
    line("Location", form.location_name) +
    line("Coordinates", `${form.location_point.lat}, ${form.location_point.lng}`) +
    line("Center", centerId) +
    `\nWHAT I SAW\n${form.observation_summary?.trim() || "(none)"}\n` +
    `\nSIGNS OF INSTABILITY\n` +
    line("Avalanches seen", inst.avalanches_observed ? "Yes" : "No") +
    line("Collapsing / whumpfing", inst.collapsing ? "Yes" : "No") +
    line("Collapsing detail", inst.collapsing_description) +
    line("Shooting cracks", inst.cracking ? "Yes" : "No") +
    line("Cracking detail", inst.cracking_description) +
    avalanches +
    (form.avalanches_summary ? `\nAVALANCHE NOTES\n${form.avalanches_summary}\n` : "") +
    (form.images.length ? `\nPhotos attached: ${form.images.length}\n` : "") +
    `\nThanks,\n${form.name}\n`
  );
}

export interface EmailResult {
  status: "sent" | "saved" | "cancelled" | "unavailable";
}

export async function emailObservation(args: {
  form: ObservationForm;
  centerId: string;
  pdfUri?: string | null;
  // Attach at most this many photos so the message stays deliverable.
  maxPhotos?: number;
}): Promise<EmailResult> {
  const { form, centerId, pdfUri, maxPhotos = 4 } = args;
  if (!(await MailComposer.isAvailableAsync())) return { status: "unavailable" };

  const to = centerEmail(centerId);
  const attachments = [
    ...(pdfUri ? [pdfUri] : []),
    ...form.images.slice(0, maxPhotos).map((i) => i.image.uri),
  ];

  const result = await MailComposer.composeAsync({
    recipients: to ? [to] : undefined,
    subject: emailSubject(form),
    body: emailBody(form, centerId),
    attachments,
  });

  if (result.status === MailComposer.MailComposerStatus.SENT) return { status: "sent" };
  if (result.status === MailComposer.MailComposerStatus.SAVED) return { status: "saved" };
  return { status: "cancelled" };
}
