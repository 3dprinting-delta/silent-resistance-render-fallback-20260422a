import type { DominantRiskSource, MissionEvent, StealthState, SuspicionBreakdown } from "@/game/core/types";

export function summarizeDominantPressure(breakdown: SuspicionBreakdown, accessState: string, enforcer: boolean, dominantRiskSource?: DominantRiskSource) {
  if (accessState === "hard_restricted") return "This zone is hard restricted for the current cover.";
  if (accessState === "soft_restricted") return "You can pass through here briefly, but lingering will build suspicion.";
  if (enforcer) return "An enforcer can penetrate the current disguise.";
  if (dominantRiskSource === "recent_crime") return "Recent hostile behavior is keeping the district on edge.";
  if (breakdown.behavior > Math.max(breakdown.zone, breakdown.los)) return "Your behavior is drawing the most scrutiny.";
  if (breakdown.los > 0) return "A watcher has line of sight on you.";
  return "Pressure is low.";
}

export function createStealthEvent(text: string, severity: MissionEvent["severity"]): MissionEvent {
  return {
    id: `stealth-${Date.now()}`,
    text,
    severity,
    timestamp: Date.now(),
  };
}

export function stateSeverity(state: StealthState): MissionEvent["severity"] {
  if (state === "compromised") return "critical";
  if (state === "investigating" || state === "suspicious") return "warning";
  return "info";
}
