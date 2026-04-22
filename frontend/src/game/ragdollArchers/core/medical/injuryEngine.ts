import type { HitPayload, Injury } from "@/game/ragdollArchers/core/types";

export function evaluateInjury(hitPayload: HitPayload): Injury[] {
  const injuries: Injury[] = [];

  if (hitPayload.bodyPart === "head") {
    injuries.push({
      id: crypto.randomUUID(),
      type: "concussion",
      severity: hitPayload.force > 8 ? "critical" : "severe",
      bodyPart: "head",
      effects: { aimPenalty: 0.4, staminaDrain: 0.2 },
    });
  }

  if (hitPayload.bodyPart === "chest") {
    injuries.push({
      id: crypto.randomUUID(),
      type: "organ",
      severity: hitPayload.penetrationDepth > 0.5 ? "critical" : "severe",
      bodyPart: "chest",
      effects: { healthDrain: 0.5 },
    });
  }

  if (hitPayload.bodyPart === "leg") {
    injuries.push({
      id: crypto.randomUUID(),
      type: "fracture",
      severity: "moderate",
      bodyPart: "leg",
      effects: { movementPenalty: 0.5 },
    });
  }

  injuries.push({
    id: crypto.randomUUID(),
    type: "bleeding",
    severity: "moderate",
    bodyPart: hitPayload.bodyPart,
    effects: { healthDrain: 0.1 },
  });

  return injuries;
}
