"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useCampaignStore } from "@/game/core/campaignStore";
import { useMultiplayerStore } from "@/game/core/multiplayerStore";
import { foundationShell } from "@/game/data/foundationShell";
import { buildStoryContinuityStack } from "@/game/data/missionStoryFabric";
import { usePhaseOneStore } from "@/game/core/phaseOneStore";
import { getDisguiseById } from "@/game/systems/phaseTwo/disguiseSystem";
import { describeZoneLegality } from "@/game/systems/phaseTwo/accessSystem";
import { distance2D } from "@/game/utils/math";
import { summarizeWorldResponse } from "@/game/systems/worldResponseSystem";
import { summarizeAssetCoverage } from "@/game/systems/assetRegistry";
import { buildRunHighlightBundle, buildShareCardSvg, captureHighlightClipDataUrl, captureShareMedia, decodeChallengePayload, describePressureTrail, downloadPngCard, downloadSvgCard, exportHighlightClip, formatMomentShareText } from "@/game/systems/viralLoop";
import type { StealthCloudProfile, StoredShareRecord } from "@/game/core/types";
import { buildSharePageUrl, createStoredShare, fetchStoredShare, loadStealthCloudProfile, syncStealthCloudProfile, trackShareEvent } from "@/lib/shareApi";
import { fetchWorldState } from "@/lib/worldApi";

const AudioTensionController = dynamic(() => import("@/components/game/AudioTensionController"), {
  ssr: false,
});

const EnvironmentCanvas = dynamic(() => import("@/components/game/EnvironmentCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[420px] items-center justify-center rounded-[32px] border border-white/8 bg-black/20 text-sm text-neutral-500">
      Loading operation shell...
    </div>
  ),
});

function statusTone(level: "calm" | "warn" | "danger" | "opportunity") {
  if (level === "danger") return "status-danger";
  if (level === "warn") return "status-warn";
  if (level === "opportunity") return "status-opportunity";
  return "status-calm";
}

function runSummaryText(score: number | null, rating: string | null, alarms: number, evidence: number) {
  if (score === null || !rating) return "Mission status pending.";
  if (alarms === 0 && evidence === 0) return `${rating}. The operation stayed nearly invisible from ingress to extraction.`;
  if (alarms <= 1 && evidence <= 2) return `${rating}. Control slipped briefly, but the operation remained disciplined.`;
  return `${rating}. The objective was completed under visible pressure and a messier trail.`;
}

function formatNarrativeRole(value: string) {
  return value.replaceAll("_", " ");
}

function formatRelativeTimestamp(timestamp: number) {
  const delta = Date.now() - timestamp;
  const hours = Math.max(1, Math.round(delta / (1000 * 60 * 60)));
  if (hours < 24) return `${hours}h ago`;
  return `${Math.max(1, Math.round(hours / 24))}d ago`;
}

function formatThreatTempo(selectedStory: { pressureClass: string; pacingType: string }) {
  return `${selectedStory.pressureClass} pressure / ${selectedStory.pacingType.replaceAll("_", " ")}`;
}

function formatSectorMetric(label: string, value: number) {
  return `${label} ${value}%`;
}

function derivePresentationBeat(params: {
  missionComplete: boolean;
  targetEliminated: boolean;
  targetWindowState: string;
  globalAlertLevel: number;
  suspicion: number;
  accessState: string;
  activeIncidents: number;
}) {
  if (params.missionComplete) {
    return {
      eyebrow: "Mission Resolved",
      title: "Debrief window secured",
      copy: "The operation has concluded. Review the final footprint, score pressure, and route discipline.",
      tone: "opportunity" as const,
    };
  }
  if (!params.targetEliminated && params.targetWindowState === "vulnerable") {
    return {
      eyebrow: "Opportunity",
      title: "Vale is in a thinner protection pocket",
      copy: "Escort spacing is open enough for a decisive move if you keep the district from spiking.",
      tone: "opportunity" as const,
    };
  }
  if (params.targetEliminated) {
    return {
      eyebrow: "Extraction",
      title: "Primary down. Control the aftermath.",
      copy: "The operation has entered exfiltration. Preserve cover, contain evidence, and get to the marina.",
      tone: "warn" as const,
    };
  }
  if (params.globalAlertLevel >= 2 || params.suspicion >= 70 || params.activeIncidents > 2) {
    return {
      eyebrow: "Danger",
      title: "The district is tightening around you",
      copy: "Search pressure is active. Challenge lines are hardening and clean routes are starting to collapse.",
      tone: "danger" as const,
    };
  }
  if (params.accessState !== "legal" || params.suspicion >= 28) {
    return {
      eyebrow: "Exposure",
      title: "Cover is holding, but only just",
      copy: "Your current disguise and posture can still work, but watchers are reading the scene more aggressively.",
      tone: "warn" as const,
    };
  }
  return {
    eyebrow: "Calm",
    title: "The floor still belongs to the operation",
    copy: "Security posture is soft enough to reposition, probe new lanes, and shape the target route before committing.",
    tone: "calm" as const,
  };
}

interface GameShellProps {
  initialShareId?: string | null;
  initialShareRecord?: StoredShareRecord | null;
}

