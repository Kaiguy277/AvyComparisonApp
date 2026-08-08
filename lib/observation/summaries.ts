// Per-section "what's filled in" summaries for the collapsed cards in
// the submit form. Each function returns null when the section is
// effectively empty (so the card shows "Tap to fill in" instead).

import type { ObservationForm } from "./schema";
import {
  ACTIVITY_OPTIONS,
  ASPECT_OPTIONS,
  AVALANCHE_TRIGGER_OPTIONS,
  D_SIZE_OPTIONS,
  PHOTO_USAGE_OPTIONS,
} from "./constants";

const lookupLabel = (
  options: readonly { value: string; label: string }[],
  value: string | undefined,
): string | undefined =>
  options.find((o) => o.value === value)?.label ?? value;

const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${monthShort[d.getMonth()]} ${d.getDate()}`;
}

export function summarizeAbout(form: ObservationForm): string | null {
  if (!form.name && !form.email) return null;
  const parts = [form.name, form.email].filter(Boolean);
  return parts.join(" · ");
}

export function summarizeWhen(form: ObservationForm): string {
  return formatDate(form.start_date);
}

export function summarizeActivity(form: ObservationForm): string | null {
  if (form.activity.length === 0) return null;
  const labels = form.activity.map((v) => lookupLabel(ACTIVITY_OPTIONS, v) ?? v);
  if (labels.length === 1) return labels[0];
  return `${labels[0]} +${labels.length - 1} more`;
}

export function summarizeWhere(form: ObservationForm): string | null {
  const hasFix = !(form.location_point.lat === 0 && form.location_point.lng === 0);
  const parts: string[] = [];
  if (form.location_name) parts.push(form.location_name);
  if (hasFix) {
    parts.push(
      `${form.location_point.lat.toFixed(3)}, ${form.location_point.lng.toFixed(3)}`,
    );
  }
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

export function summarizeObservation(form: ObservationForm): string | null {
  const t = form.observation_summary.trim();
  if (!t) return null;
  return t.length > 110 ? `${t.slice(0, 110)}…` : t;
}

export function summarizePhotos(form: ObservationForm): string | null {
  if (form.images.length === 0) return null;
  return `${form.images.length} photo${form.images.length === 1 ? "" : "s"}`;
}

export function summarizeInstability(form: ObservationForm): string {
  const i = form.instability;
  const flags: string[] = [];
  if (i.avalanches_observed) flags.push("avalanches seen");
  if (i.cracking) flags.push("cracking");
  if (i.collapsing) flags.push("collapsing");
  if (flags.length === 0) return "No signs reported";
  return capitalize(flags.join(", "));
}

export function summarizeAvalanches(form: ObservationForm): string | null {
  if (form.avalanches.length === 0) return null;
  if (form.avalanches.length > 1) {
    return `${form.avalanches.length} avalanches`;
  }
  const a = form.avalanches[0];
  const trigger = lookupLabel(AVALANCHE_TRIGGER_OPTIONS, a.trigger);
  const size = lookupLabel(D_SIZE_OPTIONS, a.d_size)?.split(" — ")[0];
  const aspect = lookupLabel(ASPECT_OPTIONS, a.aspect);
  const elev = a.elevation ? `${a.elevation}'` : "";
  return [size, aspect, elev, trigger].filter(Boolean).join(" · ");
}

export function summarizePrivacy(form: ObservationForm): string {
  const visibility = form.private ? "Private" : "Public";
  const photo = lookupLabel(PHOTO_USAGE_OPTIONS, form.photoUsage);
  const credit = form.show_name ? "name shown" : "anonymous";
  return `${visibility} · ${photo} · ${credit}`;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}
