"use client";

import { getPublicBackendBaseUrl } from "@/lib/backendUrl";

function resolveAuthorityMode(options = {}) {
  if (options.authorityMode) return options.authorityMode;
  if (typeof options.preferBackend === "boolean") {
    return options.preferBackend ? "multiplayer" : "solo";
  }
  return "auto";
}

function getApiUrl(pathname, options = {}) {
  const backendBase = getPublicBackendBaseUrl();
  const fallbackBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const authorityMode = resolveAuthorityMode(options);
  if (authorityMode === "multiplayer" && !backendBase) {
    throw new Error("Multiplayer world authority URL is not configured.");
  }
  const soloBase = fallbackBase || backendBase || "";
  const base =
    authorityMode === "multiplayer"
      ? backendBase
      : authorityMode === "solo"
        ? soloBase
        : backendBase || fallbackBase || "";
  return `${base}${pathname}`;
}

export async function fetchWorldState(options = {}) {
  const response = await fetch(getApiUrl("/api/world", options), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`World request failed with status ${response.status}`);
  }

  return response.json();
}

export async function eliminateWorldTarget(targetId, options = {}) {
  const response = await fetch(getApiUrl(`/api/targets/${targetId}`, options), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Elimination request failed with status ${response.status}`);
  }

  return response.json();
}

export async function resolveMissionOperation(payload, options = {}) {
  const authorityMode = resolveAuthorityMode(options);
  const response = await fetch(getApiUrl("/api/mission/resolve", options), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      authoritySource: authorityMode === "multiplayer" ? "backend" : payload.authoritySource || "solo_fallback",
    }),
  });

  if (!response.ok) {
    throw new Error(`Mission resolve request failed with status ${response.status}`);
  }

  return response.json();
}
