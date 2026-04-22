// Legacy prototype runtime. The live game now runs through phaseOneStore + EnvironmentCanvas.
"use client";

import { create } from "zustand";
import type { ActorRuntime, AlertTier, CameraMode, CareerRecord, DisguiseId, MissionEvent, ScoreState, SolutionType, Vec3, WorldSnapshot } from "@/game/core/types";
import { loadCareer } from "@/game/systems/career";

interface SandboxState {
  world: WorldSnapshot | null;
  connectionState: "connecting" | "connected" | "disconnected";
  cameraMode: CameraMode;
  playerPosition: Vec3;
  playerBehavior: "idle" | "walk" | "run" | "dragging_body" | "illegal_action";
  activeZoneId: string;
  disguise: DisguiseId;
  alertTier: AlertTier;
  suspicion: number;
  missionPhase: "planning" | "infiltration" | "target_down" | "exfiltration" | "complete";
  actors: ActorRuntime[];
  inventory: { poison: boolean; coins: number; wrench: boolean; keycard: boolean };
  opportunities: {
    poisonPrepared: boolean;
    transformerSabotaged: boolean;
    targetEliminated: boolean;
    extractionReady: boolean;
    solution: SolutionType | null;
  };
  score: ScoreState;
  career: CareerRecord;
  activePrompt: string;
  bodyFound: boolean;
  distractionPoint: Vec3 | null;
  searchOrigin: Vec3 | null;
  eventLog: MissionEvent[];
  setWorld: (world: WorldSnapshot) => void;
  setConnectionState: (state: SandboxState["connectionState"]) => void;
  setCameraMode: (mode: CameraMode) => void;
  setPlayerPosition: (position: Vec3) => void;
  setPlayerBehavior: (behavior: SandboxState["playerBehavior"]) => void;
  setActiveZoneId: (zoneId: string) => void;
  setDisguise: (disguise: DisguiseId) => void;
  setAlertTier: (tier: AlertTier) => void;
  addSuspicion: (delta: number) => void;
  decaySuspicion: (delta: number) => void;
  setActors: (actors: ActorRuntime[]) => void;
  setActivePrompt: (prompt: string) => void;
  setMissionPhase: (phase: SandboxState["missionPhase"]) => void;
  useCoin: (point: Vec3) => void;
  raiseSearch: (point: Vec3 | null) => void;
  hideEvidence: () => void;
  pushEvent: (text: string, severity?: MissionEvent["severity"]) => void;
  preparePoison: () => void;
  sabotageTransformer: () => void;
  eliminateTarget: (solution: SolutionType) => void;
  markExtractionReady: () => void;
  setBodyFound: (found: boolean) => void;
  finalizeRun: (result: { score: number; rating: string }) => void;
}

