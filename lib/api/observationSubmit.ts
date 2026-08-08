// Direct client for NAC's public observation submission API.
//
// Two endpoints, called in order:
//   1. POST {NAC_HOST}/v2/public/media          — one POST per image, returns MediaItem
//   2. POST {NAC_HOST}/obs/v1/public/observation/  — observation JSON referencing those MediaItems
//
// Auth is via the `Origin` request header, which NAC checks against a
// per-partner allowlist. Until our origin is added, requests against
// production will fail; default config points at staging so the rest of
// the pipeline can be exercised end-to-end.
//
// Configure via env (Expo public, baked at build time):
//   EXPO_PUBLIC_NAC_HOST    e.g. https://api.avalanche.org
//   EXPO_PUBLIC_NAC_ORIGIN  e.g. https://avycomparison.app
//
// This module exposes the primitives only. Form-state-aware orchestration
// (upload-all-photos → build payload → submit, with retries and offline
// queueing) lives in slice 7.

import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import type {
  LocalImageAsset,
  MediaItem,
  SubmitPayload,
} from "@/lib/observation/schema";

const NAC_HOST =
  process.env.EXPO_PUBLIC_NAC_HOST ?? "https://staging-api.avalanche.org";
const NAC_ORIGIN =
  process.env.EXPO_PUBLIC_NAC_ORIGIN ?? "https://staging-api.avalanche.org";

const MEDIA_PATH = "/v2/public/media";
const OBSERVATION_PATH = "/obs/v1/public/observation/";

// NAC's image pipeline produces flipped thumbnails for some EXIF
// orientations, so we always re-render through expo-image-manipulator
// (which normalizes orientation) before upload. We also clamp the
// longer dimension to 2048px and re-encode as JPEG q=0.9.
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.9;

export interface UploadMediaArgs {
  image: LocalImageAsset;
  centerId: string;
  observerName: string;
  caption?: string;
  photoUsage: "anonymous" | "credit" | "private";
  // Title shown in the NAC media browser; we use the location name.
  title?: string;
  // Aborts the in-flight POST (not just between steps).
  signal?: AbortSignal;
}

export class ObservationApiError extends Error {
  status: number;
  bodyText: string;
  constructor(message: string, status: number, bodyText: string) {
    super(message);
    this.name = "ObservationApiError";
    this.status = status;
    this.bodyText = bodyText;
  }
}

export async function uploadMedia(args: UploadMediaArgs): Promise<MediaItem> {
  const { image, centerId, observerName, caption, photoUsage, title, signal } =
    args;

  const portrait = image.height >= image.width;
  const longSide = portrait ? image.height : image.width;
  const target = Math.min(longSide, MAX_DIMENSION);

  const ctx = ImageManipulator.manipulate(image.uri);
  if (target !== longSide) {
    ctx.resize({
      width: portrait ? undefined : target,
      height: portrait ? target : undefined,
    });
  }
  const rendered = await ctx.renderAsync();
  const result = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    base64: true,
    compress: JPEG_QUALITY,
  });

  const filename = image.uri.split("/").slice(-1)[0] || "photo.jpg";

  const payload = {
    file: `data:image/jpeg;base64,${result.base64 ?? ""}`,
    type: "image",
    file_name: filename,
    center_id: centerId,
    // Empty array per Avy — center_id is what matters; zone is derived
    // from location later.
    forecast_zone_id: [],
    taken_by: observerName,
    access: photoUsage,
    source: "public",
    title: title ?? "Field observation",
    date_taken: exifDateToYmd(image.exif?.DateTimeOriginal),
    caption: caption ?? null,
  };

  return postJson<MediaItem>(MEDIA_PATH, payload, signal);
}

export async function submitObservation(
  payload: SubmitPayload,
  signal?: AbortSignal,
): Promise<unknown> {
  return postJson(OBSERVATION_PATH, payload, signal);
}

// EXIF DateTimeOriginal is "YYYY:MM:DD HH:MM:SS"; NAC expects YYYY-MM-DD.
function exifDateToYmd(raw?: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

async function postJson<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const url = `${NAC_HOST}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: NAC_ORIGIN,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await safeReadText(res);
    throw new ObservationApiError(
      `${path} responded ${res.status}`,
      res.status,
      text,
    );
  }
  return (await res.json()) as T;
}

async function safeReadText(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 1_000);
  } catch {
    return "";
  }
}

// Exposed so the submit flow + dev tools can show what we're pointing at.
export const observationApiConfig = {
  host: NAC_HOST,
  origin: NAC_ORIGIN,
  isStaging: NAC_HOST.includes("staging"),
};
