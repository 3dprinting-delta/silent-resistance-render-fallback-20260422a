"use client";

import { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import EnvironmentScene from "@/components/game/EnvironmentScene";
import PlayerController from "@/components/game/PlayerController";
import CameraController from "@/components/game/CameraController";
import InteractionPrompt from "@/components/game/InteractionPrompt";
import MultiplayerSyncController from "@/components/game/MultiplayerSyncController";
import MissionStoryController from "@/components/game/MissionStoryController";
import MomentSpikeController from "@/components/game/MomentSpikeController";
import { useCampaignStore } from "@/game/core/campaignStore";
import { useMultiplayerStore } from "@/game/core/multiplayerStore";
import { foundationLightingProfiles, foundationShell } from "@/game/data/foundationShell";
import { selectCurrentZone, selectHoveredInteractable, usePhaseOneStore } from "@/game/core/phaseOneStore";
import { applyInteractionEffects, getNearestInteractable } from "@/game/systems/interactionSystem";
import { createInitialAiActors, stepAiActors } from "@/game/ai/runtime";
import { getDisguiseById } from "@/game/systems/phaseTwo/disguiseSystem";
import { describeZoneLegality, getZoneAccessProfile } from "@/game/systems/phaseTwo/accessSystem";
import { applySuspicionDelta, composeSuspicionChannels, deriveStealthState, dominantRiskFromBreakdown, totalSuspicionFromChannels } from "@/game/systems/phaseTwo/suspicionSystem";
import { evaluateDetection } from "@/game/systems/phaseTwo/detectionSystem";
import { stateSeverity, summarizeDominantPressure } from "@/game/systems/phaseTwo/stealthFeedbackSystem";
import { collectActiveBlockers } from "@/game/core/phaseOneStore";
import { distance2D } from "@/game/utils/math";
import type { GeneratedMissionDefinition, MissionProgressState, StimulusEvent, Vec3 } from "@/game/core/types";
import {
  consequenceTextForSource,
  emitBehaviorStimulus,
  emitBodyDiscoveryStimulus,
  emitInteractionStimuli,
  emitMissionDeltaStimuli,
  emitMovementSoundStimulus,
  emitSuspicionStimulus,
} from "@/game/systems/incidentSystem";
import {
  deriveMissionPressure,
  getAlarmIncidentKey,
  getNewBodyIncidentIds,
  resolveTargetEliminationFromWorld,
  resolveWorldStateShift,
  shouldHintAlternateLedgerRoute,
} from "@/game/systems/missionConsequenceSystem";
import { finalizeMissionDebrief } from "@/game/systems/debriefSystem";
import { resolveMissionOperation } from "@/lib/worldApi";

function getLightingProfile(zoneId: string) {
  return foundationLightingProfiles.find((profile) => profile.id === zoneId || profile.zoneIds.includes(zoneId)) || foundationLightingProfiles[0];
}

function zoneCenter(zoneId: string): Vec3 {
  const zone = foundationShell.zones.find((entry) => entry.id === zoneId);
  if (!zone) return [0, 1, 18];
  return [
    (zone.bounds.minX + zone.bounds.maxX) / 2,
    zone.height || 1,
    (zone.bounds.minZ + zone.bounds.maxZ) / 2,
  ];
}

function facingToward(from: Vec3, to: Vec3) {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}

function createOnboardingIntroActors(actors: ReturnType<typeof createInitialAiActors>) {
  return actors.map((actor) => {
    if (actor.id === "guard-a") {
      return {
        ...actor,
        currentRouteId: "lobby-guard-loop",
        routeIndex: 4,
        position: [2, 1, 0] as Vec3,
        pauseRemaining: 12.2,
      };
    }
    if (actor.id === "guard-b") {
      return {
        ...actor,
        currentRouteId: "ballroom-guard-loop",
        routeIndex: 4,
        position: [8, 1, 8] as Vec3,
        pauseRemaining: 10.8,
      };
    }
    if (actor.id === "target-voss") {
      return {
        ...actor,
        currentRouteId: "target-ballroom-recovery",
        routeIndex: 0,
        position: [14, 1, -8] as Vec3,
        pauseRemaining: 9.6,
      };
    }
    if (actor.id === "bodyguard-a") {
      return {
        ...actor,
        currentRouteId: "bodyguard-left-cycle",
        routeIndex: 0,
        position: [10, 1, -8] as Vec3,
        pauseRemaining: 10.2,
      };
    }
    if (actor.id === "bodyguard-b") {
      return {
        ...actor,
        currentRouteId: "bodyguard-right-cycle",
        routeIndex: 0,
        position: [18, 1, -10] as Vec3,
        pauseRemaining: 10.2,
      };
    }
    return actor;
  });
}

function resolveOnboardingAnchor() {
  return (foundationShell.interactables.find((item) => item.id === "waiter-jacket")?.position as Vec3 | undefined) || [-16, 1, 20];
}

const SIMPLE_ONBOARDING_TARGET_POSITION: Vec3 = resolveOnboardingAnchor();
const SIMPLE_ONBOARDING_TARGET_ZONE_ID = "grand-lobby";

interface EnvironmentCanvasProps {
  selectedOperation: GeneratedMissionDefinition | null;
  missionState: MissionProgressState;
}

interface CanvasErrorBoundaryProps {
  children: ReactNode;
  onError: (error: Error) => void;
  fallback: ReactNode;
}

interface CanvasErrorBoundaryState {
  error: Error | null;
}

class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  state: CanvasErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): CanvasErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[EnvironmentCanvas] runtime error", error, errorInfo);
    this.props.onError(error);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function DebugFallbackPanel({
  selectedOperation,
  missionState,
  webglSupported,
  rendererStarted,
  sceneInitialized,
  environmentReady,
  runtimeError,
}: {
  selectedOperation: GeneratedMissionDefinition | null;
  missionState: MissionProgressState;
  webglSupported: boolean | null;
  rendererStarted: boolean;
  sceneInitialized: boolean;
  environmentReady: boolean;
  runtimeError: string | null;
}) {
  return (
    <div className="absolute inset-4 z-20 rounded-[28px] border border-red-400/30 bg-neutral-950/90 p-5 text-sm text-neutral-200 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
      <div className="text-[10px] uppercase tracking-[0.26em] text-red-300">Scene Debug</div>
      <div className="mt-3 text-2xl font-semibold text-neutral-50">
        {runtimeError ? "Environment scene failed to initialize" : "Waiting for environment runtime"}
      </div>
      <div className="mt-3 max-w-2xl leading-6 text-neutral-400">
        {runtimeError
          ? runtimeError
          : "The operation shell did not complete startup. Check the console for EnvironmentCanvas and EnvironmentScene logs."}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[22px] border border-white/8 bg-black/30 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Operation</div>
          <div className="mt-2 font-medium text-neutral-100">{selectedOperation?.title || "No selected mission"}</div>
          <div className="mt-1 text-xs text-neutral-500">{selectedOperation?.id || "mission selection missing"}</div>
        </div>
        <div className="rounded-[22px] border border-white/8 bg-black/30 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Renderer</div>
          <div className="mt-2 font-medium text-neutral-100">{rendererStarted ? "WebGL renderer started" : "Renderer not started"}</div>
          <div className="mt-1 text-xs text-neutral-500">
            WebGL support: {webglSupported === null ? "checking" : webglSupported ? "available" : "unavailable"}
          </div>
        </div>
        <div className="rounded-[22px] border border-white/8 bg-black/30 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Scene</div>
          <div className="mt-2 font-medium text-neutral-100">{sceneInitialized ? "Scene init signal received" : "Scene init not reached"}</div>
          <div className="mt-1 text-xs text-neutral-500">Environment ready: {environmentReady ? "true" : "false"}</div>
        </div>
        <div className="rounded-[22px] border border-white/8 bg-black/30 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Mission State</div>
          <div className="mt-2 font-medium text-neutral-100">
            {missionState.missionComplete ? "mission complete" : missionState.targetEliminated ? "exfiltration" : "active"}
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            target eliminated: {missionState.targetEliminated ? "true" : "false"} / extraction ready: {missionState.extractionReady ? "true" : "false"}
          </div>
        </div>
      </div>
    </div>
  );
}

