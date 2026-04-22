"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useCampaignStore } from "@/game/core/campaignStore";
import { foundationShell } from "@/game/data/foundationShell";
import { collectActiveBlockers, usePhaseOneStore } from "@/game/core/phaseOneStore";
import type { Vec3 } from "@/game/core/types";
import { resolvePlayerMotion } from "@/game/systems/movementSystem";
import { getBoundedZoneAtPosition } from "@/game/utils/math";

export default function PlayerController({
  orbitYawRef,
}: {
  orbitYawRef: React.MutableRefObject<number>;
}) {
  const onboardingStage = useCampaignStore((state) => state.progress.onboardingStage);
  const selectedOperation = useCampaignStore((state) => state.getSelectedOperation());
  const setPlayerTransform = usePhaseOneStore((state) => state.setPlayerTransform);
  const setCurrentZoneId = usePhaseOneStore((state) => state.setCurrentZoneId);
  const setPosture = usePhaseOneStore((state) => state.setPosture);
  const setPrompt = usePhaseOneStore((state) => state.setPrompt);
  const playerPosition = usePhaseOneStore((state) => state.playerPosition);
  const playerFacing = usePhaseOneStore((state) => state.playerFacing);
  const carriedBodyId = usePhaseOneStore((state) => state.carriedBodyId);
  const posture = usePhaseOneStore((state) => state.posture);
  const gateStates = usePhaseOneStore((state) => state.gateStates);
  const keys = useRef<Record<string, boolean>>({});
  const smoothedFacing = useRef(playerFacing);
  const controlReadyLogged = useRef(false);
  const movementDetectedLogged = useRef(false);
  const blockers = useMemo(() => collectActiveBlockers(foundationShell.blockers, foundationShell.structures, gateStates), [gateStates]);
  const isIntroOnboarding = onboardingStage === "first_run" && selectedOperation?.variantId === "azure-summit-fall";

  useEffect(() => {
    controlReadyLogged.current = false;
    movementDetectedLogged.current = false;
    if (!isIntroOnboarding) return;
    console.info("[PlayerController] onboarding controls armed", {
      operationId: selectedOperation?.id ?? null,
    });
    controlReadyLogged.current = true;
  }, [isIntroOnboarding, selectedOperation?.id]);

  useEffect(() => {
    const handleDown = (event: KeyboardEvent) => {
      keys.current[event.code] = true;
      if ((event.code === "KeyC" || event.code === "ControlLeft") && !carriedBodyId) {
        setPosture(usePhaseOneStore.getState().posture === "crouch" ? "stand" : "crouch");
      }
    };
    const handleUp = (event: KeyboardEvent) => {
      keys.current[event.code] = false;
    };

    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
    };
  }, [carriedBodyId, setPosture]);

  useFrame((_state, delta) => {
    let inputX = 0;
    let inputZ = 0;

    if (keys.current.KeyW || keys.current.ArrowUp) inputZ += 1;
    if (keys.current.KeyS || keys.current.ArrowDown) inputZ -= 1;
    if (keys.current.KeyA || keys.current.ArrowLeft) inputX -= 1;
    if (keys.current.KeyD || keys.current.ArrowRight) inputX += 1;
    const moving = Math.hypot(inputX, inputZ) > 0;
    if (isIntroOnboarding && moving && !movementDetectedLogged.current) {
      movementDetectedLogged.current = true;
      setPrompt("");
      console.info("[PlayerController] onboarding movement detected", {
        inputX,
        inputZ,
      });
    }
    const speed =
      posture === "dragging"
        ? 2.5
        : posture === "crouch"
          ? 2.9
          : keys.current.ShiftLeft || keys.current.ShiftRight
            ? 8.4
            : 5.2;

    if (!moving) {
      const idleVelocity: Vec3 = [0, 0, 0];
      setPlayerTransform(playerPosition, smoothedFacing.current, idleVelocity);
      const idleZone = getBoundedZoneAtPosition(playerPosition, foundationShell.zones);
      if (idleZone) setCurrentZoneId(idleZone.id);
      return;
    }

    const result = resolvePlayerMotion({
      position: playerPosition,
      yaw: orbitYawRef.current,
      inputX,
      inputZ,
      speed,
      delta,
      blockers,
      worldBounds: foundationShell.worldBounds,
    });

    const zone = getBoundedZoneAtPosition(result.position, foundationShell.zones);
    const groundedPosition = [result.position[0], zone?.height ?? 1, result.position[2]] as typeof result.position;
    smoothedFacing.current = result.facing;
    setPlayerTransform(groundedPosition, smoothedFacing.current, result.velocity);
    if (zone) setCurrentZoneId(zone.id);
    if (carriedBodyId && posture !== "dragging") setPosture("dragging");
    if (!carriedBodyId && posture === "dragging") setPosture("stand");
  });

  return null;
}