export default function GameShell({ initialShareId = null, initialShareRecord = null }: GameShellProps) {
  const [sessionCodeInput, setSessionCodeInput] = useState("");
  const [agentNameInput, setAgentNameInput] = useState("");
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(initialShareId ? buildSharePageUrl(initialShareId, typeof window !== "undefined" ? window.location.origin : null) : null);
  const [storedShareRecord, setStoredShareRecord] = useState<StoredShareRecord | null>(initialShareRecord);
  const [shareBusy, setShareBusy] = useState(false);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [cloudProfile, setCloudProfile] = useState<StealthCloudProfile | null>(null);
  const { data: session, status: sessionStatus } = useSession();
  const world = useCampaignStore((state) => state.world);
  const progress = useCampaignStore((state) => state.progress);
  const loadingWorld = useCampaignStore((state) => state.loadingWorld);
  const worldError = useCampaignStore((state) => state.worldError);
  const selectedOperationId = useCampaignStore((state) => state.selectedOperationId);
  const audioUnlocked = useCampaignStore((state) => state.audioUnlocked);
  const audioEnabled = useCampaignStore((state) => state.audioEnabled);
  const audioState = useCampaignStore((state) => state.audioState);
  const setWorld = useCampaignStore((state) => state.setWorld);
  const setLoadingWorld = useCampaignStore((state) => state.setLoadingWorld);
  const setWorldError = useCampaignStore((state) => state.setWorldError);
  const setSelectedOperationId = useCampaignStore((state) => state.setSelectedOperationId);
  const setOnboardingStage = useCampaignStore((state) => state.setOnboardingStage);
  const setAudioEnabled = useCampaignStore((state) => state.setAudioEnabled);
  const recordRunHighlight = useCampaignStore((state) => state.recordRunHighlight);
  const hydrateCloudProfile = useCampaignStore((state) => state.hydrateCloudProfile);
  const cameraMode = usePhaseOneStore((state) => state.cameraMode);
  const setCameraMode = usePhaseOneStore((state) => state.setCameraMode);
  const currentZoneId = usePhaseOneStore((state) => state.currentZoneId);
  const interactionLog = usePhaseOneStore((state) => state.interactionLog);
  const currentPrompt = usePhaseOneStore((state) => state.prompt);
  const activeDisguiseId = usePhaseOneStore((state) => state.activeDisguiseId);
  const suspicion = usePhaseOneStore((state) => state.suspicion);
  const stealthState = usePhaseOneStore((state) => state.stealthState);
  const accessState = usePhaseOneStore((state) => state.accessState);
  const activeWatcherIds = usePhaseOneStore((state) => state.activeWatcherIds);
  const dominantRiskSource = usePhaseOneStore((state) => state.dominantRiskSource);
  const lastStealthEvents = usePhaseOneStore((state) => state.lastStealthEvents);
  const aiActors = usePhaseOneStore((state) => state.aiActors);
  const globalAlertLevel = usePhaseOneStore((state) => state.globalAlertLevel);
  const targetWindowState = usePhaseOneStore((state) => state.targetWindowState);
  const aiDebug = usePhaseOneStore((state) => state.aiDebug);
  const toggleAiDebug = usePhaseOneStore((state) => state.toggleAiDebug);
  const playerPosition = usePhaseOneStore((state) => state.playerPosition);
  const activeIncidents = usePhaseOneStore((state) => state.activeIncidents);
  const guardResponseAssignments = usePhaseOneStore((state) => state.guardResponseAssignments);
  const dangerZones = usePhaseOneStore((state) => state.dangerZones);
  const missionPressure = usePhaseOneStore((state) => state.missionPressure);
  const mission = usePhaseOneStore((state) => state.mission);

  const currentZone = foundationShell.zones.find((zone) => zone.id === currentZoneId) || null;
  const disguise = getDisguiseById(activeDisguiseId);
  const target = aiActors.find((actor) => actor.role === "target");
  const leadIncident = activeIncidents[0] || null;
  const activeInvestigators = aiActors.filter((actor) => actor.state === "investigating" || actor.state === "searching" || actor.state === "alerted");
  const challengers = aiActors.filter(
    (actor) =>
      (actor.role === "guard" || actor.role === "bodyguard") &&
      (actor.state === "investigating" || actor.state === "searching" || actor.state === "alerted") &&
      distance2D(actor.position, playerPosition) < 10,
  );
  const civiliansFleeing = aiActors.filter((actor) => actor.role === "civilian" && actor.state === "fleeing");
  const briefingOpen = !mission.missionComplete && distance2D(playerPosition, foundationShell.spawn.position) < 2.6 && interactionLog.length <= 2;
  const operationsOpen = !briefingOpen && !mission.missionComplete;
  const scoreOpen = mission.missionComplete;
  const unlockedRoutes = Object.entries(mission.unlockedRoutes)
    .filter(([, unlocked]) => unlocked)
    .map(([route]) => route);
  const recentEvents = lastStealthEvents.slice(0, 4);
  const recentLog = interactionLog.slice(0, 4);
  const notableMoments = mission.notableMoments.slice(0, 3);
  const worldResponseSummary = summarizeWorldResponse(missionPressure, activeIncidents);
  const assetCoverage = summarizeAssetCoverage();
  const liveOperations = world?.liveContent?.activeOperations || [];
  const challengeBoard = world?.liveContent?.challengeBoard || [];
  const activeMissionChains = world?.liveContent?.activeMissionChains || [];
  const sectorAdaptationFlags = world?.liveContent?.sectorAdaptationFlags || [];
  const quickMatchOperationIds = world?.liveContent?.quickMatchOperationIds || [];
  const campaign = world?.campaign || null;
  const sharedContribution = world?.sharedContribution || null;
  const storyState = world?.storyState || null;
  const onboardingStage = progress.onboardingStage || (progress.operationHistory.length > 0 ? "complete" : "intro");
  const baseSelectedOperation = useMemo(
    () => liveOperations.find((operation) => operation.id === selectedOperationId) || liveOperations[0] || null,
    [liveOperations, selectedOperationId],
  );
  const introOperation = useMemo(
    () => liveOperations.find((operation) => operation.variantId === "azure-summit-fall") || liveOperations.find((operation) => operation.missionId === "azure-meridian") || liveOperations[0] || null,
    [liveOperations],
  );
  const selectedOperation = useMemo(
    () => (onboardingStage === "complete" ? baseSelectedOperation : introOperation || baseSelectedOperation),
    [baseSelectedOperation, introOperation, onboardingStage],
  );
  const selectedStory = selectedOperation?.story || null;
  const latestStoryMemory = storyState?.missionTimeline?.[0] || null;
  const continuity = useMemo(() => buildStoryContinuityStack({ operation: selectedOperation, storyState, progress }), [progress, selectedOperation, storyState]);
  const recentHighlights = progress.recentHighlights || [];
  const legendMoments = progress.legendMoments || [];
  const currentSector = useMemo(
    () => campaign?.sectors.find((sector) => sector.id === selectedOperation?.sectorId) || null,
    [campaign?.sectors, selectedOperation?.sectorId],
  );
  const sectorAdaptation = useMemo(
    () => sectorAdaptationFlags.find((flag) => flag.sectorId === selectedOperation?.sectorId) || null,
    [sectorAdaptationFlags, selectedOperation?.sectorId],
  );
  const operationClusters = useMemo(
    () =>
      campaign?.sectors.map((sector) => ({
        sector,
        operations: liveOperations.filter((operation) => operation.sectorId === sector.id),
        scars: storyState?.sectorScars?.[sector.id] || [],
        adaptation: sectorAdaptationFlags.find((flag) => flag.sectorId === sector.id) || null,
        liberation: progress.sectorLiberation[sector.id] || 0,
      })) || [],
    [campaign?.sectors, liveOperations, progress.sectorLiberation, sectorAdaptationFlags, storyState?.sectorScars],
  );
  const selectedCluster = operationClusters.find((cluster) => cluster.sector.id === selectedOperation?.sectorId) || operationClusters[0] || null;
  const branchCandidates = useMemo(
    () => liveOperations.filter((operation) => operation.id !== selectedOperation?.id).slice(0, 3),
    [liveOperations, selectedOperation?.id],
  );
  const lockedFutureMissions = selectedCluster
    ? [
        `Escalate ${selectedCluster.sector.label} once liberation pressure reaches ${Math.min(100, (selectedCluster.liberation || 0) + 18)}%.`,
        `Exploit ${selectedStory?.arc.thread ? formatNarrativeRole(selectedStory.arc.thread) : "sector fracture"} after the next visible scare.`,
      ]
    : [];
  const agentLegacy =
    progress.operationHistory.length === 0
      ? "No decisive operations recorded yet."
      : continuity.decisiveRun
        ? `${continuity.decisiveRun.rating} scored ${continuity.decisiveRun.score} on ${formatRelativeTimestamp(continuity.decisiveRun.timestamp)}.`
        : `${progress.operationHistory.length} operations recorded in the resistance archive.`;
  const presentationBeat = derivePresentationBeat({
    missionComplete: mission.missionComplete,
    targetEliminated: mission.targetEliminated,
    targetWindowState,
    globalAlertLevel,
    suspicion,
    accessState,
    activeIncidents: activeIncidents.length,
  });
  const operationPhase = mission.missionComplete
    ? "debrief"
    : mission.targetEliminated
      ? "exfiltration"
      : targetWindowState === "vulnerable"
        ? "opportunity"
        : "infiltration";
  const pressureSummary =
    globalAlertLevel >= 2
      ? "district search posture active"
      : suspicion >= 45
        ? "cover strain rising"
        : missionPressure.targetProtection !== "routine"
          ? "target shield tightening"
          : "district posture manageable";
  const missionWindowOpen = briefingOpen || scoreOpen;
  const storyAftermath = mission.storyAftermath || null;
  const isOnboardingIntro = onboardingStage === "intro";
  const isOnboardingMission = onboardingStage === "first_run";
  const isOnboardingDebrief = onboardingStage === "first_debrief";
  const showFullShell = onboardingStage === "complete";
  const isSimpleFirstRun = isOnboardingMission && selectedOperation?.variantId === "azure-summit-fall";
  const localProfileName = useMultiplayerStore((state) => state.localProfileName);
  const localRole = useMultiplayerStore((state) => state.localRole);
  const identityToken = useMultiplayerStore((state) => state.identityToken);
  const localPlayerId = useMultiplayerStore((state) => state.localPlayerId);
  const multiplayerStatus = useMultiplayerStore((state) => state.status);
  const multiplayerSessionId = useMultiplayerStore((state) => state.sessionId);
  const multiplayerCode = useMultiplayerStore((state) => state.code);
  const multiplayerPlayers = useMultiplayerStore((state) => state.players);
  const teamSummary = useMultiplayerStore((state) => state.teamSummary);
  const backendConnected = useMultiplayerStore((state) => state.backendConnected);
  const backendError = useMultiplayerStore((state) => state.backendError);
  const setLocalProfile = useMultiplayerStore((state) => state.setLocalProfile);
  const createSession = useMultiplayerStore((state) => state.createSession);
  const joinSession = useMultiplayerStore((state) => state.joinSession);
  const quickMatch = useMultiplayerStore((state) => state.quickMatch);
  const setReady = useMultiplayerStore((state) => state.setReady);
  const leaveSession = useMultiplayerStore((state) => state.leaveSession);
  const missionState = useMultiplayerStore((state) => state.missionState);
  const runHighlightBundle = useMemo(() => {
    if (!mission.missionComplete || !mission.resultRating) return null;
    return buildRunHighlightBundle({
      mission,
      operation: selectedOperation,
      progressSummary: agentLegacy,
      storyAftermath,
      storyState,
      teamSize: Math.max(1, multiplayerPlayers.length || 1),
    });
  }, [agentLegacy, mission, multiplayerPlayers.length, selectedOperation, storyAftermath, storyState]);
  const activeChallenge = progress.lastChallengePayload || null;
  const activeShareRecord = storedShareRecord || initialShareRecord || null;
  const sharePreviewText =
    activeShareRecord?.shareSummary ||
    (runHighlightBundle ? formatMomentShareText(runHighlightBundle) : null);
  const progressionSummary = `${progress.operationHistory.length} operations archived / ${legendMoments.length} legend moments / ${Object.values(progress.sectorLiberation).filter((value) => Number(value) >= 20).length} marked sectors.`;
  const returnLoopMessages = cloudProfile?.notifications?.slice(0, 3) || [];
  const introExtraction = selectedOperation?.runtimeConfig.extractionPool[0] || null;
  const onboardingObjective = mission.targetEliminated
    ? `Reach ${introExtraction?.label || "the extraction route"} before the district closes the window.`
    : selectedOperation?.runtimeConfig.objectiveBundle.primary || "Complete the objective.";
  const onboardingLocation = mission.targetEliminated
    ? introExtraction?.label || "Extraction Route"
    : suspicion >= 24 || accessState !== "legal"
      ? "West Service Yard"
      : currentZoneId === "arrival-esplanade"
        ? "Grand Lobby"
        : currentZone?.label || "Target Route";
  const onboardingPrimaryButtonLabel = isOnboardingIntro ? "PLAY OPERATION" : isOnboardingDebrief ? "UNLOCK FULL CAMPAIGN" : "OPERATION LIVE";
  const liveGameplayActive = !mission.missionComplete && (isOnboardingMission || (showFullShell && !briefingOpen));
  const liveObjectiveText = mission.targetEliminated
    ? selectedOperation?.runtimeConfig.objectiveBundle.extraction || "Reach extraction."
    : selectedOperation?.runtimeConfig.objectiveBundle.primary || "Eliminate the primary target.";

  function getVisitorId() {
    if (typeof window === "undefined") return "server";
    const key = "silent-resistance-share-visitor";
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `visitor-${Date.now()}`;
    window.localStorage.setItem(key, created);
    return created;
  }

  useEffect(() => {
    setAgentNameInput(localProfileName);
  }, [localProfileName]);

  useEffect(() => {
    let active = true;
    setLoadingWorld(true);
    fetchWorldState({ authorityMode: backendConnected || Boolean(multiplayerSessionId) ? "multiplayer" : "solo" })
      .then((nextWorld) => {
        if (!active) return;
        setWorld(nextWorld);
        setWorldError(null);
      })
      .catch((error) => {
        if (!active) return;
        setWorldError(error instanceof Error ? error.message : "World state unavailable.");
      })
      .finally(() => {
        if (!active) return;
        setLoadingWorld(false);
      });
    return () => {
      active = false;
    };
  }, [backendConnected, multiplayerSessionId, setLoadingWorld, setWorld, setWorldError]);

  useEffect(() => {
    if (onboardingStage === "complete" || !introOperation) return;
    if (selectedOperationId === introOperation.id) return;
    setSelectedOperationId(introOperation.id);
  }, [introOperation, onboardingStage, selectedOperationId, setSelectedOperationId]);

  useEffect(() => {
    if (!runHighlightBundle) return;
    if (recentHighlights.some((entry) => entry.id === runHighlightBundle.id)) return;
    recordRunHighlight(runHighlightBundle);
  }, [recentHighlights, recordRunHighlight, runHighlightBundle]);

  useEffect(() => {
    const record = storedShareRecord || initialShareRecord;
    if (!record?.operationId) return;
    setSelectedOperationId(record.operationId);
      setShareUrl(buildSharePageUrl(record.id, typeof window !== "undefined" ? window.location.origin : null));
  }, [initialShareRecord, setSelectedOperationId, storedShareRecord]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const challengeCode = params.get("challenge");
    const shareId = params.get("share") || initialShareId;
    if (shareId && !storedShareRecord) {
      void fetchStoredShare(shareId)
        .then((payload) => {
          setStoredShareRecord(payload.share);
          if (payload.share.operationId) {
            setSelectedOperationId(payload.share.operationId);
          }
            setShareUrl(buildSharePageUrl(payload.share.id, window.location.origin));
          setShareStatus(`Shared run loaded: ${payload.share.headline}`);
        })
        .catch(() => {
          setShareStatus("Shared run could not be loaded.");
        });
    }
    if (!challengeCode) return;
    const decoded = decodeChallengePayload(challengeCode);
    if (!decoded?.operationId) {
      setShareStatus("Challenge link is invalid or incomplete.");
      return;
    }
    setSelectedOperationId(decoded.operationId);
    setShareStatus(`Challenge loaded: ${decoded.codename}`);
  }, [initialShareId, setSelectedOperationId, storedShareRecord]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || cloudLoaded) return;
    void loadStealthCloudProfile()
      .then((payload) => {
        if (payload.profile) {
          hydrateCloudProfile(payload.profile);
          setCloudProfile(payload.profile);
        }
        setCloudLoaded(true);
      })
      .catch(() => {
        setCloudLoaded(true);
      });
  }, [cloudLoaded, hydrateCloudProfile, sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !identityToken || !cloudLoaded) return;
    if (!recentHighlights.length && !legendMoments.length) return;
    void syncStealthCloudProfile({
      identityToken,
      recentHighlights,
      legendMoments,
      lastChallengePayload: progress.lastChallengePayload,
      progressionSummary,
    })
      .then((payload) => {
        setCloudProfile(payload.profile);
        if (payload.identityToken && typeof window !== "undefined") {
          const raw = window.localStorage.getItem("silent-resistance-multiplayer-profile");
          if (raw) {
            const current = JSON.parse(raw);
            window.localStorage.setItem(
              "silent-resistance-multiplayer-profile",
              JSON.stringify({ ...current, identityToken: payload.identityToken, playerId: localPlayerId }),
            );
          }
        }
      })
      .catch(() => undefined);
  }, [cloudLoaded, identityToken, legendMoments, localPlayerId, progress.lastChallengePayload, progressionSummary, recentHighlights, sessionStatus]);

  useEffect(() => {
    if (!activeShareRecord?.id) return;
    void trackShareEvent(activeShareRecord.id, {
      type: "view",
      visitorId: getVisitorId(),
      accountId: session?.user?.id || null,
    }).catch(() => undefined);
  }, [activeShareRecord?.id, session?.user?.id]);

  useEffect(() => {
    if (!mission.missionComplete || !activeShareRecord?.id) return;
    void trackShareEvent(activeShareRecord.id, {
      type: "completion",
      visitorId: getVisitorId(),
      accountId: session?.user?.id || null,
    }).catch(() => undefined);
  }, [activeShareRecord?.id, mission.missionComplete, session?.user?.id]);

  useEffect(() => {
    if (!shareStatus) return;
    const timeout = window.setTimeout(() => setShareStatus(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [shareStatus]);

  async function copyText(value: string, successMessage: string) {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setShareStatus(successMessage);
        return;
      }
      setShareStatus("Clipboard unavailable. Select and copy the generated recap text manually.");
    } catch {
      setShareStatus("Clipboard copy failed. Use the generated recap text manually.");
    }
  }

  const shareSummaryText = sharePreviewText;
  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    Boolean(runHighlightBundle || activeShareRecord);

  async function shareNatively() {
    if ((!runHighlightBundle && !activeShareRecord) || typeof navigator === "undefined" || typeof navigator.share !== "function") {
      setShareStatus("Native sharing is not available on this device.");
      return;
    }
    try {
      const title = activeShareRecord?.headline || runHighlightBundle?.headline || "Archive-worthy run";
      const text = shareSummaryText || activeShareRecord?.recap || runHighlightBundle?.shareSummary || "Challenge this run.";
      const url =
        shareUrl ||
        `${window.location.origin}${window.location.pathname}?challenge=${runHighlightBundle?.challenge.payloadCode || activeShareRecord?.challenge?.payloadCode || ""}`;
      await navigator.share({
        title,
        text,
        url,
      });
      setShareStatus("Native share opened.");
    } catch {
      setShareStatus("Native share was dismissed or failed.");
    }
  }

  async function publishStoredShare() {
    if (!runHighlightBundle || shareBusy) return;
    setShareBusy(true);
    try {
      const media = await captureShareMedia(runHighlightBundle);
      const clipDataUrl = media.clipSupported ? await captureHighlightClipDataUrl(runHighlightBundle) : null;
      const payload = await createStoredShare({
        ...runHighlightBundle,
        ownerAccountId: session?.user?.id || null,
        ownerPlayerId: localPlayerId,
        replaySeed: runHighlightBundle.replaySeed,
        media: {
          imageDataUrl: media.imageDataUrl,
          thumbnailDataUrl: media.thumbnailDataUrl,
          clipDataUrl,
          clipSupported: media.clipSupported,
          clipFilename: media.clipFilename,
          cardSvg: media.cardSvg,
        },
      });
        const nextUrl = buildSharePageUrl(payload.shareId, window.location.origin);
      setStoredShareRecord(payload.share);
      setShareUrl(nextUrl);
      setShareStatus(session?.user?.id ? "Public share published and linked to your account." : "Public share published.");
    } catch {
      setShareStatus("Share publish failed. Local export tools are still available.");
    } finally {
      setShareBusy(false);
    }
  }

  async function downloadImageCard() {
    if (!runHighlightBundle) return;
    const media = await captureShareMedia(runHighlightBundle);
    if (!media.imageDataUrl) {
      setShareStatus("Image export unavailable. Use SVG card export instead.");
      return;
    }
    await downloadPngCard(`${runHighlightBundle.exportPayload.codename.toLowerCase().replaceAll(" ", "-")}-highlight.png`, media.imageDataUrl);
    setShareStatus("Image card downloaded.");
  }

  async function downloadHighlightClip() {
    if (!runHighlightBundle) return;
    const result = await exportHighlightClip(runHighlightBundle);
    setShareStatus(result.ok ? "Highlight clip downloaded." : result.error || "Clip export failed.");
  }

  function startOnboardingOperation() {
    if (introOperation?.id) {
      setSelectedOperationId(introOperation.id);
    }
    setStoredShareRecord(null);
    setShareUrl(null);
    setShareStatus(null);
    setOnboardingStage("first_run");
    if (typeof document !== "undefined") {
      window.requestAnimationFrame(() => {
        const canvas = document.querySelector("canvas");
        if (canvas instanceof HTMLCanvasElement && typeof canvas.requestPointerLock === "function") {
          canvas.requestPointerLock();
        }
      });
    }
  }

  function finishOnboardingDebrief() {
    setShareStatus("Full campaign unlocked. Advanced operations, co-op, and archive systems are now visible.");
    setOnboardingStage("complete");
  }

  return (
    <div className="relative min-h-screen">
      <AudioTensionController />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(177,31,31,0.16),_transparent_26%),linear-gradient(180deg,rgba(7,7,7,0.4),rgba(4,4,4,0.1))]" />
      <div className={`mx-auto grid min-h-screen max-w-[1820px] gap-5 px-4 py-4 ${liveGameplayActive ? "xl:grid-cols-[minmax(0,1fr)]" : "xl:grid-cols-[460px_minmax(0,1fr)]"}`}>
        {!liveGameplayActive ? (
        <section className="relative z-10 flex h-full flex-col gap-4">
          {showFullShell ? (
            <>
          <div className="panel-surface panel-hero rounded-[34px] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Mission Ops</p>
                <h1 className="mt-3 text-4xl font-semibold leading-none text-neutral-50">{selectedOperation?.title || foundationShell.title}</h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-400">{selectedOperation?.summary || foundationShell.summary}</p>
                {selectedStory ? (
                  <p className="mt-3 text-xs uppercase tracking-[0.24em] text-neutral-500">
                    {selectedStory.codename} / {selectedStory.emotionalTone} / {formatNarrativeRole(selectedStory.identity.narrativeRole)}
                  </p>
                ) : null}
              </div>
              <div className="hidden rounded-[24px] border border-white/8 bg-black/20 px-4 py-3 text-right md:block">
                <div className="eyebrow">Target</div>
                <div className="mt-2 text-base font-medium text-neutral-100">{selectedOperation?.runtimeConfig.targetProfile.label || target?.label || "Consul Lucien Vale"}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.22em] text-neutral-500">{selectedOperation?.runtimeConfig.worldRegion || "Azure Meridian / summit floor"}</div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className={`signal-card ${statusTone(accessState === "legal" ? "calm" : accessState === "soft_restricted" ? "warn" : "danger")}`}>
                <span className="signal-label">Current Access</span>
                <span className="signal-value">{describeZoneLegality(currentZone, accessState)}</span>
              </div>
              <div className={`signal-card ${statusTone(globalAlertLevel >= 2 ? "danger" : globalAlertLevel > 0 ? "warn" : "calm")}`}>
                <span className="signal-label">District Alert</span>
                <span className="signal-value">{globalAlertLevel.toFixed(1)} / 4.0</span>
              </div>
              <div className={`signal-card ${statusTone(suspicion >= 65 ? "danger" : suspicion >= 28 ? "warn" : "calm")}`}>
                <span className="signal-label">Suspicion</span>
                <span className="signal-value">{Math.round(suspicion)} / 100</span>
              </div>
              <div className={`signal-card ${statusTone(targetWindowState === "vulnerable" ? "opportunity" : targetWindowState === "relocating" ? "warn" : "calm")}`}>
                <span className="signal-label">Target Window</span>
                <span className="signal-value">{targetWindowState}</span>
              </div>
            </div>

            <div className="mt-5 mission-ribbon">
              <div>
                <div className="mission-ribbon-label">Operation Phase</div>
                <div className="mission-ribbon-value">{operationPhase}</div>
              </div>
              <div>
                <div className="mission-ribbon-label">Field Posture</div>
                <div className="mission-ribbon-copy">{pressureSummary}</div>
              </div>
              <div>
                <div className="mission-ribbon-label">District Pressure</div>
                <div className="mission-ribbon-copy">{worldResponseSummary}</div>
              </div>
              <div>
                <div className="mission-ribbon-label">Tension Audio</div>
                <button className="mission-ribbon-copy text-left transition hover:text-neutral-200" type="button" onClick={() => setAudioEnabled(!audioEnabled)}>
                  {audioUnlocked ? `${audioEnabled ? "live" : "muted"} / ${audioState}` : "awaiting user input"}
                </button>
              </div>
            </div>
          </div>

          <div className="panel-surface rounded-[34px] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Campaign Board</p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-50">{campaign ? campaign.chapterLabel : "Resistance command uplink"}</h2>
              </div>
              <div className={`status-chip ${worldError ? "status-danger" : loadingWorld ? "status-warn" : "status-opportunity"}`}>
                {worldError ? "uplink degraded" : loadingWorld ? "syncing world" : "world synced"}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="signal-card signal-neutral">
                <span className="signal-label">Regime Stability</span>
                <span className="signal-value">{campaign ? `${campaign.regimeStability}%` : "--"}</span>
              </div>
              <div className="signal-card signal-opportunity">
                <span className="signal-label">Resistance Momentum</span>
                <span className="signal-value">{campaign ? `${campaign.resistanceMomentum}%` : "--"}</span>
              </div>
              <div className="signal-card signal-warn">
                <span className="signal-label">Public Fear</span>
                <span className="signal-value">{campaign ? `${campaign.publicFear}%` : "--"}</span>
              </div>
              <div className="signal-card signal-neutral">
                <span className="signal-label">Story Network</span>
                <span className="signal-value">{world?.liveContent?.availableStoryMissionCount ?? progress.unlockedMissionIds.length}</span>
              </div>
              <div className="signal-card signal-opportunity">
                <span className="signal-label">Co-op Ops Resolved</span>
                <span className="signal-value">{sharedContribution?.coopOperationsResolved ?? 0}</span>
              </div>
              <div className="signal-card signal-neutral">
                <span className="signal-label">Agents Deployed</span>
                <span className="signal-value">{sharedContribution?.totalAgentsDeployed ?? 0}</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="brief-card">
                <div className="brief-title">Active countermeasure</div>
                <div className="brief-copy">{world?.liveContent?.activeCountermeasure || "Iron Meridian command is evaluating new containment doctrine."}</div>
              </div>
              <div className="brief-card">
                <div className="brief-title">Resistance opportunity</div>
                <div className="brief-copy">{world?.liveContent?.activeResistanceOpportunity || "Field cells are waiting for proof that the machine can be made to break."}</div>
              </div>
              <div className="brief-card">
                <div className="brief-title">Recommended next operation</div>
                <div className="brief-copy">
                  {selectedOperation
                    ? `${selectedOperation.story.codename}. ${selectedOperation.story.narrative.futureHook} ${selectedOperation.story.delivery.callbackHooks[0]}`
                    : "Hold the current mission line until the campaign uplink refreshes."}
                </div>
              </div>
              <div className="brief-card">
                <div className="brief-title">Shared campaign pressure</div>
                <div className="brief-copy">
                  {sharedContribution
                    ? `${sharedContribution.sharedDisruptions} shared disruptions recorded across ${sharedContribution.sectorsWeakened.length || 0} weakened sectors.`
                    : "Shared campaign contribution feed is still coming online."}
                </div>
              </div>
              <div className="brief-card">
                <div className="brief-title">Campaign memory</div>
                <div className="brief-copy">
                  {continuity.primaryCallback
                    ? `${continuity.primaryCallback.codename}. ${continuity.primaryCallback.summary} ${continuity.primaryCallback.unresolvedRisk}`
                    : "The campaign archive is waiting for the next operation scar."}
                </div>
              </div>
              <div className="brief-card">
                <div className="brief-title">Active narrative thread</div>
                <div className="brief-copy">
                  {selectedStory
                    ? `${formatNarrativeRole(selectedStory.arc.thread)} / ${selectedStory.arc.predecessorCondition} ${selectedStory.delivery.callbackHooks[2]}`
                    : "Narrative thread uplink pending."}
                </div>
              </div>
              <div className="brief-card">
                <div className="brief-title">Operation worth retrying</div>
                <div className="brief-copy">
                  {activeChallenge
                    ? `${activeChallenge.codename}. ${activeChallenge.beatThisText}`
                    : "The archive will nominate a retry-worthy operation as soon as your first challenge payload lands."}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[28px] border border-white/8 bg-black/15 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="eyebrow">Operation Network</div>
                  <div className="mt-2 text-lg font-semibold text-neutral-50">
                    {world?.liveContent?.availableStoryMissionCount ?? progress.unlockedMissionIds.length} authored-feeling operations routed through this campaign fabric
                  </div>
                </div>
                <div className="text-right text-xs uppercase tracking-[0.22em] text-neutral-500">
                  {selectedStory ? `${selectedStory.codename} / ${formatThreatTempo(selectedStory)}` : "network uplink pending"}
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {operationClusters.slice(0, 4).map((cluster) => (
                  <div key={cluster.sector.id} className={`rounded-[24px] border px-4 py-4 ${selectedCluster?.sector.id === cluster.sector.id ? "border-red-400/40 bg-red-500/5" : "border-white/8 bg-black/10"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="brief-title">{cluster.sector.label} / {cluster.sector.status}</div>
                        <div className="brief-copy">
                          {formatSectorMetric("surveillance", cluster.sector.surveillanceCoverage)} / {formatSectorMetric("unrest", cluster.sector.civilianUnrest)} / {formatSectorMetric("resistance", cluster.sector.resistanceSupport)} / liberation {cluster.liberation}%
                        </div>
                      </div>
                      <div className="text-right text-[10px] uppercase tracking-[0.22em] text-neutral-500">
                        {cluster.adaptation
                          ? `verify ${cluster.adaptation.verificationPressure}% / unrest ${cluster.adaptation.unrestOpportunity}%`
                          : "adaptation pending"}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      {cluster.operations.length ? (
                        cluster.operations.map((operation) => (
                          <button
                            key={operation.id}
                            className={`brief-card text-left transition ${selectedOperation?.id === operation.id ? "ring-1 ring-red-400/60" : ""}`}
                            onClick={() => setSelectedOperationId(operation.id)}
                            type="button"
                          >
                            <div className="brief-title">{operation.story.codename} / {operation.priority} / {operation.type.replaceAll("_", " ")}</div>
                            <div className="brief-copy">
                              {operation.title}. {operation.story.delivery.briefingTone} {operation.story.delivery.briefingHook} Team {operation.runtimeConfig.recommendedTeamSize}-{operation.runtimeConfig.maxTeamSize}
                              {quickMatchOperationIds.includes(operation.id) ? " / quick match ready" : ""}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.22em] text-neutral-500">
                              {operation.story.boardTags.map((tag) => (
                                <span key={tag} className="status-chip status-muted">{tag}</span>
                              ))}
                            </div>
                            <div className="mt-2 text-xs leading-5 text-neutral-500">
                              {operation.story.arc.followUpHook}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="brief-card">
                          <div className="brief-title">Locked follow-up lane</div>
                          <div className="brief-copy">No active operation is surfacing here yet. Pressure and memory callbacks will unlock future branches.</div>
                        </div>
                      )}

                      {cluster.scars.slice(0, 2).map((scar) => (
                        <div key={scar} className="brief-card">
                          <div className="brief-title">Sector scar</div>
                          <div className="brief-copy">{scar}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="brief-card">
                  <div className="brief-title">Branch candidates</div>
                  <div className="brief-copy">
                    {branchCandidates.length
                      ? branchCandidates.map((operation) => `${operation.story.codename}: ${operation.story.narrative.futureHook}`).join(" / ")
                      : "Branch candidates will appear once the board rotates."}
                  </div>
                </div>
                <div className="brief-card">
                  <div className="brief-title">Locked future missions</div>
                  <div className="brief-copy">{lockedFutureMissions.join(" / ") || "Future branches will reveal as sectors fracture."}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[28px] border border-white/8 bg-black/15 p-4">
                  <div className="eyebrow">Recent Greatest Moments</div>
                  <div className="mt-3 grid gap-2">
                    {recentHighlights.length ? (
                      recentHighlights.slice(0, 3).map((highlight) => (
                        <div key={highlight.id} className="brief-card">
                          <div className="brief-title">{highlight.headline}</div>
                          <div className="brief-copy">{highlight.recap} {highlight.challenge.beatThisText}</div>
                        </div>
                      ))
                    ) : (
                      <div className="brief-card">
                        <div className="brief-title">Archive waiting</div>
                        <div className="brief-copy">Strong runs will surface here as soon as the district gives you something worth boasting about.</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-[28px] border border-white/8 bg-black/15 p-4">
                  <div className="eyebrow">Campaign Legend Feed</div>
                  <div className="mt-3 grid gap-2">
                    {legendMoments.length ? (
                      legendMoments.slice(0, 4).map((moment) => (
                        <div key={moment.id} className="brief-card">
                          <div className="brief-title">{moment.category}</div>
                          <div className="brief-copy">{moment.headline}. {moment.challengeText}</div>
                        </div>
                      ))
                    ) : (
                      <div className="brief-card">
                        <div className="brief-title">Legend feed idle</div>
                        <div className="brief-copy">The campaign starts naming your signature moments once a few archive-worthy runs exist.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {cloudProfile ? (
                <div className="mt-4 rounded-[28px] border border-white/8 bg-black/15 p-4">
                  <div className="eyebrow">Return Loop</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="brief-card">
                      <div className="brief-title">New challenges available</div>
                      <div className="brief-copy">
                        {progress.lastChallengePayload?.beatThisText || "A new challenge will appear after your next archive-worthy run."}
                      </div>
                    </div>
                    <div className="brief-card">
                      <div className="brief-title">Your run was beaten</div>
                      <div className="brief-copy">
                        {returnLoopMessages.find((entry) => entry.type === "challenge_beaten")?.message || "No rival completion has landed against your latest public run yet."}
                      </div>
                    </div>
                    <div className="brief-card">
                      <div className="brief-title">Growth pulse</div>
                      <div className="brief-copy">
                        {cloudProfile.stats.shareClicks} clicks / {cloudProfile.stats.challengeCompletions} completions / {cloudProfile.stats.returningUsers} returns.
                      </div>
                    </div>
                  </div>
                  {returnLoopMessages.length ? (
                    <div className="mt-3 grid gap-2">
                      {returnLoopMessages.map((entry) => (
                        <div key={entry.id} className="brief-card">
                          <div className="brief-title">{entry.type.replaceAll("_", " ")}</div>
                          <div className="brief-copy">{entry.message}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="panel-surface rounded-[34px] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Co-op Network</p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-50">Resistance session uplink</h2>
              </div>
              <div className={`status-chip ${backendError ? "status-danger" : backendConnected ? "status-opportunity" : "status-warn"}`}>
                {backendError ? "backend fault" : backendConnected ? "backend live" : "standby"}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="brief-card">
                <div className="brief-title">Agent handle</div>
                <input
                  className="mt-2 w-full rounded-[16px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none"
                  value={agentNameInput}
                  onChange={(event) => setAgentNameInput(event.target.value.slice(0, 18))}
                  onBlur={() => setLocalProfile(agentNameInput || localProfileName, localRole)}
                  placeholder="Resistance agent name"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button className="ui-button" type="button" onClick={() => createSession({ operationId: selectedOperation?.id || null, privacy: "private" })}>
                  host private op
                </button>
                <button className="ui-button" type="button" onClick={() => quickMatch(selectedOperation?.id || null)}>
                  quick match
                </button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                <input
                  className="rounded-[16px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none"
                  value={sessionCodeInput}
                  onChange={(event) => setSessionCodeInput(event.target.value.toUpperCase())}
                  placeholder="enter lobby code"
                />
                <button className="ui-button" type="button" onClick={() => joinSession(sessionCodeInput)}>
                  join
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="signal-card signal-neutral">
                <span className="signal-label">Session status</span>
                <span className="signal-value">{multiplayerStatus}</span>
              </div>
              <div className="signal-card signal-opportunity">
                <span className="signal-label">Lobby code</span>
                <span className="signal-value">{multiplayerCode || "offline"}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {multiplayerSessionId ? (
                <>
                  <div className="brief-card">
                    <div className="brief-title">Session summary</div>
                    <div className="brief-copy">{teamSummary || `${multiplayerPlayers.length} agents linked to ${selectedOperation?.title || "current operation"}.`}</div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {multiplayerPlayers.map((player) => (
                      <div key={player.playerId} className="brief-card">
                        <div className="brief-title">{player.name}</div>
                        <div className="brief-copy">
                          {player.role} / {player.ready ? "ready" : "staging"} / {player.connected ? "connected" : "reconnecting"} / {player.disguiseId.replaceAll("_", " ")}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="ui-button" type="button" onClick={() => setReady(true)}>
                      ready up
                    </button>
                    <button className="ui-button" type="button" onClick={() => leaveSession()}>
                      leave session
                    </button>
                  </div>
                  {missionState ? (
                    <div className="brief-card">
                      <div className="brief-title">Shared mission state</div>
                      <div className="brief-copy">
                        alert {missionState.globalAlertLevel.toFixed(1)} / extraction {missionState.extractionState} / incidents {missionState.activeIncidents.length} / assists {missionState.teamObjectives.assistCount}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="brief-card">
                  <div className="brief-title">Co-op readiness</div>
                  <div className="brief-copy">
                    Use a private op for coordinated stealth or quick match to join another cell. Solo remains fully playable if the multiplayer backend is unavailable.
                  </div>
                </div>
              )}
              {backendError ? (
                <div className="brief-card">
                  <div className="brief-title">Backend note</div>
                  <div className="brief-copy">{backendError}</div>
                </div>
              ) : null}
            </div>
          </div>

          {operationsOpen ? (
            <>
              <div className="panel-surface rounded-[34px] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">Live Ops</p>
                    <h2 className="mt-2 text-xl font-semibold text-neutral-50">Current field picture</h2>
                  </div>
                  <button className="ui-button" onClick={() => setCameraMode(cameraMode === "third_person" ? "first_person" : "third_person")}>
                    {cameraMode === "third_person" ? "switch to first-person" : "return to third-person"}
                  </button>
                </div>

                <div className={`event-beat event-beat-${presentationBeat.tone} mt-4`}>
                  <div>
                    <div className="event-beat-eyebrow">{presentationBeat.eyebrow}</div>
                    <div className="event-beat-title">{presentationBeat.title}</div>
                    <div className="event-beat-copy">{presentationBeat.copy}</div>
                  </div>
                  <div className="event-beat-meta">
                    <span className={`status-chip ${statusTone(presentationBeat.tone)}`}>{presentationBeat.tone}</span>
                    <span className="status-chip status-muted">{currentZone?.label || "transit"}</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="signal-card signal-neutral">
                    <span className="signal-label">Disguise</span>
                    <span className="signal-value">{disguise.label}</span>
                  </div>
                  <div className={`signal-card ${statusTone(activeWatcherIds.length ? "danger" : "calm")}`}>
                    <span className="signal-label">Watcher Pressure</span>
                    <span className="signal-value">{activeWatcherIds.length ? `${activeWatcherIds.length} tracking` : "clear"}</span>
                  </div>
                  <div className={`signal-card ${statusTone(challengers.length ? "danger" : "calm")}`}>
                    <span className="signal-label">Nearby Challenge</span>
                    <span className="signal-value">{challengers.length ? `${challengers.length} responders` : "none"}</span>
                  </div>
                  <div className={`signal-card ${statusTone(dangerZones.length ? "warn" : "calm")}`}>
                    <span className="signal-label">Danger Zones</span>
                    <span className="signal-value">{dangerZones.length}</span>
                  </div>
                </div>

                <div className="mt-5 stealth-meter stealth-meter-large">
                  <div className="stealth-meter-line">
                    <div className={`stealth-meter-fill ${suspicion >= 65 ? "danger-fill" : suspicion >= 28 ? "warn-fill" : "calm-fill"}`} style={{ width: `${suspicion}%` }} />
                  </div>
                  <div className="stealth-meter-thresholds">
                    <span>noticed</span>
                    <span>suspicious</span>
                    <span>investigating</span>
                    <span>compromised</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  <div className="brief-card">
                    <div className="brief-title">Operation identity</div>
                    <div className="brief-copy">
                      {selectedStory
                        ? `${selectedStory.codename} is a ${selectedStory.emotionalTone} ${selectedStory.pacingType.replaceAll("_", " ")} episode targeting ${formatNarrativeRole(selectedStory.identity.regimeSystem)}. ${selectedStory.delivery.targetBehaviorNote}`
                        : "Operation identity uplink pending."}
                    </div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Current beat</div>
                    <div className="brief-copy">{presentationBeat.copy}</div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Clip-worthy moment</div>
                    <div className="brief-copy">
                      {notableMoments[0]
                        ? `${notableMoments[0].label}. ${notableMoments[0].summary}`
                        : "The operation is still building toward a bigger spike worth remembering."}
                    </div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Primary</div>
                    <div className="brief-copy">{mission.targetEliminated ? "Target eliminated. Control the scene and move to extraction." : "Keep contact on Vale without escalating the district faster than the route network can absorb."}</div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Secondary</div>
                    <div className="brief-copy">{mission.secondaryObjectiveComplete ? `Ledger secured via ${mission.secondaryObjectiveSource?.replaceAll("_", " ")}.` : "Ledger still unsecured. The annex transfer and security hub remain the cleanest routes."}</div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Route posture</div>
                    <div className="brief-copy">Unlocked: {unlockedRoutes.length ? unlockedRoutes.join(", ") : "core routes only"} / detour {mission.activeDetour.replaceAll("_", " ")} / escort {mission.escortSplit === "none" ? "tight" : mission.escortSplit}</div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Situation</div>
                    <div className="brief-copy">
                      {leadIncident
                        ? `Current pressure is ${leadIncident.category} in ${leadIncident.zoneClusterId}. ${guardResponseAssignments.length} assignments are shaping local security response, and target protection is ${missionPressure.targetProtection}.`
                        : `No dominant incident is owning the district. ${challengers.length ? `${challengers.length} nearby responders still read your space.` : "Local posture remains comparatively loose."}`}
                    </div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Target movement</div>
                    <div className="brief-copy">
                      {target
                        ? `${target.label} is on ${target.currentRouteId?.replaceAll("-", " ") || "an unknown route"} and currently ${target.state}.`
                        : "Target position unresolved."}
                    </div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Mission pressure</div>
                    <div className="brief-copy">
                      Annex {missionPressure.annexPressure ? "hot" : "stable"} / ballroom {missionPressure.ballroomPressure ? "hot" : "stable"} / security {missionPressure.securityPressure ? "hot" : "stable"} / extraction risk {missionPressure.extractionRisk}.
                    </div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Response chain</div>
                    <div className="brief-copy">{worldResponseSummary}</div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Continuous story pressure</div>
                    <div className="brief-copy">
                      {continuity.primaryCallback
                        ? `This district still carries ${continuity.primaryCallback.codename}. ${continuity.primaryCallback.impactSummary}`
                        : "No earlier sector scar is dominating this run yet."}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="threat-card">
                    <div className="threat-card-label">Responder posture</div>
                    <div className="threat-card-value">{activeInvestigators.length ? `${activeInvestigators.length} active teams` : "routine patrol pattern"}</div>
                  </div>
                  <div className="threat-card">
                    <div className="threat-card-label">Escort geometry</div>
                    <div className="threat-card-value">{mission.escortSplit === "none" ? "tight diamond" : `${mission.escortSplit} separation`}</div>
                  </div>
                  <div className="threat-card">
                    <div className="threat-card-label">Extraction status</div>
                    <div className="threat-card-value">{mission.targetEliminated ? "marina window live" : "locked until target falls"}</div>
                  </div>
                </div>
              </div>

              <details className="panel-surface rounded-[34px] p-5" open={aiDebug}>
                <summary className="cursor-pointer list-none select-none">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="eyebrow">Operations Detail</p>
                      <h3 className="mt-2 text-lg font-semibold text-neutral-50">Secondary telemetry and field notes</h3>
                    </div>
                    <button className="ui-button" type="button" onClick={(event) => { event.preventDefault(); toggleAiDebug(); }}>
                      {aiDebug ? "hide debug paths" : "show debug paths"}
                    </button>
                  </div>
                </summary>

                <div className="mt-4 grid gap-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    {liveOperations.map((operation) => (
                      <div key={operation.id} className="brief-card">
                        <div className="brief-title">{operation.priority} / {operation.type.replaceAll("_", " ")}</div>
                        <div className="brief-copy">{operation.title}. {operation.objective}</div>
                      </div>
                    ))}
                    {challengeBoard.map((challenge) => (
                      <div key={challenge.id} className="brief-card">
                        <div className="brief-title">{challenge.cadence} directive</div>
                        <div className="brief-copy">{challenge.label}. {challenge.goal}</div>
                      </div>
                    ))}
                    {activeMissionChains.map((chain) => (
                      <div key={chain.id} className="brief-card">
                        <div className="brief-title">mission chain</div>
                        <div className="brief-copy">{chain.label}. {chain.trigger} {chain.followUp}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm text-neutral-300">
                    <div className="brief-card">
                      <div className="brief-title">Zone</div>
                      <div className="brief-copy">{currentZone?.label || currentZoneId}</div>
                    </div>
                    <div className="brief-card">
                      <div className="brief-title">Dominant risk</div>
                      <div className="brief-copy">{dominantRiskSource.replaceAll("_", " ")}</div>
                    </div>
                    <div className="brief-card">
                      <div className="brief-title">Responders</div>
                      <div className="brief-copy">{activeInvestigators.length} active / {guardResponseAssignments.length} assigned</div>
                    </div>
                    <div className="brief-card">
                      <div className="brief-title">Civilians fleeing</div>
                      <div className="brief-copy">{civiliansFleeing.length}</div>
                    </div>
                    <div className="brief-card">
                      <div className="brief-title">Asset readiness</div>
                      <div className="brief-copy">
                        {assetCoverage.characters} character / {assetCoverage.animations} animation / {assetCoverage.hdris} hdri entries in the active runtime registry.
                      </div>
                    </div>
                    <div className="brief-card">
                      <div className="brief-title">Animation coverage</div>
                      <div className="brief-copy">
                        idle {assetCoverage.animationCoverage.idle}, walk {assetCoverage.animationCoverage.walk}, alert {assetCoverage.animationCoverage.alert}, search {assetCoverage.animationCoverage.search}, target {assetCoverage.animationCoverage.target}
                      </div>
                    </div>
                    <div className="brief-card">
                      <div className="brief-title">Campaign unlocks</div>
                      <div className="brief-copy">{progress.unlockedStarts.length} starts / {progress.unlockedModifiers.length} modifiers / {progress.codexEntries.length} codex entries</div>
                    </div>
                    <div className="brief-card">
                      <div className="brief-title">Liberation pressure</div>
                      <div className="brief-copy">
                        {campaign?.sectors.map((sector) => `${sector.label}: ${progress.sectorLiberation[sector.id] || 0}%`).join(" / ") || "world uplink pending"}
                      </div>
                    </div>
                    <div className="brief-card">
                      <div className="brief-title">Sector adaptation</div>
                      <div className="brief-copy">
                        {sectorAdaptationFlags.length
                          ? sectorAdaptationFlags
                              .slice(0, 2)
                              .map((flag) => `${flag.sectorId}: verify ${flag.verificationPressure}% / unrest ${flag.unrestOpportunity}%`)
                              .join(" / ")
                          : "Adaptation data pending"}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {notableMoments.map((moment) => (
                      <div key={moment.id} className="event-log-card rounded-[24px] border border-red-500/20 bg-red-950/10 px-4 py-3 text-sm text-neutral-200">
                        <div className={`text-[10px] uppercase tracking-[0.26em] ${moment.severity === "critical" ? "text-red-300" : moment.severity === "warning" ? "text-amber-300" : "text-emerald-300"}`}>highlight</div>
                        <div className="mt-2 font-medium">{moment.label}</div>
                        <div className="mt-1 leading-6 text-neutral-400">{moment.summary}</div>
                      </div>
                    ))}
                    {recentEvents.map((event) => (
                      <div key={event.id} className="event-log-card rounded-[24px] border border-white/8 bg-black/20 px-4 py-3 text-sm text-neutral-300">
                        <div className={`text-[10px] uppercase tracking-[0.26em] ${event.severity === "critical" ? "text-red-400" : event.severity === "warning" ? "text-amber-300" : "text-neutral-500"}`}>{event.severity}</div>
                        <div className="mt-2 leading-6">{event.text}</div>
                      </div>
                    ))}
                    {recentLog.map((entry, index) => (
                      <div key={`${entry}-${index}`} className="rounded-[24px] border border-white/8 bg-black/20 px-4 py-3 text-sm leading-6 text-neutral-400">
                        {entry}
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </>
          ) : null}
            </>
          ) : (
            <>
              <div className="panel-surface panel-hero rounded-[34px] p-6">
                <p className="eyebrow">{isOnboardingIntro ? "First Operation" : isOnboardingDebrief ? "Operation Complete" : "Operation Live"}</p>
                <h1 className="mt-3 text-4xl font-semibold leading-none text-neutral-50">
                  {isOnboardingIntro
                    ? "Move fast. Stay hidden. Finish the operation."
                    : isOnboardingDebrief
                      ? "You got in. You adapted. You finished the operation."
                      : selectedOperation?.title || "Operation active"}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-400">
                  {isOnboardingIntro
                    ? "One click. One target. One clean way out."
                    : isOnboardingDebrief
                      ? "The full campaign opens now: more operations, deeper pressure, replay, sharing, and co-op."
                      : selectedOperation?.summary || foundationShell.summary}
                </p>

                <div className="mt-5 grid gap-3">
                  {isOnboardingIntro ? (
                    <button className="ui-button mt-2 text-lg" type="button" onClick={startOnboardingOperation}>
                      {onboardingPrimaryButtonLabel}
                    </button>
                  ) : isOnboardingDebrief ? (
                    <>
                      <div className="brief-card">
                        <div className="brief-title">Unlocked</div>
                        <div className="brief-copy">
                          The campaign board is live. More operations, co-op runs, replay, sharing, and the full pressure model are now open.
                        </div>
                      </div>
                      <button className="ui-button mt-2 text-lg" type="button" onClick={finishOnboardingDebrief}>
                        {onboardingPrimaryButtonLabel}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="grid gap-3">
                        <div className="brief-card">
                          <div className="brief-title">Target</div>
                          <div className="brief-copy">{selectedOperation?.runtimeConfig.targetProfile.label || target?.label || "Primary target"}</div>
                        </div>
                        <div className="brief-card">
                          <div className="brief-title">Objective</div>
                          <div className="brief-copy">{isSimpleFirstRun ? "GO THERE" : onboardingObjective}</div>
                        </div>
                        {!isSimpleFirstRun ? (
                          <>
                            <div className="brief-card">
                              <div className="brief-title">Location</div>
                              <div className="brief-copy">{onboardingLocation}</div>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-3">
                              <div className={`signal-card ${statusTone(accessState === "legal" ? "calm" : accessState === "soft_restricted" ? "warn" : "danger")}`}>
                                <span className="signal-label">Access</span>
                                <span className="signal-value">{describeZoneLegality(currentZone, accessState)}</span>
                              </div>
                              <div className={`signal-card ${statusTone(suspicion >= 32 || globalAlertLevel >= 1.2 ? "warn" : "calm")}`}>
                                <span className="signal-label">Pressure</span>
                                <span className="signal-value">{currentPrompt || "Stay out of sight."}</span>
                              </div>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
        ) : null}

        <section className="relative overflow-hidden rounded-[36px] border border-white/8 bg-neutral-950/95 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
          <EnvironmentCanvas selectedOperation={selectedOperation} missionState={mission} />
          {(showFullShell ? missionWindowOpen : scoreOpen) ? <div className="mission-window-backdrop pointer-events-none" aria-hidden="true" /> : null}

          {liveGameplayActive ? (
            <div className="pointer-events-none absolute left-4 top-4 z-20 flex max-w-[320px] flex-col gap-2">
              <div className="rounded-[20px] border border-white/10 bg-black/70 px-4 py-3 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur">
                <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-500">Target</div>
                <div className="mt-1 text-sm font-semibold text-neutral-50">{selectedOperation?.runtimeConfig.targetProfile.label || target?.label || "Primary target"}</div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-black/70 px-4 py-3 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur">
                <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-500">Objective</div>
                <div className="mt-1 text-sm font-semibold text-neutral-50">{isSimpleFirstRun ? "GO THERE" : liveObjectiveText}</div>
              </div>
            </div>
          ) : null}

          {showFullShell && !liveGameplayActive && activeShareRecord ? (
            <div className="rounded-[28px] border border-red-400/20 bg-red-950/10 p-4">
              <div className="eyebrow">Shared Challenge</div>
              <div className="mt-2 text-2xl font-semibold text-neutral-50">{activeShareRecord.headline}</div>
              <div className="mt-2 text-sm leading-6 text-neutral-300">{activeShareRecord.recap}</div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="brief-card">
                  <div className="brief-title">Why it mattered</div>
                  <div className="brief-copy">{activeShareRecord.campaignImpact || activeShareRecord.consequenceLine || "Campaign impact is stabilizing."}</div>
                </div>
                <div className="brief-card">
                  <div className="brief-title">Challenge hook</div>
                  <div className="brief-copy">
                    {activeShareRecord.challenge?.beatThisText || activeShareRecord.replaySeed.challengeHook}
                  </div>
                </div>
              </div>
              {activeShareRecord.analytics ? (
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <div className="signal-card signal-neutral"><span className="signal-label">Views</span><span className="signal-value">{activeShareRecord.analytics.views}</span></div>
                  <div className="signal-card signal-neutral"><span className="signal-label">Launches</span><span className="signal-value">{activeShareRecord.analytics.launches}</span></div>
                  <div className="signal-card signal-neutral"><span className="signal-label">Completions</span><span className="signal-value">{activeShareRecord.analytics.completions}</span></div>
                  <div className="signal-card signal-neutral"><span className="signal-label">Unique Visitors</span><span className="signal-value">{activeShareRecord.analytics.uniqueVisitors}</span></div>
                </div>
              ) : null}
            </div>
          ) : null}

          {showFullShell && briefingOpen ? (
            <div className="mission-window-shell">
              <div className="mission-window mission-window-briefing">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="eyebrow">Mission Briefing</p>
                    <h2 className="mt-2 text-2xl font-semibold text-neutral-50">{selectedStory ? `${selectedStory.codename} operational picture` : "Azure Meridian operational picture"}</h2>
                  </div>
                  <div className="status-chip status-muted">auto-collapses on movement</div>
                </div>

                <div className="mt-5 grid gap-4 mission-window-grid">
                  <div className="brief-card">
                    <div className="brief-title">Codename</div>
                    <div className="brief-copy">{selectedStory ? `${selectedStory.codename}. ${selectedStory.operationFantasy} ${selectedStory.delivery.briefingTone}` : "Mission codename awaiting uplink."}</div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Operation tension</div>
                    <div className="brief-copy">{selectedStory ? `${selectedStory.delivery.briefingHook} ${selectedStory.delivery.preMissionIntel}` : "The district is under pressure."}</div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Primary objective</div>
                    <div className="brief-copy">{selectedOperation?.runtimeConfig.objectiveBundle.primary || "Eliminate the primary target while preserving a controllable exit."}</div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Secondary objective</div>
                    <div className="brief-copy">{selectedOperation?.runtimeConfig.objectiveBundle.secondary || "Secure the secondary objective without collapsing the route network."}</div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Target dossier</div>
                    <div className="brief-copy">{selectedStory ? `${selectedOperation?.runtimeConfig.targetProfile.label} / ${selectedStory.targetCharacterization} ${selectedStory.delivery.dossierHook}` : "Target dossier uplink pending."}</div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Narrative function</div>
                    <div className="brief-copy">{selectedStory ? `${selectedStory.narrative.campaignMeaning} ${selectedStory.narrative.pressureCreated}` : "Mission narrative function is stabilizing."}</div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Continuity stack</div>
                    <div className="brief-copy">
                      {continuity.primaryCallback
                        ? `Previous echo: ${continuity.primaryCallback.codename}. ${continuity.primaryCallback.impactSummary} ${continuity.primaryCallback.unresolvedRisk}`
                        : "No prior scar is currently dominating this operation window."}
                    </div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Turning point forecast</div>
                    <div className="brief-copy">{selectedStory?.pacing.turningPoint || "Expect a pressure shift once the target window opens."}</div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Extraction note</div>
                    <div className="brief-copy">{selectedOperation?.runtimeConfig.objectiveBundle.extraction || "Extraction guidance is stabilizing."}</div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Why this matters now</div>
                    <div className="brief-copy">
                      {selectedStory
                        ? `${selectedStory.arc.predecessorCondition} ${selectedStory.delivery.callbackHooks[0]} ${selectedStory.narrative.futureHook}`
                        : "Campaign relevance uplink pending."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {isOnboardingDebrief && scoreOpen ? (
            <div className="mission-window-shell">
              <div className="mission-window mission-window-debrief">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="eyebrow">First Mission Debrief</p>
                    <h2 className="mt-3 text-3xl font-semibold text-neutral-50">You got in. You adapted. You finished the operation.</h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400">
                      The summit is open now. Step into the full campaign when you are ready.
                    </p>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-black/25 px-6 py-5 text-right">
                    <div className="eyebrow">Final Score</div>
                    <div className="mt-3 text-4xl font-semibold text-neutral-50">{mission.resultScore ?? "--"}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.22em] text-neutral-500">confidence built</div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="brief-card">
                    <div className="brief-title">Result</div>
                    <div className="brief-copy">{mission.resultRating || "Operation complete"} with the route still in your hands.</div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Expansion</div>
                    <div className="brief-copy">Campaign board, deeper operations, replay, share, and co-op are ready.</div>
                  </div>
                  <div className="brief-card">
                    <div className="brief-title">Next step</div>
                    <div className="brief-copy">Unlock the full experience and choose your next operation.</div>
                  </div>
                </div>

                <div className="mt-6">
                  <button className="ui-button" type="button" onClick={finishOnboardingDebrief}>
                    unlock full campaign
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {showFullShell && scoreOpen ? (
            <div className="mission-window-shell">
              <div className="mission-window mission-window-debrief">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="eyebrow">Post-Mission Debrief</p>
                    <h2 className="mt-3 text-3xl font-semibold text-neutral-50">{selectedStory ? `${selectedStory.codename} / ${mission.resultRating}` : mission.resultRating}</h2>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-400">
                      {runSummaryText(mission.resultScore, mission.resultRating, mission.alarmsTriggered, mission.evidenceLeftBehind)}
                    </p>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-black/25 px-6 py-5 text-right">
                    <div className="eyebrow">Final Score</div>
                    <div className="mt-3 text-4xl font-semibold text-neutral-50">{mission.resultScore}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.22em] text-neutral-500">
                      {mission.durationSeconds ? `${Math.floor(mission.durationSeconds / 60)}m ${mission.durationSeconds % 60}s` : "resolved"}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                  <div className="grid gap-3">
                    {shareStatus ? <div className="status-chip status-opportunity">{shareStatus}</div> : null}
                    {runHighlightBundle ? (
                      <div className="rounded-[28px] border border-red-400/20 bg-red-950/10 p-4">
                        <div className="eyebrow">Highlight Shelf</div>
                        <div className="mt-2 text-xl font-semibold text-neutral-50">{runHighlightBundle.headline}</div>
                        <div className="mt-2 text-sm leading-6 text-neutral-300">{runHighlightBundle.recap}</div>
                        <div className="mt-4 grid gap-2">
                          {runHighlightBundle.topMoments.map((moment) => (
                            <div key={moment.id} className="brief-card">
                              <div className="brief-title">{moment.highlightCategory}</div>
                              <div className="brief-copy">{moment.headline}. {moment.summary}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="brief-card">
                      <div className="brief-title">Run profile</div>
                      <div className="brief-copy">Solution {mission.solution || "unknown"} / disguises used {mission.disguisesUsed.join(", ")} / {mission.secondaryObjectiveComplete ? "primary and secondary resolved" : "secondary left unresolved"}.</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="signal-card signal-neutral"><span className="signal-label">Alarms</span><span className="signal-value">{mission.alarmsTriggered}</span></div>
                      <div className="signal-card signal-neutral"><span className="signal-label">Bodies Found</span><span className="signal-value">{mission.bodiesFound}</span></div>
                      <div className="signal-card signal-neutral"><span className="signal-label">Evidence</span><span className="signal-value">{mission.evidenceLeftBehind}</span></div>
                      <div className="signal-card signal-neutral"><span className="signal-label">Suspicion Peak</span><span className="signal-value">{Math.round(mission.suspicionPeak)}</span></div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[28px] border border-white/8 bg-black/20 p-4">
                      <div className="eyebrow">Score Breakdown</div>
                      <div className="mt-3 grid gap-2">
                        {mission.scoreBreakdown.map((entry) => (
                          <div key={entry.label} className="flex items-center justify-between rounded-[18px] border border-white/6 bg-neutral-950/50 px-3 py-2 text-sm text-neutral-300">
                            <span>{entry.label}</span>
                            <span className={entry.kind === "bonus" ? "text-emerald-300" : entry.kind === "penalty" ? "text-red-300" : "text-neutral-400"}>
                              {entry.value > 0 ? `+${entry.value}` : entry.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-white/8 bg-black/20 p-4">
                      <div className="eyebrow">Challenge Hooks</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {mission.completedChallenges.length ? (
                          mission.completedChallenges.map((challenge) => (
                            <span key={challenge} className="status-chip status-muted">{challenge}</span>
                          ))
                        ) : (
                          <span className="text-sm text-neutral-500">No challenge hooks completed.</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-white/8 bg-black/20 p-4">
                      <div className="eyebrow">Clip Markers</div>
                      <div className="mt-3 grid gap-2">
                        {mission.notableMoments.length ? (
                          mission.notableMoments.map((moment) => (
                            <div key={moment.id} className="brief-card">
                              <div className="brief-title">{moment.label} / {moment.highlightCategory}</div>
                              <div className="brief-copy">{moment.headline}. {moment.summary}</div>
                            </div>
                          ))
                        ) : (
                          <div className="brief-card">
                            <div className="brief-title">No spike captured</div>
                            <div className="brief-copy">The run resolved cleanly but did not trigger a standout moment marker.</div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-white/8 bg-black/20 p-4">
                      <div className="eyebrow">Share / Export</div>
                      <div className="mt-3 grid gap-3">
                        <div className="brief-card">
                          <div className="brief-title">Shareable recap</div>
                          <div className="brief-copy">
                            {shareSummaryText || "A highlight recap will appear here once the run resolves."}
                          </div>
                        </div>
                        {shareUrl ? (
                          <div className="brief-card">
                            <div className="brief-title">Public share URL</div>
                            <div className="brief-copy">{shareUrl}</div>
                          </div>
                        ) : null}
                        {activeShareRecord?.replaySeed ? (
                          <div className="brief-card">
                            <div className="brief-title">Replay seed</div>
                            <div className="brief-copy">
                              {activeShareRecord.replaySeed.seedReference} / {activeShareRecord.replaySeed.challengeRestriction || "no extra restriction"} / team {activeShareRecord.replaySeed.recommendedTeamSize}
                            </div>
                          </div>
                        ) : runHighlightBundle ? (
                          <div className="brief-card">
                            <div className="brief-title">Replay seed</div>
                            <div className="brief-copy">
                              {runHighlightBundle.replaySeed.seedReference} / {runHighlightBundle.replaySeed.challengeRestriction || "no extra restriction"} / team {runHighlightBundle.replaySeed.recommendedTeamSize}
                            </div>
                          </div>
                        ) : null}
                        <div className="grid grid-cols-2 gap-3">
                          <button className="ui-button" type="button" onClick={() => void publishStoredShare()} disabled={!runHighlightBundle || shareBusy}>
                            {shareBusy ? "publishing..." : "publish share url"}
                          </button>
                          <button className="ui-button" type="button" onClick={() => shareSummaryText && void copyText(shareSummaryText, "Recap copied to clipboard.")}>
                            copy recap
                          </button>
                          <button className="ui-button" type="button" onClick={() => void shareNatively()} disabled={!canNativeShare}>
                            native share
                          </button>
                          <button
                            className="ui-button"
                            type="button"
                            onClick={() =>
                              runHighlightBundle &&
                              void copyText(
                                JSON.stringify(runHighlightBundle.exportPayload, null, 2),
                                "Structured share payload copied.",
                              )
                            }
                          >
                            copy payload
                          </button>
                          <button
                            className="ui-button"
                            type="button"
                            onClick={() => {
                              if (!runHighlightBundle) return;
                              downloadSvgCard(`${runHighlightBundle.exportPayload.codename.toLowerCase().replaceAll(" ", "-")}-highlight.svg`, buildShareCardSvg(runHighlightBundle));
                              setShareStatus("Share card downloaded.");
                            }}
                          >
                            download svg
                          </button>
                          <button className="ui-button" type="button" onClick={() => void downloadImageCard()} disabled={!runHighlightBundle}>
                            download image
                          </button>
                          <button className="ui-button" type="button" onClick={() => void downloadHighlightClip()} disabled={!runHighlightBundle}>
                            export clip
                          </button>
                          <button
                            className="ui-button"
                            type="button"
                            onClick={() =>
                              (shareUrl
                                ? void copyText(shareUrl, "Public share URL copied.")
                                : runHighlightBundle &&
                              void copyText(
                                `${window.location.origin}${window.location.pathname}?challenge=${runHighlightBundle.challenge.payloadCode}`,
                                "Challenge link copied.",
                              ))
                            }
                          >
                            {shareUrl ? "copy share url" : "copy challenge link"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-white/8 bg-black/20 p-4">
                      <div className="eyebrow">Operational Readout</div>
                      <div className="mt-3 grid gap-2">
                        <div className="brief-card">
                          <div className="brief-title">Response posture</div>
                          <div className="brief-copy">{worldResponseSummary}</div>
                        </div>
                        <div className="brief-card">
                          <div className="brief-title">Final beat</div>
                          <div className="brief-copy">{presentationBeat.title}. {presentationBeat.copy}</div>
                        </div>
                        <div className="brief-card">
                          <div className="brief-title">Before / after</div>
                          <div className="brief-copy">
                            {currentSector
                              ? `Sector now reads ${currentSector.status}. ${formatSectorMetric("surveillance", currentSector.surveillanceCoverage)} / ${formatSectorMetric("enforcement", currentSector.enforcementPressure)} / liberation ${progress.sectorLiberation[currentSector.id] || 0}%.`
                              : "Sector delta feed is stabilizing."}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-white/8 bg-black/20 p-4">
                      <div className="eyebrow">Aftermath</div>
                      <div className="mt-3 grid gap-2">
                        <div className="brief-card">
                          <div className="brief-title">Resistance reaction</div>
                          <div className="brief-copy">
                            {storyAftermath?.resistanceReaction || latestStoryMemory?.summary || selectedStory?.delivery.aftermathTemplate || "Resistance analysis pending."}
                          </div>
                        </div>
                        <div className="brief-card">
                          <div className="brief-title">After-action report</div>
                          <div className="brief-copy">
                            {storyAftermath?.reportLine || latestStoryMemory?.impactSummary || selectedStory?.delivery.aftermathReportLine || "After-action report uplink pending."}
                          </div>
                        </div>
                        <div className="brief-card">
                          <div className="brief-title">World scar</div>
                          <div className="brief-copy">
                            {storyAftermath?.worldScar || storyState?.sectorScars?.[selectedOperation?.sectorId || ""]?.[0] || "Sector scar data will populate on world sync."}
                          </div>
                        </div>
                        <div className="brief-card">
                          <div className="brief-title">Chain risk</div>
                          <div className="brief-copy">
                            {storyAftermath?.chainRisk || latestStoryMemory?.unresolvedRisk || selectedStory?.delivery.callbackHooks[1] || "Command response forecast is still compiling."}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-white/8 bg-black/20 p-4">
                      <div className="eyebrow">Campaign Consequence</div>
                      <div className="mt-3 grid gap-2">
                        <div className="brief-card">
                          <div className="brief-title">Next pressure point</div>
                          <div className="brief-copy">
                            {liveOperations[0]
                              ? `${liveOperations[0].story.codename}. ${liveOperations[0].story.arc.followUpHook}`
                              : "Campaign uplink is recalculating the next strike window."}
                          </div>
                        </div>
                        <div className="brief-card">
                          <div className="brief-title">Progression pulse</div>
                          <div className="brief-copy">
                            {progress.unlockedStarts.length} starts unlocked / {progress.unlockedIntelAdvantages.length} intel advantages / {progress.operationHistory.length} operations recorded.
                          </div>
                        </div>
                        <div className="brief-card">
                          <div className="brief-title">Agent legacy</div>
                          <div className="brief-copy">
                            {agentLegacy} {progress.discoveredOpportunities.length} opportunities discovered / {Object.values(progress.sectorLiberation).filter((value) => Number(value) >= 20).length} sectors showing your mark.
                          </div>
                        </div>
                        {runHighlightBundle ? (
                          <div className="brief-card">
                            <div className="brief-title">Try this run</div>
                            <div className="brief-copy">{runHighlightBundle.challenge.beatThisText}</div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-white/8 bg-black/20 p-4">
                      <div className="eyebrow">Personal Legend</div>
                      <div className="mt-3 grid gap-2">
                        <div className="brief-card">
                          <div className="brief-title">Pressure trail</div>
                          <div className="brief-copy">{describePressureTrail(missionPressure, storyAftermath)}</div>
                        </div>
                        <div className="brief-card">
                          <div className="brief-title">Signature archive</div>
                          <div className="brief-copy">
                            {legendMoments.length
                              ? legendMoments
                                  .slice(0, 3)
                                  .map((moment) => `${moment.category}: ${moment.headline}`)
                                  .join(" / ")
                              : "No signature archive entries yet."}
                          </div>
                        </div>
                        <div className="brief-card">
                          <div className="brief-title">Recent archive-worthy run</div>
                          <div className="brief-copy">
                            {recentHighlights[0]
                              ? `${recentHighlights[0].headline}. ${recentHighlights[0].campaignImpact}`
                              : "The archive will start tracking your best runs as soon as one lands."}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
