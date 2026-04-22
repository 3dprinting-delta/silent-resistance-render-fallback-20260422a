import type { ActorRuntime, AlertTier, DisguiseId, ZoneDefinition } from "@/game/core/types";
import { distance2D } from "@/game/utils/math";

const roleAffinity: Record<string, DisguiseId> = {
  civilian: "civilian",
  technician: "technician",
  officer: "officer",
  enforcer: "officer",
  target: "officer",
};

export function getBehaviorPenalty(behavior: "idle" | "walk" | "run" | "dragging_body" | "illegal_action") {
  if (behavior === "walk") return 3;
  if (behavior === "run") return 14;
  if (behavior === "dragging_body") return 32;
  if (behavior === "illegal_action") return 40;
  return 0;
}

export function computeSuspicionDelta(params: {
  actor: ActorRuntime;
  playerPosition: [number, number, number];
  disguise: DisguiseId;
  zone: ZoneDefinition | null;
  behavior: "idle" | "walk" | "run" | "dragging_body" | "illegal_action";
  bodySeen?: boolean;
  sabotageSeen?: boolean;
}) {
  const distance = distance2D(params.playerPosition, params.actor.position);
  if (distance > params.actor.visionRange) return 0;
  const facing = params.actor.facing ?? 0;
  const dx = params.playerPosition[0] - params.actor.position[0];
  const dz = params.playerPosition[2] - params.actor.position[2];
  const toPlayer = Math.atan2(dx, dz);
  const angleDelta = Math.abs(Math.atan2(Math.sin(toPlayer - facing), Math.cos(toPlayer - facing)));
  const withinCone = angleDelta < Math.PI * 0.42;
  if (!withinCone && distance > 2.75) return 0;

  const expected = roleAffinity[params.actor.role];
  let delta = 0;

  if (!params.zone || !params.zone.clearance.includes(params.disguise)) {
    delta += 10;
  }
  if (params.actor.disguiseEnforcer && params.disguise !== "officer") {
    delta += 12;
  }
  if (params.disguise !== expected) {
    delta += params.actor.role === "officer" ? 8 : params.actor.role === "technician" ? 6 : 4;
  }
  if (distance < 3) {
    delta += 6;
  } else if (distance < 6) {
    delta += 3;
  }
  if (params.zone) {
    delta *= 1 / Math.max(0.45, params.zone.stealthModifier);
  }
  delta += Math.max(0, (params.actor.awareness || 0) * 0.35);

  delta += getBehaviorPenalty(params.behavior);
  if (params.bodySeen) delta += 24;
  if (params.sabotageSeen) delta += 18;

  return Math.round(delta * (params.zone?.witnessWeight || 1));
}

export function deriveAlertTier(suspicion: number): AlertTier {
  if (suspicion >= 90) return "lockdown";
  if (suspicion >= 70) return "compromised";
  if (suspicion >= 45) return "investigating";
  if (suspicion >= 20) return "suspicious";
  return "calm";
}
