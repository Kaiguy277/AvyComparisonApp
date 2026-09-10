// Gear inventory catalogue for the tap-to-own grid. Each item is a tile;
// items with `detail` reveal a short text field once owned (e.g. the sat
// device's share URL). Pure module — no RN imports.

import type { GearProfile } from "./schema";

export interface GearItem {
  key: string;
  label: string;
  // MaterialCommunityIcons name.
  icon: string;
  // Which GearProfile text field holds this item's detail, if any.
  detail?: keyof GearProfile;
  detailLabel?: string;
  detailPlaceholder?: string;
  // Legacy boolean kept in sync.
  legacy?: "beacon" | "shovel" | "probe" | "airbag";
}

export const GEAR_ITEMS: readonly GearItem[] = [
  { key: "beacon", label: "Beacon", icon: "access-point", legacy: "beacon" },
  { key: "shovel", label: "Shovel", icon: "shovel", legacy: "shovel" },
  { key: "probe", label: "Probe", icon: "ruler", legacy: "probe" },
  { key: "airbag", label: "Airbag", icon: "bag-personal", legacy: "airbag" },
  { key: "sat", label: "Sat device", icon: "satellite-variant", detail: "satDeviceType", detailLabel: "Which device?", detailPlaceholder: "inReach Mini 2, Zoleo…" },
  { key: "radio", label: "Radio", icon: "radio-handheld", detail: "radio", detailLabel: "Radio + channel", detailPlaceholder: "BCA Link 2.0, ch 1" },
  { key: "first_aid", label: "First aid", icon: "medical-bag" },
  { key: "headlamp", label: "Headlamp", icon: "flashlight" },
  { key: "stove", label: "Stove / fire", icon: "fire", detail: "fireAndStove", detailLabel: "What?", detailPlaceholder: "Jetboil, lighter" },
  { key: "overnight", label: "Overnight", icon: "tent", detail: "overnightGear", detailLabel: "What's in it?", detailPlaceholder: "Bivy, puffy, extra food" },
  { key: "map", label: "Map / GPS", icon: "map-marker-path", detail: "navigation", detailLabel: "What are you navigating with?", detailPlaceholder: "Gaia on phone, paper map" },
  { key: "helmet", label: "Helmet", icon: "racing-helmet" },
  { key: "repair", label: "Repair kit", icon: "tools" },
  { key: "skins", label: "Skins", icon: "ski" },
  { key: "firearm", label: "Firearm", icon: "pistol", detail: "firearm", detailLabel: "Type", detailPlaceholder: "12 ga, .44" },
] as const;

export function hasItem(g: GearProfile | undefined, key: string): boolean {
  if (!g) return false;
  if (g.inventory?.includes(key)) return true;
  const item = GEAR_ITEMS.find((i) => i.key === key);
  // Legacy booleans count as owned when the inventory hasn't been set up.
  if (item?.legacy && (!g.inventory || g.inventory.length === 0)) return !!g[item.legacy];
  return false;
}

export function toggleItem(g: GearProfile, key: string): GearProfile {
  const owned = new Set(g.inventory ?? []);
  // First toggle migrates legacy booleans into the inventory so they don't
  // silently disappear when the array becomes non-empty.
  if (owned.size === 0) {
    for (const i of GEAR_ITEMS) if (i.legacy && g[i.legacy]) owned.add(i.key);
  }
  if (owned.has(key)) owned.delete(key);
  else owned.add(key);
  const next: GearProfile = { ...g, inventory: [...owned] };
  for (const i of GEAR_ITEMS) if (i.legacy) next[i.legacy] = owned.has(i.key);
  return next;
}

export function ownedItems(g: GearProfile | undefined): GearItem[] {
  return GEAR_ITEMS.filter((i) => hasItem(g, i.key));
}

export function gearSummary(g: GearProfile | undefined): string | null {
  const owned = ownedItems(g);
  if (owned.length === 0) return null;
  const core = ["beacon", "shovel", "probe"].every((k) => hasItem(g, k));
  const rest = owned.filter((i) => !["beacon", "shovel", "probe"].includes(i.key)).map((i) => i.label);
  const parts = [core ? "Beacon · shovel · probe" : null, ...rest].filter(Boolean) as string[];
  return parts.slice(0, 4).join(" · ") + (parts.length > 4 ? ` +${parts.length - 4}` : "");
}
