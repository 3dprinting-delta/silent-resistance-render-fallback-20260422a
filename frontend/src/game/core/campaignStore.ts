"use client";

import { create } from "zustand";
import { getMissionVariantById } from "@/game/data/generatedMissionCatalog";
import type { AudioTensionState, CampaignProgressState, GeneratedMissionDefinition, RunHighlightBundle, StealthCloudProfile, WorldSnapshot } from "@/game/core/types";

const CAMPAIGN_PROGRESS_KEY = "silent-resistance-campaign-progress";

function createInitialProgress(): CampaignProgressState {
  return {
    onboardingStage: "intro",
    unlockedStarts: ["marina_default"],
    unlockedModifiers: [],
    unlockedIntelAdvantages: [],
    unlockedMissionIds: ["azure-meridian"],
    codexEntries: ["iron-meridian-dossier"],
    routeMastery: {},
    sectorLiberation: {},
    discoveredOpportunities: [],
    operationHistory: [],
    recentHighlights: [],
    legendMoments: [],
    lastChallengePayload: null,
    nextRecommendedOperationId: null,
  };
}

function loadProgress(): CampaignProgressState {
  if (typeof window === "undefined") return createInitialProgress();
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_PROGRESS_KEY);
    if (!raw) return createInitialProgress();
    const parsed = JSON.parse(raw) as Partial<CampaignProgressState>;
    const next = { ...createInitialProgress(), ...parsed } as CampaignProgressState;
    if (!parsed.onboardingStage) {
      next.onboardingStage = Array.isArray(parsed.operationHistory) && parsed.operationHistory.length > 0 ? "complete" : "intro";
    }
    return next;
  } catch {
    return createInitialProgress();
  }
}

function persistProgress(progress: CampaignProgressState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CAMPAIGN_PROGRESS_KEY, JSON.stringify(progress));
}

function resolveRecommendedOperation(world: WorldSnapshot | null): string | null {
  return world?.liveContent?.activeOperations[0]?.id || null;
}

interface CampaignStoreState {
  world: WorldSnapshot | null;
  progress: CampaignProgressState;
  loadingWorld: boolean;
  worldError: string | null;
  selectedOperationId: string | null;
  audioUnlocked: boolean;
  audioEnabled: boolean;
  audioState: AudioTensionState;
  setWorld: (world: WorldSnapshot) => void;
  setLoadingWorld: (loadingWorld: boolean) => void;
  setWorldError: (worldError: string | null) => void;
  setSelectedOperationId: (operationId: string) => void;
  setOnboardingStage: (stage: CampaignProgressState["onboardingStage"]) => void;
  unlockAudio: () => void;
  setAudioEnabled: (audioEnabled: boolean) => void;
  setAudioState: (audioState: AudioTensionState) => void;
  getSelectedOperation: () => GeneratedMissionDefinition | null;
  recordMissionOutcome: (params: {
    missionId: string;
    operationId?: string | null;
    variantId?: string | null;
    rating: string;
    score: number;
    teamSize?: number;
    sessionId?: string | null;
    unlockedStart?: string | null;
    unlockedModifier?: string | null;
    unlockedIntel?: string | null;
    codexEntry?: string | null;
    opportunityId?: string | null;
    sectorId?: string | null;
  }) => void;
  recordRunHighlight: (highlight: RunHighlightBundle) => void;
  hydrateCloudProfile: (profile: StealthCloudProfile) => void;
}

