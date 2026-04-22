"use client";

import { MutableRefObject, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import { useCampaignStore } from "@/game/core/campaignStore";
import { collectActiveBlockers, usePhaseOneStore } from "@/game/core/phaseOneStore";
import { foundationShell } from "@/game/data/foundationShell";
import { clamp, lerp } from "@/game/utils/math";

function resolveCameraState(params: {
  suspicion: number;
  accessState: string;
  alertLevel: number;
  watcherCount: number;
  hoverActive: boolean;
  targetWindow: string;
}) {
  if (params.hoverActive) return "interaction_focus";
  if (params.targetWindow === "vulnerable" && params.alertLevel < 2) return "target_focus";
  if (params.alertLevel >= 2.2 || params.suspicion >= 72) return "alert_danger";
  if (params.accessState === "hard_restricted" || params.accessState === "enforcer_compromised") return "trespass_tension";
  if (params.watcherCount > 0 || params.suspicion >= 26) return "stealth_focus";
  return "exploration";
}

function sampleCollisionDistance(from: Vector3, to: Vector3, blockers: ReturnType<typeof collectActiveBlockers>) {
  const steps = 14;
  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    const x = MathUtils.lerp(from.x, to.x, t);
    const z = MathUtils.lerp(from.z, to.z, t);
    const blocked = blockers.some((bounds) => x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ);
    if (blocked) {
      return Math.max(0.38, (index - 1) / steps);
    }
  }
  return 1;
}

