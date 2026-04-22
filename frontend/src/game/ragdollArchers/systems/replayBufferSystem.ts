import type { BufferedReplayEvent, ReplayHighlightTag, ReplaySnapshot } from "@/game/ragdollArchers/core/types";

const DEFAULT_WINDOW_MS = 15000;

export function appendReplayEvent(buffer: BufferedReplayEvent[], event: BufferedReplayEvent, windowMs = DEFAULT_WINDOW_MS) {
  const next = [...buffer, event];
  const cutoff = event.timestampMs - windowMs;
  return next.filter((entry) => entry.timestampMs >= cutoff);
}

export function freezeReplaySnapshot(params: {
  buffer: BufferedReplayEvent[];
  capturedAt: number;
  highlightTag?: ReplayHighlightTag;
}): ReplaySnapshot {
  const startedAt = params.buffer[0]?.timestampMs ?? params.capturedAt;
  return {
    id: `replay-${params.capturedAt}`,
    capturedAt: params.capturedAt,
    startedAt,
    durationMs: Math.max(0, params.capturedAt - startedAt),
    events: [...params.buffer],
    highlightTag: params.highlightTag,
  };
}

export function getReplayWindow(buffer: BufferedReplayEvent[], nowMs: number, windowMs = DEFAULT_WINDOW_MS) {
  const cutoff = nowMs - windowMs;
  return buffer.filter((entry) => entry.timestampMs >= cutoff);
}

export function detectReplayHighlight(params: {
  eventType: string;
  summary: string;
  preventable?: boolean;
  nearDeath?: boolean;
  totemUsed?: boolean;
}): ReplayHighlightTag | null {
  if (params.eventType === "critical-hit" || params.summary.toLowerCase().includes("head")) return "critical-hit";
  if (params.preventable && params.eventType === "death") return "preventable-death";
  if (params.nearDeath && params.eventType === "treatment_interrupted") return "treatment-failed-near-death";
  if (params.eventType === "critical_state_entered" && params.summary.toLowerCase().includes("survived")) return "survived-critical-injury";
  if (params.totemUsed) return "totem-save";
  return null;
}
