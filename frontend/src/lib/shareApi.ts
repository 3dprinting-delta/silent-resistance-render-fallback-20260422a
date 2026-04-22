import type { ShareCreateRequest, ShareLookupResponse, StealthCloudProfile } from "@/game/core/types";
import { getPublicBackendBaseUrl, getShareSiteBaseUrl } from "@/lib/backendUrl";

function resolveBackendBase() {
  return getPublicBackendBaseUrl();
}

export function resolveShareSiteBase() {
  return getShareSiteBaseUrl();
}

export function buildSharePageUrl(shareId: string, origin?: string | null) {
  const base = resolveShareSiteBase() || origin || "";
  return base ? `${base.replace(/\/$/, "")}/share/${shareId}` : `/share/${shareId}`;
}

export function buildShareImageUrl(shareId: string) {
  const base = resolveShareSiteBase();
  return `${base.replace(/\/$/, "")}/share/${shareId}/opengraph-image`;
}

export async function createStoredShare(payload: ShareCreateRequest) {
  const response = await fetch(`${resolveBackendBase()}/api/shares`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Share creation failed with status ${response.status}`);
  }

  return response.json() as Promise<{ ok: true; shareId: string; share: ShareLookupResponse["share"] }>;
}

export async function fetchStoredShare(shareId: string, options?: RequestInit & { next?: { revalidate?: number } }) {
  const response = await fetch(`${resolveBackendBase()}/api/shares/${shareId}`, {
    cache: "no-store",
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Share lookup failed with status ${response.status}`);
  }

  return response.json() as Promise<ShareLookupResponse>;
}

export async function trackShareEvent(shareId: string, payload: {
  type: "view" | "launch" | "completion";
  visitorId: string;
  accountId?: string | null;
}) {
  const response = await fetch(`${resolveBackendBase()}/api/shares/${shareId}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Share tracking failed with status ${response.status}`);
  }
  return response.json() as Promise<{ ok: true; analytics: unknown }>;
}

export async function syncStealthCloudProfile(payload: {
  identityToken: string;
  recentHighlights: StealthCloudProfile["recentHighlights"];
  legendMoments: StealthCloudProfile["legendMoments"];
  lastChallengePayload: StealthCloudProfile["lastChallengePayload"];
  progressionSummary: string | null;
}) {
  const response = await fetch("/api/account/stealth-cloud", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Cloud sync failed with status ${response.status}`);
  }
  return response.json() as Promise<{ ok: true; profile: StealthCloudProfile; identityToken?: string | null }>;
}

export async function loadStealthCloudProfile() {
  const response = await fetch("/api/account/stealth-cloud", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Cloud profile load failed with status ${response.status}`);
  }
  return response.json() as Promise<{ ok: true; profile: StealthCloudProfile | null }>;
}
