import type { HitPayload, Injury, ReplayHighlightTag } from "@/game/ragdollArchers/core/types";

export interface NetworkPlayerSnapshot {
  actorId: string;
  position: [number, number, number];
  velocity: [number, number, number];
  aimYaw: number;
  aimPitch: number;
  health: number;
  stamina: number;
}

export interface NetworkInjurySummary {
  actorId: string;
  activeInjuries: number;
  criticalInjuries: number;
  bleedingRisk: number;
}

export interface NetworkTreatmentSummary {
  actorId: string;
  injuryId: string;
  state: string;
  progress: number;
}

export interface NetworkDeathSummary {
  actorId: string;
  cause: string;
  timestampMs: number;
}

export type NetworkMatchEvent =
  | { type: "player_input"; payload: Record<string, unknown> }
  | { type: "arrow_fired"; payload: Record<string, unknown> }
  | { type: "hit_registered"; payload: HitPayload }
  | { type: "injury_applied"; payload: Injury | NetworkInjurySummary }
  | { type: "treatment_started"; payload: Record<string, unknown> }
  | { type: "treatment_interrupted"; payload: Record<string, unknown> }
  | { type: "treatment_completed"; payload: Record<string, unknown> }
  | { type: "consumable_used"; payload: Record<string, unknown> }
  | { type: "player_died"; payload: NetworkDeathSummary }
  | { type: "highlight_tagged"; payload: { tag: ReplayHighlightTag; actorId: string; timestampMs: number } };
