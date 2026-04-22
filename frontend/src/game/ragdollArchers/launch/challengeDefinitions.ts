import type { ChallengeDefinition } from "@/game/ragdollArchers/core/types";

export const challengeDefinitions: ChallengeDefinition[] = [
  {
    id: "no-treatment-run",
    label: "No-Treatment Run",
    description: "No field treatment. Stay mobile, land clean shots, and end fights before the body gives out.",
    baseMode: "firstperson",
    starterFriendly: false,
    intensity: "high",
    recommendedLabel: "Pure pressure",
    modifiers: {
      disableTreatment: true,
      oxygenMultiplier: 0.9,
    },
  },
  {
    id: "one-arrow-survival",
    label: "One Arrow Survival",
    description: "One arrow, one chance. Miss and the duel becomes a desperate scramble.",
    baseMode: "duel",
    starterFriendly: true,
    intensity: "medium",
    recommendedLabel: "Best first challenge",
    modifiers: {
      ammoOverride: {
        standard: 1,
        heavy: 0,
        explosive: 0,
        light: 0,
      },
    },
  },
  {
    id: "critical-start",
    label: "Critical Start",
    description: "Open hurt but not doomed. Stabilize fast, then turn the fight back in your favor.",
    baseMode: "firstperson",
    starterFriendly: false,
    intensity: "high",
    recommendedLabel: "Recovery story",
    modifiers: {
      startCritical: true,
      oxygenMultiplier: 0.88,
    },
  },
  {
    id: "low-oxygen-arena",
    label: "Low Oxygen Arena",
    description: "Thin air punishes overexertion. Sprint less, aim cleaner, and pick your bursts.",
    baseMode: "firstperson",
    starterFriendly: true,
    intensity: "medium",
    recommendedLabel: "Control your pace",
    modifiers: {
      oxygenMultiplier: 0.78,
    },
  },
  {
    id: "stimulant-crash-mode",
    label: "Stimulant Crash Mode",
    description: "Open with a burst of speed and focus, then survive the ugly crash that follows.",
    baseMode: "firstperson",
    starterFriendly: false,
    intensity: "high",
    recommendedLabel: "Boom then collapse",
    modifiers: {
      triggerStimulantCrash: true,
      oxygenMultiplier: 0.92,
    },
  },
  {
    id: "totem-last-chance",
    label: "Totem Last Chance",
    description: "One undying lifeline buys a comeback window. Waste it and the arena ends you quickly.",
    baseMode: "duel",
    starterFriendly: true,
    intensity: "medium",
    recommendedLabel: "Clutch comeback",
    modifiers: {
      grantTotem: true,
    },
  },
];

export function getChallengeDefinition(challengeId: string | null | undefined) {
  return challengeDefinitions.find((entry) => entry.id === challengeId) || null;
}
