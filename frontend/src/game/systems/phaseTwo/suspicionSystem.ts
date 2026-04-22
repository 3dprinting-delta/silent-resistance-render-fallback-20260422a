import type { DominantRiskSource, StealthState, SuspicionBreakdown, SuspicionChannels } from "@/game/core/types";

const thresholds = {
  noticedUp: 12,
  noticedDown: 8,
  suspiciousUp: 28,
  suspiciousDown: 20,
  investigatingUp: 56,
  investigatingDown: 46,
  compromisedUp: 84,
  compromisedDown: 72,
};

export function deriveStealthState(suspicion: number, current: StealthState): StealthState {
  if (current === "compromised") return suspicion < thresholds.compromisedDown ? "investigating" : "compromised";
  if (current === "investigating") {
    if (suspicion >= thresholds.compromisedUp) return "compromised";
    if (suspicion < thresholds.investigatingDown) return "suspicious";
    return "investigating";
  }
  if (current === "suspicious") {
    if (suspicion >= thresholds.investigatingUp) return "investigating";
    if (suspicion < thresholds.suspiciousDown) return "noticed";
    return "suspicious";
  }
  if (current === "noticed") {
    if (suspicion >= thresholds.suspiciousUp) return "suspicious";
    if (suspicion < thresholds.noticedDown) return "clear";
    return "noticed";
  }
  if (suspicion >= thresholds.noticedUp) return "noticed";
  return "clear";
}

export function applySuspicionDelta(current: number, delta: number) {
  return Math.max(0, Math.min(100, current + delta));
}

export function composeSuspicionChannels(params: {
  previous: SuspicionChannels;
  breakdown: SuspicionBreakdown;
  trespassExposure: number;
  recentCrimeLevel: number;
  decaySafe: boolean;
}) {
  const decay = params.decaySafe ? 6 : 0;
  return {
    trespass: Math.max(0, Math.min(100, params.trespassExposure - decay)),
    exposure: Math.max(0, Math.min(100, params.breakdown.distance + params.breakdown.los - decay)),
    behavior: Math.max(0, Math.min(100, params.breakdown.behavior - decay)),
    enforcer: Math.max(0, Math.min(100, params.breakdown.enforcer - (params.decaySafe ? 8 : 0))),
    recentCrime: Math.max(0, Math.min(100, params.recentCrimeLevel - 3)),
  };
}

export function totalSuspicionFromChannels(channels: SuspicionChannels) {
  return Math.min(
    100,
    Math.round(channels.trespass * 0.22 + channels.exposure * 0.28 + channels.behavior * 0.18 + channels.enforcer * 0.2 + channels.recentCrime * 0.12),
  );
}

export function dominantRiskFromBreakdown(breakdown: SuspicionBreakdown, recentCrime: number): DominantRiskSource {
  const entries: Array<[DominantRiskSource, number]> = [
    ["trespass", breakdown.zone],
    ["exposure", breakdown.distance + breakdown.los],
    ["behavior", breakdown.behavior],
    ["enforcer", breakdown.enforcer],
    ["recent_crime", recentCrime],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][1] > 0 ? entries[0][0] : "none";
}