export default function CameraController({
  orbitYawRef,
  orbitPitchRef,
  orbitDistanceRef,
  isIntroOnboarding = false,
  introFacing = null,
}: {
  orbitYawRef: MutableRefObject<number>;
  orbitPitchRef: MutableRefObject<number>;
  orbitDistanceRef: MutableRefObject<number>;
  isIntroOnboarding?: boolean;
  introFacing?: number | null;
}) {
  const { camera, gl } = useThree();
  const onboardingStage = useCampaignStore((state) => state.progress.onboardingStage);
  const playerPosition = usePhaseOneStore((state) => state.playerPosition);
  const cameraMode = usePhaseOneStore((state) => state.cameraMode);
  const setCameraMode = usePhaseOneStore((state) => state.setCameraMode);
  const suspicion = usePhaseOneStore((state) => state.suspicion);
  const accessState = usePhaseOneStore((state) => state.accessState);
  const globalAlertLevel = usePhaseOneStore((state) => state.globalAlertLevel);
  const activeWatcherIds = usePhaseOneStore((state) => state.activeWatcherIds);
  const hoveredInteractableId = usePhaseOneStore((state) => state.hoveredInteractableId);
  const targetWindowState = usePhaseOneStore((state) => state.targetWindowState);
  const gateStates = usePhaseOneStore((state) => state.gateStates);
  const interactionLog = usePhaseOneStore((state) => state.interactionLog);
  const mission = usePhaseOneStore((state) => state.mission);
  const dragging = useRef(false);
  const blockers = collectActiveBlockers(foundationShell.blockers, foundationShell.structures, gateStates);
  const briefingOpen = !mission.missionComplete && Math.hypot(playerPosition[0] - foundationShell.spawn.position[0], playerPosition[2] - foundationShell.spawn.position[2]) < 2.6 && interactionLog.length <= 2;
  const liveWindowOpen = mission.missionComplete || briefingOpen || onboardingStage === "intro" || onboardingStage === "first_debrief";
  const firstPersonPositionRef = useRef(new Vector3(playerPosition[0], playerPosition[1] + 1.68, playerPosition[2]));
  const firstPersonLookRef = useRef(new Vector3(playerPosition[0], playerPosition[1] + 1.6, playerPosition[2] + 1));

  useEffect(() => {
    if (typeof introFacing === "number") {
      orbitYawRef.current = introFacing;
    }
    orbitPitchRef.current = isIntroOnboarding ? 0.56 : 0.6;
    orbitDistanceRef.current = 5.6;
    if (onboardingStage === "first_run") {
      setCameraMode("first_person");
    }
  }, [introFacing, isIntroOnboarding, onboardingStage, orbitDistanceRef, orbitPitchRef, orbitYawRef, setCameraMode]);

  useEffect(() => {
    const element = gl.domElement;
    const supportsPointerLock = typeof element.requestPointerLock === "function";
    element.tabIndex = 0;
    element.style.outline = "none";
    element.style.touchAction = "none";

    const onPointerDown = (event: PointerEvent) => {
      if (cameraMode === "first_person") {
        if (event.button !== 0 || liveWindowOpen || !supportsPointerLock) return;
        element.focus({ preventScroll: true });
        element.requestPointerLock();
        return;
      }
      if (event.button !== 2) return;
      dragging.current = true;
      element.setPointerCapture(event.pointerId);
    };

    const onPointerUp = (event: PointerEvent) => {
      dragging.current = false;
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (cameraMode === "first_person") {
        if (document.pointerLockElement !== element) return;
        orbitYawRef.current -= event.movementX * 0.0026;
        orbitPitchRef.current = clamp(orbitPitchRef.current - event.movementY * 0.0021, 0.36, 1.24);
        return;
      }
      if (!dragging.current) return;
      orbitYawRef.current -= event.movementX * 0.005;
      orbitPitchRef.current = clamp(orbitPitchRef.current - event.movementY * 0.004, 0.35, 1.25);
    };

    const onWheel = (event: WheelEvent) => {
      orbitDistanceRef.current = clamp(orbitDistanceRef.current + event.deltaY * 0.01, 4.5, 11);
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    element.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("wheel", onWheel, { passive: true });
    element.addEventListener("contextmenu", onContextMenu);

    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("wheel", onWheel);
      element.removeEventListener("contextmenu", onContextMenu);
    };
  }, [cameraMode, gl, liveWindowOpen, orbitDistanceRef, orbitPitchRef, orbitYawRef]);

  useEffect(() => {
    const element = gl.domElement;
    if (cameraMode !== "first_person" || liveWindowOpen) {
      if (document.pointerLockElement === element) {
        document.exitPointerLock();
      }
    }
  }, [cameraMode, gl, liveWindowOpen]);

  useFrame(() => {
    const perspectiveCamera = camera as PerspectiveCamera;
    const lookY = cameraMode === "first_person" ? playerPosition[1] + 1.45 : playerPosition[1] + 1.4;

    if (cameraMode === "first_person") {
      const desiredPosition = new Vector3(playerPosition[0], playerPosition[1] + 1.68, playerPosition[2]);
      const desiredLook = new Vector3(
        playerPosition[0] + Math.sin(orbitYawRef.current) * 10,
        playerPosition[1] + 1.58,
        playerPosition[2] + Math.cos(orbitYawRef.current) * 10,
      );
      firstPersonPositionRef.current.lerp(desiredPosition, 0.72);
      firstPersonLookRef.current.lerp(desiredLook, 0.7);
      perspectiveCamera.position.copy(firstPersonPositionRef.current);
      perspectiveCamera.lookAt(firstPersonLookRef.current);
      return;
    }

    const cameraState = resolveCameraState({
      suspicion,
      accessState,
      alertLevel: globalAlertLevel,
      watcherCount: activeWatcherIds.length,
      hoverActive: Boolean(hoveredInteractableId),
      targetWindow: targetWindowState,
    });

    const distanceBias =
      cameraState === "alert_danger"
        ? -1.8
        : cameraState === "trespass_tension"
          ? -1.2
          : cameraState === "interaction_focus"
            ? -2.3
            : cameraState === "target_focus"
              ? -1.4
              : cameraState === "stealth_focus"
                ? -0.8
                : 0;
    const shoulderBias = cameraState === "alert_danger" || cameraState === "target_focus" ? 1.05 : cameraState === "stealth_focus" || cameraState === "trespass_tension" ? 0.72 : 0.35;
    const pitchBias =
      cameraState === "interaction_focus" ? 0.16 :
      cameraState === "target_focus" ? 0.08 :
      cameraState === "alert_danger" ? 0.05 : 0;
    const lookAheadBias = cameraState === "target_focus" ? 1.6 : cameraState === "alert_danger" ? 0.8 : 0.4;

    const desiredDistance = clamp(orbitDistanceRef.current + distanceBias, 3.7, 10.8);
    const desiredPitch = clamp(orbitPitchRef.current + pitchBias, 0.38, 1.18);
    const desiredFov =
      cameraState === "alert_danger"
        ? 55
        : cameraState === "trespass_tension"
          ? 52
          : cameraState === "interaction_focus"
            ? 46
            : cameraState === "target_focus"
              ? 48
              : 50;

    perspectiveCamera.fov = lerp(perspectiveCamera.fov, desiredFov, 0.1);
    perspectiveCamera.updateProjectionMatrix();

    const introLookAheadBias = isIntroOnboarding && onboardingStage === "first_run" ? 0.18 : 0;
    const introShoulderBias = isIntroOnboarding && onboardingStage === "first_run" ? 0.08 : 0;
    const desiredX = playerPosition[0] - Math.sin(orbitYawRef.current) * Math.cos(desiredPitch) * desiredDistance + Math.cos(orbitYawRef.current) * (shoulderBias + introShoulderBias);
    const desiredY = playerPosition[1] + Math.sin(desiredPitch) * desiredDistance + 0.82;
    const desiredZ = playerPosition[2] - Math.cos(orbitYawRef.current) * Math.cos(desiredPitch) * desiredDistance - Math.sin(orbitYawRef.current) * (shoulderBias + introShoulderBias);
    const desiredPosition = new Vector3(desiredX, desiredY, desiredZ);
    const targetPosition = new Vector3(playerPosition[0], playerPosition[1] + 1.35, playerPosition[2]);
    const visibleFactor = sampleCollisionDistance(targetPosition, desiredPosition, blockers);
    const resolvedPosition = targetPosition.clone().lerp(desiredPosition, visibleFactor);
    const finalTarget = new Vector3(
      playerPosition[0] + Math.sin(orbitYawRef.current) * (lookAheadBias + introLookAheadBias),
      lookY,
      playerPosition[2] + Math.cos(orbitYawRef.current) * (lookAheadBias + introLookAheadBias),
    );

    perspectiveCamera.position.set(
      lerp(perspectiveCamera.position.x, resolvedPosition.x, isIntroOnboarding && onboardingStage === "first_run" ? 0.16 : cameraState === "alert_danger" ? 0.17 : 0.11),
      lerp(perspectiveCamera.position.y, resolvedPosition.y, isIntroOnboarding && onboardingStage === "first_run" ? 0.15 : cameraState === "interaction_focus" ? 0.16 : 0.11),
      lerp(perspectiveCamera.position.z, resolvedPosition.z, isIntroOnboarding && onboardingStage === "first_run" ? 0.16 : cameraState === "alert_danger" ? 0.17 : 0.11),
    );
    perspectiveCamera.lookAt(finalTarget);
  });

  return null;
}
