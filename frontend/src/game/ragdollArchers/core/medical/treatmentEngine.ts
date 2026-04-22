import type { Injury } from "@/game/ragdollArchers/core/types";

export function getTreatmentPlan(injuries: Injury[]) {
  const needs: Record<string, number> = {};

  injuries.forEach((injury) => {
    if (injury.type === "bleeding") {
      needs.bandage = (needs.bandage || 0) + 1;
    }
    if (injury.type === "fracture") {
      needs.splint = 1;
    }
    if (injury.type === "organ") {
      needs.medkit = 1;
    }
  });

  return needs;
}
