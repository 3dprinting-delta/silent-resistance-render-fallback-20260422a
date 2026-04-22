import { arrowTuning } from "@/game/ragdollArchers/core/constants";
import type { ArrowType, DamageEvent, LimbName } from "@/game/ragdollArchers/core/types";

export function damageMultiplierForLimb(limb: LimbName) {
  if (limb === "head") return 999;
  if (limb === "torso" || limb === "pelvis") return 1.05;
  if (limb.includes("Arm")) return 0.65;
  return 0.72;
}

export function buildDamageEvent(params: {
  actorId: string;
  sourceActorId: string;
  limb: LimbName;
  arrowType: ArrowType;
  position: [number, number, number];
}): DamageEvent {
  const tuning = arrowTuning[params.arrowType];
  const headshot = params.limb === "head";
  return {
    actorId: params.actorId,
    sourceActorId: params.sourceActorId,
    limb: params.limb,
    arrowType: params.arrowType,
    position: params.position,
    damage: headshot ? 200 : tuning.damage * damageMultiplierForLimb(params.limb),
    impulse: headshot ? tuning.impulse * 1.6 : tuning.impulse,
    headshot,
  };
}
