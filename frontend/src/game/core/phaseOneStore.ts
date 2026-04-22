"use client";

import { create } from "zustand";
import type {
  AccessState,
  AiActorRuntime,
  CameraMode,
  DangerZone,
  DominantRiskSource,
  DisguiseId,
  IncidentRecord,
  InteractableDefinition,
  MissionProgressState,
  MissionPressureState,
  MissionEvent,
  PhaseOneBounds,
  PhaseOneGateState,
  PhaseOneStructure,
  PhaseOneZone,
  PlayerPosture,
  SuspicionChannels,
  StealthState,
  StimulusEvent,
  Vec3,
  WatcherDefinition,
  WatcherExposureState,
} from "@/game/core/types";
import { foundationShell } from "@/game/data/foundationShell";

interface PhaseOneState {
  cameraMode: CameraMode;
  playerPosition: Vec3;
  playerFacing: number;
  playerVelocity: Vec3;
  currentZoneId: string;
  hoveredInteractableId: string | null;
  prompt: string;
  interactionLog: string[];
  gateStates: Record<string, PhaseOneGateState>;
  environmentReady: boolean;
  activeDisguiseId: DisguiseId;
  posture: PlayerPosture;
  carriedBodyId: string | null;
  suspicion: number;
  stealthState: StealthState;
  accessState: AccessState;
  trespassExposure: number;
  activeWatcherIds: string[];
  suspicionChannels: SuspicionChannels;
  watcherExposure: Record<string, WatcherExposureState>;
  dominantRiskSource: DominantRiskSource;
  coverInstabilityUntil: number | null;
  lastStealthEvents: MissionEvent[];
  recentIllegalAction: string | null;
  recentIllegalActionAt: number | null;
  sabotageFlags: Record<string, boolean>;
  aiActors: AiActorRuntime[];
  globalAlertLevel: number;
  activeStimuli: StimulusEvent[];
  activeIncidents: IncidentRecord[];
  dangerZones: DangerZone[];
  guardResponseAssignments: { actorId: string; incidentId: string; role: "lead" | "support" | "perimeter" | "report" | "flee" | "protect" | "none" }[];
  targetWindowState: "guarded" | "vulnerable" | "relocating";
  searchAssignments: { actorId: string; routeId: string; target: Vec3 }[];
  missionPressure: MissionPressureState;
  aiDebug: boolean;
  mission: MissionProgressState;
  missionStartTime: number;
  setCameraMode: (mode: CameraMode) => void;
  setPlayerTransform: (position: Vec3, facing: number, velocity: Vec3) => void;
  setCurrentZoneId: (zoneId: string) => void;
  setHoveredInteractableId: (id: string | null) => void;
  pushLog: (message: string) => void;
  setPrompt: (prompt: string) => void;
  toggleGate: (gateId: string) => boolean;
  initializeEnvironment: () => void;
  setDisguise: (disguiseId: DisguiseId) => void;
  setPosture: (posture: PlayerPosture) => void;
  toggleCarryBody: (bodyId: string) => boolean;
  setSuspicion: (value: number) => void;
  setStealthState: (state: StealthState) => void;
  setAccessState: (state: AccessState) => void;
  setTrespassExposure: (value: number) => void;
  setActiveWatcherIds: (ids: string[]) => void;
  setSuspicionChannels: (channels: SuspicionChannels) => void;
  setWatcherExposure: (exposure: Record<string, WatcherExposureState>) => void;
  setDominantRiskSource: (source: DominantRiskSource) => void;
  pushStealthEvent: (text: string, severity?: MissionEvent["severity"], key?: string) => void;
  markIllegalAction: (action: string) => void;
  markSabotage: (sabotageId: string) => void;
  setAiActors: (actors: AiActorRuntime[]) => void;
  setGlobalAlertLevel: (level: number) => void;
  setActiveStimuli: (stimuli: StimulusEvent[]) => void;
  setActiveIncidents: (incidents: IncidentRecord[]) => void;
  setDangerZones: (zones: DangerZone[]) => void;
  setGuardResponseAssignments: (assignments: { actorId: string; incidentId: string; role: "lead" | "support" | "perimeter" | "report" | "flee" | "protect" | "none" }[]) => void;
  setTargetWindowState: (state: "guarded" | "vulnerable" | "relocating") => void;
  setSearchAssignments: (assignments: { actorId: string; routeId: string; target: Vec3 }[]) => void;
  setMissionPressure: (pressure: MissionPressureState) => void;
  toggleAiDebug: () => void;
  acquirePoison: () => void;
  preparePoison: () => boolean;
  armAccident: () => void;
  completeSecondaryObjective: () => void;
  unlockRoute: (routeId: "annex" | "basement" | "terrace") => void;
  queueTargetDetour: (detour: "none" | "annex_inspection" | "ballroom_recovery" | "vip_fallback") => void;
  splitEscort: (split: "none" | "annex" | "service" | "security") => void;
  advanceSecondaryObjective: (source: "security_hub" | "annex_transfer") => void;
  eliminateTarget: (solution: "social" | "poison" | "environmental") => void;
  noteAlarmTriggered: () => void;
  noteBodyFound: () => void;
  noteNonTargetCasualty: (count?: number) => void;
  noteEvidenceLeft: (count?: number) => void;
  stashBody: () => boolean;
  completeExtraction: (result: {
    score: number;
    rating: string;
    durationSeconds: number;
    breakdown: { label: string; value: number; kind: "bonus" | "penalty" | "neutral" }[];
    challenges: string[];
  }) => boolean;
  setStoryAftermath: (summary: MissionProgressState["storyAftermath"]) => void;
  noteMoment: (moment: MissionProgressState["notableMoments"][number]) => void;
}

