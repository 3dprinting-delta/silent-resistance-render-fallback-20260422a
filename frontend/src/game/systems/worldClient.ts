import type { WorldSnapshot } from "@/game/core/types";
import { getPublicBackendBaseUrl } from "@/lib/backendUrl";

function getApiUrl(pathname: string) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || getPublicBackendBaseUrl();
  return `${base}${pathname}`;
}

export async function fetchWorldSnapshot(): Promise<WorldSnapshot> {
  const response = await fetch(getApiUrl("/api/world"), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`World request failed with status ${response.status}`);
  }
  return response.json();
}

export async function advanceSharedWorld(): Promise<WorldSnapshot> {
  const response = await fetch(getApiUrl("/api/simulation/tick"), { method: "POST" });
  if (!response.ok) {
    throw new Error(`Tick request failed with status ${response.status}`);
  }
  return response.json();
}

export async function commitMissionOutcome(payload: { targetId: string; title: string; summary: string; broadcast: string }) {
  const response = await fetch(getApiUrl("/api/mission/resolve"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Mission resolve failed with status ${response.status}`);
  }
  return response.json() as Promise<WorldSnapshot>;
}