function SceneInitProbe({
  selectedOperation,
  onReady,
}: {
  selectedOperation: GeneratedMissionDefinition | null;
  onReady: () => void;
}) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    console.info("[EnvironmentCanvas] scene probe ready", {
      operationId: selectedOperation?.id ?? null,
      sceneChildren: scene.children.length,
      rendererType: gl.constructor.name,
      cameraType: camera.constructor.name,
    });
    onReady();
  }, [camera, gl, onReady, scene, selectedOperation?.id]);

  return null;
}

function LightingRig() {
  const { scene, gl } = useThree();
  const onboardingStage = useCampaignStore((state) => state.progress.onboardingStage);
  const selectedOperation = useCampaignStore((state) => state.getSelectedOperation());
  const currentZoneId = usePhaseOneStore((state) => state.currentZoneId);
  const suspicion = usePhaseOneStore((state) => state.suspicion);
  const globalAlertLevel = usePhaseOneStore((state) => state.globalAlertLevel);
  const missionPressure = usePhaseOneStore((state) => state.missionPressure);
  const playerPosition = usePhaseOneStore((state) => state.playerPosition);
  const introGuidePulse = useRef(0);
  const profile = getLightingProfile(selectedOperation?.runtimeConfig.lightingProfileId || currentZoneId);
  const fogColor = new THREE.Color(profile.fogColor);
  const warmKey = new THREE.Color(profile.keyColor);
  const fillColor = new THREE.Color(profile.fillColor);
  const accentColor = new THREE.Color(profile.accentColor);
  const isIntroOnboarding = onboardingStage === "first_run" && selectedOperation?.variantId === "azure-summit-fall";
  const pressureBoost = Math.min(
    0.28,
    suspicion / 600 +
      globalAlertLevel * 0.05 +
      (selectedOperation?.runtimeConfig.securityTier === "lockdown" ? 0.05 : selectedOperation?.runtimeConfig.securityTier === "hardened" ? 0.02 : 0),
  );

  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.88;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }, [gl]);

  useFrame((_, delta) => {
    introGuidePulse.current += delta;
    scene.fog = new THREE.Fog(profile.fogColor, profile.fogNear, profile.fogFar);
    gl.toneMappingExposure = THREE.MathUtils.lerp(gl.toneMappingExposure, (isIntroOnboarding ? 0.94 : 0.9) - pressureBoost * 0.14, 0.08);
  });

  const publicFocus = currentZoneId === "gala-ballroom" || currentZoneId === "grand-lobby";
  const vipFocus = currentZoneId === "vip-suite-foyer" || currentZoneId === "annex-tasting-room" || currentZoneId === "rooftop-lounge";
  const serviceFocus = currentZoneId === "west-service-yard" || currentZoneId === "kitchens" || currentZoneId === "basement-service-spine";
  const riskPractical = suspicion >= 45 || globalAlertLevel >= 1.8 || missionPressure.targetProtection !== "routine";
  const introPulse = isIntroOnboarding ? 0.72 + Math.sin(introGuidePulse.current * 1.8) * 0.14 : 0;
  const introPressurePulse = isIntroOnboarding ? 0.64 + Math.sin(introGuidePulse.current * 2.6 + 0.8) * 0.18 : 0;

  return (
    <>
      <color attach="background" args={[profile.fogColor]} />
      <ambientLight intensity={profile.ambientIntensity * (isIntroOnboarding ? 0.72 : 0.86)} color={fillColor} />
      <hemisphereLight intensity={0.14 + profile.ambientIntensity * 0.16} color={warmKey} groundColor={fogColor} />
      <directionalLight
        castShadow
        position={isIntroOnboarding ? [-26, 28, 18] : publicFocus ? [-20, 30, 12] : serviceFocus ? [-14, 22, 10] : [-22, 26, 18]}
        intensity={profile.directionalIntensity + (isIntroOnboarding ? 0.38 : 0.12)}
        color={warmKey}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={profile.shadowBias || -0.0004}
      />
      <spotLight position={[0, 11, 14]} intensity={publicFocus ? profile.practicalIntensity * 1.28 : 0.58} angle={0.46} penumbra={0.88} color={accentColor} />
      <spotLight position={[34, 7, -12]} intensity={currentZoneId === "security-hub" ? profile.practicalIntensity * 0.95 : 0.38} angle={0.42} penumbra={0.72} color={fillColor} />
      <spotLight position={[62, 8, -33]} intensity={vipFocus ? profile.practicalIntensity * 1.22 : 0.34} angle={0.38} penumbra={0.82} color={warmKey} />
      <pointLight position={[-30, 5, 4]} intensity={serviceFocus ? 1.92 : 0.42} distance={26} color={serviceFocus ? "#89a6b8" : "#5d636b"} />
      <pointLight position={[28, 6, -46]} intensity={currentZoneId === "rooftop-lounge" ? 2.4 : 0.7} distance={24} color="#f0ba84" />
      <pointLight position={[playerPosition[0], playerPosition[1] + 4, playerPosition[2]]} intensity={riskPractical ? 0.42 : 0.08} distance={10} color={riskPractical ? "#a84f45" : "#50565f"} />
      {isIntroOnboarding ? (
        <>
          <pointLight position={[-12, 3.4, 24]} intensity={1.35 + introPulse * 0.22} distance={18} color="#f3ca8e" />
          <pointLight position={[-16, 3.1, 18]} intensity={1.58 + introPulse * 0.2} distance={16} color="#f6b56f" />
          <pointLight position={[-29, 3.5, 10]} intensity={1.26 + introPulse * 0.16} distance={22} color="#7fa5bc" />
          <pointLight position={[-6, 3.4, 8]} intensity={0.62 + introPressurePulse * 0.32} distance={14} color="#b8614f" />
        </>
      ) : null}
    </>
  );
}