export const useSandboxStore = create<SandboxState>((set) => ({
  world: null,
  connectionState: "connecting",
  cameraMode: "third_person",
  playerPosition: [0, 1, 46],
  playerBehavior: "idle",
  activeZoneId: "tram-exit",
  disguise: "civilian",
  alertTier: "calm",
  suspicion: 0,
  missionPhase: "planning",
  actors: [],
  inventory: { poison: true, coins: 2, wrench: true, keycard: false },
  opportunities: { poisonPrepared: false, transformerSabotaged: false, targetEliminated: false, extractionReady: false, solution: null },
  score: {
    suspicionPeak: 0,
    alarmsTriggered: 0,
    bodiesFound: 0,
    witnessedActions: 0,
    nonTargetCasualties: 0,
    disguiseBreaks: 0,
    disguisesUsed: 1,
    evidenceLeftBehind: 0,
    objectivesCompleted: 0,
    startTime: Date.now(),
    finishTime: null,
  },
  career: loadCareer(),
  activePrompt: "Survey the district, choose a cover identity, and find an opening.",
  bodyFound: false,
  distractionPoint: null,
  searchOrigin: null,
  eventLog: [
    {
      id: "mission-boot",
      text: "District infiltration window opened. Blend into worker traffic or push through service routes.",
      severity: "info",
      timestamp: Date.now(),
    },
  ],
  setWorld: (world) => set({ world }),
  setConnectionState: (connectionState) => set({ connectionState }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setPlayerPosition: (playerPosition) => set({ playerPosition }),
  setPlayerBehavior: (playerBehavior) => set({ playerBehavior }),
  setActiveZoneId: (activeZoneId) => set({ activeZoneId }),
  setDisguise: (disguise) =>
    set((state) => ({
      disguise,
      score: {
        ...state.score,
        disguiseBreaks: state.disguise === disguise ? state.score.disguiseBreaks : state.score.disguiseBreaks + 1,
      },
    })),
  setAlertTier: (alertTier) => set({ alertTier }),
  addSuspicion: (delta) =>
    set((state) => {
      const suspicion = Math.min(100, state.suspicion + delta);
      return { suspicion, score: { ...state.score, suspicionPeak: Math.max(state.score.suspicionPeak, suspicion) } };
    }),
  decaySuspicion: (delta) => set((state) => ({ suspicion: Math.max(0, state.suspicion - delta) })),
  setActors: (actors) => set({ actors }),
  setActivePrompt: (activePrompt) => set({ activePrompt }),
  setMissionPhase: (missionPhase) => set({ missionPhase }),
  useCoin: (point) => set((state) => ({ distractionPoint: point, inventory: { ...state.inventory, coins: Math.max(0, state.inventory.coins - 1) } })),
  raiseSearch: (searchOrigin) => set({ searchOrigin }),
  pushEvent: (text, severity = "info") =>
    set((state) => ({
      eventLog: [{ id: `${Date.now()}-${state.eventLog.length}`, text, severity, timestamp: Date.now() }, ...state.eventLog].slice(0, 8),
    })),
  hideEvidence: () =>
    set((state) => ({
      bodyFound: false,
      searchOrigin: null,
      activePrompt: "Evidence concealed. The district is still uneasy, but immediate search pressure has eased.",
      eventLog: [
        {
          id: `${Date.now()}-${state.eventLog.length}`,
          text: "Evidence was concealed before patrols could lock onto the scene.",
          severity: "info" as const,
          timestamp: Date.now(),
        },
        ...state.eventLog,
      ].slice(0, 8),
      score: { ...state.score, objectivesCompleted: state.score.objectivesCompleted + 1, bodiesFound: Math.max(0, state.score.bodiesFound - 1) },
    })),
  preparePoison: () =>
    set((state) => ({
      inventory: { ...state.inventory, poison: false },
      opportunities: { ...state.opportunities, poisonPrepared: true },
      activePrompt: "The poison is in place. Stay clear until the target returns to the annex.",
      eventLog: [
        {
          id: `${Date.now()}-${state.eventLog.length}`,
          text: "Tea service contaminated. The poison route is now live.",
          severity: "warning" as const,
          timestamp: Date.now(),
        },
        ...state.eventLog,
      ].slice(0, 8),
      score: { ...state.score, objectivesCompleted: state.score.objectivesCompleted + 1 },
    })),
  sabotageTransformer: () =>
    set((state) => ({
      inventory: { ...state.inventory, wrench: false },
      opportunities: { ...state.opportunities, transformerSabotaged: true },
      activePrompt: "The transformer is primed. The balcony review is now a live environmental opportunity.",
      eventLog: [
        {
          id: `${Date.now()}-${state.eventLog.length}`,
          text: "Transformer bank destabilized. Balcony review is now vulnerable to a staged failure.",
          severity: "warning" as const,
          timestamp: Date.now(),
        },
        ...state.eventLog,
      ].slice(0, 8),
      score: { ...state.score, objectivesCompleted: state.score.objectivesCompleted + 1 },
    })),
  eliminateTarget: (solution) =>
    set((state) => ({
      missionPhase: "target_down",
      opportunities: { ...state.opportunities, targetEliminated: true, extractionReady: true, solution },
      activePrompt: "Target neutralized. Break line of sight and reach the tram exit.",
      eventLog: [
        {
          id: `${Date.now()}-${state.eventLog.length}`,
          text: `Primary target eliminated via ${solution}. Inner security cordon is destabilizing.`,
          severity: "critical" as const,
          timestamp: Date.now(),
        },
        ...state.eventLog,
      ].slice(0, 8),
      score: { ...state.score, objectivesCompleted: state.score.objectivesCompleted + 2 },
    })),
  markExtractionReady: () => set((state) => ({ opportunities: { ...state.opportunities, extractionReady: true } })),
  setBodyFound: (bodyFound) => set((state) => ({ bodyFound, score: { ...state.score, bodiesFound: bodyFound ? state.score.bodiesFound + 1 : state.score.bodiesFound } })),
  finalizeRun: (result) => set((state) => ({ missionPhase: "complete", score: { ...state.score, finishTime: Date.now(), score: result.score, rating: result.rating }, career: state.career })),
}));
