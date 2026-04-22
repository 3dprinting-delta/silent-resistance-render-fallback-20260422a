import type { DerivedVitals, InjuryEffectModifiers, InjuryRecord } from "@/game/ragdollArchers/core/types";
import { clamp } from "@/game/ragdollArchers/systems/math";

const MAX_MOVEMENT_PENALTY = 0.72;
const MAX_AIM_PENALTY = 0.68;
const MAX_HEALTH_DRAIN_PER_SECOND = 8.5;
const MAX_STAMINA_DRAIN_PER_SECOND = 16;

export function applyInjuryEffects(params: {
  injuries: InjuryRecord[];
  derivedVitals: DerivedVitals;
  sprinting: boolean;
  deltaTime: number;
}) {
  let healthDrainPerSecond = 0;
  let staminaDrainPerSecond = 0;
  let aimPenalty = 0;
  let movementPenalty = 0;

  params.injuries.forEach((injury) => {
    const treatmentMultiplier = injury.treated ? 0.2 : injury.stabilized ? 0.55 : 1;
    const criticalMultiplier = injury.severity === "critical" ? 1.28 : injury.severity === "severe" ? 1.08 : 1;

    healthDrainPerSecond += injury.bleedingRate * 0.22 * treatmentMultiplier * criticalMultiplier;
    staminaDrainPerSecond += injury.staminaPenalty * 0.08 * treatmentMultiplier;
    aimPenalty += injury.aimPenalty * treatmentMultiplier;
    movementPenalty += injury.mobilityPenalty * treatmentMultiplier;

    if ((injury.bodyRegion === "chest" || injury.category === "collapsed-lung") && !injury.treated) {
      staminaDrainPerSecond += 1.6 * criticalMultiplier;
    }
    if (params.sprinting && injury.bodyRegion.includes("Leg") && !injury.treated) {
      movementPenalty += 0.05 * criticalMultiplier;
      staminaDrainPerSecond += 1.2;
    }
    if (injury.category === "concussion" && !injury.treated) {
      aimPenalty += 0.06;
    }
  });

  aimPenalty += params.derivedVitals.painLoad * 0.18 + (1 - params.derivedVitals.breathingCapacity) * 0.04;
  movementPenalty += params.derivedVitals.shockRisk * 0.18 + params.derivedVitals.bloodLossLevel * 0.1;
  staminaDrainPerSecond += params.derivedVitals.bloodLossLevel * 5 + (1 - params.derivedVitals.breathingCapacity) * 4;

  const modifiers: InjuryEffectModifiers = {
    healthDrainPerSecond: clamp(healthDrainPerSecond, 0, MAX_HEALTH_DRAIN_PER_SECOND),
    staminaDrainPerSecond: clamp(staminaDrainPerSecond, 0, MAX_STAMINA_DRAIN_PER_SECOND),
    aimPenalty: clamp(aimPenalty, 0, MAX_AIM_PENALTY),
    movementPenalty: clamp(movementPenalty, 0, MAX_MOVEMENT_PENALTY),
    warnings: {
      severeBloodLoss: params.derivedVitals.bloodLossLevel >= 0.45,
      breathingCompromised: params.derivedVitals.breathingCapacity <= 0.55,
      highPain: params.derivedVitals.painLoad >= 0.5,
      shockRiskHigh: params.derivedVitals.shockRisk >= 0.58,
    },
  };

  return {
    modifiers,
    healthDelta: modifiers.healthDrainPerSecond * params.deltaTime,
    staminaDelta: modifiers.staminaDrainPerSecond * params.deltaTime,
  };
}
