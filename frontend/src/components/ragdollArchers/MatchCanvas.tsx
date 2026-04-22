"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import styles from "./RagdollArchers.module.css";
import { PLAYER_ID } from "@/game/ragdollArchers/core/constants";
import { useRagdollArchersStore } from "@/game/ragdollArchers/core/store";
import { usePlayerInput, consumePlayerInputFrame, type PlayerInputState } from "@/game/ragdollArchers/controllers/usePlayerInput";
import { createFoundationMatch, type FoundationMatchDefinition } from "@/game/ragdollArchers/runtime/matchRuntimeFactory";

const Duel2DMatch = dynamic(async () => {
  try {
    return (await import("@/components/ragdollArchers/Duel2DMatch")).Duel2DMatch;
  } catch (error) {
    console.error("Recovered error: Duel2DMatch import", error);
    return function Duel2DMatchFallback() {
      return <div className={styles.viewportPanel} style={{ padding: 16 }}>2D duel unavailable.</div>;
    };
  }
}, { ssr: false });

function SafePlayableFallbackScene({ inputRef }: { inputRef: React.MutableRefObject<PlayerInputState> }) {
  const { camera } = useThree();
  const pushToast = useRagdollArchersStore((state) => state.pushToast);
  const setHitFeedback = useRagdollArchersStore((state) => state.setHitFeedback);
  const playerRef = useRef<THREE.Mesh>(null);
  const targetRef = useRef<THREE.Mesh>(null);
  const projectileRef = useRef<THREE.Mesh>(null);
  const playerPositionRef = useRef<THREE.Vector3 | null>(null);
  const targetHomeRef = useRef<THREE.Vector3 | null>(null);
  const targetPositionRef = useRef<THREE.Vector3 | null>(null);
  const targetVelocityRef = useRef<THREE.Vector3 | null>(null);
  const projectileStateRef = useRef({
    active: false,
    position: null as THREE.Vector3 | null,
    velocity: null as THREE.Vector3 | null,
  });
  const hitPulseRef = useRef(0);
  const recoilKickRef = useRef(0);
  const impactSlowRef = useRef(0);
  const lastShotAtRef = useRef(0);
  const lastLowHealthWarnRef = useRef(false);
  const fallbackVitalsRef = useRef({
    health: 100,
    stamina: 100,
  });
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      playerPositionRef.current = new THREE.Vector3(0, 1.2, 4.4);
      targetHomeRef.current = new THREE.Vector3(0, 1.25, -3.4);
      targetPositionRef.current = targetHomeRef.current.clone();
      targetVelocityRef.current = new THREE.Vector3();
      projectileStateRef.current.position = new THREE.Vector3();
      projectileStateRef.current.velocity = new THREE.Vector3();
    } catch (error) {
      console.error("Recovered error: fallback-scene-init", error);
      playerPositionRef.current = null;
      targetHomeRef.current = null;
      targetPositionRef.current = null;
      targetVelocityRef.current = null;
      projectileStateRef.current.position = null;
      projectileStateRef.current.velocity = null;
    }
  }, []);

  useFrame((_, delta) => {
    if (
      !playerPositionRef.current ||
      !targetHomeRef.current ||
      !targetPositionRef.current ||
      !targetVelocityRef.current ||
      !projectileStateRef.current.position ||
      !projectileStateRef.current.velocity
    ) {
      return;
    }
    elapsedRef.current += delta;
    const simDelta = impactSlowRef.current > 0 ? delta * 0.38 : delta;
    impactSlowRef.current = Math.max(0, impactSlowRef.current - delta * 3.2);
    const input = consumePlayerInputFrame(inputRef);
    const moveSpeed = input.sprint ? 8.8 : 6.8;
    const yaw = input.pointerLocked ? input.yaw : Math.PI;
    const pitch = input.pointerLocked ? input.pitch : -0.03;
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const movement = forward.clone().multiplyScalar(input.moveZ).add(right.clone().multiplyScalar(input.moveX));
    if (movement.lengthSq() > 1) movement.normalize();
    playerPositionRef.current.addScaledVector(movement, moveSpeed * simDelta);
    fallbackVitalsRef.current.stamina = THREE.MathUtils.clamp(
      fallbackVitalsRef.current.stamina + (input.sprint && movement.lengthSq() > 0.04 ? -simDelta * 7 : simDelta * 11),
      32,
      100,
    );
    fallbackVitalsRef.current.health = THREE.MathUtils.clamp(fallbackVitalsRef.current.health - simDelta * 0.35, 26, 100);

    if (fallbackVitalsRef.current.health < 34 && !lastLowHealthWarnRef.current) {
      lastLowHealthWarnRef.current = true;
      pushToast({
        title: "UNSTABLE CONDITION",
        body: "Back off, breathe, and line up the next shot.",
        tone: "warn",
      });
    }

    if (fallbackVitalsRef.current.health >= 38) {
      lastLowHealthWarnRef.current = false;
    }

    if ((input.drawStarted || input.drawReleased) && !projectileStateRef.current.active) {
      const origin = playerPositionRef.current.clone().add(new THREE.Vector3(0, 1.1, 0));
      const direction = input.pointerLocked
        ? new THREE.Vector3(
            Math.sin(yaw) * Math.cos(pitch),
            Math.sin(pitch),
            Math.cos(yaw) * Math.cos(pitch),
          ).normalize()
        : targetPositionRef.current.clone().add(new THREE.Vector3(0, 0.45, 0)).sub(origin).normalize();
      projectileStateRef.current.active = true;
      projectileStateRef.current.position.copy(origin).addScaledVector(direction, 1.05);
      projectileStateRef.current.velocity.copy(direction.multiplyScalar(36));
      recoilKickRef.current = 0.42;
      const now = typeof performance === "undefined" ? Date.now() : performance.now();
      if (now - lastShotAtRef.current > 550) {
        pushToast({
          title: "SHOT AWAY",
          body: "Keep the dummy in your lane and fire again.",
          tone: "neutral",
        });
        lastShotAtRef.current = now;
      }
    }

    if (projectileStateRef.current.active) {
      projectileStateRef.current.position.addScaledVector(projectileStateRef.current.velocity, simDelta);
      const impactDistance = projectileStateRef.current.position.distanceTo(targetPositionRef.current);
      if (impactDistance < 1.55) {
        const critical = impactDistance < 0.78;
        console.log(critical ? "CRITICAL HIT" : "HIT");
        projectileStateRef.current.active = false;
        targetVelocityRef.current.add(projectileStateRef.current.velocity.clone().normalize().multiplyScalar(critical ? 4.4 : 3.2));
        hitPulseRef.current = critical ? 0.88 : 0.62;
        impactSlowRef.current = critical ? 0.18 : 0.1;
        pushToast({
          title: critical ? "CRITICAL HIT" : "HIT",
          body: critical ? "Center-mass impact snapped the dummy backward." : "Clean impact confirmed.",
          tone: "success",
        });
        setHitFeedback({
          id: `fallback-hit-${Date.now()}`,
          title: critical ? "CRITICAL HIT" : "HIT",
          body: critical ? "Heavy shot landed squarely on target." : "Target knocked off balance.",
          severity: critical ? "critical" : "info",
          actorId: PLAYER_ID,
          limb: "torso",
          startedAt: Date.now(),
        });
      } else if (projectileStateRef.current.position.distanceTo(playerPositionRef.current) > 50) {
        projectileStateRef.current.active = false;
      }
    }

    const swayTarget = new THREE.Vector3(
      Math.sin(elapsedRef.current * 0.9) * 0.42,
      1.25 + Math.sin(elapsedRef.current * 1.3) * 0.04,
      -3.4 + Math.cos(elapsedRef.current * 0.7) * 0.18,
    );
    targetHomeRef.current.lerp(swayTarget, 0.08);
    targetPositionRef.current.addScaledVector(targetVelocityRef.current, simDelta);
    targetVelocityRef.current.multiplyScalar(0.86);
    targetPositionRef.current.lerp(targetHomeRef.current, 0.052);
    hitPulseRef.current = Math.max(0, hitPulseRef.current - simDelta);
    recoilKickRef.current = Math.max(0, recoilKickRef.current - delta * 2.3);

    if (playerRef.current) {
      playerRef.current.position.copy(playerPositionRef.current);
    }

    if (targetRef.current) {
      targetRef.current.position.copy(targetPositionRef.current);
      const scale = 1 + hitPulseRef.current * 0.82;
      targetRef.current.scale.set(scale, scale, scale);
      if (targetRef.current.material instanceof THREE.MeshStandardMaterial) {
        targetRef.current.material.emissiveIntensity = hitPulseRef.current > 0 ? 1.65 : 0.26;
      }
    }

    if (projectileRef.current) {
      projectileRef.current.visible = projectileStateRef.current.active;
      if (projectileStateRef.current.active) {
        projectileRef.current.position.copy(projectileStateRef.current.position);
      }
    }

    const cameraOffset = new THREE.Vector3(
      -Math.sin(yaw) * (5.35 + recoilKickRef.current * 0.65),
      3.45 + Math.sin(-pitch) * 1.2 + recoilKickRef.current * 0.22,
      -Math.cos(yaw) * (5.35 + recoilKickRef.current * 0.65),
    );
    const lookTarget = targetPositionRef.current.clone().lerp(playerPositionRef.current.clone().add(new THREE.Vector3(0, 1.1, 0)), 0.42);
    camera.position.lerp(playerPositionRef.current.clone().add(cameraOffset), 0.14);
    camera.lookAt(lookTarget);

  });

  return (
    <>
      <color attach="background" args={["#091017"]} />
      <fog attach="fog" args={["#091017", 14, 38]} />
      <ambientLight intensity={0.95} />
      <directionalLight position={[8, 12, 6]} intensity={1.55} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#31443e" />
      </mesh>
      <mesh ref={playerRef} position={[0, 1.2, 4.4]} castShadow>
        <capsuleGeometry args={[0.38, 1.2, 6, 10]} />
        <meshStandardMaterial color="#d07c53" emissive="#2b1510" emissiveIntensity={0.35} />
      </mesh>
      <mesh ref={targetRef} position={[0, 1.25, -3.4]} castShadow>
        <boxGeometry args={[1.2, 2.4, 1.2]} />
        <meshStandardMaterial color="#6e8e9b" emissive="#441111" emissiveIntensity={0.2} />
      </mesh>
      <mesh ref={projectileRef} visible={false} castShadow>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#ffd48a" emissive="#9a6408" emissiveIntensity={1.2} />
      </mesh>
    </>
  );
}

