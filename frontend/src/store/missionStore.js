"use client";

import { create } from "zustand";
import { missionBrief } from "@/game/missionData";

export const useMissionStore = create((set) => ({
  cameraMode: "third_person",
  inputLocked: false,
  playerPosition: [0, 1.1, 43],
  currentZoneId: "tram_extraction",
  missionPhase: "infiltration",
  targetNeutralized: false,
  missionCommitted: false,
  currentDisguise: "civilian",
  playerBehavior: "idle",
  routeNote: missionBrief.routeNotes[0],
  interactionState: {
    canNeutralize: false,
    canExtract: false,
    submitting: false,
    neutralize: null,
    extract: null,
  },
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setInputLocked: (inputLocked) => set({ inputLocked }),
  setPlayerPosition: (playerPosition) => set({ playerPosition }),
  setCurrentZoneId: (currentZoneId) => set({ currentZoneId }),
  setMissionPhase: (missionPhase) => set({ missionPhase }),
  setCurrentDisguise: (currentDisguise) => set({ currentDisguise }),
  setPlayerBehavior: (playerBehavior) => set({ playerBehavior }),
  setRouteNote: (routeNote) => set({ routeNote }),
  markTargetNeutralized: () =>
    set({
      targetNeutralized: true,
      missionPhase: "exfiltration",
      routeNote: "Primary target is down. Break contact, avoid checkpoint convergence, and reach the tram trench.",
    }),
  markMissionCommitted: () =>
    set({
      missionCommitted: true,
      missionPhase: "complete",
      routeNote: "Mission outcome transmitted. District pressure is shifting across the shared world state.",
    }),
  resetMissionLocalState: () =>
    set({
      playerPosition: [0, 1.1, 43],
      currentZoneId: "tram_extraction",
      missionPhase: "infiltration",
      targetNeutralized: false,
      missionCommitted: false,
      currentDisguise: "civilian",
      playerBehavior: "idle",
      routeNote: missionBrief.routeNotes[0],
    }),
}));