function PlayerAvatar() {
  const playerPosition = usePhaseOneStore((state) => state.playerPosition);
  const playerFacing = usePhaseOneStore((state) => state.playerFacing);
  const cameraMode = usePhaseOneStore((state) => state.cameraMode);
  const posture = usePhaseOneStore((state) => state.posture);

  if (cameraMode === "first_person") return null;

  return (
    <group position={playerPosition} rotation-y={playerFacing}>
      <mesh castShadow scale-y={posture === "crouch" ? 0.7 : 1}>
        <capsuleGeometry args={[0.34, 1.18, 6, 12]} />
        <meshStandardMaterial color={posture === "dragging" ? "#b6967b" : "#d4d0cb"} roughness={0.76} />
      </mesh>
      <mesh position={[0, posture === "crouch" ? 1.18 : 1.62, 0]} castShadow>
        <sphereGeometry args={[0.21, 16, 16]} />
        <meshStandardMaterial color="#b8aca4" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Runtime({
  selectedOperation,
  missionState,
  onRuntimeReady,
}: {
  selectedOperation: GeneratedMissionDefinition | null;
  missionState: MissionProgressState;
  onRuntimeReady: () => void;
}) {
  const setWorld = useCampaignStore((state) => state.setWorld);
  const recordMissionOutcome = useCampaignStore((state) => state.recordMissionOutcome);
  const onboardingStage = useCampaignStore((state) => state.progress.onboardingStage);
  const multiplayerSessionId = useMultiplayerStore((state) => state.sessionId);
  const multiplayerPlayers = useMultiplayerStore((state) => state.players);
  const playerPosition = usePhaseOneStore((state) => state.playerPosition);
  const playerVelocity = usePhaseOneStore((state) => state.playerVelocity);
  const gateStates = usePhaseOneStore((state) => state.gateStates);
  const hoveredInteractableId = usePhaseOneStore((state) => state.hoveredInteractableId);
  const setHoveredInteractableId = usePhaseOneStore((state) => state.setHoveredInteractableId);
  const setPrompt = usePhaseOneStore((state) => state.setPrompt);
  const pushLog = usePhaseOneStore((state) => state.pushLog);
  const toggleGate = usePhaseOneStore((state) => state.toggleGate);
  const setPlayerTransform = usePhaseOneStore((state) => state.setPlayerTransform);
  const setDisguise = usePhaseOneStore((state) => state.setDisguise);
  const toggleCarryBody = usePhaseOneStore((state) => state.toggleCarryBody);
  const markSabotage = usePhaseOneStore((state) => state.markSabotage);
  const setSuspicion = usePhaseOneStore((state) => state.setSuspicion);
  const setStealthState = usePhaseOneStore((state) => state.setStealthState);
  const setAccessState = usePhaseOneStore((state) => state.setAccessState);
  const setTrespassExposure = usePhaseOneStore((state) => state.setTrespassExposure);
  const setActiveWatcherIds = usePhaseOneStore((state) => state.setActiveWatcherIds);
  const setSuspicionChannels = usePhaseOneStore((state) => state.setSuspicionChannels);
  const setWatcherExposure = usePhaseOneStore((state) => state.setWatcherExposure);
  const setDominantRiskSource = usePhaseOneStore((state) => state.setDominantRiskSource);
  const pushStealthEvent = usePhaseOneStore((state) => state.pushStealthEvent);
  const markIllegalAction = usePhaseOneStore((state) => state.markIllegalAction);
  const aiActors = usePhaseOneStore((state) => state.aiActors);
  const activeStimuli = usePhaseOneStore((state) => state.activeStimuli);
  const setAiActors = usePhaseOneStore((state) => state.setAiActors);
  const setActiveStimuli = usePhaseOneStore((state) => state.setActiveStimuli);
  const activeIncidents = usePhaseOneStore((state) => state.activeIncidents);
  const setActiveIncidents = usePhaseOneStore((state) => state.setActiveIncidents);
  const setDangerZones = usePhaseOneStore((state) => state.setDangerZones);
  const setGuardResponseAssignments = usePhaseOneStore((state) => state.setGuardResponseAssignments);
  const setGlobalAlertLevel = usePhaseOneStore((state) => state.setGlobalAlertLevel);
  const setTargetWindowState = usePhaseOneStore((state) => state.setTargetWindowState);
  const setSearchAssignments = usePhaseOneStore((state) => state.setSearchAssignments);
  const setMissionPressure = usePhaseOneStore((state) => state.setMissionPressure);
  const mission = usePhaseOneStore((state) => state.mission);
  const acquirePoison = usePhaseOneStore((state) => state.acquirePoison);
  const preparePoison = usePhaseOneStore((state) => state.preparePoison);
  const armAccident = usePhaseOneStore((state) => state.armAccident);
  const completeSecondaryObjective = usePhaseOneStore((state) => state.completeSecondaryObjective);
  const unlockRoute = usePhaseOneStore((state) => state.unlockRoute);
  const queueTargetDetour = usePhaseOneStore((state) => state.queueTargetDetour);
  const splitEscort = usePhaseOneStore((state) => state.splitEscort);
  const advanceSecondaryObjective = usePhaseOneStore((state) => state.advanceSecondaryObjective);
  const eliminateTarget = usePhaseOneStore((state) => state.eliminateTarget);
  const noteAlarmTriggered = usePhaseOneStore((state) => state.noteAlarmTriggered);
  const noteBodyFound = usePhaseOneStore((state) => state.noteBodyFound);
  const noteNonTargetCasualty = usePhaseOneStore((state) => state.noteNonTargetCasualty);
  const noteEvidenceLeft = usePhaseOneStore((state) => state.noteEvidenceLeft);
  const stashBody = usePhaseOneStore((state) => state.stashBody);
  const completeExtraction = usePhaseOneStore((state) => state.completeExtraction);
  const setStoryAftermath = usePhaseOneStore((state) => state.setStoryAftermath);
  const activeDisguiseId = usePhaseOneStore((state) => state.activeDisguiseId);
  const posture = usePhaseOneStore((state) => state.posture);
  const currentZoneId = usePhaseOneStore((state) => state.currentZoneId);
  const suspicion = usePhaseOneStore((state) => state.suspicion);
  const stealthState = usePhaseOneStore((state) => state.stealthState);
  const trespassExposure = usePhaseOneStore((state) => state.trespassExposure);
  const suspicionChannels = usePhaseOneStore((state) => state.suspicionChannels);
  const recentIllegalAction = usePhaseOneStore((state) => state.recentIllegalAction);
  const recentIllegalActionAt = usePhaseOneStore((state) => state.recentIllegalActionAt);
  const carriedBodyId = usePhaseOneStore((state) => state.carriedBodyId);
  const watcherExposure = usePhaseOneStore((state) => state.watcherExposure);
  const coverInstabilityUntil = usePhaseOneStore((state) => state.coverInstabilityUntil);
  const orbitYawRef = useRef(Math.PI);
  const orbitPitchRef = useRef(0.72);
  const orbitDistanceRef = useRef(7.8);
  const playerFacing = usePhaseOneStore((state) => state.playerFacing);
  const stealthAccumulator = useRef(0);
  const elapsedSeconds = useRef(0);
  const lingerAccumulator = useRef(0);
  const aiAccumulator = useRef(0);
  const previousStealthState = useRef(usePhaseOneStore.getState().stealthState);
  const previousAccessState = useRef(usePhaseOneStore.getState().accessState);
  const previousMissionState = useRef(usePhaseOneStore.getState().mission);
  const lastSoundAt = useRef(0);
  const lastSabotageDigest = useRef("");
  const lastBodyEventAt = useRef(0);
  const lastSuspicionIncidentAt = useRef(0);
  const lastBehaviorIncidentAt = useRef(0);
  const lastSecurityHintAt = useRef(0);
  const lastWorldStateShiftAt = useRef(0);
  const lastAlarmIncidentKey = useRef("");
  const seenBodyIncidentIds = useRef<string[]>([]);
  const onboardingHintStage = useRef(0);
  const onboardingMovementStarted = useRef(false);
  const isIntroOnboarding = onboardingStage === "first_run" && selectedOperation?.variantId === "azure-summit-fall";
  const introFacingForCamera = isIntroOnboarding && selectedOperation
    ? facingToward(selectedOperation.runtimeConfig.entryPool[0].position, SIMPLE_ONBOARDING_TARGET_POSITION)
    : null;

  useEffect(() => {
    console.info("[EnvironmentCanvas] runtime received mission payload", {
      operationId: selectedOperation?.id ?? null,
      missionId: selectedOperation?.templateId ?? null,
      variantId: selectedOperation?.variantId ?? null,
      missionComplete: missionState.missionComplete,
    });
    onRuntimeReady();
  }, [missionState.missionComplete, onRuntimeReady, selectedOperation?.id, selectedOperation?.templateId, selectedOperation?.variantId]);

  useEffect(() => {
    if (!selectedOperation) return;
    const entry = selectedOperation.runtimeConfig.entryPool[0];
    const introFacing = isIntroOnboarding ? facingToward(entry.position, SIMPLE_ONBOARDING_TARGET_POSITION) : Math.PI;
    const introActors = isIntroOnboarding ? createOnboardingIntroActors(createInitialAiActors(selectedOperation.runtimeConfig)) : createInitialAiActors(selectedOperation.runtimeConfig);
    onboardingHintStage.current = 0;
    onboardingMovementStarted.current = false;
    orbitYawRef.current = introFacing;
    orbitPitchRef.current = isIntroOnboarding ? 0.56 : 0.6;
    orbitDistanceRef.current = 5.6;
    usePhaseOneStore.setState({
      cameraMode: "first_person",
      playerPosition: entry.position,
      playerFacing: introFacing,
      playerVelocity: [0, 0, 0],
      currentZoneId: entry.zoneId,
      activeDisguiseId: entry.disguiseId,
      prompt: isIntroOnboarding ? "" : `${selectedOperation.story.codename}. ${selectedOperation.runtimeConfig.objectiveBundle.primary} ${selectedOperation.runtimeConfig.liveEventOverlay}`,
      interactionLog: isIntroOnboarding
        ? ["Operation live."]
        : [
            `Loaded operation: ${selectedOperation.story.codename} / ${selectedOperation.title}.`,
            `Briefing: ${selectedOperation.story.delivery.briefingHook}`,
            `Primary: ${selectedOperation.runtimeConfig.objectiveBundle.primary}`,
            `Secondary: ${selectedOperation.runtimeConfig.objectiveBundle.secondary}`,
          ],
      gateStates: foundationShell.gates.reduce<Record<string, (typeof foundationShell.gates)[number]>>((map, gate) => {
        map[gate.id] = { ...gate };
        return map;
      }, {}),
      suspicion: 0,
      stealthState: "clear",
      accessState: "legal",
      trespassExposure: 0,
      activeWatcherIds: [],
      suspicionChannels: { trespass: 0, exposure: 0, behavior: 0, enforcer: 0, recentCrime: 0 },
      watcherExposure: {},
      dominantRiskSource: "none",
      coverInstabilityUntil: null,
      sabotageFlags: {},
      globalAlertLevel: selectedOperation.runtimeConfig.securityTier === "lockdown" ? 0.6 : selectedOperation.runtimeConfig.securityTier === "hardened" ? 0.2 : 0,
      activeStimuli: [],
      activeIncidents: [],
      dangerZones: [],
      guardResponseAssignments: [],
      targetWindowState: isIntroOnboarding ? "vulnerable" : selectedOperation.runtimeConfig.securityTier === "lockdown" ? "guarded" : "relocating",
      searchAssignments: [],
      missionPressure: {
        annexPressure: false,
        ballroomPressure: false,
        securityPressure: false,
        targetProtection: "routine",
        extractionRisk: "low",
        activeLeadIncidentId: null,
      },
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
        disguisesUsed: [entry.disguiseId],
        evidenceLeftBehind: 0,
        completedChallenges: [],
        scoreBreakdown: [],
        durationSeconds: null,
        storyAftermath: null,
        notableMoments: [],
      },
      missionStartTime: Date.now(),
      aiActors: introActors,
    });
  }, [isIntroOnboarding, selectedOperation]);

  useFrame((_state, delta) => {
    elapsedSeconds.current += delta;
    const movementSpeed = Math.hypot(playerVelocity[0], playerVelocity[2]);
    const onboardingQuietWindow = isIntroOnboarding && elapsedSeconds.current < 10;
    const onboardingPromptSuppressionWindow = isIntroOnboarding && elapsedSeconds.current < 20;
    if (isIntroOnboarding && !onboardingMovementStarted.current && movementSpeed > 0.28) {
      onboardingMovementStarted.current = true;
      if (!onboardingQuietWindow) {
        onboardingHintStage.current = Math.max(onboardingHintStage.current, 1);
        setPrompt("Move to lobby.");
      }
    }
    const nearest = getNearestInteractable(playerPosition, foundationShell.interactables);
    const allowWorldPrompt = !isIntroOnboarding || (!onboardingPromptSuppressionWindow && onboardingHintStage.current >= 2);
    if (nearest?.id !== hoveredInteractableId) {
      setHoveredInteractableId(nearest?.id || null);
      if (allowWorldPrompt) {
        setPrompt(nearest?.prompt || (isIntroOnboarding ? "Stay hidden." : "Move through the shell to validate traversal, sight lines, and context interactions."));
      }
    }

    stealthAccumulator.current += delta;
    if (stealthAccumulator.current < 0.2) return;
    stealthAccumulator.current = 0;

    const disguise = getDisguiseById(activeDisguiseId);
    const zone = selectCurrentZone(foundationShell.zones, currentZoneId);
    const accessProfile = getZoneAccessProfile(zone, disguise);
    const blockers = collectActiveBlockers(foundationShell.blockers, foundationShell.structures, gateStates);
    const behavior = movementSpeed > 6.2 ? "run" : movementSpeed > 0.3 ? "walk" : "idle";
    const sabotageRecent = recentIllegalAction === "sabotage" && recentIllegalActionAt ? Date.now() - recentIllegalActionAt < 4500 : false;
    const recentCrimeLevel = recentIllegalActionAt ? Math.max(0, 20 - Math.floor((Date.now() - recentIllegalActionAt) / 350)) : 0;

    if (behavior === "idle") lingerAccumulator.current += 0.2;
    else lingerAccumulator.current = Math.max(0, lingerAccumulator.current - 0.4);

    const { breakdown, activeWatcherIds, watcherExposure: nextWatcherExposure, dominantRiskSource } = evaluateDetection({
      playerPosition,
      zone,
      disguise,
      posture,
      behavior,
      watchers: foundationShell.watchers,
      blockers,
      elapsedSeconds: elapsedSeconds.current,
      trespassExposure,
      sabotageRecent,
      carryingBody: Boolean(carriedBodyId),
      accessState: accessProfile.accessState,
      zoneFit: accessProfile.zoneFit,
      previousExposure: watcherExposure,
      coverInstabilityUntil,
    });

    const graceExpired = lingerAccumulator.current > accessProfile.lingerGraceSeconds;
    const nextTrespass =
      accessProfile.accessState === "legal"
        ? Math.max(0, trespassExposure - 5)
        : accessProfile.accessState === "soft_restricted"
          ? Math.min(100, trespassExposure + (graceExpired ? accessProfile.trespassRate * 0.16 : accessProfile.trespassRate * 0.04))
          : Math.min(100, trespassExposure + accessProfile.trespassRate * 0.22);

    setTrespassExposure(nextTrespass);
    setActiveWatcherIds(activeWatcherIds);
    setWatcherExposure(nextWatcherExposure);
    setAccessState(accessProfile.accessState);

    const decaySafe = activeWatcherIds.length === 0 && accessProfile.accessState === "legal" && !recentCrimeLevel && !carriedBodyId;
    const channels = composeSuspicionChannels({
      previous: suspicionChannels,
      breakdown: { ...breakdown, recentCrime: recentCrimeLevel },
      trespassExposure: nextTrespass,
      recentCrimeLevel,
      decaySafe,
    });
    setSuspicionChannels(channels);

    const nextDominantRisk = dominantRiskFromBreakdown({ ...breakdown, recentCrime: recentCrimeLevel }, recentCrimeLevel);
    setDominantRiskSource(nextDominantRisk);

    const nextSuspicion = applySuspicionDelta(suspicion, totalSuspicionFromChannels(channels) - suspicion);
    setSuspicion(nextSuspicion);
    const nextStealthState = deriveStealthState(nextSuspicion, stealthState);
    setStealthState(nextStealthState);

    if (accessProfile.accessState !== previousAccessState.current) {
      previousAccessState.current = accessProfile.accessState;
      pushStealthEvent(describeZoneLegality(zone, accessProfile.accessState), accessProfile.accessState === "legal" ? "info" : accessProfile.accessState === "soft_restricted" ? "warning" : "critical", `access-${accessProfile.zoneId}-${accessProfile.accessState}`);
      pushLog(describeZoneLegality(zone, accessProfile.accessState));
    }

    if (nextStealthState !== previousStealthState.current) {
      previousStealthState.current = nextStealthState;
      const summary = summarizeDominantPressure({ ...breakdown, recentCrime: recentCrimeLevel }, accessProfile.accessState, breakdown.enforcer > 0, nextDominantRisk);
      pushStealthEvent(`Stealth state changed to ${nextStealthState}. ${summary}`, stateSeverity(nextStealthState), `state-${nextStealthState}`);
      if (onboardingQuietWindow) {
        setPrompt("");
      } else if (isIntroOnboarding && onboardingHintStage.current < 2) {
        onboardingHintStage.current = 2;
        setPrompt("Break sight.");
      } else {
        setPrompt(summary);
      }
    }

    if (!onboardingQuietWindow && isIntroOnboarding && onboardingHintStage.current < 2 && nextSuspicion >= 20) {
      onboardingHintStage.current = 2;
      setPrompt("Break sight.");
    }
    if (!onboardingQuietWindow && isIntroOnboarding && onboardingMovementStarted.current && onboardingHintStage.current < 3 && elapsedSeconds.current >= 10 && nextSuspicion < 20 && !mission.targetEliminated) {
      onboardingHintStage.current = 3;
      setPrompt("Reach the target.");
    }
    if (!onboardingQuietWindow && isIntroOnboarding && mission.targetEliminated && onboardingHintStage.current < 4) {
      onboardingHintStage.current = 4;
      setPrompt("Extract now.");
    }

    if (accessProfile.zoneFit === "mismatched" && accessProfile.accessState === "legal") {
      pushStealthEvent("Your disguise is technically legal here, but it does not socially fit the space.", "warning", "zone-fit");
    }
    if (accessProfile.accessState === "soft_restricted" && graceExpired) {
      pushStealthEvent("You have lingered too long in a soft-restricted zone.", "warning", `linger-${accessProfile.zoneId}`);
    }
    if (breakdown.enforcer > 0) {
      pushStealthEvent("An enforcer is reading through your cover.", "warning", "enforcer-warning");
    }
    if (posture === "crouch" && zone?.publicComposureRules?.includes("no_crouch_public")) {
      pushStealthEvent("Crouching in public is attracting attention.", "warning", "public-crouch");
    }
    if (carriedBodyId) {
      pushStealthEvent("Carrying a body is generating severe scrutiny.", "critical", "body-carry");
    }

    aiAccumulator.current += delta;
    if (aiAccumulator.current < 0.25) return;
    const aiDelta = aiAccumulator.current;
    aiAccumulator.current = 0;

    const now = Date.now();
    const nextStimuli: StimulusEvent[] = activeStimuli.filter((stimulus) => stimulus.expiresAt > now);
    const currentSpeed = Math.hypot(playerVelocity[0], playerVelocity[2]);
    const soundStimulus = emitMovementSoundStimulus({
      now,
      playerPosition,
      currentZoneId,
      currentSpeed,
      lastSoundAt: lastSoundAt.current,
    });
    lastSoundAt.current = soundStimulus.lastSoundAt;
    if (soundStimulus.stimulus) nextStimuli.push(soundStimulus.stimulus);

    const securityPressureZone = currentZoneId === "security-hub" || currentZoneId === "pier-security-checkpoint" || currentZoneId === "vip-suite-foyer";
    const suspicionStimulus = emitSuspicionStimulus({
      now,
      playerPosition,
      currentZoneId,
      nextStealthState,
      accessState: accessProfile.accessState,
      zoneFit: accessProfile.zoneFit,
      activeWatcherIds,
      lastSuspicionIncidentAt: lastSuspicionIncidentAt.current,
    });
    lastSuspicionIncidentAt.current = suspicionStimulus.lastSuspicionIncidentAt;
    if (suspicionStimulus.stimulus) nextStimuli.push(suspicionStimulus.stimulus);

    const behaviorStimulus = emitBehaviorStimulus({
      now,
      playerPosition,
      currentZoneId,
      lastBehaviorIncidentAt: lastBehaviorIncidentAt.current,
      activeWatcherIds,
      posture,
      behavior,
      zoneFit: accessProfile.zoneFit,
      lingerExceeded: lingerAccumulator.current > accessProfile.lingerGraceSeconds,
      securityPressureZone,
      publicNoCrouch: Boolean(zone?.publicComposureRules?.includes("no_crouch_public")),
    });
    lastBehaviorIncidentAt.current = behaviorStimulus.lastBehaviorIncidentAt;
    if (behaviorStimulus.stimulus) nextStimuli.push(behaviorStimulus.stimulus);

    const sabotageDigest = Object.keys(usePhaseOneStore.getState().sabotageFlags)
      .sort()
      .join("|");
    if (sabotageDigest && sabotageDigest !== lastSabotageDigest.current) {
      const previousSabotageIds = new Set(lastSabotageDigest.current ? lastSabotageDigest.current.split("|") : []);
      const newestSabotageId =
        sabotageDigest
          .split("|")
          .find((id) => !previousSabotageIds.has(id)) || sabotageDigest.split("|").at(-1);
      const sabotageSource =
        foundationShell.interactables.find((item) => item.effects?.some((effect) => effect.type === "markSabotage" && effect.sabotageId === newestSabotageId)) ||
        foundationShell.interactables.find((item) => item.type === "sabotage");
      lastSabotageDigest.current = sabotageDigest;
      nextStimuli.push({
        id: `sabotage-${now}`,
        type: "sabotage",
        category: "sabotage",
        confirmed: true,
        position: sabotageSource?.position || playerPosition,
        radius: 14,
        severity: 3,
        createdAt: now,
        expiresAt: now + 9000,
        zoneId: sabotageSource?.zoneId || currentZoneId,
      });
    }

    const previousMission = previousMissionState.current;
    nextStimuli.push(...emitMissionDeltaStimuli({
      now,
      mission,
      previousMission,
      playerPosition,
      currentZoneId,
    }));
    previousMissionState.current = mission;

    const bodyDiscovery = emitBodyDiscoveryStimulus({
      now,
      aiActors,
      carriedBodyId,
      lastBodyEventAt: lastBodyEventAt.current,
    });
    lastBodyEventAt.current = bodyDiscovery.lastBodyEventAt;
    if (bodyDiscovery.stimulus) nextStimuli.push(bodyDiscovery.stimulus);

    const aiStep = stepAiActors({
      actors: aiActors,
      stimuli: nextStimuli,
      previousIncidents: activeIncidents,
      delta: aiDelta,
      playerPosition,
      accessState: accessProfile.accessState,
      zoneFit: accessProfile.zoneFit,
      disguiseId: activeDisguiseId,
      posture,
      suspicion: nextSuspicion,
      carriedBodyId,
      recentCrime: Boolean(recentCrimeLevel),
      currentZoneId,
      mission,
    });

    setAiActors(aiStep.actors);
    setActiveStimuli(aiStep.stimuli);
    setActiveIncidents(aiStep.incidents);
    setDangerZones(aiStep.dangerZones);
    setGuardResponseAssignments(aiStep.guardResponseAssignments);
    setGlobalAlertLevel(aiStep.globalAlertLevel);
    setTargetWindowState(aiStep.targetWindowState);
    setSearchAssignments(aiStep.searchAssignments);

    const missionPressure = deriveMissionPressure({
      incidents: aiStep.incidents,
      globalAlertLevel: aiStep.globalAlertLevel,
      mission,
    });
    setMissionPressure(missionPressure);

    const newBodyIncidentIds = getNewBodyIncidentIds(aiStep.incidents, seenBodyIncidentIds.current);
    if (newBodyIncidentIds.length) {
      seenBodyIncidentIds.current = [...seenBodyIncidentIds.current, ...newBodyIncidentIds].slice(-12);
      for (const _incidentId of newBodyIncidentIds) noteBodyFound();
    }

    const alarmIncidentKey = getAlarmIncidentKey(aiStep.incidents, aiStep.globalAlertLevel);
    if (alarmIncidentKey && lastAlarmIncidentKey.current !== alarmIncidentKey) {
      lastAlarmIncidentKey.current = alarmIncidentKey;
      noteAlarmTriggered();
    }

    const worldShift = resolveWorldStateShift({
      now,
      mission,
      missionPressure,
      globalAlertLevel: aiStep.globalAlertLevel,
      lastWorldStateShiftAt: lastWorldStateShiftAt.current,
    });
    if (worldShift) {
      lastWorldStateShiftAt.current = now;
      queueTargetDetour(worldShift.detour);
      splitEscort(worldShift.escort);
      pushStealthEvent(worldShift.eventText, worldShift.severity, worldShift.eventKey);
      if (worldShift.logText) pushLog(worldShift.logText);
    }

    if (
      shouldHintAlternateLedgerRoute({
        now,
        lastSecurityHintAt: lastSecurityHintAt.current,
        mission,
        missionPressure,
      })
    ) {
      lastSecurityHintAt.current = now;
      pushStealthEvent("Security hub pressure is rising. The annex transfer route is becoming the safer ledger play.", "warning", "ledger-alt-route");
      pushLog("Security hub search pressure is climbing. The annex transfer looks like the cleaner ledger intercept.");
    }

    const worldElimination = resolveTargetEliminationFromWorld({
      mission,
      actors: aiStep.actors,
      currentZoneId,
    });
    if (worldElimination) {
      eliminateTarget(worldElimination.solution);
      if (worldElimination.evidence) noteEvidenceLeft(worldElimination.evidence);
      if (worldElimination.nonTargetCasualties) noteNonTargetCasualty(worldElimination.nonTargetCasualties);
      pushLog(worldElimination.logText);
      pushStealthEvent(worldElimination.eventText, "critical", worldElimination.eventKey);
    }

    if (aiStep.globalAlertLevel >= 2) {
      pushStealthEvent("District alert pressure is escalating. Guards are coordinating search patterns.", aiStep.globalAlertLevel >= 3 ? "critical" : "warning", `alert-${Math.floor(aiStep.globalAlertLevel)}`);
    }
    if (aiStep.targetWindowState === "vulnerable") {
      pushStealthEvent("The target has entered a thinner escort window.", "info", "target-vulnerable");
    }
  });

  useEffect(() => {
    if (usePhaseOneStore.getState().aiActors.length === 0) {
      setAiActors(createInitialAiActors());
    }
  }, [setAiActors]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (event.code === "KeyQ") {
        useMultiplayerStore.getState().pushPing({
          id: `ping-${Date.now()}`,
          label: currentZoneId.replaceAll("-", " "),
          position: [playerPosition[0], playerPosition[1] + 0.1, playerPosition[2]],
        });
        pushLog("Tactical marker broadcast to the team.");
        return;
      }

      if (event.code === "KeyE") {
        const interactable = selectHoveredInteractable(foundationShell.interactables, usePhaseOneStore.getState().hoveredInteractableId);
        if (!interactable) return;
        const messages = applyInteractionEffects({
          interactable,
          gateStates,
          toggleGate,
          setPlayerPosition: (position) => setPlayerTransform(position, playerFacing, playerVelocity),
          setDisguise,
          toggleCarryBody,
          markSabotage,
          addSuspicion: (delta) => setSuspicion(applySuspicionDelta(usePhaseOneStore.getState().suspicion, delta)),
          markIllegalAction,
          acquirePoison,
          preparePoison,
          armAccident,
          completeSecondaryObjective,
          unlockRoute,
          queueTargetDetour,
          splitEscort,
          advanceSecondaryObjective,
          attemptCloseElimination: (radius) => {
            const currentState = usePhaseOneStore.getState();
            const target = currentState.aiActors.find((actor) => actor.id === "target-voss");
            const nearbyBodyguards = currentState.aiActors.filter(
              (actor) => actor.role === "bodyguard" && actor.state !== "down" && target && distance2D(actor.position, target.position) < 5.2,
            );
            const activeInteractableId = currentState.hoveredInteractableId;
            const currentMission = currentState.mission;
            if (!target || currentMission.targetEliminated) return false;
            const killPocket =
              activeInteractableId === "annex-overlook-rail"
                ? ([60, 1, -39] as [number, number, number])
                : activeInteractableId === "service-inspection-rail"
                  ? ([22, 1, -10] as [number, number, number])
                  : ([4, 1, -26] as [number, number, number]);
            const inKillPocket = distance2D(target.position, killPocket) < radius;
            const vulnerable = currentState.targetWindowState === "vulnerable" && inKillPocket;
            const playerInPocketZone =
              (activeInteractableId === "annex-overlook-rail" && currentState.currentZoneId === "annex-tasting-room") ||
              (activeInteractableId === "service-inspection-rail" && currentState.currentZoneId === "ballroom-terrace") ||
              (activeInteractableId !== "annex-overlook-rail" && activeInteractableId !== "service-inspection-rail" && currentState.currentZoneId === "vip-suite-foyer");
            const lowAlert = currentState.globalAlertLevel < 2.4;
            const splitSupportsThis =
              activeInteractableId === "service-inspection-rail"
                ? currentMission.escortSplit === "service"
                : activeInteractableId === "annex-overlook-rail"
                  ? currentMission.activeDetour === "annex_inspection"
                  : true;
            if (!vulnerable || !playerInPocketZone || !lowAlert || !splitSupportsThis || nearbyBodyguards.length > 0 || distance2D(target.position, playerPosition) > radius) return false;
            eliminateTarget("social");
            pushStealthEvent(
              activeInteractableId === "annex-overlook-rail"
                ? "Primary target eliminated through a silent annex overlook push."
                : activeInteractableId === "service-inspection-rail"
                  ? "Primary target eliminated through a service-side isolation kill."
                  : "Primary target eliminated through a silent private balcony push.",
              "critical",
              "social-kill",
            );
            return true;
          },
          stashBody,
          extractMission: () => {
            const current = usePhaseOneStore.getState();
            if (!current.mission.targetEliminated || current.mission.missionComplete) return false;
            const debrief = finalizeMissionDebrief({
              mission: current.mission,
              suspicion: current.suspicion,
              globalAlertLevel: current.globalAlertLevel,
              accessState: current.accessState,
              missionStartTime: current.missionStartTime,
              operation: selectedOperation,
            });
            const result = debrief.result;
            const success = completeExtraction(result);
            if (success) {
              setStoryAftermath(debrief.storyAftermath);
              debrief.persistCareer();
              recordMissionOutcome({
                missionId: selectedOperation?.missionId || "azure-meridian",
                operationId: selectedOperation?.id,
                variantId: selectedOperation?.variantId,
                rating: result.rating,
                score: result.score,
                teamSize: Math.max(1, multiplayerPlayers.length || 1),
                sessionId: multiplayerSessionId,
                unlockedStart: result.rating === "Silent Phantom" ? "annex_service_start" : null,
                unlockedModifier: current.mission.secondaryObjectiveComplete ? "ledger_insider" : null,
                unlockedIntel: current.mission.solution === "poison" ? "catering-schedule" : null,
                codexEntry: current.mission.targetEliminated ? "meridian-after-action" : null,
                opportunityId: current.mission.solution ? `method-${current.mission.solution}` : null,
                sectorId: selectedOperation?.sectorId || "harbor-facility",
              });
              void resolveMissionOperation({
                missionId: selectedOperation?.missionId || "azure-meridian",
                variantId: selectedOperation?.variantId || current.mission.activeDetour,
                targetId: selectedOperation?.runtimeConfig.targetProfile.id || "hc-2",
                targetEliminated: current.mission.targetEliminated,
                secondaryObjectiveComplete: current.mission.secondaryObjectiveComplete,
                solution: current.mission.solution,
                score: result.score,
                rating: result.rating,
                alarmsTriggered: current.mission.alarmsTriggered,
                evidenceLeftBehind: current.mission.evidenceLeftBehind,
                teamSize: Math.max(1, multiplayerPlayers.length || 1),
                sessionId: multiplayerSessionId,
                contributingPlayerIds: multiplayerPlayers.map((player) => player.playerId),
                title: selectedOperation?.title || "Azure Meridian disruption",
                region: selectedOperation?.runtimeConfig.worldRegion || "Harbor Facility",
                summary:
                  debrief.storyAftermath?.resistanceReaction ||
                  (current.mission.secondaryObjectiveComplete
                    ? `${selectedOperation?.title || "The operation"} resolved primary and secondary objectives, widening fractures across ${selectedOperation?.runtimeConfig.worldRegion || "the harbor chain"}.`
                    : `${selectedOperation?.title || "The operation"} removed a regime node and forced an unstable security response.`),
                broadcast:
                  debrief.storyAftermath?.regimeReaction ||
                  "Harbor command issues emergency doctrine updates after a summit collapse leaves screening and escort procedures in disarray.",
              }, { authorityMode: Boolean(multiplayerSessionId) || multiplayerPlayers.length > 1 ? "multiplayer" : "solo" })
                .then((world) => setWorld(world))
                .catch(() => {
                  pushStealthEvent("Campaign uplink delayed. Mission result saved locally; world sync will refresh on the next board update.", "warning", "campaign-sync-delay");
                  pushLog("Campaign uplink delayed. Local progression persisted; world-state refresh is pending.");
                });
              pushStealthEvent(`Mission complete. Rating: ${result.rating}. Score: ${result.score}.`, "info", "mission-complete");
            }
            return success;
          },
        });
        const interactionStimuli = emitInteractionStimuli({
          interactableId: interactable.id,
          fallbackPosition: playerPosition,
          fallbackZoneId: currentZoneId,
          now: Date.now(),
        });
        if (interactionStimuli.length) {
          setActiveStimuli([...usePhaseOneStore.getState().activeStimuli.filter((stimulus) => stimulus.expiresAt > Date.now()), ...interactionStimuli]);
          const consequenceText = consequenceTextForSource(interactable.id);
          if (consequenceText) pushStealthEvent(consequenceText, "warning", `interaction-${interactable.id}`);
        }
        for (const message of messages) {
          pushLog(message);
          setPrompt(message);
          pushStealthEvent(message, "info");
        }
      }

      if (event.code === "KeyF") {
        const bodyInteractable = foundationShell.interactables.find((item) => item.type === "body" && (Math.hypot(item.position[0] - playerPosition[0], item.position[2] - playerPosition[2]) < 2.8 || usePhaseOneStore.getState().carriedBodyId === item.id));
        if (!bodyInteractable) return;
        const messages = applyInteractionEffects({
          interactable: bodyInteractable,
          gateStates,
          toggleGate,
          setPlayerPosition: (position) => setPlayerTransform(position, playerFacing, playerVelocity),
          setDisguise,
          toggleCarryBody,
          markSabotage,
          addSuspicion: (delta) => setSuspicion(applySuspicionDelta(usePhaseOneStore.getState().suspicion, delta)),
          markIllegalAction,
          acquirePoison,
          preparePoison,
          armAccident,
          completeSecondaryObjective,
          unlockRoute,
          queueTargetDetour,
          splitEscort,
          advanceSecondaryObjective,
          attemptCloseElimination: () => false,
          stashBody,
          extractMission: () => false,
        });
        const interactionStimuli = emitInteractionStimuli({
          interactableId: bodyInteractable.id,
          fallbackPosition: playerPosition,
          fallbackZoneId: currentZoneId,
          now: Date.now(),
        });
        if (interactionStimuli.length) {
          setActiveStimuli([...usePhaseOneStore.getState().activeStimuli.filter((stimulus) => stimulus.expiresAt > Date.now()), ...interactionStimuli]);
        }
        for (const message of messages) {
          pushLog(message);
          setPrompt(message);
          pushStealthEvent(message, "warning");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [acquirePoison, armAccident, completeExtraction, completeSecondaryObjective, currentZoneId, eliminateTarget, gateStates, multiplayerPlayers.length, multiplayerSessionId, playerFacing, playerPosition, playerVelocity, preparePoison, pushLog, pushStealthEvent, recordMissionOutcome, setActiveStimuli, setDisguise, setPlayerTransform, setPrompt, setStoryAftermath, setSuspicion, setWorld, stashBody, toggleCarryBody, toggleGate, markIllegalAction, markSabotage, mission]);

  return (
    <>
      <Sky distance={450000} sunPosition={[-1.2, 0.45, -1]} inclination={0.55} azimuth={0.2} turbidity={16} />
      <LightingRig />
      {selectedOperation ? <MultiplayerSyncController /> : null}
      {selectedOperation ? <MissionStoryController /> : null}
      {selectedOperation ? <MomentSpikeController /> : null}
      <EnvironmentScene selectedOperation={selectedOperation} missionState={missionState} />
      <PlayerController orbitYawRef={orbitYawRef} />
      <CameraController
        orbitYawRef={orbitYawRef}
        orbitPitchRef={orbitPitchRef}
        orbitDistanceRef={orbitDistanceRef}
        isIntroOnboarding={isIntroOnboarding}
        introFacing={introFacingForCamera}
      />
      <PlayerAvatar />
    </>
  );
}

export default function EnvironmentCanvas({ selectedOperation, missionState }: EnvironmentCanvasProps) {
  const onboardingStage = useCampaignStore((state) => state.progress.onboardingStage);
  const currentZone = usePhaseOneStore((state) => selectCurrentZone(foundationShell.zones, state.currentZoneId));
  const hoveredInteractable = usePhaseOneStore((state) => selectHoveredInteractable(foundationShell.interactables, state.hoveredInteractableId));
  const prompt = usePhaseOneStore((state) => state.prompt);
  const initializeEnvironment = usePhaseOneStore((state) => state.initializeEnvironment);
  const environmentReady = usePhaseOneStore((state) => state.environmentReady);
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const [rendererStarted, setRendererStarted] = useState(false);
  const [sceneInitialized, setSceneInitialized] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [selectionTimedOut, setSelectionTimedOut] = useState(false);
  const isFirstRunSafe = onboardingStage === "first_run";

  useEffect(() => {
    console.info("[EnvironmentCanvas] mount", {
      operationId: selectedOperation?.id ?? null,
      missionId: selectedOperation?.templateId ?? null,
    });
    initializeEnvironment();
    setRendererStarted(false);
    setSceneInitialized(false);
    setRuntimeError(null);
  }, [initializeEnvironment, selectedOperation?.id, selectedOperation?.templateId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onWindowError = (event: ErrorEvent) => {
      console.error("[EnvironmentCanvas] uncaught window error", event.error || event.message);
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("[EnvironmentCanvas] unhandled rejection", event.reason);
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    try {
      const probe = document.createElement("canvas");
      const supported = Boolean(probe.getContext("webgl2") || probe.getContext("webgl") || probe.getContext("experimental-webgl"));
      setWebglSupported(supported);
      if (!supported) {
        console.error("[EnvironmentCanvas] WebGL unavailable in this browser.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "WebGL probe failed.";
      setWebglSupported(false);
      setRuntimeError(message);
      console.error("[EnvironmentCanvas] WebGL probe failed", error);
    }
  }, []);

  useEffect(() => {
    if (selectedOperation) {
      setSelectionTimedOut(false);
      return;
    }
    const timeout = window.setTimeout(() => {
      setSelectionTimedOut(true);
      console.warn("[EnvironmentCanvas] mission selection did not resolve before scene startup timeout.");
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [selectedOperation]);

  const showDebugFallback = Boolean(runtimeError) || webglSupported === false || (!selectedOperation && selectionTimedOut);

  return (
    <div className="relative h-full min-h-[760px]">
      <CanvasErrorBoundary
        key={selectedOperation?.id || "no-operation"}
        onError={(error) => setRuntimeError(error.message || "Environment runtime crashed during render.")}
        fallback={
          <div className="flex min-h-[760px] items-center justify-center rounded-[32px] border border-red-400/20 bg-black/30">
            <DebugFallbackPanel
              selectedOperation={selectedOperation}
              missionState={missionState}
              webglSupported={webglSupported}
              rendererStarted={rendererStarted}
              sceneInitialized={sceneInitialized}
              environmentReady={environmentReady}
              runtimeError={runtimeError || "The 3D scene threw an exception before the first frame completed."}
            />
          </div>
        }
      >
        <Canvas
          key={selectedOperation?.id || "no-operation"}
          frameloop="always"
          shadows
          camera={{ position: [0, 6, 52], fov: 50 }}
          onCreated={({ gl, scene, camera }) => {
            setRendererStarted(true);
            console.info("[EnvironmentCanvas] renderer started", {
              operationId: selectedOperation?.id ?? null,
              rendererType: gl.constructor.name,
              sceneChildren: scene.children.length,
              cameraType: camera.constructor.name,
            });
          }}
        >
          <SceneInitProbe selectedOperation={selectedOperation} onReady={() => setSceneInitialized(true)} />
          <Runtime selectedOperation={selectedOperation} missionState={missionState} onRuntimeReady={() => setSceneInitialized(true)} />
        </Canvas>
      </CanvasErrorBoundary>
      {showDebugFallback ? (
        <DebugFallbackPanel
          selectedOperation={selectedOperation}
          missionState={missionState}
          webglSupported={webglSupported}
          rendererStarted={rendererStarted}
          sceneInitialized={sceneInitialized}
          environmentReady={environmentReady}
          runtimeError={runtimeError}
        />
      ) : null}
      {!isFirstRunSafe ? <InteractionPrompt zone={currentZone} interactable={hoveredInteractable} prompt={prompt} /> : null}
    </div>
  );
}