export const useCampaignStore = create<CampaignStoreState>((set, get) => ({
  world: null,
  progress: createInitialProgress(),
  loadingWorld: false,
  worldError: null,
  selectedOperationId: null,
  audioUnlocked: false,
  audioEnabled: false,
  audioState: "calm",
  setWorld: (world) =>
    set((state) => {
      const nextProgress = {
        ...state.progress,
        nextRecommendedOperationId: resolveRecommendedOperation(world),
      };
      persistProgress(nextProgress);
      return {
        world,
        progress: nextProgress,
        selectedOperationId: state.selectedOperationId || resolveRecommendedOperation(world),
      };
    }),
  setLoadingWorld: (loadingWorld) => set({ loadingWorld }),
  setWorldError: (worldError) => set({ worldError }),
  setSelectedOperationId: (selectedOperationId) => set({ selectedOperationId }),
  setOnboardingStage: (onboardingStage) =>
    set((state) => {
      const nextProgress = {
        ...state.progress,
        onboardingStage,
      };
      persistProgress(nextProgress);
      return { progress: nextProgress };
    }),
  unlockAudio: () => set({ audioUnlocked: true, audioEnabled: true }),
  setAudioEnabled: (audioEnabled) => set({ audioEnabled }),
  setAudioState: (audioState) => set({ audioState }),
  getSelectedOperation: (): GeneratedMissionDefinition | null => {
    const state = get();
    return state.world?.liveContent?.activeOperations.find((operation) => operation.id === state.selectedOperationId) || state.world?.liveContent?.activeOperations[0] || null;
  },
  recordMissionOutcome: ({ missionId, operationId, variantId, rating, score, teamSize, sessionId, unlockedStart, unlockedModifier, unlockedIntel, codexEntry, opportunityId, sectorId }) =>
    set((state) => {
      const current = state.progress.unlockedMissionIds.includes(missionId)
        ? state.progress.unlockedMissionIds
        : [...state.progress.unlockedMissionIds, missionId];
      const variant = variantId ? getMissionVariantById(variantId) : null;
      const nextProgress: CampaignProgressState = {
        ...state.progress,
        onboardingStage: state.progress.onboardingStage === "complete" ? "complete" : "first_debrief",
        unlockedMissionIds: current,
        unlockedStarts:
          unlockedStart && !state.progress.unlockedStarts.includes(unlockedStart)
            ? [...state.progress.unlockedStarts, unlockedStart]
            : variant?.entryPool[0] && !state.progress.unlockedStarts.includes(variant.entryPool[0].id)
              ? [...state.progress.unlockedStarts, variant.entryPool[0].id]
              : state.progress.unlockedStarts,
        unlockedModifiers:
          unlockedModifier && !state.progress.unlockedModifiers.includes(unlockedModifier)
            ? [...state.progress.unlockedModifiers, unlockedModifier]
            : state.progress.unlockedModifiers,
        unlockedIntelAdvantages:
          unlockedIntel && !state.progress.unlockedIntelAdvantages.includes(unlockedIntel)
            ? [...state.progress.unlockedIntelAdvantages, unlockedIntel]
            : state.progress.unlockedIntelAdvantages,
        codexEntries: codexEntry && !state.progress.codexEntries.includes(codexEntry) ? [...state.progress.codexEntries, codexEntry] : state.progress.codexEntries,
        discoveredOpportunities:
          opportunityId && !state.progress.discoveredOpportunities.includes(opportunityId)
            ? [...state.progress.discoveredOpportunities, opportunityId]
            : state.progress.discoveredOpportunities,
        sectorLiberation: sectorId
          ? {
              ...state.progress.sectorLiberation,
              [sectorId]: Math.min(100, (state.progress.sectorLiberation[sectorId] || 0) + (rating === "Silent Phantom" || rating === "Ghost" ? 16 : 9)),
            }
          : state.progress.sectorLiberation,
        operationHistory: [
          { id: `${operationId || missionId}-${Date.now()}`, missionId, rating, score, timestamp: Date.now(), teamSize: teamSize || 1, sessionId: sessionId || null },
          ...state.progress.operationHistory,
        ].slice(0, 18),
        nextRecommendedOperationId: resolveRecommendedOperation(state.world),
      };
      persistProgress(nextProgress);
      return { progress: nextProgress };
    }),
  recordRunHighlight: (highlight) =>
    set((state) => {
      if (state.progress.recentHighlights.some((entry) => entry.id === highlight.id)) {
        return state;
      }
      const nextProgress: CampaignProgressState = {
        ...state.progress,
        recentHighlights: [highlight, ...state.progress.recentHighlights].slice(0, 12),
        legendMoments: [
          ...highlight.topMoments.map((moment) => ({
            id: `${highlight.id}-${moment.id}`,
            label: moment.label,
            headline: moment.headline,
            summary: moment.summary,
            category: moment.highlightCategory,
            operationId: highlight.operationId,
            missionId: highlight.missionId,
            sectorId: highlight.sectorId,
            createdAt: moment.createdAt,
            shareabilityScore: moment.shareabilityScore,
            tags: moment.tags,
            challengeText: highlight.challenge.beatThisText,
          })),
          ...state.progress.legendMoments,
        ]
          .slice(0, 40)
          .filter((entry, index, list) => list.findIndex((candidate) => candidate.id === entry.id) === index),
        lastChallengePayload: highlight.challenge,
      };
      persistProgress(nextProgress);
      return { progress: nextProgress };
    }),
  hydrateCloudProfile: (profile) =>
    set((state) => {
      const nextProgress: CampaignProgressState = {
        ...state.progress,
        recentHighlights: Array.isArray(profile.recentHighlights) && profile.recentHighlights.length
          ? profile.recentHighlights
          : state.progress.recentHighlights,
        legendMoments: Array.isArray(profile.legendMoments) && profile.legendMoments.length
          ? profile.legendMoments
          : state.progress.legendMoments,
        lastChallengePayload: profile.lastChallengePayload || state.progress.lastChallengePayload,
      };
      persistProgress(nextProgress);
      return { progress: nextProgress };
    }),
}));

if (typeof window !== "undefined") {
  const initial = loadProgress();
  useCampaignStore.setState({ progress: initial });
}
