"use client";

import { create } from "zustand";

const disguiseRank = {
  civilian: 0,
  vanguard_grunt: 1,
  vanguard_technician: 2,
  vanguard_officer: 3,
};

const npcAffinity = {
  civilian: "civilian",
  technician: "vanguard_technician",
  officer: "vanguard_officer",
  enforcer: "vanguard_officer",
};

const actionPenalty = {
  idle: 0,
  walk: 1,
  run: 18,
  sneak: 3,
  restricted_area: 40,
  trespass: 40,
  brandish_weapon: 55,
};

export function checkSuspicion(playerDisguise, npcType, playerAction = "idle", context = {}) {
  const actionScore = actionPenalty[playerAction] ?? 10;
  const expectedDisguise = npcAffinity[npcType];
  const zonePenalty =
    context.allowedDisguises && !context.allowedDisguises.includes(playerDisguise)
      ? context.zonePenalty ?? 28
      : 0;
  const witnessMultiplier = context.witnessWeight ?? 1;
  let suspicion = 8;

  if (playerDisguise === expectedDisguise) {
    suspicion = 1;
  } else if (npcType === "civilian" && playerDisguise === "civilian") {
    suspicion = 2;
  } else if (npcType === "technician" && playerDisguise === "vanguard_grunt") {
    suspicion = 12;
  } else if (npcType === "officer" && playerDisguise === "vanguard_technician") {
    suspicion = 18;
  } else if (npcType === "enforcer" && (disguiseRank[playerDisguise] ?? 0) < disguiseRank.vanguard_officer) {
    suspicion = 25;
  } else if ((disguiseRank[playerDisguise] ?? 0) < (disguiseRank[expectedDisguise] ?? 0)) {
    suspicion = 16;
  }

  if (playerAction === "run" && playerDisguise === "vanguard_officer") {
    suspicion += 22;
  }

  if (context.distance && context.distance < 3.5) {
    suspicion += 6;
  }

  return Math.max(0, Math.min(100, Math.round((suspicion + actionScore + zonePenalty) * witnessMultiplier)));
}

export const useSuspicionStore = create((set) => ({
  suspicion: 0,
  gameOver: false,
  setSuspicion: (value) =>
    set(() => {
      const suspicion = Math.max(0, Math.min(100, value));
      return {
        suspicion,
        gameOver: suspicion >= 100,
      };
    }),
  addSuspicion: (delta) =>
    set((state) => {
      const suspicion = Math.max(0, Math.min(100, state.suspicion + delta));
      return {
        suspicion,
        gameOver: suspicion >= 100,
      };
    }),
  bleedSuspicion: (delta = 2) =>
    set((state) => {
      const suspicion = Math.max(0, state.suspicion - delta);
      return {
        suspicion,
        gameOver: suspicion >= 100,
      };
    }),
  resetSuspicion: () =>
    set({
      suspicion: 0,
      gameOver: false,
    }),
}));
