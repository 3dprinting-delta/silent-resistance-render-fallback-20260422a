"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Sky, Stars } from "@react-three/drei";
import { Physics, useRapier, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { computeAiIntent } from "@/game/ragdollArchers/controllers/aiController";
import { consumePlayerInputFrame, type PlayerInputState } from "@/game/ragdollArchers/controllers/usePlayerInput";
import { FIXED_STEP, MAX_ACTIVE_ARROWS, PLAYER_ID, SNAPSHOT_INTERVAL, arrowTuning, difficultyTuning } from "@/game/ragdollArchers/core/constants";
import { buildProgressionEffects } from "@/game/ragdollArchers/core/progression";
import { createInitialActorAmmo, useRagdollArchersStore } from "@/game/ragdollArchers/core/store";
import type { ActiveTreatment, ActorSnapshot, ArrowSnapshot, ArrowType, BalanceState, BufferedReplayEvent, DerivedVitals, HitFeedbackEvent, InjuryRecord, MedicalSupplyId, ReplayHighlightTag, SupplyStack } from "@/game/ragdollArchers/core/types";
import { ArrowEntity } from "@/game/ragdollArchers/entities/ArrowEntity";
import { ActorRagdoll, type RagdollRigApi } from "@/game/ragdollArchers/entities/ActorRagdoll";
import { ArenaScene, type PropBodyApi } from "@/game/ragdollArchers/entities/WorldProps";
import { decodeNetworkEvent, encodeNetworkEvent } from "@/game/ragdollArchers/network/eventCodec";
import type { NetworkMatchEvent } from "@/game/ragdollArchers/network/networkTypes";
import { sampleArenaHeight } from "@/game/ragdollArchers/physics/terrain";
import { appendReplayEvent, detectReplayHighlight, freezeReplaySnapshot } from "@/game/ragdollArchers/systems/replayBufferSystem";
import { clamp, dampAngle, distanceBetween, easeOutCubic, lerp } from "@/game/ragdollArchers/systems/math";
import { applyInjuryEffects } from "@/game/ragdollArchers/systems/injuryEffectsSystem";
import { applyHit, createMatchRuntime, spawnArrow, type ActorDescriptor } from "@/game/ragdollArchers/runtime/matchRuntimeFactory";
import { getChallengeDefinition } from "@/game/ragdollArchers/launch/challengeDefinitions";
import {
  applyConsumableEffect,
  applyTreatmentStage,
  buildDeathReport,
  buildMedicalSummary,
  computeDerivedVitals,
  consumeSupply,
  createDefaultVitals,
  createInjuryFromHit,
  getTreatmentAction,
  getTreatmentStatus,
  isHighSignalMedicalEvent,
  tickInjuryProgression,
  tickVitals,
} from "@/game/ragdollArchers/systems/survival";
import { supplyCatalog } from "@/game/ragdollArchers/systems/survival";

const RUNTIME_SUBSYSTEMS = {
  replay: true,
  network: true,
  injuryEffects: true,
  survival: true,
  audio: true,
} as const;

type MutableActorState = {
  id: string;
  name: string;
  team: "player" | "enemy";
  isPlayer: boolean;
  alive: boolean;
  knockedOut: boolean;
  health: number;
  stability: number;
  balanceState: BalanceState;
  drawCharge: number;
  vitals: ActorSnapshot["vitals"];
  injuries: InjuryRecord[];
  aimYaw: number;
  aimPitch: number;
  ammo: ReturnType<typeof createInitialActorAmmo>;
  limbs: ActorSnapshot["limbs"];
  lastFireAt: number;
  stimulantCrashAt: number | null;
  stimulantKind: MedicalSupplyId | null;
  stimulantCrashed: boolean;
};

type MutableArrow = {
  id: string;
  ownerId: string;
  type: ArrowType;
  bornAt: number;
};

type SafeModeStatus = {
  active: boolean;
  reason: string | null;
};

type SafeModeInputState = {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  yaw: number;
  pitch: number;
  fireQueued: boolean;
};

function createLimbState() {
  return {
    head: { hp: 20, disabled: false },
    torso: { hp: 55, disabled: false },
    pelvis: { hp: 50, disabled: false },
    upperArmLeft: { hp: 22, disabled: false },
    lowerArmLeft: { hp: 18, disabled: false },
    upperArmRight: { hp: 22, disabled: false },
    lowerArmRight: { hp: 18, disabled: false },
    upperLegLeft: { hp: 28, disabled: false },
    lowerLegLeft: { hp: 24, disabled: false },
    upperLegRight: { hp: 28, disabled: false },
    lowerLegRight: { hp: 24, disabled: false },
  } as ActorSnapshot["limbs"];
}

function createMutableActor(descriptor: ActorDescriptor): MutableActorState {
  const progression = useRagdollArchersStore.getState().progression;
  const effects = buildProgressionEffects(progression);
  const vitals = createDefaultVitals();
  if (descriptor.isPlayer) {
    vitals.stamina = effects.maxStamina;
    vitals.energy = effects.maxStamina;
  }
  const ammo = createInitialActorAmmo();
  if (descriptor.isPlayer) {
    ammo.standard += effects.ammoBonus;
    ammo.light += effects.ammoBonus;
    ammo.heavy += Math.ceil(effects.ammoBonus / 2);
  }
  return {
    id: descriptor.id,
    name: descriptor.name,
    team: descriptor.team,
    isPlayer: descriptor.isPlayer,
    alive: true,
    knockedOut: false,
    health: descriptor.isPlayer ? effects.maxHealth : 100,
    stability: 100,
    balanceState: "stable",
    drawCharge: 0,
    vitals,
    injuries: [],
    aimYaw: descriptor.isPlayer ? 0 : Math.PI,
    aimPitch: -0.1,
    ammo,
    limbs: createLimbState(),
    lastFireAt: 0,
    stimulantCrashAt: null,
    stimulantKind: null,
    stimulantCrashed: false,
  };
}

function deriveBalanceState(actor: MutableActorState) {
  if (!actor.alive || actor.stability <= 8) return "fallen" as const;
  if (actor.stability < 28) return "recovering" as const;
  if (actor.stability < 58) return "unstable" as const;
  return "stable" as const;
}

function PhysicsStepBridge({ stepRef }: { stepRef: React.MutableRefObject<((delta: number) => void) | null> }) {
  const { step } = useRapier();

  useEffect(() => {
    stepRef.current = step;
    return () => {
      stepRef.current = null;
    };
  }, [step, stepRef]);

  return null;
}

function SafeModeController({
  active,
  inputRef,
  initialPlayerSpawn,
  initialTargetSpawn,
  onHit,
}: {
  active: boolean;
  inputRef: React.MutableRefObject<PlayerInputState>;
  initialPlayerSpawn: [number, number, number];
  initialTargetSpawn: [number, number, number];
  onHit: () => void;
}) {
  const { camera } = useThree();
  const playerMeshRef = useRef<THREE.Mesh>(null);
  const targetMeshRef = useRef<THREE.Mesh>(null);
  const projectileMeshRef = useRef<THREE.Mesh>(null);
  const playerPositionRef = useRef<THREE.Vector3 | null>(null);
  const targetPositionRef = useRef<THREE.Vector3 | null>(null);
  const targetVelocityRef = useRef<THREE.Vector3 | null>(null);
  const projectileStateRef = useRef({
    active: false,
    position: null as THREE.Vector3 | null,
    velocity: null as THREE.Vector3 | null,
  });
  const hitPulseRef = useRef(0);
  const safeInputRef = useRef<SafeModeInputState>({
    moveX: 0,
    moveZ: 0,
    sprint: false,
    yaw: inputRef.current.yaw,
    pitch: inputRef.current.pitch,
    fireQueued: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      playerPositionRef.current = new THREE.Vector3(initialPlayerSpawn[0], initialPlayerSpawn[1] + 1.1, initialPlayerSpawn[2]);
      targetPositionRef.current = new THREE.Vector3(initialTargetSpawn[0], initialTargetSpawn[1] + 1.1, initialTargetSpawn[2]);
      targetVelocityRef.current = new THREE.Vector3();
      projectileStateRef.current.position = new THREE.Vector3();
      projectileStateRef.current.velocity = new THREE.Vector3();
    } catch (error) {
      console.error("Recovered error: safe-mode-vector-init", error);
      playerPositionRef.current = null;
      targetPositionRef.current = null;
      targetVelocityRef.current = null;
      projectileStateRef.current.position = null;
      projectileStateRef.current.velocity = null;
    }
  }, [initialPlayerSpawn, initialTargetSpawn]);

  useEffect(() => {
    if (!active) return;
    if (!playerPositionRef.current || !targetPositionRef.current || !targetVelocityRef.current || !projectileStateRef.current.position || !projectileStateRef.current.velocity) return;
    playerPositionRef.current.set(initialPlayerSpawn[0], initialPlayerSpawn[1] + 1.1, initialPlayerSpawn[2]);
    targetPositionRef.current.set(initialTargetSpawn[0], initialTargetSpawn[1] + 1.1, initialTargetSpawn[2]);
    targetVelocityRef.current.set(0, 0, 0);
    projectileStateRef.current.active = false;
    hitPulseRef.current = 0;
  }, [active, initialPlayerSpawn, initialTargetSpawn]);

  useEffect(() => {
    if (!active || typeof window === "undefined" || typeof document === "undefined") return;
    try {
      const pressed = new Set<string>();
      const updateAxes = () => {
        safeInputRef.current.moveX = (pressed.has("KeyD") ? 1 : 0) - (pressed.has("KeyA") ? 1 : 0);
        safeInputRef.current.moveZ = (pressed.has("KeyW") ? 1 : 0) - (pressed.has("KeyS") ? 1 : 0);
        safeInputRef.current.sprint = pressed.has("ShiftLeft") || pressed.has("ShiftRight");
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        pressed.add(event.code);
        updateAxes();
      };

      const handleKeyUp = (event: KeyboardEvent) => {
        pressed.delete(event.code);
        updateAxes();
      };

      const handleMouseMove = (event: MouseEvent) => {
        if (document.pointerLockElement) {
          safeInputRef.current.yaw -= event.movementX * 0.0025;
          safeInputRef.current.pitch = clamp(safeInputRef.current.pitch - event.movementY * 0.002, -0.9, 0.7);
          return;
        }

        const normalizedX = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
        const normalizedY = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
        safeInputRef.current.yaw = -normalizedX * Math.PI * 1.15;
        safeInputRef.current.pitch = clamp(-normalizedY * 1.15, -0.75, 0.55);
      };

      const handleClick = () => {
        safeInputRef.current.fireQueued = true;
        if (!document.pointerLockElement) {
          try {
            document.body.requestPointerLock?.();
          } catch (error) {
            console.error("Recovered error: safe-mode-pointer-lock", error);
          }
        }
      };

      const handleBlur = () => {
        pressed.clear();
        updateAxes();
      };

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("click", handleClick);
      window.addEventListener("blur", handleBlur);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("click", handleClick);
        window.removeEventListener("blur", handleBlur);
      };
    } catch (error) {
      console.error("Recovered error: safe-mode-input-setup", error);
      return;
    }
  }, [active]);

  useFrame((_, delta) => {
    if (!active) {
      if (projectileMeshRef.current) projectileMeshRef.current.visible = false;
      return;
    }
    if (!playerPositionRef.current || !targetPositionRef.current || !targetVelocityRef.current || !projectileStateRef.current.position || !projectileStateRef.current.velocity) return;

    const moveSpeed = safeInputRef.current.sprint ? 8.8 : 5.8;
    const forward = new THREE.Vector3(Math.sin(safeInputRef.current.yaw), 0, Math.cos(safeInputRef.current.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    const movement = forward.clone().multiplyScalar(safeInputRef.current.moveZ).add(right.clone().multiplyScalar(safeInputRef.current.moveX));
    if (movement.lengthSq() > 1) movement.normalize();
    playerPositionRef.current.addScaledVector(movement, moveSpeed * delta);

    if (safeInputRef.current.fireQueued && !projectileStateRef.current.active) {
      safeInputRef.current.fireQueued = false;
      const projectileDirection = new THREE.Vector3(
        Math.sin(safeInputRef.current.yaw) * Math.cos(safeInputRef.current.pitch),
        Math.sin(safeInputRef.current.pitch),
        Math.cos(safeInputRef.current.yaw) * Math.cos(safeInputRef.current.pitch),
      ).normalize();
      projectileStateRef.current.active = true;
      projectileStateRef.current.position.copy(playerPositionRef.current).add(new THREE.Vector3(0, 1.1, 0)).addScaledVector(projectileDirection, 1.3);
      projectileStateRef.current.velocity.copy(projectileDirection.multiplyScalar(24));
    }

    if (projectileStateRef.current.active) {
      projectileStateRef.current.position.addScaledVector(projectileStateRef.current.velocity, delta);
      if (projectileStateRef.current.position.distanceTo(targetPositionRef.current) < 1.05) {
        console.log("HIT");
        projectileStateRef.current.active = false;
        targetVelocityRef.current.add(projectileStateRef.current.velocity.clone().normalize().multiplyScalar(1.4));
        hitPulseRef.current = 0.45;
        onHit();
      } else if (projectileStateRef.current.position.distanceTo(playerPositionRef.current) > 45) {
        projectileStateRef.current.active = false;
      }
    }

    targetPositionRef.current.addScaledVector(targetVelocityRef.current, delta);
    targetVelocityRef.current.multiplyScalar(0.88);
    targetPositionRef.current.lerp(new THREE.Vector3(initialTargetSpawn[0], initialTargetSpawn[1] + 1.1, initialTargetSpawn[2]), 0.04);
    hitPulseRef.current = Math.max(0, hitPulseRef.current - delta);

    if (playerMeshRef.current) {
      playerMeshRef.current.position.copy(playerPositionRef.current);
    }
    if (targetMeshRef.current) {
      targetMeshRef.current.position.copy(targetPositionRef.current);
      const scaleBoost = 1 + hitPulseRef.current * 0.65;
      targetMeshRef.current.scale.set(scaleBoost, scaleBoost, scaleBoost);
      const targetMaterial = targetMeshRef.current.material;
      if (targetMaterial instanceof THREE.MeshStandardMaterial) {
        targetMaterial.emissiveIntensity = hitPulseRef.current > 0 ? 1.35 : 0.25;
      }
    }
    if (projectileMeshRef.current) {
      projectileMeshRef.current.visible = projectileStateRef.current.active;
      if (projectileStateRef.current.active) {
        projectileMeshRef.current.position.copy(projectileStateRef.current.position);
      }
    }

    const cameraOffset = new THREE.Vector3(
      -Math.sin(safeInputRef.current.yaw) * 6.4,
      3.2 + Math.sin(-safeInputRef.current.pitch) * 1.4,
      -Math.cos(safeInputRef.current.yaw) * 6.4,
    );
    camera.position.lerp(playerPositionRef.current.clone().add(cameraOffset), 0.16);
    camera.lookAt(playerPositionRef.current.x, playerPositionRef.current.y + 1.15, playerPositionRef.current.z);
  });

  if (!active) return null;

  return (
    <>
      <mesh ref={playerMeshRef} position={[initialPlayerSpawn[0], initialPlayerSpawn[1] + 1.1, initialPlayerSpawn[2]]}>
        <capsuleGeometry args={[0.35, 1.1, 4, 8]} />
        <meshStandardMaterial color="#d07c53" emissive="#2b1510" emissiveIntensity={0.35} />
      </mesh>
      <mesh ref={targetMeshRef} position={[initialTargetSpawn[0], initialTargetSpawn[1] + 1.1, initialTargetSpawn[2]]}>
        <boxGeometry args={[0.9, 1.9, 0.9]} />
        <meshStandardMaterial color="#6e8e9b" emissive="#3b0f0f" emissiveIntensity={0.25} />
      </mesh>
      <mesh ref={projectileMeshRef} visible={false}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color="#ffd48a" emissive="#6c4b0d" emissiveIntensity={0.8} />
      </mesh>
    </>
  );
}

export function FoundationMatchRuntime({ inputRef }: { inputRef: React.MutableRefObject<PlayerInputState> }) {
  const { camera, clock, scene } = useThree();
  const phase = useRagdollArchersStore((state) => state.phase);
  const settings = useRagdollArchersStore((state) => state.settings);
  const selectedChallengeId = useRagdollArchersStore((state) => state.selectedChallengeId);
  const activeArrowType = useRagdollArchersStore((state) => state.activeArrowType);
  const setActors = useRagdollArchersStore((state) => state.setActors);
  const setArrowsSnapshot = useRagdollArchersStore((state) => state.setArrows);
  const setMatchSnapshot = useRagdollArchersStore((state) => state.setMatchSnapshot);
  const setCinematic = useRagdollArchersStore((state) => state.setCinematic);
  const setHitFeedback = useRagdollArchersStore((state) => state.setHitFeedback);
  const setDeathReport = useRagdollArchersStore((state) => state.setDeathReport);
  const pushMedicalEvent = useRagdollArchersStore((state) => state.pushMedicalEvent);
  const medicalEvents = useRagdollArchersStore((state) => state.medicalEvents);
  const setDerivedVitals = useRagdollArchersStore((state) => state.setDerivedVitals);
  const enqueueNetworkEvent = useRagdollArchersStore((state) => state.enqueueNetworkEvent);
  const setReplayState = useRagdollArchersStore((state) => state.setReplayState);
  const setHighlightState = useRagdollArchersStore((state) => state.setHighlightState);
  const activeTreatment = useRagdollArchersStore((state) => state.activeTreatment);
  const setActiveTreatment = useRagdollArchersStore((state) => state.setActiveTreatment);
  const clearActiveTreatment = useRagdollArchersStore((state) => state.clearActiveTreatment);
  const setMedicalSummary = useRagdollArchersStore((state) => state.setMedicalSummary);
  const supplies = useRagdollArchersStore((state) => state.supplies);
  const setSupplies = useRagdollArchersStore((state) => state.setSupplies);
  const setTreatmentStatus = useRagdollArchersStore((state) => state.setTreatmentStatus);
  const pendingSelfAction = useRagdollArchersStore((state) => state.pendingSelfAction);
  const clearSelfAction = useRagdollArchersStore((state) => state.clearSelfAction);
  const completeMatch = useRagdollArchersStore((state) => state.completeMatch);
  const pushToast = useRagdollArchersStore((state) => state.pushToast);
  const pushAudioEvent = useRagdollArchersStore((state) => state.pushAudioEvent);

  const [runtime, setRuntime] = useState<ReturnType<typeof createMatchRuntime> | null>(null);
  const challenge = useMemo(() => getChallengeDefinition(selectedChallengeId), [selectedChallengeId]);
  const [descriptors, setDescriptors] = useState<ActorDescriptor[]>([]);
  const [arrows, setArrows] = useState<MutableArrow[]>([]);
  const actorStateRef = useRef<Record<string, MutableActorState>>({});
  const rigMapRef = useRef<Map<string, RagdollRigApi>>(new Map());
  const arrowBodiesRef = useRef<Map<string, React.RefObject<RapierRigidBody | null>>>(new Map());
  const propBodiesRef = useRef<Map<string, PropBodyApi>>(new Map());
  const accumulatorRef = useRef(0);
  const snapshotAccumulatorRef = useRef(0);
  const elapsedRef = useRef(0);
  const waveRef = useRef(1);
  const killsRef = useRef(0);
  const scoreRef = useRef(0);
  const slowMoUntilRef = useRef(0);
  const cameraShakeRef = useRef(0);
  const supplyBagRef = useRef<SupplyStack[]>(supplies);
  const treatmentActionRef = useRef<{ type: "treat" | "consume"; target: string } | null>(null);
  const activeTreatmentRef = useRef<ActiveTreatment | null>(activeTreatment);
  const medicalTimelineRef = useRef(medicalEvents);
  const replayBufferRef = useRef<BufferedReplayEvent[]>([]);
  const eventCooldownRef = useRef<Record<string, number>>({});
  const majorMomentCooldownRef = useRef<Record<string, number>>({});
  const stepRef = useRef<((delta: number) => void) | null>(null);
  const safeLoopVerifiedRef = useRef(false);
  const treatmentStatsRef = useRef({
    attempts: 0,
    completions: 0,
    interruptions: 0,
    consumablesUsed: [] as string[],
    shotsWhileInjured: 0,
    hitsWhileInjured: 0,
  });
  const [safeModeStatus, setSafeModeStatus] = useState<SafeModeStatus>({ active: false, reason: null });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const nextRuntime = createMatchRuntime({ settings });
      setRuntime(nextRuntime);
    } catch (error) {
      console.error("Recovered error: runtime-init", error);
      setRuntime(null);
    }
  }, [settings]);

  useEffect(() => {
    supplyBagRef.current = supplies;
  }, [supplies]);

  useEffect(() => {
    if (!challenge) return;
    let nextInventory = supplyBagRef.current;
    if (challenge.modifiers.grantTotem) {
      const current = nextInventory.find((stack) => stack.id === "undying-totem");
      if (!current || current.quantity < 1) {
        nextInventory = current
          ? nextInventory.map((stack) => (stack.id === "undying-totem" ? { ...stack, quantity: 1 } : stack))
          : [...nextInventory, { id: "undying-totem", label: supplyCatalog["undying-totem"].label, quantity: 1 }];
      }
    }
    if (challenge.modifiers.startCritical) {
      const player = actorStateRef.current[PLAYER_ID];
      if (player && player.injuries.length === 0) {
        const criticalInjury = createInjuryFromHit({
          actorId: PLAYER_ID,
          limb: "torso",
          arrowType: "heavy",
          force: 22,
          impactAngle: 32,
          penetrationDepth: 0.72,
        });
        player.injuries = [criticalInjury];
        player.vitals.bloodLevel = clamp(player.vitals.bloodLevel - 18, 0, 100);
      }
    }
    supplyBagRef.current = nextInventory;
    setSupplies(nextInventory);
  }, [challenge, setSupplies]);

  useEffect(() => {
    treatmentActionRef.current = pendingSelfAction;
  }, [pendingSelfAction]);

  useEffect(() => {
    activeTreatmentRef.current = activeTreatment;
  }, [activeTreatment]);

  useEffect(() => {
    medicalTimelineRef.current = medicalEvents;
  }, [medicalEvents]);

  const activateSafeMode = useCallback((reason: string) => {
    setSafeModeStatus((current) => {
      if (current.active && current.reason === reason) return current;
      console.error("Recovered error: entering safe mode", reason);
      return { active: true, reason };
    });
  }, []);

  const handleSafeModeHit = useCallback(() => {
    safeLoopVerifiedRef.current = true;
    pushToast({
      title: "Safe mode hit confirmed",
      body: "Fallback projectile connected cleanly.",
      tone: "success",
    });
    setHitFeedback({
      id: `safe-hit-${Date.now()}`,
      title: "HIT",
      body: "Fallback target reaction confirmed.",
      severity: "info",
      actorId: "safe-dummy",
      limb: "torso",
      startedAt: Date.now(),
    });
  }, [pushToast, setHitFeedback]);

  const registerRig = useCallback((actorId: string, api: RagdollRigApi | null) => {
    if (api) rigMapRef.current.set(actorId, api);
    else rigMapRef.current.delete(actorId);
  }, []);

  const registerArrowBody = useCallback((id: string, body: React.RefObject<RapierRigidBody | null> | null) => {
    if (body) arrowBodiesRef.current.set(id, body);
    else arrowBodiesRef.current.delete(id);
  }, []);

  const registerProp = useCallback((api: PropBodyApi | null, id: string) => {
    if (api) propBodiesRef.current.set(id, api);
    else propBodiesRef.current.delete(id);
  }, []);

  useEffect(() => {
    if (!runtime) {
      activateSafeMode("runtime unavailable");
      setDescriptors([]);
      actorStateRef.current = {};
      setArrows([]);
      return;
    }
    if (typeof window === "undefined") return;
    console.log("Runtime started");
    const nextDescriptors = [...runtime.descriptors];
    if (!nextDescriptors.some((descriptor) => descriptor.id === PLAYER_ID)) {
      console.warn("Recovered error: safe mode player bootstrap");
      activateSafeMode("player descriptor missing");
      nextDescriptors.unshift({
        id: PLAYER_ID,
        name: "Fallback Archer",
        isPlayer: true,
        color: "#d07c53",
        spawn: runtime.arenaConfig.spawnPoints.player,
        team: "player",
        actorIndex: 0,
      });
    }
    if (!nextDescriptors.some((descriptor) => !descriptor.isPlayer)) {
      console.warn("Recovered error: safe mode target bootstrap");
      activateSafeMode("enemy descriptor missing");
      nextDescriptors.push({
        id: "safe-dummy",
        name: "Fallback Dummy",
        isPlayer: false,
        color: "#6e8e9b",
        spawn: [
          runtime.arenaConfig.spawnPoints.player[0],
          runtime.arenaConfig.spawnPoints.player[1],
          runtime.arenaConfig.spawnPoints.player[2] - 5,
        ],
        team: "enemy",
        actorIndex: nextDescriptors.length,
      });
    }
    setDescriptors(nextDescriptors);
    actorStateRef.current = Object.fromEntries(
      nextDescriptors.map((descriptor) => {
        const actor = createMutableActor(descriptor);
        if (descriptor.id === PLAYER_ID && challenge) {
          if (challenge.modifiers.ammoOverride) {
            actor.ammo = {
              ...actor.ammo,
              ...challenge.modifiers.ammoOverride,
            };
          }
          if (challenge.modifiers.oxygenMultiplier) {
            actor.vitals.oxygen = clamp(actor.vitals.oxygen * challenge.modifiers.oxygenMultiplier, 0, 100);
          }
          if (challenge.modifiers.triggerStimulantCrash) {
            actor.vitals.energy = clamp(actor.vitals.energy + 18, 0, 100);
            actor.vitals.stamina = clamp(actor.vitals.stamina + 16, 0, 100);
            actor.stimulantCrashAt = 10;
            actor.stimulantKind = "monster";
          }
        }
        return [descriptor.id, actor];
      }),
    );
    setArrows([]);
    elapsedRef.current = 0;
    waveRef.current = 1;
    killsRef.current = 0;
    scoreRef.current = 0;
    treatmentStatsRef.current = {
      attempts: 0,
      completions: 0,
      interruptions: 0,
      consumablesUsed: [],
      shotsWhileInjured: 0,
      hitsWhileInjured: 0,
    };
    eventCooldownRef.current = {};
    replayBufferRef.current = [];
    safeLoopVerifiedRef.current = false;
    setCinematic(null);
    setHitFeedback(null);
  }, [activateSafeMode, challenge, runtime, setCinematic, setHitFeedback]);

  useEffect(() => {
    if (typeof window === "undefined" || phase !== "playing") return;
    try {
      const timer = window.setTimeout(() => {
        try {
          const playerRig = rigMapRef.current.get(PLAYER_ID)?.pelvis.current;
          const hasEnemyRig = descriptors.some((descriptor) => !descriptor.isPlayer && rigMapRef.current.get(descriptor.id)?.pelvis.current);
          if (!playerRig) {
            activateSafeMode("player rig missing");
          } else if (!hasEnemyRig) {
            activateSafeMode("enemy rig missing");
          } else if (!safeLoopVerifiedRef.current) {
            activateSafeMode("no successful hit loop detected");
          }
        } catch (error) {
          console.error("Recovered error: safe-mode-watchdog", error);
          activateSafeMode("safe-mode watchdog failed");
        }
      }, 4500);

      return () => window.clearTimeout(timer);
    } catch (error) {
      console.error("Recovered error: safe-mode-watchdog-setup", error);
      return;
    }
  }, [activateSafeMode, descriptors, phase]);

  const emitHitFeedback = useCallback(
    (event: HitFeedbackEvent) => {
      setHitFeedback(event);
      pushToast({
        title: event.title,
        body: event.body,
        tone: event.severity === "critical" ? "danger" : event.severity === "warning" ? "warn" : "neutral",
      });
    },
    [pushToast, setHitFeedback],
  );

  const emitMajorMoment = useCallback(
    (params: {
      id: string;
      title: string;
      body: string;
      severity?: HitFeedbackEvent["severity"];
      tone?: "neutral" | "warn" | "danger" | "success";
      highlightTag?: ReplayHighlightTag;
      cinematicStrength?: number;
      cooldownMs?: number;
    }) => {
      const now = Date.now();
      const previous = majorMomentCooldownRef.current[params.id] || 0;
      if (now - previous < (params.cooldownMs ?? 5000)) return false;
      majorMomentCooldownRef.current[params.id] = now;
      pushToast({
        title: params.title,
        body: params.body,
        tone: params.tone || (params.severity === "critical" ? "danger" : params.severity === "warning" ? "warn" : "success"),
      });
      setHitFeedback({
        id: `moment-${params.id}-${now}`,
        title: params.title,
        body: params.body,
        severity: params.severity || "info",
        actorId: PLAYER_ID,
        startedAt: now,
      });
      if (params.highlightTag) {
        setHighlightState({
          tag: params.highlightTag,
          message: params.title,
          startedAt: now,
        });
      }
      if (params.cinematicStrength) {
        setCinematic({
          id: `moment-cine-${params.id}-${now}`,
          type: "critical-hit",
          actorId: PLAYER_ID,
          strength: params.cinematicStrength,
          title: params.title,
          startedAt: now,
          durationMs: 420,
        });
      }
      return true;
    },
    [pushToast, setCinematic, setHighlightState, setHitFeedback],
  );

  const logMedicalEvent = useCallback(
    (event: {
      type: "hit_received" | "injury_added" | "injury_worsened" | "treatment_started" | "treatment_interrupted" | "treatment_completed" | "consumable_used" | "stamina_crash" | "critical_state_entered" | "death";
      source: string;
      target: string;
      bodyPart?: string;
      severity?: "minor" | "moderate" | "severe" | "critical";
      suppliesUsed?: MedicalSupplyId[];
      result: string;
      details?: Record<string, string | number | boolean | null | undefined>;
      dedupeKey?: string;
      minIntervalMs?: number;
    }) => {
      const nowMs = Math.round(elapsedRef.current * 1000);
      const dedupeKey = event.dedupeKey;
      if (dedupeKey) {
        const previous = eventCooldownRef.current[dedupeKey] || -Infinity;
        if (nowMs - previous < (event.minIntervalMs ?? 2500)) return;
        eventCooldownRef.current[dedupeKey] = nowMs;
      }
      pushMedicalEvent({
        timestampMs: nowMs,
        type: event.type,
        source: event.source,
        target: event.target,
        bodyPart: event.bodyPart,
        severity: event.severity,
        suppliesUsed: event.suppliesUsed,
        result: event.result,
        details: event.details,
      });
    },
    [pushMedicalEvent],
  );

  const emitNetworkEvent = useCallback(
    (event: NetworkMatchEvent) => {
      if (!RUNTIME_SUBSYSTEMS.network) {
        console.warn("Disabled subsystem for isolation: network");
        return;
      }
      try {
        const encoded = encodeNetworkEvent(event);
        const decoded = decodeNetworkEvent(encoded);
        if (!decoded) return;
        enqueueNetworkEvent(decoded);
      } catch (error) {
        console.error("Recovered error: network", error);
      }
    },
    [enqueueNetworkEvent],
  );

  const recordReplayEvent = useCallback(
    (event: BufferedReplayEvent) => {
      if (!RUNTIME_SUBSYSTEMS.replay) {
        console.warn("Disabled subsystem for isolation: replay");
        return;
      }
      try {
        replayBufferRef.current = appendReplayEvent(replayBufferRef.current, event);
        const highlightTag = event.highlightTag || detectReplayHighlight({
          eventType: event.eventType,
          summary: event.summary,
          preventable: event.summary.toLowerCase().includes("preventable"),
          nearDeath: event.summary.toLowerCase().includes("death") || event.summary.toLowerCase().includes("fatal"),
          totemUsed: event.summary.toLowerCase().includes("totem"),
        });
        if (highlightTag) {
          setHighlightState({
            tag: highlightTag,
            message: event.summary,
            startedAt: Date.now(),
          });
          setReplayState({
            latestSnapshot: freezeReplaySnapshot({
              buffer: replayBufferRef.current,
              capturedAt: event.timestampMs,
              highlightTag,
            }),
            latestHighlight: highlightTag,
          });
          emitNetworkEvent({
            type: "highlight_tagged",
            payload: {
              tag: highlightTag,
              actorId: PLAYER_ID,
              timestampMs: event.timestampMs,
            },
          });
        }
      } catch (error) {
        console.error("Recovered error: replay", error);
      }
    },
    [emitNetworkEvent, setHighlightState, setReplayState],
  );

  const safePushAudioEvent = useCallback(
    (event: Omit<Parameters<typeof pushAudioEvent>[0], "id">) => {
      if (!RUNTIME_SUBSYSTEMS.audio) {
        console.warn("Disabled subsystem for isolation: audio");
        return;
      }
      try {
        pushAudioEvent(event);
      } catch (error) {
        console.error("Recovered error: audio", error);
      }
    },
    [pushAudioEvent],
  );

  const interruptTreatment = useCallback(
    (reason: string) => {
      const current = activeTreatmentRef.current;
      if (!current || (current.state !== "preparing" && current.state !== "applying")) return;
      const interrupted = { ...current, state: "interrupted" as const, interruptedReason: reason };
      activeTreatmentRef.current = interrupted;
      setActiveTreatment(interrupted);
      treatmentStatsRef.current.interruptions += 1;
      logMedicalEvent({
        type: "treatment_interrupted",
        source: PLAYER_ID,
        target: PLAYER_ID,
        result: `${current.stage} interrupted`,
        details: { message: reason, cause: "interruption" },
      });
      emitNetworkEvent({
        type: "treatment_interrupted",
        payload: { actorId: PLAYER_ID, injuryId: current.injuryId, reason, stage: current.stage },
      });
      recordReplayEvent({
        id: `replay-interrupt-${Date.now()}`,
        timestampMs: Math.round(elapsedRef.current * 1000),
        category: "medical",
        eventType: "treatment_interrupted",
        summary: `${current.stage} interrupted: ${reason}`,
        payload: { injuryId: current.injuryId, reason },
      });
      pushToast({ title: "Treatment interrupted", body: reason, tone: "warn" });
    },
    [emitNetworkEvent, logMedicalEvent, pushToast, recordReplayEvent, setActiveTreatment],
  );

  const applyDamageToActor = useCallback(
    (payload: ReturnType<typeof applyHit>) => {
      const actor = actorStateRef.current[payload.actorId];
      const rig = rigMapRef.current.get(payload.actorId);
      if (!actor || !rig || !actor.alive) return;

      const injury = createInjuryFromHit({
        actorId: payload.actorId,
        limb: payload.limb,
        arrowType: payload.arrowType,
        force: payload.impulse,
        impactAngle: Math.random() * 55,
        penetrationDepth: clamp(payload.impulse / 28, 0.18, 0.92),
      });
      actor.injuries = [...actor.injuries, injury];
      logMedicalEvent({
        type: "hit_received",
        source: payload.sourceActorId,
        target: payload.actorId,
        bodyPart: payload.limb,
        severity: payload.headshot ? "critical" : injury.severity,
        result: payload.headshot ? "Head impact registered" : "Arrow impact registered",
        details: { message: `${payload.arrowType} arrow struck ${payload.limb}.`, sourceType: payload.arrowType },
      });
      logMedicalEvent({
        type: "injury_added",
        source: payload.sourceActorId,
        target: payload.actorId,
        bodyPart: injury.bodyRegion,
        severity: injury.severity,
        result: `${injury.category.replaceAll("-", " ")} added`,
        details: { message: `${actor.name} sustained ${injury.severity} trauma to ${injury.bodyRegion}.` },
      });
      emitNetworkEvent({
        type: "hit_registered",
        payload: {
          targetId: payload.actorId,
          bodyPart: payload.limb === "head" ? "head" : payload.limb === "torso" ? "chest" : payload.limb === "pelvis" ? "abdomen" : payload.limb.includes("Arm") ? "arm" : "leg",
          force: payload.impulse,
          penetrationDepth: clamp(payload.impulse / 28, 0.18, 0.92),
          arrowType: payload.arrowType,
        },
      });
      emitNetworkEvent({
        type: "injury_applied",
        payload: {
          id: injury.id,
          type: injury.category === "concussion" ? "concussion" : injury.category === "fractured-bone" ? "fracture" : injury.category === "organ-trauma" || injury.category === "collapsed-lung" ? "organ" : "bleeding",
          severity: injury.severity,
          bodyPart: payload.limb === "head" ? "head" : payload.limb === "torso" ? "chest" : payload.limb === "pelvis" ? "abdomen" : payload.limb.includes("Arm") ? "arm" : "leg",
          effects: {
            healthDrain: injury.bleedingRate * 0.22,
            staminaDrain: injury.staminaPenalty * 0.08,
            aimPenalty: injury.aimPenalty,
            movementPenalty: injury.mobilityPenalty,
          },
        },
      });
      recordReplayEvent({
        id: `replay-hit-${Date.now()}`,
        timestampMs: Math.round(elapsedRef.current * 1000),
        category: "presentation",
        eventType: payload.headshot ? "critical-hit" : "hit",
        summary: payload.headshot ? "Critical hit landed" : `${payload.arrowType} hit ${payload.limb}`,
        payload: { actorId: payload.actorId, limb: payload.limb, arrowType: payload.arrowType },
        highlightTag: payload.headshot ? "critical-hit" : undefined,
      });

      if (payload.actorId === PLAYER_ID) {
        interruptTreatment("Incoming damage broke your treatment action.");
      }

      actor.limbs[payload.limb].hp -= payload.damage;
      actor.health = clamp(actor.health - payload.damage, 0, 100);
      actor.stability = clamp(actor.stability - payload.impulse * (payload.limb.includes("Leg") ? 2.2 : payload.limb === "head" ? 4.4 : 1.8), 0, 100);
      actor.limbs[payload.limb].disabled = actor.limbs[payload.limb].hp <= 0;
      actor.balanceState = deriveBalanceState(actor);

      const targetBody = rig.limbs[payload.limb].current || rig.torso.current;
      if (targetBody) {
        const impulseDirection = new THREE.Vector3(Math.random() - 0.5, 0.28, Math.random() - 0.5).normalize();
        targetBody.applyImpulse({ x: impulseDirection.x * payload.impulse, y: Math.max(2.4, payload.impulse * 0.4), z: impulseDirection.z * payload.impulse }, true);
      }

      const severity = payload.limb === "head" ? "critical" : payload.limb === "torso" || payload.limb === "pelvis" ? "warning" : "info";
      emitHitFeedback({
        id: `hit-${Date.now()}`,
        title: payload.limb === "head" ? "Headshot" : payload.limb.includes("Leg") ? "Leg hit" : payload.limb.includes("Arm") ? "Arm hit" : "Torso hit",
        body:
          payload.limb === "head"
            ? `${actor.name} sustains ${injury.category.replaceAll("-", " ")} and immediate neurological collapse.`
            : `${actor.name} now has ${injury.severity} ${injury.category.replaceAll("-", " ")} affecting ${injury.bodyRegion}.`,
        severity,
        actorId: actor.id,
        limb: payload.limb,
        startedAt: Date.now(),
      });
      safePushAudioEvent({ kind: "impact", strength: clamp(payload.impulse / 20, 0.25, 1) });

      if (payload.sourceActorId === PLAYER_ID) {
        const playerState = actorStateRef.current[PLAYER_ID];
        const playerUnderPressure =
          !!playerState && (playerState.health < 45 || playerState.injuries.some((entry) => !entry.treated || entry.severity === "critical"));
        if (payload.headshot || (playerUnderPressure && (payload.impulse > 14 || actor.health <= 24))) {
          emitMajorMoment({
            id: "clutch-hit",
            title: "CLUTCH HIT",
            body: payload.headshot ? "One clean shot broke the fight open." : "You landed the shot while everything was slipping.",
            severity: payload.headshot ? "critical" : "warning",
            highlightTag: "critical-hit",
            cinematicStrength: 0.72,
            cooldownMs: 6500,
          });
          slowMoUntilRef.current = Math.max(slowMoUntilRef.current, clock.getElapsedTime() + 0.22);
        }
      }

      if (payload.headshot || actor.health <= 0 || actor.stability <= 0) {
        actor.alive = false;
        actor.knockedOut = true;
        actor.balanceState = "fallen";
        if (payload.sourceActorId === PLAYER_ID) {
          killsRef.current += 1;
          scoreRef.current += payload.limb === "head" ? 220 : 90;
        }
        safePushAudioEvent({ kind: "ko", strength: 1 });
        setCinematic({
          id: `cine-${Date.now()}`,
          type: "critical-hit",
          actorId: actor.id,
          strength: payload.limb === "head" ? 1 : 0.7,
          title: payload.limb === "head" ? "Headshot knockout" : `${actor.name} collapses`,
          startedAt: Date.now(),
          durationMs: 520,
        });
        slowMoUntilRef.current = clock.getElapsedTime() + 0.42;
        cameraShakeRef.current = 1;
      }

      if (payload.sourceActorId === PLAYER_ID && actorStateRef.current[PLAYER_ID]?.injuries.some((entry) => !entry.treated)) {
        treatmentStatsRef.current.hitsWhileInjured += 1;
      }
      if (payload.sourceActorId === PLAYER_ID) {
        safeLoopVerifiedRef.current = true;
      }
    },
    [clock, emitHitFeedback, emitMajorMoment, emitNetworkEvent, interruptTreatment, logMedicalEvent, recordReplayEvent, safePushAudioEvent, setCinematic],
  );

  useFrame((state, delta) => {
    if (phase !== "playing") return;
    if (!runtime) return;
    if (typeof window === "undefined") return;
    if (!scene || !camera) return;
    if (!camera || !clock) return;
    accumulatorRef.current += Math.min(delta, 0.05);
    snapshotAccumulatorRef.current += Math.min(delta, 0.05);

    while (accumulatorRef.current >= FIXED_STEP) {
      const timeScale = slowMoUntilRef.current > clock.getElapsedTime() ? 0.35 : 1;
      const simDt = FIXED_STEP * timeScale;
      elapsedRef.current += simDt;
      accumulatorRef.current -= FIXED_STEP;

      const playerInput = consumePlayerInputFrame(inputRef);
      const playerRig = rigMapRef.current.get(PLAYER_ID);
      const playerPosition = playerRig?.pelvis.current?.translation();
      const playerVelocity = playerRig?.pelvis.current?.linvel();

      for (const descriptor of descriptors) {
        const actor = actorStateRef.current[descriptor.id];
        const rig = rigMapRef.current.get(descriptor.id);
        if (!actor || !rig?.pelvis.current || !rig.torso.current) continue;

        const pelvisBody = rig.pelvis.current;
        const torsoBody = rig.torso.current;
        const pelvisPosition = pelvisBody.translation();
        const currentVelocity = pelvisBody.linvel();
        const groundHeight = sampleArenaHeight(runtime.arenaConfig, pelvisPosition.x, pelvisPosition.z);
        const grounded = pelvisPosition.y < groundHeight + 1.25;
        const damagedLegs = Number(actor.limbs.upperLegLeft.disabled || actor.limbs.lowerLegLeft.disabled) + Number(actor.limbs.upperLegRight.disabled || actor.limbs.lowerLegRight.disabled);
        const untreatedInjuries = actor.injuries.filter((injury) => !injury.treated);
        const derivedVitals: DerivedVitals = computeDerivedVitals(actor.vitals, actor.injuries);
        setDerivedVitals(actor.id, derivedVitals);
        const drawPenalty =
          (actor.limbs.upperArmLeft.disabled || actor.limbs.lowerArmLeft.disabled || actor.limbs.upperArmRight.disabled || actor.limbs.lowerArmRight.disabled ? 0.55 : 1) *
          clamp(1 - untreatedInjuries.reduce((sum, injury) => sum + injury.aimPenalty, 0) * 0.18, 0.35, 1);

        const targetPosition: [number, number, number] = playerPosition ? [playerPosition.x, playerPosition.y, playerPosition.z] : runtime.arenaConfig.spawnPoints.player;
        const targetVelocity: [number, number, number] = playerVelocity ? [playerVelocity.x, playerVelocity.y, playerVelocity.z] : [0, 0, 0];
        const intent = descriptor.isPlayer
          ? {
              moveX: playerInput.moveX,
              moveZ: playerInput.moveZ,
              aimYaw: playerInput.yaw,
              aimPitch: playerInput.pitch,
              jump: playerInput.jump,
              sprint: playerInput.sprint,
              drawHeld: playerInput.drawHeld,
              drawStarted: playerInput.drawStarted,
              drawReleased: playerInput.drawReleased,
              selectedArrowType: activeArrowType,
            }
          : computeAiIntent({
              difficulty: settings.difficulty,
              arena: runtime.arenaConfig,
              selfPosition: [pelvisPosition.x, pelvisPosition.y, pelvisPosition.z],
              targetPosition,
              targetVelocity,
              elapsed: elapsedRef.current,
              actorIndex: descriptor.actorIndex,
            });

        actor.aimYaw = dampAngle(actor.aimYaw, intent.aimYaw, descriptor.isPlayer ? 0.45 : 0.14 * difficultyTuning[settings.difficulty].enemyAccuracy);
        actor.aimPitch = lerp(actor.aimPitch, intent.aimPitch, descriptor.isPlayer ? 0.35 : 0.11);
        const forward = new THREE.Vector3(Math.sin(actor.aimYaw), 0, Math.cos(actor.aimYaw));
        const right = new THREE.Vector3(forward.z, 0, -forward.x);
        const desiredMove = forward.multiplyScalar(intent.moveZ).add(right.multiplyScalar(intent.moveX));
        if (desiredMove.lengthSq() > 1) desiredMove.normalize();
        const continuousEffects = RUNTIME_SUBSYSTEMS.injuryEffects
          ? (() => {
              try {
                return applyInjuryEffects({
                  injuries: untreatedInjuries,
                  derivedVitals,
                  sprinting: intent.sprint && desiredMove.lengthSq() > 0.02,
                  deltaTime: simDt,
                });
              } catch (error) {
                console.error("Recovered error: injury-effects", error);
                return {
                  healthDelta: 0,
                  staminaDelta: 0,
                  modifiers: {
                    healthDrainPerSecond: 0,
                    staminaDrainPerSecond: 0,
                    aimPenalty: 0,
                    movementPenalty: 0,
                    warnings: {
                      severeBloodLoss: false,
                      breathingCompromised: false,
                      highPain: false,
                      shockRiskHigh: false,
                    },
                  },
                };
              }
            })()
          : {
              healthDelta: 0,
              staminaDelta: 0,
              modifiers: {
                healthDrainPerSecond: 0,
                staminaDrainPerSecond: 0,
                aimPenalty: 0,
                movementPenalty: 0,
                warnings: {
                  severeBloodLoss: false,
                  breathingCompromised: false,
                  highPain: false,
                  shockRiskHigh: false,
                },
              },
            };
        const openingWindowMultiplier = elapsedRef.current < 24 ? 0.42 : elapsedRef.current < 40 ? 0.68 : 1;
        const adjustedHealthDelta =
          (safeModeStatus.active ? continuousEffects.healthDelta * 0.3 : continuousEffects.healthDelta) * openingWindowMultiplier;
        const adjustedStaminaDelta =
          (safeModeStatus.active ? continuousEffects.staminaDelta * 0.5 : continuousEffects.staminaDelta) * (elapsedRef.current < 24 ? 0.58 : openingWindowMultiplier);
        const totalAimPenalty = continuousEffects.modifiers.aimPenalty;
        const totalMobilityPenalty = continuousEffects.modifiers.movementPenalty;
        const movePenalty =
          actor.balanceState === "fallen" && !safeModeStatus.active && elapsedRef.current >= 22
            ? 0
            : clamp(1 - damagedLegs * 0.26 - totalMobilityPenalty, safeModeStatus.active || elapsedRef.current < 24 ? 0.62 : 0.18, 1);
        const stimulantBoost = actor.stimulantCrashAt && elapsedRef.current < actor.stimulantCrashAt ? 1.08 : 1;
        const speedTarget =
          (intent.sprint ? 10.6 : 7.2) *
          movePenalty *
          stimulantBoost *
          (actor.health < 35 ? 0.84 : 1) *
          clamp(derivedVitals.breathingCapacity, 0.55, 1) *
          clamp(1 - derivedVitals.shockRisk * 0.22, 0.68, 1);
        const desiredVelocity = desiredMove.multiplyScalar(speedTarget);
        const velocityDelta = new THREE.Vector3(desiredVelocity.x - currentVelocity.x, 0, desiredVelocity.z - currentVelocity.z);

        if (!actor.knockedOut && actor.alive) pelvisBody.applyImpulse({ x: velocityDelta.x * 0.5, y: 0, z: velocityDelta.z * 0.5 }, true);
        if (grounded && intent.jump && actor.alive && !actor.knockedOut) pelvisBody.applyImpulse({ x: 0, y: 4.8 * movePenalty, z: 0 }, true);

        const q = torsoBody.rotation();
        const quat = new THREE.Quaternion(q.x, q.y, q.z, q.w);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
        const correctionAxis = up.clone().cross(new THREE.Vector3(0, 1, 0));
        const balanceStrength = actor.balanceState === "fallen" ? 0.04 : actor.balanceState === "recovering" ? 0.16 : actor.balanceState === "unstable" ? 0.34 : 0.56;
        torsoBody.applyTorqueImpulse({ x: correctionAxis.x * -balanceStrength, y: 0, z: correctionAxis.z * -balanceStrength }, true);
        pelvisBody.applyTorqueImpulse({ x: correctionAxis.x * -0.12, y: 0, z: correctionAxis.z * -0.12 }, true);

        actor.stability = clamp(actor.stability + (grounded && actor.alive ? simDt * (actor.balanceState === "recovering" ? 11 : 4) : -simDt * 3), 0, 100);
        actor.balanceState = deriveBalanceState(actor);
        tickVitals(actor.vitals, actor.injuries, simDt, desiredMove.lengthSq() > 0.02);
        actor.vitals.bloodLevel = clamp(actor.vitals.bloodLevel - adjustedHealthDelta, 0, 100);
        actor.vitals.stamina = clamp(actor.vitals.stamina - adjustedStaminaDelta, 0, 100);
        if (elapsedRef.current >= 18 && derivedVitals.shockRisk > 0.72 && actor.balanceState !== "fallen") {
          actor.stability = clamp(actor.stability - simDt * 8, 0, 100);
        }
        const progression = RUNTIME_SUBSYSTEMS.survival
          ? (() => {
              try {
                return tickInjuryProgression(actor.vitals, actor.injuries, simDt, {
                  elapsedMs: Math.round(elapsedRef.current * 1000),
                  sprinting: intent.sprint && desiredMove.lengthSq() > 0.02,
                  balanceState: actor.balanceState,
                });
              } catch (error) {
                console.error("Recovered error: survival", error);
                return { events: [] };
              }
            })()
          : { events: [] };
        progression.events.forEach((event) => {
          logMedicalEvent({
            type: event.type,
            source: actor.id,
            target: actor.id,
            bodyPart: event.bodyPart,
            severity: event.severity,
            result: event.result,
            details: event.details,
            dedupeKey: `${actor.id}-${event.type}-${event.bodyPart || "global"}-${event.result}`,
            minIntervalMs: event.type === "critical_state_entered" ? 5000 : 4000,
          });
          if (descriptor.id === PLAYER_ID && isHighSignalMedicalEvent(event.type)) {
            recordReplayEvent({
              id: `replay-med-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              timestampMs: Math.round(elapsedRef.current * 1000),
              category: "medical",
              eventType: event.type,
              summary: event.result,
              payload: {
                details: event.details,
                severity: event.severity,
                bodyPart: event.bodyPart,
              },
            });
          }
        });
        if (descriptor.id === PLAYER_ID && (continuousEffects.modifiers.warnings.severeBloodLoss || continuousEffects.modifiers.warnings.breathingCompromised || continuousEffects.modifiers.warnings.highPain || continuousEffects.modifiers.warnings.shockRiskHigh)) {
          const warningMessage = continuousEffects.modifiers.warnings.severeBloodLoss
            ? "Severe blood loss"
            : continuousEffects.modifiers.warnings.breathingCompromised
              ? "Breathing compromised"
              : continuousEffects.modifiers.warnings.shockRiskHigh
                ? "Shock risk rising"
                : "High pain affecting aim";
          logMedicalEvent({
            type: "critical_state_entered",
            source: PLAYER_ID,
            target: PLAYER_ID,
            severity: continuousEffects.modifiers.warnings.severeBloodLoss || continuousEffects.modifiers.warnings.shockRiskHigh ? "critical" : "severe",
            result: warningMessage,
            details: { message: warningMessage, shockRisk: derivedVitals.shockRisk },
            dedupeKey: `warning-${warningMessage}`,
            minIntervalMs: 4500,
          });
          emitMajorMoment({
            id: "unstable-condition",
            title: "UNSTABLE CONDITION",
            body: warningMessage,
            severity: continuousEffects.modifiers.warnings.severeBloodLoss || continuousEffects.modifiers.warnings.shockRiskHigh ? "critical" : "warning",
            cooldownMs: 9000,
          });
        }
        actor.health = clamp(Math.min(actor.health, actor.vitals.bloodLevel), 0, 100);

        if (descriptor.id === PLAYER_ID && treatmentActionRef.current) {
          if (treatmentActionRef.current.type === "consume") {
            const stack = supplyBagRef.current.find((item) => item.id === treatmentActionRef.current?.target);
            if (stack && stack.quantity > 0) {
              const nextInventory = supplyBagRef.current.map((item) =>
                item.id === stack.id ? { ...item, quantity: Math.max(0, item.quantity - 1) } : item,
              );
              actor.vitals = applyConsumableEffect(actor.vitals, stack.id as MedicalSupplyId);
              if (stack.id === "monster" || stack.id === "red-bull") {
                actor.stimulantCrashAt = elapsedRef.current + 10;
                actor.stimulantKind = stack.id;
                actor.stimulantCrashed = false;
              }
              supplyBagRef.current = nextInventory;
              setSupplies(nextInventory);
              pushToast({ title: stack.label, body: "Consumed from field inventory.", tone: "neutral" });
              treatmentStatsRef.current.consumablesUsed.push(stack.label);
              logMedicalEvent({
                type: "consumable_used",
                source: PLAYER_ID,
                target: PLAYER_ID,
                suppliesUsed: [stack.id],
                result: `Used ${stack.label}`,
                details: { message: "Field consumable applied.", itemOrTool: stack.label },
              });
              emitNetworkEvent({
                type: "consumable_used",
                payload: { actorId: PLAYER_ID, itemId: stack.id, timestampMs: Math.round(elapsedRef.current * 1000) },
              });
              recordReplayEvent({
                id: `replay-consume-${Date.now()}`,
                timestampMs: Math.round(elapsedRef.current * 1000),
                category: "medical",
                eventType: "consumable_used",
                summary: `Used ${stack.label}`,
                payload: { itemId: stack.id },
              });
            }
            clearSelfAction();
            treatmentActionRef.current = null;
          } else if (treatmentActionRef.current.type === "treat") {
            if (challenge?.modifiers.disableTreatment) {
              pushToast({ title: "Treatment locked", body: "This challenge forbids field treatment.", tone: "warn" });
              clearSelfAction();
              treatmentActionRef.current = null;
              continue;
            }
            const injury = actor.injuries.find((entry) => entry.id === treatmentActionRef.current?.target);
            if (injury) {
              const status = getTreatmentStatus([injury], supplyBagRef.current);
              if (status.canTreatNow) {
                const treatment = getTreatmentAction(injury, supplyBagRef.current);
                const startedTreatment: ActiveTreatment = {
                  ...treatment,
                  state: "preparing",
                  startedAt: Math.round(elapsedRef.current * 1000),
                  progress: 0,
                };
                activeTreatmentRef.current = startedTreatment;
                setActiveTreatment(startedTreatment);
                treatmentStatsRef.current.attempts += 1;
                logMedicalEvent({
                  type: "treatment_started",
                  source: PLAYER_ID,
                  target: PLAYER_ID,
                  bodyPart: injury.bodyRegion,
                  severity: injury.severity,
                  suppliesUsed: treatment.requiredSupplies.map((requirement) => requirement.supplyId),
                  result: `${treatment.stage} started`,
                  details: { message: `${injury.category.replaceAll("-", " ")} treatment underway.`, progress: 0 },
                });
                emitNetworkEvent({
                  type: "treatment_started",
                  payload: { actorId: PLAYER_ID, injuryId: injury.id, stage: treatment.stage, durationMs: treatment.durationMs },
                });
                pushToast({ title: "Treatment started", body: `${treatment.stage} in progress.`, tone: "neutral" });
              } else {
                pushToast({ title: "Treatment blocked", body: "Missing supplies or tool for this injury.", tone: "warn" });
              }
            }
            clearSelfAction();
            treatmentActionRef.current = null;
          }
        }

        if (descriptor.id === PLAYER_ID && actor.stimulantCrashAt && elapsedRef.current >= actor.stimulantCrashAt && !actor.stimulantCrashed) {
          actor.vitals.energy = clamp(actor.vitals.energy - 18, 0, 100);
          actor.vitals.stamina = clamp(actor.vitals.stamina - 14, 0, 100);
          actor.stimulantCrashed = true;
          logMedicalEvent({
            type: "stamina_crash",
            source: PLAYER_ID,
            target: PLAYER_ID,
            result: `${actor.stimulantKind === "red-bull" ? "Red Bull" : "Monster"} crash`,
            details: { message: "Temporary stimulant boost has worn off." },
          });
          pushToast({ title: "Energy crash", body: "Stimulant fatigue is hitting hard.", tone: "warn" });
        }

        if (descriptor.id === PLAYER_ID && activeTreatmentRef.current) {
          const currentTreatment = activeTreatmentRef.current;
          const unsafeToTreat =
            !actor.alive ||
            actor.vitals.unconscious ||
            actor.balanceState === "fallen" ||
            (intent.sprint && desiredMove.lengthSq() > 0.02) ||
            intent.jump;
          if (unsafeToTreat) {
            interruptTreatment(
              !actor.alive || actor.vitals.unconscious
                ? "Treatment aborted because you lost consciousness."
                : actor.balanceState === "fallen"
                  ? "Treatment interrupted by severe balance loss."
                  : intent.jump
                    ? "Treatment interrupted by a jump."
                    : "Treatment interrupted while sprinting.",
            );
          } else if (currentTreatment.state === "preparing" || currentTreatment.state === "applying") {
            const progress = clamp((Math.round(elapsedRef.current * 1000) - currentTreatment.startedAt) / currentTreatment.durationMs, 0, 1);
            const nextTreatment: ActiveTreatment = {
              ...currentTreatment,
              state: progress >= 0.18 ? "applying" : "preparing",
              progress,
            };
            activeTreatmentRef.current = nextTreatment;
            setActiveTreatment(nextTreatment);

            if (progress >= 1) {
              const injury = actor.injuries.find((entry) => entry.id === currentTreatment.injuryId);
              if (injury) {
                let nextInventory = supplyBagRef.current;
                currentTreatment.requiredSupplies.forEach((requirement) => {
                  nextInventory = consumeSupply(nextInventory, requirement.supplyId, requirement.quantity);
                });
                const result = applyTreatmentStage(injury, currentTreatment.stage);
                actor.injuries = actor.injuries.map((entry) => (entry.id === injury.id ? injury : entry));
                supplyBagRef.current = nextInventory;
                setSupplies(nextInventory);
                const completedTreatment: ActiveTreatment = {
                  ...nextTreatment,
                  state: "completed",
                  progress: 1,
                };
                activeTreatmentRef.current = completedTreatment;
                setActiveTreatment(completedTreatment);
                treatmentStatsRef.current.completions += 1;
                logMedicalEvent({
                  type: "treatment_completed",
                  source: PLAYER_ID,
                  target: PLAYER_ID,
                  bodyPart: injury.bodyRegion,
                  severity: injury.severity,
                  suppliesUsed: currentTreatment.requiredSupplies.map((requirement) => requirement.supplyId),
                  result: `${currentTreatment.stage} completed`,
                  details: {
                    message: [
                      result.stoppedBleeding ? "Bleeding reduced" : null,
                      result.reducedPain ? "Pain reduced" : null,
                      result.improvedMobility ? "Mobility improved" : null,
                      result.unresolvedRisk ? "Further treatment still required" : null,
                    ]
                      .filter(Boolean)
                      .join(". "),
                    progress: 1,
                  },
                });
                emitNetworkEvent({
                  type: "treatment_completed",
                  payload: { actorId: PLAYER_ID, injuryId: injury.id, stage: currentTreatment.stage, unresolvedRisk: result.unresolvedRisk },
                });
                recordReplayEvent({
                  id: `replay-treatment-${Date.now()}`,
                  timestampMs: Math.round(elapsedRef.current * 1000),
                  category: "medical",
                  eventType: "treatment_completed",
                  summary: `${currentTreatment.stage} completed`,
                  payload: { injuryId: injury.id, unresolvedRisk: result.unresolvedRisk },
                });
                pushToast({
                  title: "Treatment complete",
                  body: result.unresolvedRisk ? "Stabilized, but ongoing risk remains." : `${injury.bodyRegion} care completed successfully.`,
                  tone: "success",
                });
                if (actor.health < 38 || actor.vitals.bloodLevel < 35 || actor.vitals.oxygen < 40) {
                  emitMajorMoment({
                    id: "last-second-save",
                    title: "LAST SECOND SAVE",
                    body: result.unresolvedRisk ? "You stabilized just before collapse." : "That treatment bought the run back.",
                    severity: "warning",
                    highlightTag: "survived-critical-injury",
                    cinematicStrength: 0.55,
                    cooldownMs: 9000,
                  });
                }
              } else {
                clearActiveTreatment();
                activeTreatmentRef.current = null;
              }
            }
          }
        }

        if (intent.drawHeld && actor.alive && !actor.knockedOut && actor.ammo[intent.selectedArrowType] > 0) {
          actor.drawCharge = clamp(actor.drawCharge + simDt * 0.9 * drawPenalty, 0, 1);
          if (intent.drawStarted) safePushAudioEvent({ kind: "draw", strength: actor.drawCharge + 0.2 });
        }

        if (intent.drawReleased && actor.drawCharge > 0.08 && actor.alive && actor.ammo[intent.selectedArrowType] > 0 && elapsedRef.current - actor.lastFireAt > 0.4) {
          actor.lastFireAt = elapsedRef.current;
          actor.ammo[intent.selectedArrowType] -= 1;
          const sourceBody = rig.limbs.lowerArmRight.current || rig.torso.current;
          const origin = sourceBody?.translation() || pelvisPosition;
          const power = 0.45 + easeOutCubic(actor.drawCharge) * 0.9;
          const spread = (1 - actor.stability / 100) * 0.08 + (drawPenalty < 1 ? 0.06 : 0) + totalAimPenalty * 0.035 + actor.vitals.pain * 0.0008;
          const yaw = actor.aimYaw + (Math.random() - 0.5) * spread;
          const pitch = actor.aimPitch + (Math.random() - 0.5) * spread;
          const direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).normalize();
          let shot: ReturnType<typeof spawnArrow> | null = null;
          try {
            shot = spawnArrow({
              ownerId: descriptor.id,
              type: intent.selectedArrowType,
              origin: [origin.x + direction.x * 0.9, origin.y + 0.1 + direction.y * 0.9, origin.z + direction.z * 0.9],
              direction: [direction.x, direction.y, direction.z],
              power,
            });
          } catch (error) {
            console.error("Recovered error: safe mode projectile fallback", error);
            activateSafeMode("arrow spawn failed");
          }
          if (!shot) {
            actor.drawCharge = 0;
            continue;
          }
          emitNetworkEvent({
            type: "arrow_fired",
            payload: {
              actorId: descriptor.id,
              arrowType: intent.selectedArrowType,
              origin: shot.origin,
              direction: shot.direction,
              power,
              timestampMs: Math.round(elapsedRef.current * 1000),
            },
          });
          setArrows((current) => [...current.slice(-MAX_ACTIVE_ARROWS + 1), { id: shot.id, ownerId: descriptor.id, type: shot.type, bornAt: elapsedRef.current }]);
          if (typeof window !== "undefined") {
            window.setTimeout(() => {
              const ref = arrowBodiesRef.current.get(shot.id)?.current;
              if (ref) {
                ref.setTranslation({ x: shot.origin[0], y: shot.origin[1], z: shot.origin[2] }, true);
                ref.setLinvel({ x: shot.direction[0] * shot.speed + currentVelocity.x * 0.4, y: shot.direction[1] * shot.speed + currentVelocity.y * 0.2, z: shot.direction[2] * shot.speed + currentVelocity.z * 0.4 }, true);
              }
            }, 0);
          }
          safePushAudioEvent({ kind: "release", strength: power });
          actor.drawCharge = 0;
          if (descriptor.id === PLAYER_ID && untreatedInjuries.length > 0) {
            treatmentStatsRef.current.shotsWhileInjured += 1;
          }
        } else if (!intent.drawHeld) {
          actor.drawCharge = clamp(actor.drawCharge - simDt * 1.8, 0, 1);
        }

        if (actor.vitals.unconscious || actor.vitals.bloodLevel <= 0 || actor.vitals.oxygen <= 0) {
          if (safeModeStatus.active && actor.id === PLAYER_ID && !safeLoopVerifiedRef.current) {
            actor.alive = true;
            actor.knockedOut = false;
            actor.balanceState = "recovering";
            actor.health = Math.max(actor.health, 30);
            actor.stability = Math.max(actor.stability, 35);
            actor.vitals.unconscious = false;
            actor.vitals.bloodLevel = Math.max(actor.vitals.bloodLevel, 24);
            actor.vitals.oxygen = Math.max(actor.vitals.oxygen, 30);
          } else {
            actor.alive = false;
            actor.knockedOut = true;
            actor.balanceState = "fallen";
          }
        }
      }

      for (const arrow of arrows) {
        const body = arrowBodiesRef.current.get(arrow.id)?.current;
        if (!body) continue;
        const position = body.translation();
        const velocity = body.linvel();
        const tuning = arrowTuning[arrow.type];
        body.applyImpulse({ x: settings.mode === "firstperson" ? 0.014 * timeScale : 0.009 * timeScale, y: 0, z: 0.004 * timeScale }, true);
        body.setLinvel({ x: velocity.x * (1 - tuning.drag), y: velocity.y, z: velocity.z * (1 - tuning.drag * 0.8) }, true);

        if (elapsedRef.current - arrow.bornAt > 6 || position.y < -18) {
          setArrows((current) => current.filter((entry) => entry.id !== arrow.id));
          continue;
        }

        for (const descriptor of descriptors) {
          if (descriptor.id === arrow.ownerId) continue;
          const actor = actorStateRef.current[descriptor.id];
          const rig = rigMapRef.current.get(descriptor.id);
          if (!actor?.alive || !rig) continue;
          const limbEntries = Object.entries(rig.limbs) as [keyof ActorSnapshot["limbs"], React.RefObject<RapierRigidBody | null>][];
          let hit = false;
          for (const [limbName, limbRef] of limbEntries) {
            const limbBody = limbRef.current;
            if (!limbBody) continue;
            const limbPosition = limbBody.translation();
            const distance = distanceBetween([position.x, position.y, position.z], [limbPosition.x, limbPosition.y, limbPosition.z]);
            const threshold = limbName === "head" ? 0.34 : String(limbName).includes("Arm") ? 0.32 : 0.4;
            if (distance > threshold) continue;
            applyDamageToActor(
              applyHit({
                actorId: descriptor.id,
                limb: limbName,
                arrowType: arrow.type,
                impactPoint: [position.x, position.y, position.z],
                impulse: tuning.impulse,
                sourceActorId: arrow.ownerId,
              }),
            );
            setArrows((current) => current.filter((entry) => entry.id !== arrow.id));
            hit = true;
            break;
          }
          if (hit) break;
        }
      }

      const stepSimulation = stepRef.current;
      if (!stepSimulation) return;
      stepSimulation(simDt);

      const remainingEnemies = Object.values(actorStateRef.current).filter((actor) => !actor.isPlayer && actor.alive).length;
      const playerAlive = actorStateRef.current[PLAYER_ID]?.alive;
      const playerState = actorStateRef.current[PLAYER_ID];
      if (playerState) {
        setTreatmentStatus(getTreatmentStatus(playerState.injuries.filter((injury) => !injury.treated), supplyBagRef.current));
      }
      setMatchSnapshot({
        remainingEnemies,
        kills: killsRef.current,
        score: scoreRef.current,
        wave: waveRef.current,
        activeMode: settings.mode,
        wind: [settings.mode === "firstperson" ? 2.3 : 1.2, 0, settings.arenaId === "windbreak-hills" ? 0.9 : 0.35],
      });

      if (settings.mode === "firstperson" && remainingEnemies === 0 && waveRef.current < 5) {
        waveRef.current += 1;
        const nextRuntime = createMatchRuntime({ settings: { ...settings, mode: "firstperson" } });
        const enemyCount = Math.min(nextRuntime.arenaConfig.spawnPoints.enemies.length, 2 + waveRef.current + difficultyTuning[settings.difficulty].waveSizeBonus);
        const nextDescriptors = [nextRuntime.descriptors[0], ...nextRuntime.descriptors.slice(1, enemyCount + 1)];
        actorStateRef.current = Object.fromEntries(nextDescriptors.map((descriptor) => [descriptor.id, descriptor.id === PLAYER_ID ? actorStateRef.current[PLAYER_ID] : createMutableActor(descriptor)]));
        setDescriptors(nextDescriptors);
        pushToast({ title: `Wave ${waveRef.current}`, body: "Fresh archers are dropping into the arena.", tone: "neutral" });
      }

      if (!playerAlive) {
        if (playerState) {
          const totemStack = supplyBagRef.current.find((stack) => stack.id === "undying-totem" && stack.quantity > 0);
          if (totemStack && challenge?.modifiers.grantTotem) {
            playerState.alive = true;
            playerState.knockedOut = false;
            playerState.balanceState = "recovering";
            playerState.health = 34;
            playerState.vitals.bloodLevel = clamp(playerState.vitals.bloodLevel + 20, 0, 100);
            playerState.vitals.oxygen = clamp(playerState.vitals.oxygen + 18, 0, 100);
            playerState.vitals.shock = clamp(playerState.vitals.shock - 24, 0, 100);
            supplyBagRef.current = supplyBagRef.current.map((stack) => (stack.id === "undying-totem" ? { ...stack, quantity: Math.max(0, stack.quantity - 1) } : stack));
            setSupplies(supplyBagRef.current);
            setHighlightState({ tag: "totem-save", message: "Totem Save", startedAt: Date.now() });
            recordReplayEvent({
              id: `replay-totem-${Date.now()}`,
              timestampMs: Math.round(elapsedRef.current * 1000),
              category: "presentation",
              eventType: "totem-save",
              summary: "Totem Save",
              payload: { actorId: PLAYER_ID },
              highlightTag: "totem-save",
            });
            logMedicalEvent({
              type: "critical_state_entered",
              source: PLAYER_ID,
              target: PLAYER_ID,
              severity: "critical",
              result: "Totem Save",
              details: { message: "An undying totem prevented death." },
              dedupeKey: "totem-save",
              minIntervalMs: 60000,
            });
            emitMajorMoment({
              id: "totem-last-second-save",
              title: "LAST SECOND SAVE",
              body: "The totem gave the run one more breath.",
              severity: "critical",
              highlightTag: "totem-save",
              cinematicStrength: 0.72,
              cooldownMs: 15000,
            });
            continue;
          }
          logMedicalEvent({
            type: "death",
            source: "simulation",
            target: PLAYER_ID,
            bodyPart: playerState.injuries[0]?.bodyRegion,
            severity: "critical",
            result: "Player death recorded",
            details: { message: "Medical collapse reached terminal state.", preventable: true },
            dedupeKey: "player-death",
            minIntervalMs: 60000,
          });
          emitNetworkEvent({
            type: "player_died",
            payload: {
              actorId: PLAYER_ID,
              cause: "medical-collapse",
              timestampMs: Math.round(elapsedRef.current * 1000),
            },
          });
          const richReport = buildDeathReport({
            injuries: playerState.injuries,
            vitals: playerState.vitals,
            derivedVitals: computeDerivedVitals(playerState.vitals, playerState.injuries),
            killer: "Enemy Archer",
            weapon: "Composite Bow",
            survivedMs: elapsedRef.current * 1000,
            medicalEvents: medicalTimelineRef.current,
          });
          setMedicalSummary(
            buildMedicalSummary({
              injuries: playerState.injuries,
              medicalEvents: medicalTimelineRef.current,
              survivedMs: elapsedRef.current * 1000,
              causeOfDeath: richReport.causeOfDeath,
              accuracyWhileInjured:
                treatmentStatsRef.current.shotsWhileInjured > 0
                  ? treatmentStatsRef.current.hitsWhileInjured / treatmentStatsRef.current.shotsWhileInjured
                  : null,
            }),
          );
          setDeathReport({
            ...richReport,
          });
          try {
            setReplayState({
              latestSnapshot: freezeReplaySnapshot({
                buffer: replayBufferRef.current,
                capturedAt: Math.round(elapsedRef.current * 1000),
                highlightTag: detectReplayHighlight({
                  eventType: "death",
                  summary: richReport.causeExplanation || richReport.causeOfDeath,
                  preventable: richReport.preventability === "high",
                  nearDeath: true,
                }) || "preventable-death",
              }),
              latestHighlight: detectReplayHighlight({
                eventType: "death",
                summary: richReport.causeExplanation || richReport.causeOfDeath,
                preventable: richReport.preventability === "high",
                nearDeath: true,
              }),
            });
          } catch (error) {
            console.error("Recovered error: replay-death-report", error);
          }
        }
        completeMatch({ title: "Simulation failed", body: `You were overwhelmed after scoring ${scoreRef.current} points and eliminating ${killsRef.current} opponents.`, success: false, kills: killsRef.current, score: scoreRef.current });
      } else if (settings.mode === "duel" && remainingEnemies === 0) {
        if (playerState) {
          setMedicalSummary(
            buildMedicalSummary({
              injuries: playerState.injuries,
              medicalEvents: medicalTimelineRef.current,
              survivedMs: elapsedRef.current * 1000,
              causeOfDeath: null,
              accuracyWhileInjured:
                treatmentStatsRef.current.shotsWhileInjured > 0
                  ? treatmentStatsRef.current.hitsWhileInjured / treatmentStatsRef.current.shotsWhileInjured
                  : null,
            }),
          );
        }
        completeMatch({ title: "Arena cleared", body: `All hostiles are down. Final score ${scoreRef.current} with ${killsRef.current} eliminations.`, success: true, kills: killsRef.current, score: scoreRef.current });
      } else if (settings.mode === "firstperson" && remainingEnemies === 0 && waveRef.current >= 5) {
        if (playerState) {
          setMedicalSummary(
            buildMedicalSummary({
              injuries: playerState.injuries,
              medicalEvents: medicalTimelineRef.current,
              survivedMs: elapsedRef.current * 1000,
              causeOfDeath: null,
              accuracyWhileInjured:
                treatmentStatsRef.current.shotsWhileInjured > 0
                  ? treatmentStatsRef.current.hitsWhileInjured / treatmentStatsRef.current.shotsWhileInjured
                  : null,
            }),
          );
        }
        completeMatch({ title: "Survival complete", body: `Five full waves cleared. Final score ${scoreRef.current} with ${killsRef.current} kills.`, success: true, kills: killsRef.current, score: scoreRef.current });
      }
    }

    cameraShakeRef.current = lerp(cameraShakeRef.current, 0, 0.08);
    const playerRigNow = rigMapRef.current.get(PLAYER_ID);
    if (playerRigNow?.pelvis.current && camera) {
      const translation = playerRigNow.pelvis.current.translation();
      const player = actorStateRef.current[PLAYER_ID];
      const yaw = player?.aimYaw || inputRef.current.yaw;
      const pitch = player?.aimPitch || inputRef.current.pitch;
      const concussionPenalty =
        player?.injuries.filter((injury) => injury.category === "concussion" && !injury.treated).reduce((sum, injury) => sum + injury.aimPenalty, 0) || 0;
      if (settings.mode === "firstperson") {
        const eyePosition = new THREE.Vector3(
          translation.x,
          translation.y + 1.45 + (Math.random() - 0.5) * concussionPenalty * 0.12,
          translation.z,
        );
        const lookDirection = new THREE.Vector3(
          Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          Math.cos(yaw) * Math.cos(pitch),
        );
        camera.position.lerp(eyePosition, 0.28);
        camera.lookAt(
          eyePosition.x + lookDirection.x * 12,
          eyePosition.y + lookDirection.y * 12,
          eyePosition.z + lookDirection.z * 12,
        );
      } else {
        const offset = new THREE.Vector3(-Math.sin(yaw) * 7.2, 3.8 + Math.sin(-pitch) * 2, -Math.cos(yaw) * 7.2);
        camera.position.lerp(
          new THREE.Vector3(
            translation.x + offset.x + (Math.random() - 0.5) * (cameraShakeRef.current * 0.35 + concussionPenalty * 0.45),
            translation.y + offset.y + (Math.random() - 0.5) * concussionPenalty * 0.2,
            translation.z + offset.z + (Math.random() - 0.5) * (cameraShakeRef.current * 0.35 + concussionPenalty * 0.45),
          ),
          0.14,
        );
        camera.lookAt(translation.x, translation.y + 1.3, translation.z);
      }
    }

    if (snapshotAccumulatorRef.current >= SNAPSHOT_INTERVAL) {
      snapshotAccumulatorRef.current = 0;
      const actorSnapshots: Record<string, ActorSnapshot> = {};
      for (const descriptor of descriptors) {
        const actor = actorStateRef.current[descriptor.id];
        const rig = rigMapRef.current.get(descriptor.id);
        if (!actor || !rig?.pelvis.current) continue;
        const position = rig.pelvis.current.translation();
        const velocity = rig.pelvis.current.linvel();
        actorSnapshots[descriptor.id] = {
          id: actor.id,
          name: actor.name,
          team: actor.team,
          isPlayer: actor.isPlayer,
          alive: actor.alive,
          knockedOut: actor.knockedOut,
          health: actor.health,
          stability: actor.stability,
          balanceState: actor.balanceState,
          drawCharge: actor.drawCharge,
          vitals: JSON.parse(JSON.stringify(actor.vitals)),
          injuries: JSON.parse(JSON.stringify(actor.injuries)),
          position: [position.x, position.y, position.z],
          velocity: [velocity.x, velocity.y, velocity.z],
          aimYaw: actor.aimYaw,
          aimPitch: actor.aimPitch,
          ammo: { ...actor.ammo },
          limbs: JSON.parse(JSON.stringify(actor.limbs)),
        };
      }
      setActors(actorSnapshots);
      setArrowsSnapshot(
        arrows
          .map((arrow) => {
            const body = arrowBodiesRef.current.get(arrow.id)?.current;
            if (!body) return null;
            const position = body.translation();
            const velocity = body.linvel();
            return {
              id: arrow.id,
              ownerId: arrow.ownerId,
              type: arrow.type,
              active: true,
              position: [position.x, position.y, position.z] as [number, number, number],
              velocity: [velocity.x, velocity.y, velocity.z] as [number, number, number],
              life: elapsedRef.current - arrow.bornAt,
            };
          })
          .filter(Boolean) as ArrowSnapshot[],
      );
    }
  });

  return (
    <>
      <ambientLight intensity={0.58} color="#d6e1f3" />
      <directionalLight castShadow position={[12, 24, 8]} intensity={2.1} color="#fff2c5" shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <hemisphereLight intensity={0.55} skyColor="#9ec7f7" groundColor="#23303f" />
      {runtime?.arenaConfig.sky === "dawn" ? <Sky sunPosition={[12, 5, 2]} turbidity={6} /> : null}
      {runtime?.arenaConfig.sky && runtime.arenaConfig.sky !== "dawn" ? <Stars radius={180} depth={80} count={3000} factor={4} saturation={0} fade speed={1} /> : null}
      {runtime?.arenaConfig.sky === "storm" ? <Environment preset="sunset" /> : null}
      <SafeModeController
        active={safeModeStatus.active}
        inputRef={inputRef}
        initialPlayerSpawn={runtime?.arenaConfig.spawnPoints.player || [0, 0, 6]}
        initialTargetSpawn={
          runtime
            ? [
                runtime.arenaConfig.spawnPoints.player[0],
                runtime.arenaConfig.spawnPoints.player[1],
                runtime.arenaConfig.spawnPoints.player[2] - 5,
              ]
            : [0, 0, 1]
        }
        onHit={handleSafeModeHit}
      />
      {!runtime ? null : (
        <>
      <Physics gravity={[0, -18, 0]} paused interpolate={false} colliders={false} numSolverIterations={8} numAdditionalFrictionIterations={4}>
        <PhysicsStepBridge stepRef={stepRef} />
        <ArenaScene arenaId={runtime.arenaConfig.id} registerProp={registerProp} />
        {descriptors.map((descriptor) => (
          <ActorRagdoll key={descriptor.id} actorId={descriptor.id} color={descriptor.color} spawn={descriptor.spawn} onRegister={registerRig} />
        ))}
        {arrows.map((arrow) => (
          <ArrowEntity key={arrow.id} id={arrow.id} type={arrow.type} spawn={[0, -50, 0]} velocity={[0, 0, 0]} color={arrow.ownerId === PLAYER_ID ? "#f5d7b5" : "#d0e1f2"} register={registerArrowBody} />
        ))}
      </Physics>
        </>
      )}
    </>
  );
}