function createGateMap() {
  return foundationShell.gates.reduce<Record<string, PhaseOneGateState>>((map, gate) => {
    map[gate.id] = { ...gate };
    return map;
  }, {});
}

function initialStealthEvent(text: string): MissionEvent {
  return {
    id: "phase-two-boot",
    text,
    severity: "info",
    timestamp: Date.now(),
  };
}

export const usePhaseOneStore = create<PhaseOneState>((set) => ({
  cameraMode: "third_person",
  playerPosition: foundationShell.spawn.position,
  playerFacing: foundationShell.spawn.facing,
  playerVelocity: [0, 0, 0],
  currentZoneId: foundationShell.zones[0]?.id || "checkpoint-boulevard",
  hoveredInteractableId: null,
  prompt: "Move through the district and use nearby interaction points to test traversal and context actions.",
  interactionLog: ["Phase 2 shell booted. Stealth systems, access rules, and watcher detection are now active."],
  gateStates: createGateMap(),
  environmentReady: false,
  activeDisguiseId: "civilian",
  posture: "stand",
  carriedBodyId: null,
  suspicion: 0,
  stealthState: "clear",
  accessState: "legal",
  trespassExposure: 0,
  activeWatcherIds: [],
  suspicionChannels: { trespass: 0, exposure: 0, behavior: 0, enforcer: 0, recentCrime: 0 },
  watcherExposure: {},
  dominantRiskSource: "none",
  coverInstabilityUntil: null,
  lastStealthEvents: [initialStealthEvent("Stealth runtime online. Civilian cover is active by default.")],
  recentIllegalAction: null,
  recentIllegalActionAt: null,
  sabotageFlags: {},
  aiActors: [],
  globalAlertLevel: 0,
  activeStimuli: [],
  activeIncidents: [],
  dangerZones: [],
  guardResponseAssignments: [],
  targetWindowState: "guarded",
  searchAssignments: [],
  missionPressure: {
    annexPressure: false,
    ballroomPressure: false,
    securityPressure: false,
    targetProtection: "routine",
    extractionRisk: "low",
    activeLeadIncidentId: null,
  },
  aiDebug: false,
  mission: {
    hasPoison: false,
    poisonPrepared: false,
    accidentArmed: false,
    secondaryObjectiveComplete: false,
    secondaryObjectiveSource: null,
    targetEliminated: false,
    extractionReady: false,
    missionComplete: false,
    hiddenBodies: 0,
    solution: null,
    resultScore: null,
    resultRating: null,
    activeDetour: "none",
    escortSplit: "none",
    unlockedRoutes: { annex: false, basement: false, terrace: false },
    reserveRelocated: false,
    alternateIntelRouteUsed: false,
    suspicionPeak: 0,
    alarmsTriggered: 0,
    bodiesFound: 0,
    nonTargetCasualties: 0,
    disguisesUsed: ["civilian"],
    evidenceLeftBehind: 0,
    completedChallenges: [],
    scoreBreakdown: [],
    durationSeconds: null,
    storyAftermath: null,
    notableMoments: [],
  },
  missionStartTime: Date.now(),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setPlayerTransform: (playerPosition, playerFacing, playerVelocity) => set({ playerPosition, playerFacing, playerVelocity }),
  setCurrentZoneId: (currentZoneId) => set({ currentZoneId }),
  setHoveredInteractableId: (hoveredInteractableId) => set({ hoveredInteractableId }),
  pushLog: (message) => set((state) => ({ interactionLog: [message, ...state.interactionLog].slice(0, 8) })),
  setPrompt: (prompt) => set({ prompt }),
  toggleGate: (gateId) => {
    let nextOpen = false;
    set((state) => {
      const current = state.gateStates[gateId];
      if (!current) return state;
      nextOpen = !current.open;
      return {
        gateStates: {
          ...state.gateStates,
          [gateId]: {
            ...current,
            open: nextOpen,
          },
        },
      };
    });
    return nextOpen;
  },
  initializeEnvironment: () => set({ environmentReady: true, gateStates: createGateMap() }),
  setDisguise: (activeDisguiseId) =>
    set((state) => ({
      activeDisguiseId,
      coverInstabilityUntil: Date.now() + 1750,
      mission: {
        ...state.mission,
        disguisesUsed: state.mission.disguisesUsed.includes(activeDisguiseId)
          ? state.mission.disguisesUsed
          : [...state.mission.disguisesUsed, activeDisguiseId],
      },
      lastStealthEvents: [
        { id: `event-${Date.now()}`, text: `Disguise changed to ${activeDisguiseId}.`, severity: "info" as const, timestamp: Date.now() },
        ...state.lastStealthEvents,
      ].slice(0, 8),
    })),
  setPosture: (posture) => set({ posture }),
  toggleCarryBody: (bodyId) => {
    let carrying = false;
    set((state) => {
      carrying = state.carriedBodyId !== bodyId;
      return { carriedBodyId: carrying ? bodyId : null, posture: carrying ? "dragging" : "stand" };
    });
    return carrying;
  },
  setSuspicion: (suspicion) =>
    set((state) => {
      const clamped = Math.max(0, Math.min(100, suspicion));
      return {
        suspicion: clamped,
        mission: {
          ...state.mission,
          suspicionPeak: Math.max(state.mission.suspicionPeak, clamped),
        },
      };
    }),
  setStealthState: (stealthState) => set({ stealthState }),
  setAccessState: (accessState) => set({ accessState }),
  setTrespassExposure: (trespassExposure) => set({ trespassExposure: Math.max(0, trespassExposure) }),
  setActiveWatcherIds: (activeWatcherIds) => set({ activeWatcherIds }),
  setSuspicionChannels: (suspicionChannels) => set({ suspicionChannels }),
  setWatcherExposure: (watcherExposure) => set({ watcherExposure }),
  setDominantRiskSource: (dominantRiskSource) => set({ dominantRiskSource }),
  pushStealthEvent: (text, severity = "info", key) =>
    set((state) => {
      const latest = state.lastStealthEvents[0];
      if (latest && latest.text === text && Date.now() - latest.timestamp < 1500 && key) {
        return state;
      }
      return {
        lastStealthEvents: [{ id: key || `event-${Date.now()}`, text, severity: severity as MissionEvent["severity"], timestamp: Date.now() }, ...state.lastStealthEvents].slice(0, 8),
      };
    }),
  markIllegalAction: (recentIllegalAction) => set({ recentIllegalAction, recentIllegalActionAt: Date.now() }),
  markSabotage: (sabotageId) =>
    set((state) => ({
      sabotageFlags: { ...state.sabotageFlags, [sabotageId]: true },
      recentIllegalAction: "sabotage",
      recentIllegalActionAt: Date.now(),
      mission: {
        ...state.mission,
        evidenceLeftBehind: state.sabotageFlags[sabotageId] ? state.mission.evidenceLeftBehind : state.mission.evidenceLeftBehind + 1,
      },
      suspicionChannels: {
        ...state.suspicionChannels,
        recentCrime: Math.min(100, state.suspicionChannels.recentCrime + 22),
      },
    })),
  setAiActors: (aiActors) => set({ aiActors }),
  setGlobalAlertLevel: (globalAlertLevel) => set({ globalAlertLevel }),
  setActiveStimuli: (activeStimuli) => set({ activeStimuli }),
  setActiveIncidents: (activeIncidents) => set({ activeIncidents }),
  setDangerZones: (dangerZones) => set({ dangerZones }),
  setGuardResponseAssignments: (guardResponseAssignments) => set({ guardResponseAssignments }),
  setTargetWindowState: (targetWindowState) => set({ targetWindowState }),
  setSearchAssignments: (searchAssignments) => set({ searchAssignments }),
  setMissionPressure: (missionPressure) => set({ missionPressure }),
  toggleAiDebug: () => set((state) => ({ aiDebug: !state.aiDebug })),
  acquirePoison: () =>
    set((state) => ({
      mission: { ...state.mission, hasPoison: true },
      interactionLog: ["Fast-acting toxin acquired from housekeeping supply.", ...state.interactionLog].slice(0, 8),
    })),
  preparePoison: () => {
    let prepared = false;
    set((state) => {
      if (!state.mission.hasPoison || state.mission.poisonPrepared) return state;
      prepared = true;
      return {
        mission: { ...state.mission, hasPoison: false, poisonPrepared: true },
      };
    });
    return prepared;
  },
  armAccident: () =>
    set((state) => ({
      mission: { ...state.mission, accidentArmed: true },
    })),
  completeSecondaryObjective: () =>
    set((state) => ({
      mission: {
        ...state.mission,
        secondaryObjectiveComplete: true,
        secondaryObjectiveSource: "security_hub",
        evidenceLeftBehind: state.mission.evidenceLeftBehind + 1,
      },
    })),
  unlockRoute: (routeId) =>
    set((state) => ({
      mission: {
        ...state.mission,
        unlockedRoutes: {
          ...state.mission.unlockedRoutes,
          [routeId]: true,
        },
      },
    })),
  queueTargetDetour: (detour) =>
    set((state) => ({
      mission: {
        ...state.mission,
        activeDetour: detour,
        reserveRelocated: detour === "annex_inspection" ? true : state.mission.reserveRelocated,
      },
    })),
  splitEscort: (split) =>
    set((state) => ({
      mission: {
        ...state.mission,
        escortSplit: split,
      },
    })),
  advanceSecondaryObjective: (source) =>
    set((state) => ({
      mission: {
        ...state.mission,
        secondaryObjectiveComplete: true,
        secondaryObjectiveSource: source,
        alternateIntelRouteUsed: source === "annex_transfer" ? true : state.mission.alternateIntelRouteUsed,
        evidenceLeftBehind: source === "security_hub" ? state.mission.evidenceLeftBehind + 1 : state.mission.evidenceLeftBehind,
      },
    })),
  eliminateTarget: (solution) =>
    set((state) => ({
      mission: {
        ...state.mission,
        targetEliminated: true,
        extractionReady: true,
        solution,
        evidenceLeftBehind:
          state.mission.evidenceLeftBehind +
          (solution === "environmental" ? 2 : solution === "social" ? 1 : 0),
        nonTargetCasualties:
          state.mission.nonTargetCasualties + (solution === "environmental" ? 1 : 0),
      },
      globalAlertLevel: Math.max(state.globalAlertLevel, 2.2),
      aiActors: state.aiActors.map((actor) => {
        if (actor.id === "target-voss") {
          return {
            ...actor,
            state: "down",
            hidden: false,
            alertLevel: 4,
            currentIncidentId: `target-down-${Date.now()}`,
          };
        }
        if (actor.role === "bodyguard") {
          return {
            ...actor,
            state: "alerted",
            alertLevel: Math.max(actor.alertLevel, 3.2),
            investigateTarget: state.aiActors.find((entry) => entry.id === "target-voss")?.position || actor.investigateTarget,
            searchTarget: state.aiActors.find((entry) => entry.id === "target-voss")?.position || actor.searchTarget,
            responseRole: "protect",
          };
        }
        if (actor.role === "guard") {
          return {
            ...actor,
            alertLevel: Math.max(actor.alertLevel, 1.8),
          };
        }
        return actor;
      }),
    })),
  stashBody: () => {
    let success = false;
    set((state) => {
      if (!state.carriedBodyId) return state;
      success = true;
      return {
        carriedBodyId: null,
        posture: "stand",
        mission: {
          ...state.mission,
          hiddenBodies: state.mission.hiddenBodies + 1,
          evidenceLeftBehind: Math.max(0, state.mission.evidenceLeftBehind - 1),
        },
      };
    });
    return success;
  },
  noteAlarmTriggered: () =>
    set((state) => ({
      mission: {
        ...state.mission,
        alarmsTriggered: state.mission.alarmsTriggered + 1,
      },
    })),
  noteBodyFound: () =>
    set((state) => ({
      mission: {
        ...state.mission,
        bodiesFound: state.mission.bodiesFound + 1,
        evidenceLeftBehind: state.mission.evidenceLeftBehind + 1,
      },
    })),
  noteNonTargetCasualty: (count = 1) =>
    set((state) => ({
      mission: {
        ...state.mission,
        nonTargetCasualties: state.mission.nonTargetCasualties + count,
      },
    })),
  noteEvidenceLeft: (count = 1) =>
    set((state) => ({
      mission: {
        ...state.mission,
        evidenceLeftBehind: state.mission.evidenceLeftBehind + count,
      },
    })),
  completeExtraction: (result) => {
    let success = false;
    set((state) => {
      if (!state.mission.targetEliminated || state.mission.missionComplete) return state;
      success = true;
      return {
        mission: {
          ...state.mission,
          missionComplete: true,
          resultScore: result.score,
          resultRating: result.rating,
          scoreBreakdown: result.breakdown,
          completedChallenges: result.challenges,
          durationSeconds: result.durationSeconds,
        },
      };
    });
    return success;
  },
  setStoryAftermath: (storyAftermath) =>
    set((state) => ({
      mission: {
        ...state.mission,
        storyAftermath,
      },
    })),
  noteMoment: (moment) =>
    set((state) => {
      if (state.mission.notableMoments.some((entry) => entry.id === moment.id)) return state;
      return {
        mission: {
          ...state.mission,
          notableMoments: [moment, ...state.mission.notableMoments].slice(0, 8),
          completedChallenges: state.mission.completedChallenges.includes(moment.type)
            ? state.mission.completedChallenges
            : [moment.type, ...state.mission.completedChallenges].slice(0, 10),
        },
        lastStealthEvents: [{ id: moment.id, text: `${moment.label}. ${moment.summary}`, severity: moment.severity, timestamp: Date.now() }, ...state.lastStealthEvents].slice(0, 8),
      };
    }),
}));

export function selectCurrentZone(zones: PhaseOneZone[], zoneId: string) {
  return zones.find((zone) => zone.id === zoneId) || null;
}

export function selectHoveredInteractable(interactables: InteractableDefinition[], hoveredId: string | null) {
  return interactables.find((interactable) => interactable.id === hoveredId) || null;
}

export function collectActiveBlockers(bounds: PhaseOneBounds[], structures: PhaseOneStructure[], gateStates: Record<string, PhaseOneGateState>) {
  const gateBounds = Object.values(gateStates)
    .filter((gate) => !gate.open)
    .map((gate) => gate.bounds);

  return [...bounds, ...structures.filter((structure) => structure.solid).map((structure) => structure.bounds), ...gateBounds];
}

export function selectActiveWatchers(watchers: WatcherDefinition[], ids: string[]) {
  return watchers.filter((watcher) => ids.includes(watcher.id));
}
