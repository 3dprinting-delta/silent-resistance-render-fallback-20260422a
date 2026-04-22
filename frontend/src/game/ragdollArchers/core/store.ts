"use client";

import { create } from "zustand";
import { arrowOrder, defaultAmmo } from "@/game/ragdollArchers/core/constants";
import { createDefaultProgression, parseProfileProgression, type PlayerProgression, type UpgradeId } from "@/game/ragdollArchers/core/progression";
import type {
  ActiveHighlightState,
  ActiveTreatment,
  ActorSnapshot,
  ArrowSnapshot,
  ArenaId,
  ArrowType,
  AudioEvent,
  ChallengeDefinition,
  HitFeedbackEvent,
  CinematicEvent,
  DerivedVitals,
  DifficultyId,
  GameModeId,
  GamePhase,
  HudToast,
  InjuryRecord,
  LaunchModeId,
  LaunchSettings,
  MatchMedicalSummary,
  MatchHistoryEntry,
  MatchResult,
  MatchSettings,
  MatchSnapshot,
  MedicalEvent,
  MedicalDeathReport,
  MedicalSupplyId,
  PersistedPlayerProfile,
  ReplayPresentationState,
  ReplayState,
  RagdollHudState,
  SupplyStack,
  TutorialState,
  TreatmentStatus,
} from "@/game/ragdollArchers/core/types";
import type { NetworkMatchEvent } from "@/game/ragdollArchers/network/networkTypes";
import { getChallengeDefinition } from "@/game/ragdollArchers/launch/challengeDefinitions";
import { createStarterInventory } from "@/game/ragdollArchers/systems/survival";

function toInventoryMap(supplies: SupplyStack[]) {
  return supplies.reduce<Record<string, number>>((accumulator, stack) => {
    accumulator[stack.id] = stack.quantity;
    return accumulator;
  }, {});
}

interface RagdollArchersState {
  phase: GamePhase;
  launchMode: LaunchModeId;
  settings: MatchSettings;
  launchSettings: LaunchSettings;
  actors: Record<string, ActorSnapshot>;
  arrows: ArrowSnapshot[];
  activeArrowType: ArrowType;
  match: MatchSnapshot;
  cinematic: CinematicEvent | null;
  hitFeedback: HitFeedbackEvent | null;
  result: MatchResult | null;
  deathReport: MedicalDeathReport | null;
  medicalEvents: MedicalEvent[];
  derivedVitalsByActor: Record<string, DerivedVitals>;
  networkEventQueue: NetworkMatchEvent[];
  replayState: ReplayState;
  replayPresentation: ReplayPresentationState;
  highlightState: ActiveHighlightState | null;
  streamerMode: boolean;
  activeTreatment: ActiveTreatment | null;
  medicalSummary: MatchMedicalSummary | null;
  selectedChallengeId: string | null;
  tutorial: TutorialState;
  recentResultCard: string | null;
  injuries: Record<string, InjuryRecord[]>;
  inventory: Record<string, number>;
  supplies: SupplyStack[];
  treatmentStatus: TreatmentStatus;
  hudState: RagdollHudState;
  realismMode: boolean;
  progression: PlayerProgression;
  profile: PersistedPlayerProfile | null;
  pendingSelfAction: { type: "treat" | "consume"; target: string } | null;
  toasts: HudToast[];
  audioQueue: AudioEvent[];
  beginMatch: () => void;
  setLaunchMode: (mode: LaunchModeId) => void;
  setMode: (mode: GameModeId) => void;
  setArena: (arenaId: ArenaId) => void;
  setDifficulty: (difficulty: DifficultyId) => void;
  setLaunchSettings: (settings: Partial<LaunchSettings>) => void;
  setSelectedChallengeId: (challengeId: string | null) => void;
  setTutorial: (tutorial: Partial<TutorialState>) => void;
  setReplayPresentation: (presentation: ReplayPresentationState) => void;
  setRecentResultCard: (card: string | null) => void;
  setActiveArrowType: (arrowType: ArrowType) => void;
  cycleArrowType: (direction?: 1 | -1) => void;
  setActors: (actors: Record<string, ActorSnapshot>) => void;
  setArrows: (arrows: ArrowSnapshot[]) => void;
  setMatchSnapshot: (snapshot: Partial<MatchSnapshot>) => void;
  setCinematic: (event: CinematicEvent | null) => void;
  setHitFeedback: (event: HitFeedbackEvent | null) => void;
  setDeathReport: (report: MedicalDeathReport | null) => void;
  pushMedicalEvent: (event: Omit<MedicalEvent, "id"> & { id?: string }) => void;
  clearMedicalEvents: () => void;
  setDerivedVitals: (actorId: string, vitals: DerivedVitals) => void;
  clearDerivedVitals: () => void;
  enqueueNetworkEvent: (event: NetworkMatchEvent) => void;
  clearNetworkEvents: () => void;
  setReplayState: (replayState: ReplayState) => void;
  setHighlightState: (highlightState: ActiveHighlightState | null) => void;
  setStreamerMode: (streamerMode: boolean) => void;
  setActiveTreatment: (treatment: ActiveTreatment | null) => void;
  clearActiveTreatment: () => void;
  setMedicalSummary: (summary: MatchMedicalSummary | null) => void;
  applyInjury: (playerId: string, injuries: InjuryRecord[]) => void;
  addItem: (item: string, amount: number) => void;
  setSupplies: (supplies: SupplyStack[]) => void;
  setTreatmentStatus: (status: TreatmentStatus) => void;
  setHudState: (hudState: Partial<RagdollHudState>) => void;
  setRealismMode: (realismMode: boolean) => void;
  awardProgression: (payload: { coins?: number; upgradePoints?: number; bestWave?: number; highestScore?: number }) => void;
  spendUpgradePoint: (upgradeId: UpgradeId) => void;
  consumeSupply: (supplyId: MedicalSupplyId, quantity?: number) => void;
  setProfile: (profile: PersistedPlayerProfile | null) => void;
  queueSelfAction: (action: { type: "treat" | "consume"; target: string }) => void;
  clearSelfAction: () => void;
  completeMatch: (result: MatchResult) => void;
  restartMatch: () => void;
  returnToMenu: () => void;
  pushToast: (toast: Omit<HudToast, "id">) => void;
  dismissToast: (id: string) => void;
  pushAudioEvent: (event: Omit<AudioEvent, "id">) => void;
  shiftAudioEvent: () => AudioEvent | undefined;
}

