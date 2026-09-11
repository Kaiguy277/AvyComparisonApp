// "Here's what you sent" — a PDF copy of a submitted observation.
//
// Generated on-device from the same form object that went to the National
// Avalanche Center, so it's a record of what the observer actually
// submitted rather than a re-query of what the server stored.

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

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

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

const labelOf = (opts: readonly Option[], value: string | undefined) =>
  opts.find((o) => o.value === value)?.label ?? value ?? "";

function row(label: string, value: unknown): string {
  const v = String(value ?? "").trim();
  if (!v) return "";
  return `<tr><th>${esc(label)}</th><td>${esc(v)}</td></tr>`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

export function receiptHtml(form: ObservationForm, submittedAt: Date, centerId: string): string {
  const avalanches = form.avalanches
    .map(
      (a, i) => `
      <h3>Avalanche ${i + 1}</h3>
      <table>
        ${row("Date", fmtDate(a.date))}
        ${row("Location", a.location)}
        ${row("Trigger", labelOf(AVALANCHE_TRIGGER_OPTIONS, a.trigger))}
        ${row("Type", labelOf(AVALANCHE_TYPE_OPTIONS, a.avalanche_type))}
        ${row("Bed surface", labelOf(BED_SURFACE_OPTIONS, a.bed_sfc))}
        ${row("Aspect", labelOf(ASPECT_OPTIONS, a.aspect))}
        ${row("Size", labelOf(D_SIZE_OPTIONS, a.d_size))}
        ${row("Elevation", a.elevation ? `${a.elevation} ft` : "Not recorded")}
        ${row("How many", a.number)}
        ${row("Comments", a.comments)}
        ${row("Photos", a.images.length ? `${a.images.length} attached` : "")}
      </table>`,
    )
    .join("");

  const inst = form.instability;
  const instabilityRows = [
    row("Avalanches seen", inst.avalanches_observed ? "Yes" : "No"),
    row("Collapsing / whumpfing", inst.collapsing ? "Yes" : "No"),
    row("Collapsing detail", inst.collapsing_description),
    row("Shooting cracks", inst.cracking ? "Yes" : "No"),
    row("Cracking detail", inst.cracking_description),
  ].join("");

  return `<!doctype html><html><head><meta charset="utf-8">
<style>
  @page { margin: 40px; }
  body { font: 12px/1.5 -apple-system, system-ui, sans-serif; color: #1B1916; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #5C534A;
       margin: 22px 0 6px; border-bottom: 1px solid #A89A82; padding-bottom: 3px; }
  h3 { font-size: 13px; margin: 14px 0 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; width: 150px; color: #5C534A; font-weight: 500; vertical-align: top; padding: 3px 8px 3px 0; }
  td { padding: 3px 0; vertical-align: top; }
  .meta { color: #5C534A; font-size: 11px; }
  .note { margin-top: 26px; padding-top: 8px; border-top: 1px solid #A89A82; color: #5C534A; font-size: 10px; }
</style></head><body>
  <h1>Avalanche observation</h1>
  <div class="meta">Submitted ${esc(submittedAt.toLocaleString())} · ${esc(centerId || "center not set")}</div>

  <h2>Observer</h2>
  <table>
    ${row("Name", form.name)}
    ${row("Email", form.email)}
    ${row("Phone", form.phone)}
    ${row("Name shown publicly", form.show_name ? "Yes" : "No")}
  </table>

  <h2>When and where</h2>
  <table>
    ${row("Date", fmtDate(form.start_date))}
    ${row("Activity", form.activity.map((a) => labelOf(ACTIVITY_OPTIONS, a)).join(", "))}
    ${row("Location name", form.location_name)}
    ${row("Coordinates", `${form.location_point.lat}, ${form.location_point.lng}`)}
    ${row("Forecast center", centerId)}
  </table>

  <h2>What you saw</h2>
  <table>${row("Summary", form.observation_summary)}</table>

  <h2>Signs of instability</h2>
  <table>${instabilityRows}</table>

  ${form.avalanches.length ? `<h2>Avalanches</h2>${avalanches}` : ""}
  ${form.avalanches_summary ? `<h2>Avalanche summary</h2><table>${row("Notes", form.avalanches_summary)}</table>` : ""}
  ${form.images.length ? `<h2>Photos</h2><table>${row("Attached", `${form.images.length}`)}</table>` : ""}

  <div class="note">
    Your copy of an observation submitted through Avy Comparison to the National
    Avalanche Center. Photos are listed by count only; the images themselves went
    with the submission.
  </div>
</body></html>`;
}

// Returns the file URI of the generated PDF, or null if printing failed.
export async function buildReceiptPdf(
  form: ObservationForm,
  centerId: string,
  submittedAt: Date = new Date(),
): Promise<string | null> {
  try {
    const { uri } = await Print.printToFileAsync({
      html: receiptHtml(form, submittedAt, centerId),
    });
    return uri;
  } catch {
    return null;
  }
}

export async function shareReceiptPdf(uri: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "Your observation",
    });
  }
}
