// Canonical mapping from NAC's free-text elevation strings to one of the
// three standard avalanche bands. NAC emits "Alpine", "Treeline", and
// "Below Treeline" (and occasionally "Above Treeline"). The ORDER of the
// checks is load-bearing: "below" must be tested before the treeline
// fallthrough, or "Below Treeline" gets misread as "Treeline" — which
// showed a problem at a band the forecast didn't include, and made the
// problem card's text disagree with the rose beside it. Both the rose
// and the card resolve bands through here so they can't diverge.

export type ElevationBand = "alpine" | "treeline" | "belowTreeline";

export function elevationBand(elev: string): ElevationBand {
  const e = elev.toLowerCase();
  if (e.includes("alpine") || e.includes("above")) return "alpine";
  if (e.includes("below")) return "belowTreeline";
  return "treeline";
}

// Rose ring index: 0 = inner (alpine), 1 = middle (treeline), 2 = outer
// (below treeline).
export function elevationRingIndex(elev: string): 0 | 1 | 2 {
  const band = elevationBand(elev);
  return band === "alpine" ? 0 : band === "belowTreeline" ? 2 : 1;
}