const initialSettings: MatchSettings = {
  mode: "duel",
  arenaId: "shatter-isles",
  difficulty: "veteran",
  seed: 1337,
};

const initialLaunchSettings: LaunchSettings = {
  streamerMode: false,
  cleanHud: false,
  reducedClutter: false,
  cinematicBanners: true,
  autoHidePanels: false,
  eventFeedDensity: "standard",
  screenShakeLevel: 1,
  slowMoLevel: 1,
  hudDensity: "standard",
};

const initialMatch: MatchSnapshot = {
  wave: 1,
  score: 0,
  kills: 0,
  remainingEnemies: 0,
  wind: [1.8, 0, 0.45],
  activeMode: initialSettings.mode,
};

export const useRagdollArchersStore = create<RagdollArchersState>((set, get) => ({
  ...(() => {
    const initialSupplies = createStarterInventory();
    return {
  phase: "menu",
  launchMode: "quick_duel",
  settings: initialSettings,
  launchSettings: initialLaunchSettings,
  actors: {},
  arrows: [],
  activeArrowType: "standard",
  match: initialMatch,
  cinematic: null,
  hitFeedback: null,
  result: null,
  deathReport: null,
  medicalEvents: [],
  derivedVitalsByActor: {},
  networkEventQueue: [],
  replayState: {
    latestSnapshot: null,
    latestHighlight: null,
  },
  replayPresentation: {
    open: false,
    mode: null,
  },
  highlightState: null,
  streamerMode: false,
  activeTreatment: null,
  medicalSummary: null,
  selectedChallengeId: null,
  tutorial: {
    seen: false,
    completed: false,
    skipped: false,
    visible: false,
    currentStep: 0,
  },
  recentResultCard: null,
  injuries: {},
  inventory: toInventoryMap(initialSupplies),
  supplies: initialSupplies,
  treatmentStatus: {
    currentInjury: null,
    canTreatNow: false,
    missingSupplies: [],
    missingTools: [],
    availableOptions: [],
  },
  hudState: {
    showMedicalPanel: false,
  },
  realismMode: false,
  progression: createDefaultProgression(),
  profile: null,
  pendingSelfAction: null,
  toasts: [],
  audioQueue: [],
    };
  })(),
  beginMatch: () =>
    set((state) => {
      const challenge = getChallengeDefinition(state.selectedChallengeId);
      const activeMode =
        state.launchMode === "quick_duel"
          ? "duel"
          : state.launchMode === "survival_run"
            ? "firstperson"
          : challenge?.baseMode || state.settings.mode;
      const inventory = state.profile?.inventory?.length ? state.profile.inventory : state.supplies;
      return {
        phase: "playing",
        settings: { ...state.settings, mode: activeMode },
        result: null,
        cinematic: null,
        hitFeedback: null,
        deathReport: null,
        medicalEvents: [],
        derivedVitalsByActor: {},
        networkEventQueue: [],
        replayState: {
          latestSnapshot: null,
          latestHighlight: null,
        },
        replayPresentation: {
          open: false,
          mode: null,
        },
        highlightState: null,
        activeTreatment: null,
        medicalSummary: null,
        recentResultCard: null,
        injuries: {},
        actors: {},
        arrows: [],
        supplies: inventory,
        inventory: toInventoryMap(inventory),
        match: {
          ...initialMatch,
          activeMode,
        },
        hudState: {
          showMedicalPanel: state.launchMode === "challenge_run",
        },
        realismMode: state.launchMode === "challenge_run",
        toasts: [
          {
            id: `toast-${Date.now()}`,
            title: "Combat hot",
            body: activeMode === "duel" ? "Classic ragdoll run live. Keep the wobble under control and spend upgrade points between waves." : "First-person variant live. Same profile, rougher camera, lighter fidelity.",
            tone: "neutral",
          },
        ],
      };
    }),
  setLaunchMode: (launchMode) =>
    set((state) => ({
      launchMode,
      settings: {
        ...state.settings,
        mode: launchMode === "quick_duel" ? "duel" : launchMode === "survival_run" ? "firstperson" : state.settings.mode,
      },
      realismMode: launchMode === "challenge_run",
    })),
  setMode: (mode) =>
    set((state) => ({
      settings: { ...state.settings, mode },
      match: { ...state.match, activeMode: mode },
    })),
  setArena: (arenaId) => set((state) => ({ settings: { ...state.settings, arenaId } })),
  setDifficulty: (difficulty) => set((state) => ({ settings: { ...state.settings, difficulty } })),
  setLaunchSettings: (launchSettings) =>
    set((state) => ({
      launchSettings: { ...state.launchSettings, ...launchSettings },
      streamerMode: launchSettings.streamerMode ?? state.streamerMode,
    })),
  setSelectedChallengeId: (selectedChallengeId) => set({ selectedChallengeId }),
  setTutorial: (tutorial) => set((state) => ({ tutorial: { ...state.tutorial, ...tutorial } })),
  setReplayPresentation: (replayPresentation) => set({ replayPresentation }),
  setRecentResultCard: (recentResultCard) => set({ recentResultCard }),
  setActiveArrowType: (activeArrowType) => set({ activeArrowType }),
  cycleArrowType: (direction = 1) => {
    const { activeArrowType } = get();
    const currentIndex = arrowOrder.indexOf(activeArrowType);
    const nextIndex = (currentIndex + direction + arrowOrder.length) % arrowOrder.length;
    set({ activeArrowType: arrowOrder[nextIndex] });
  },
  setActors: (actors) => set({ actors }),
  setArrows: (arrows) => set({ arrows }),
  setMatchSnapshot: (snapshot) => set((state) => ({ match: { ...state.match, ...snapshot } })),
  setCinematic: (cinematic) => set({ cinematic }),
  setHitFeedback: (hitFeedback) => set({ hitFeedback }),
  setDeathReport: (deathReport) => set({ deathReport }),
  pushMedicalEvent: (event) =>
    set((state) => ({
      medicalEvents: [
        ...state.medicalEvents,
        {
          ...event,
          id: event.id || `med-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
      ].slice(-80),
    })),
  clearMedicalEvents: () => set({ medicalEvents: [] }),
  setDerivedVitals: (actorId, vitals) =>
    set((state) => ({
      derivedVitalsByActor: {
        ...state.derivedVitalsByActor,
        [actorId]: vitals,
      },
    })),
  clearDerivedVitals: () => set({ derivedVitalsByActor: {} }),
  enqueueNetworkEvent: (event) =>
    set((state) => ({
      networkEventQueue: [...state.networkEventQueue.slice(-119), event],
    })),
  clearNetworkEvents: () => set({ networkEventQueue: [] }),
  setReplayState: (replayState) => set({ replayState }),
  setHighlightState: (highlightState) => set({ highlightState }),
  setStreamerMode: (streamerMode) => set((state) => ({ streamerMode, launchSettings: { ...state.launchSettings, streamerMode } })),
  setActiveTreatment: (activeTreatment) => set({ activeTreatment }),
  clearActiveTreatment: () => set({ activeTreatment: null }),
  setMedicalSummary: (medicalSummary) => set({ medicalSummary }),
  applyInjury: (playerId, injuries) =>
    set((state) => {
      const current = state.injuries[playerId] || [];
      return {
        injuries: {
          ...state.injuries,
          [playerId]: [...current, ...injuries],
        },
      };
    }),
  addItem: (item, amount) =>
    set((state) => ({
      inventory: {
        ...state.inventory,
        [item]: (state.inventory[item] || 0) + amount,
      },
    })),
  setSupplies: (supplies) => set({ supplies, inventory: toInventoryMap(supplies) }),
  setTreatmentStatus: (treatmentStatus) => set({ treatmentStatus }),
  setHudState: (hudState) => set((state) => ({ hudState: { ...state.hudState, ...hudState } })),
  setRealismMode: (realismMode) => set({ realismMode }),
  awardProgression: ({ coins = 0, upgradePoints = 0, bestWave, highestScore }) =>
    set((state) => ({
      progression: {
        ...state.progression,
        coins: state.progression.coins + coins,
        upgradePoints: state.progression.upgradePoints + upgradePoints,
        bestWave: Math.max(state.progression.bestWave, bestWave || 0),
        highestScore: Math.max(state.progression.highestScore, highestScore || 0),
      },
    })),
  spendUpgradePoint: (upgradeId) =>
    set((state) => {
      if (state.progression.upgradePoints <= 0) return state;
      return {
        progression: {
          ...state.progression,
          upgradePoints: state.progression.upgradePoints - 1,
          upgrades: {
            ...state.progression.upgrades,
            [upgradeId]: state.progression.upgrades[upgradeId] + 1,
          },
        },
      };
    }),
  consumeSupply: (supplyId, quantity = 1) =>
    set((state) => ({
      supplies: state.supplies.map((stack) => (stack.id === supplyId ? { ...stack, quantity: Math.max(0, stack.quantity - quantity) } : stack)),
      inventory: {
        ...state.inventory,
        [supplyId]: Math.max(0, (state.inventory[supplyId] || 0) - quantity),
      },
    })),
  setProfile: (profile) => {
    const supplies = profile?.inventory?.length ? profile.inventory : createStarterInventory();
    let launchSettings = initialLaunchSettings;
    let tutorial = get().tutorial;
    let realismMode = get().realismMode;
    if (profile?.settingsJson) {
      try {
        const parsed = JSON.parse(profile.settingsJson) as { launchSettings?: Partial<LaunchSettings>; tutorial?: Partial<TutorialState>; realismMode?: boolean };
        launchSettings = { ...launchSettings, ...parsed.launchSettings };
        tutorial = { ...tutorial, ...parsed.tutorial };
        realismMode = parsed.realismMode ?? realismMode;
      } catch {
        launchSettings = initialLaunchSettings;
      }
    }
    set({
      profile,
      supplies,
      inventory: toInventoryMap(supplies),
      launchSettings,
      streamerMode: launchSettings.streamerMode,
      tutorial,
      realismMode,
      progression: parseProfileProgression(profile),
    });
  },
  queueSelfAction: (pendingSelfAction) => set({ pendingSelfAction }),
  clearSelfAction: () => set({ pendingSelfAction: null }),
  completeMatch: (result) =>
    set({
      phase: "result",
      result,
      cinematic: null,
      activeTreatment: null,
    }),
  restartMatch: () =>
    set((state) => ({
      phase: "playing",
      result: null,
      cinematic: null,
      hitFeedback: null,
      deathReport: null,
      medicalEvents: [],
      derivedVitalsByActor: {},
      networkEventQueue: [],
      replayState: {
        latestSnapshot: null,
        latestHighlight: null,
      },
      replayPresentation: {
        open: false,
        mode: null,
      },
      highlightState: null,
      activeTreatment: null,
      medicalSummary: null,
      recentResultCard: null,
      injuries: {},
      pendingSelfAction: null,
      actors: {},
      arrows: [],
      treatmentStatus: {
        currentInjury: null,
        canTreatNow: false,
        missingSupplies: [],
        missingTools: [],
        availableOptions: [],
      },
      hudState: {
        showMedicalPanel: state.realismMode,
      },
      match: {
        ...initialMatch,
        activeMode: state.settings.mode,
      },
    })),
  returnToMenu: () =>
    set({
      phase: "menu",
      result: null,
      actors: {},
      arrows: [],
      cinematic: null,
      hitFeedback: null,
      deathReport: null,
      medicalEvents: [],
      derivedVitalsByActor: {},
      networkEventQueue: [],
      replayState: {
        latestSnapshot: null,
        latestHighlight: null,
      },
      replayPresentation: {
        open: false,
        mode: null,
      },
      highlightState: null,
      activeTreatment: null,
      medicalSummary: null,
      recentResultCard: null,
      injuries: {},
      pendingSelfAction: null,
      match: initialMatch,
      activeArrowType: "standard",
      treatmentStatus: {
        currentInjury: null,
        canTreatNow: false,
        missingSupplies: [],
        missingTools: [],
        availableOptions: [],
      },
      hudState: {
        showMedicalPanel: false,
      },
    }),
  pushToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { ...toast, id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }],
    })),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  pushAudioEvent: (event) =>
    set((state) => ({
      audioQueue: [...state.audioQueue, { ...event, id: `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }],
    })),
  shiftAudioEvent: () => {
    const [next, ...rest] = get().audioQueue;
    if (next) set({ audioQueue: rest });
    return next;
  },
}));

export function createInitialActorAmmo() {
  return { ...defaultAmmo };
}
