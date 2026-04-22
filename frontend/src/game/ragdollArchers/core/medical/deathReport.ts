import type { Injury } from "@/game/ragdollArchers/core/types";

export function generateDeathReport(injuries: Injury[]) {
  const fatal = injuries.find((injury) => injury.severity === "critical");

  return {
    primaryCause: fatal?.type || "unknown",
    totalInjuries: injuries.length,
    preventable: injuries.length > 0,
  };
}
