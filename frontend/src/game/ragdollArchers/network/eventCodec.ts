import type { NetworkMatchEvent } from "@/game/ragdollArchers/network/networkTypes";

const validEventTypes = new Set<NetworkMatchEvent["type"]>([
  "player_input",
  "arrow_fired",
  "hit_registered",
  "injury_applied",
  "treatment_started",
  "treatment_interrupted",
  "treatment_completed",
  "consumable_used",
  "player_died",
  "highlight_tagged",
]);

export function encodeNetworkEvent(event: NetworkMatchEvent) {
  return JSON.stringify(event);
}

export function decodeNetworkEvent(serialized: string): NetworkMatchEvent | null {
  try {
    const parsed = JSON.parse(serialized) as Partial<NetworkMatchEvent>;
    if (!parsed || typeof parsed !== "object" || !parsed.type || !validEventTypes.has(parsed.type as NetworkMatchEvent["type"])) {
      return null;
    }
    return parsed as NetworkMatchEvent;
  } catch {
    return null;
  }
}

export function isNetworkMatchEvent(value: unknown): value is NetworkMatchEvent {
  return typeof value === "object" && value !== null && "type" in value && validEventTypes.has((value as { type: NetworkMatchEvent["type"] }).type);
}