const FoundationMatchRuntime = dynamic(async () => {
  try {
    return (await import("@/game/ragdollArchers/runtime/FoundationMatchRuntime")).FoundationMatchRuntime;
  } catch (error) {
    console.error("Recovered error: FoundationMatchRuntime import", error);
    return function FoundationMatchRuntimeFallback(props: { inputRef: React.MutableRefObject<PlayerInputState> }) {
      return <SafePlayableFallbackScene inputRef={props.inputRef} />;
    };
  }
}, { ssr: false });

export function MatchCanvas({ mode }: { mode: "quick" | "survival" | "challenge" }) {
  const phase = useRagdollArchersStore((state) => state.phase);
  const settings = useRagdollArchersStore((state) => state.settings);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = usePlayerInput(containerRef);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [runtimePreview, setRuntimePreview] = useState<FoundationMatchDefinition | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setRuntimeReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const nextPreview = createFoundationMatch({
        arenaId: settings.arenaId,
        enemyCount: mode === "quick" ? 1 : mode === "survival" ? 3 : 4,
      });
      setRuntimePreview(nextPreview);
    } catch (error) {
      console.error("Runtime preview crash:", error);
      setRuntimePreview(null);
    }
  }, [mode, settings.arenaId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      console.log("MatchCanvas mounted");
      console.log("Canvas mounted");
      console.log("Initializing runtime");
      if (!runtimePreview) {
        console.warn("Runtime preview unavailable for mode:", mode);
        return;
      }
      console.log("Runtime initialized for mode:", mode, runtimePreview);
    } catch (error) {
      console.error("Runtime crash:", error);
    }

    return () => {
      console.log("MatchCanvas unmounted");
    };
  }, [mode, runtimePreview]);

  if (!runtimeReady || !runtimePreview) {
    if (settings.mode === "duel") {
      return (
        <div ref={containerRef} className={styles.viewportPanel}>
          <Duel2DMatch />
        </div>
      );
    }
    return (
      <div ref={containerRef} className={styles.viewportPanel}>
        <Canvas shadows camera={{ position: [-10, 8, 12], fov: 55 }}>
          <SafePlayableFallbackScene inputRef={inputRef} />
        </Canvas>
      </div>
    );
  }

  if (settings.mode === "duel") {
    return (
      <div ref={containerRef} className={styles.viewportPanel}>
        <Duel2DMatch />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={styles.viewportPanel}>
      <Canvas shadows camera={{ position: [-10, 8, 12], fov: settings.mode === "firstperson" ? 72 : 55 }}>
        {phase === "playing" || phase === "result" ? <FoundationMatchRuntime inputRef={inputRef} /> : null}
      </Canvas>
    </div>
  );
}
