"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Sky, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { Socket } from "socket.io-client";
import { getMultiplayerSocket } from "@/lib/multiplayerClient";
import styles from "./DeadzoneClient.module.css";

type Snapshot = any;
type BuildId = "barricade" | "wall" | "gate" | "storage" | "bench" | "bed" | "generator" | "turret";
type Rarity = "common" | "uncommon" | "rare";

type SceneHudState = {
  interactionHint: string;
  reloadUntil: number;
  reloadDuration: number;
  zoneTint: number;
  buildValid: boolean;
  buildPreviewLabel: string;
  basePressure: boolean;
  safeZone: boolean;
  damageFlash: number;
  lowHealth: number;
  exhaustion: number;
  attackPressure: number;
  sirenPulse: number;
};

type PickupToast = {
  id: string;
  label: string;
  rarity: Rarity;
  amount: number;
  context: string;
  createdAt: number;
};

type ImpactFx = {
  id: string;
  position: [number, number, number];
  createdAt: number;
  color: string;
  scale: number;
  severity: number;
};

type CorpseFx = {
  id: string;
  position: [number, number, number];
  rotationY: number;
  roll: number;
  pitch: number;
  createdAt: number;
  tint: string;
  scale: number;
  crawler: boolean;
  drift: [number, number];
  slump: number;
};

type MutationBurstFx = {
  id: string;
  position: [number, number, number];
  createdAt: number;
  color: string;
};

type ReactionFx = {
  at: number;
  yaw: number;
  power: number;
  upperBias: number;
  severity: number;
};

type ZombieGhost = {
  id: string;
  x: number;
  z: number;
  seed: number;
  pace: number;
};

const BUILD_ORDER: BuildId[] = ["barricade", "wall", "gate", "storage", "bench", "bed", "generator", "turret"];
const RESOURCE_KEYS = ["scrap", "wood", "wiring", "battery", "fuel", "chemicals", "cloth", "food", "water", "med", "tools", "weaponParts", "tech", "mutationSample", "artifact"];
const INVENTORY_WEIGHTS: Record<string, number> = {
  scrap: 1,
  wood: 0.8,
  wiring: 0.5,
  battery: 1.8,
  fuel: 1.6,
  chemicals: 1.1,
  cloth: 0.4,
  food: 0.7,
  water: 1.1,
  med: 0.9,
  tools: 1.8,
  weaponParts: 1.5,
  tech: 1.4,
  mutationSample: 1.8,
  artifact: 2.3,
};
const BUILD_OFFSET_DISTANCE = 5.4;
const INVENTORY_SOFT_CAP = 90;
const HIT_MARKER_MS = 130;
const PICKUP_VISIBLE_MS = 2800;
const ALERT_VISIBLE_MS = 5000;
const CORPSE_VISIBLE_MS = 6500;
const MAX_IMPACTS = 22;
const MAX_CORPSES = 16;
const MAX_ALERTS = 4;
const MAX_PICKUPS = 5;
const LOOK_SENSITIVITY = 0.002;
const LOOK_SMOOTHING = 0.18;

const WEAPON_FEEL: Record<string, { recoilPitch: number; recoilYaw: number; flash: number; smoke: number; recover: number; impactScale: number; force: number; cadence: number }> = {
  pistol: { recoilPitch: 0.038, recoilYaw: 0.012, flash: 0.8, smoke: 0.16, recover: 0.12, impactScale: 0.8, force: 0.9, cadence: 1 },
  shotgun: { recoilPitch: 0.11, recoilYaw: 0.022, flash: 1.3, smoke: 0.38, recover: 0.085, impactScale: 1.45, force: 1.8, cadence: 0.7 },
  smg: { recoilPitch: 0.024, recoilYaw: 0.018, flash: 0.72, smoke: 0.14, recover: 0.16, impactScale: 0.72, force: 0.72, cadence: 1.2 },
  rifle: { recoilPitch: 0.052, recoilYaw: 0.014, flash: 0.95, smoke: 0.2, recover: 0.12, impactScale: 0.98, force: 1.12, cadence: 1 },
  revolver: { recoilPitch: 0.072, recoilYaw: 0.016, flash: 1.05, smoke: 0.2, recover: 0.1, impactScale: 1.06, force: 1.26, cadence: 0.8 },
  nailgun: { recoilPitch: 0.03, recoilYaw: 0.022, flash: 0.46, smoke: 0.1, recover: 0.13, impactScale: 0.76, force: 0.84, cadence: 1.1 },
  pipe: { recoilPitch: 0.018, recoilYaw: 0.008, flash: 0, smoke: 0, recover: 0.18, impactScale: 0.66, force: 0.62, cadence: 0.6 },
  marksman: { recoilPitch: 0.082, recoilYaw: 0.014, flash: 1.1, smoke: 0.24, recover: 0.09, impactScale: 1.2, force: 1.42, cadence: 0.68 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function createDeviceId() {
  const existing = window.localStorage.getItem("deadzone-device-id");
  if (existing) return existing;
  const next = `deadzone-${crypto.randomUUID()}`;
  window.localStorage.setItem("deadzone-device-id", next);
  return next;
}

function formatClock(hours: number) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  const suffix = h >= 12 ? "PM" : "AM";
  const normalized = h % 12 || 12;
  return `${normalized}:${String(m).padStart(2, "0")} ${suffix}`;
}

function formatEvent(kind?: string | null) {
  if (!kind) return "No active district event";
  return kind
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function resourceLabel(resource: string) {
  return resource
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function formatActionLabel(action?: string | null) {
  if (!action) return "";
  if (action === "firing") return "Engaging";
  if (action === "reloading") return "Reloading";
  if (action === "building") return "Building";
  if (action === "looting") return "Scavenging";
  if (action === "repairing") return "Repairing";
  if (action === "stashing") return "Stashing";
  if (action === "healing") return "Patching up";
  if (action === "respawned") return "Back in";
  if (action === "ability") return "Signal spike";
  if (action === "weaponSwap") return "Switching";
  return resourceLabel(action);
}

function sectorColor(kind: string, infection: number) {
  const base =
    kind === "hospital" || kind === "clinic"
      ? new THREE.Color("#5a646a")
      : kind === "police" || kind === "fire" || kind === "bunker"
        ? new THREE.Color("#4f5861")
        : kind === "quarantine" || kind === "lab" || kind === "sewer"
          ? new THREE.Color("#4a5547")
          : kind === "park"
            ? new THREE.Color("#59604a")
            : new THREE.Color("#605751");
  return base.lerp(new THREE.Color("#6b2f27"), infection * 0.68);
}

function zombieTint(mutation?: string | null) {
  if (mutation === "toxic") return "#8cb668";
  if (mutation === "armored") return "#717983";
  if (mutation === "electric") return "#73b9df";
  if (mutation === "fastTwitch") return "#bb7c63";
  if (mutation === "parasite") return "#919a63";
  if (mutation === "split") return "#926b75";
  if (mutation === "oversizedLimb") return "#9c644b";
  if (mutation === "cloaked") return "#5d696f";
  return "#7c8474";
}

function mutationGlow(mutation?: string | null) {
  if (mutation === "electric") return "#8bd2ff";
  if (mutation === "toxic") return "#a4d86a";
  if (mutation === "armored") return "#a2aab5";
  if (mutation === "fastTwitch") return "#d88a68";
  if (mutation === "parasite") return "#c8d47a";
  if (mutation === "split") return "#ce8797";
  if (mutation === "oversizedLimb") return "#cc8f60";
  if (mutation === "cloaked") return "#85a3b0";
  return "#90968b";
}

function structureStyle(buildId: BuildId) {
  if (buildId === "wall") return { size: [4.2, 2.9, 0.74] as [number, number, number], color: "#7a7063" };
  if (buildId === "gate") return { size: [3.7, 3.1, 0.92] as [number, number, number], color: "#62666a" };
  if (buildId === "turret") return { size: [1.7, 2.1, 1.7] as [number, number, number], color: "#596772" };
  if (buildId === "generator") return { size: [2.4, 1.6, 1.6] as [number, number, number], color: "#726857" };
  if (buildId === "storage") return { size: [2.2, 2.4, 1.3] as [number, number, number], color: "#68645b" };
  if (buildId === "bench") return { size: [2.8, 1.4, 1.5] as [number, number, number], color: "#725f4b" };
  if (buildId === "bed") return { size: [2.4, 1.1, 1.4] as [number, number, number], color: "#70665c" };
  return { size: [2.7, 1.8, 0.95] as [number, number, number], color: "#7f6a5e" };
}

function getLootMeta(resource: string, sectorKind?: string): { rarity: Rarity; context: string } {
  if (resource === "artifact") return { rarity: "rare", context: "anomaly cache" };
  if (resource === "mutationSample" || resource === "tech" || resource === "weaponParts") return { rarity: "uncommon", context: sectorKind || "deep district" };
  if (sectorKind === "hospital" || sectorKind === "clinic") return { rarity: resource === "med" || resource === "chemicals" ? "uncommon" : "common", context: "medical stash" };
  if (sectorKind === "police") return { rarity: resource.includes("Ammo") || resource === "weaponParts" ? "uncommon" : "common", context: "police cache" };
  if (sectorKind === "bunker") return { rarity: resource === "battery" || resource === "tech" ? "uncommon" : "common", context: "bunker locker" };
  return { rarity: "common", context: sectorKind || "street cache" };
}

function getWeaponSpec(snapshot: Snapshot | null, weaponId?: string | null) {
  return snapshot?.definitions?.weapons?.find((entry: any) => entry.id === weaponId) || null;
}

function getReloadDuration(weaponId?: string | null) {
  if (weaponId === "shotgun") return 1550;
  if (weaponId === "rifle" || weaponId === "marksman") return 1480;
  if (weaponId === "smg") return 1180;
  if (weaponId === "revolver") return 1320;
  if (weaponId === "nailgun") return 1220;
  if (weaponId === "pipe") return 0;
  return 1050;
}

function getRecoilStrength(weaponId?: string | null) {
  if (weaponId === "shotgun") return 0.09;
  if (weaponId === "rifle") return 0.055;
  if (weaponId === "marksman" || weaponId === "revolver") return 0.075;
  if (weaponId === "smg") return 0.032;
  if (weaponId === "nailgun") return 0.038;
  if (weaponId === "pipe") return 0.02;
  return 0.04;
}

function getWeaponFeel(weaponId?: string | null) {
  return WEAPON_FEEL[weaponId || "pistol"] || WEAPON_FEEL.pistol;
}

function getInventoryBurden(resources: Record<string, number> = {}) {
  return RESOURCE_KEYS.reduce((sum, key) => sum + (resources[key] || 0) * (INVENTORY_WEIGHTS[key] || 1), 0);
}

function snapBuildPosition(x: number, z: number) {
  const grid = 2;
  return {
    x: Math.round(x / grid) * grid,
    z: Math.round(z / grid) * grid,
  };
}

function playTone(audioContextRef: MutableRefObject<AudioContext | null>, options: { frequency: number; duration: number; gain?: number; type?: OscillatorType; slideTo?: number }) {
  try {
    const ctx = audioContextRef.current || new window.AudioContext();
    audioContextRef.current = ctx;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(options.frequency, now);
    if (options.slideTo) oscillator.frequency.linearRampToValueAtTime(options.slideTo, now + options.duration);
    gain.gain.setValueAtTime(options.gain ?? 0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + options.duration);
  } catch {
    // Audio is optional in browsers without a resumed audio context.
  }
}

export default function DeadzoneClient() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [buildMode, setBuildMode] = useState(false);
  const [selectedBuild, setSelectedBuild] = useState<BuildId>("barricade");
  const [alerts, setAlerts] = useState<Array<{ id: string; message: string; createdAt: number }>>([
    { id: crypto.randomUUID(), message: "Deadzone Alpha persists even when the city is empty.", createdAt: Date.now() },
  ]);
  const [senseHotspots, setSenseHotspots] = useState<Array<{ label: string; hordePressure: number }>>([]);
  const [pickupToasts, setPickupToasts] = useState<PickupToast[]>([]);
  const [lastHit, setLastHit] = useState<any>(null);
  const [sceneHud, setSceneHud] = useState<SceneHudState>({
    interactionHint: "",
    reloadUntil: 0,
    reloadDuration: 0,
    zoneTint: 0,
    buildValid: true,
    buildPreviewLabel: "",
    basePressure: false,
    safeZone: false,
    damageFlash: 0,
    lowHealth: 0,
    exhaustion: 0,
    attackPressure: 0,
    sirenPulse: 0,
  });
  const [abilityCue, setAbilityCue] = useState<{ label: string; until: number } | null>(null);
  const [hudNow, setHudNow] = useState(Date.now());
  const audioContextRef = useRef<AudioContext | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const snapshotRef = useRef<Snapshot | null>(null);
  const previousNearbyPlayersRef = useRef(0);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHudNow(Date.now());
      setAlerts((current) => current.filter((entry) => Date.now() - entry.createdAt < ALERT_VISIBLE_MS));
      setPickupToasts((current) => current.filter((entry) => Date.now() - entry.createdAt < PICKUP_VISIBLE_MS));
      setAbilityCue((current) => (current && current.until < Date.now() ? null : current));
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const socket = getMultiplayerSocket();
    socketRef.current = socket;
    socket.auth = {
      deviceId: createDeviceId(),
      identityToken: window.localStorage.getItem("deadzone-identity-token"),
      name: window.localStorage.getItem("deadzone-display-name") || "City Survivor",
      role: "scavenger",
    };

    const pushAlert = (message: string) => {
      setAlerts((current) => [{ id: crypto.randomUUID(), message, createdAt: Date.now() }, ...current].slice(0, MAX_ALERTS));
    };

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onIdentity = (payload: any) => {
      window.localStorage.setItem("deadzone-identity-token", payload.identityToken);
      socket.emit("deadzone:join", { name: payload.name });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("identity:ready", onIdentity);
    socket.on("deadzone:joined", () => setJoined(true));
    socket.on("deadzone:snapshot", (payload: Snapshot) => setSnapshot(payload));
    socket.on("deadzone:error", (payload: any) => pushAlert(payload?.message || "World sync error."));
    socket.on("deadzone:loot", (payload: any) => {
      const sector = snapshotRef.current?.sectors?.find((entry: any) => entry.lootNodes?.some((node: any) => node.id === payload.lootId));
      const meta = getLootMeta(payload.resource, sector?.kind);
      playTone(audioContextRef, {
        frequency: meta.rarity === "rare" ? 760 : meta.rarity === "uncommon" ? 620 : 520,
        slideTo: meta.rarity === "rare" ? 980 : 720,
        gain: 0.03,
        duration: 0.12,
        type: "triangle",
      });
      setPickupToasts((current) => [
        {
          id: crypto.randomUUID(),
          label: resourceLabel(payload.resource),
          rarity: meta.rarity,
          amount: payload.amount,
          context: meta.context,
          createdAt: Date.now(),
        },
        ...current,
      ].slice(0, MAX_PICKUPS));
      pushAlert(`Scavenged ${payload.amount} ${resourceLabel(payload.resource)}.`);
    });
    socket.on("deadzone:crafted", (payload: any) => {
      playTone(audioContextRef, { frequency: 450, slideTo: 590, duration: 0.18, gain: 0.025, type: "square" });
      pushAlert(`Crafted ${resourceLabel(payload.recipeId)}.`);
    });
    socket.on("deadzone:reloaded", (payload: any) => {
      playTone(audioContextRef, { frequency: 240, slideTo: 180, duration: 0.09, gain: 0.018, type: "sawtooth" });
      pushAlert(`${resourceLabel(payload.weaponId)} reloaded.`);
    });
    socket.on("deadzone:ability-used", (payload: any) => {
      setAbilityCue({ label: resourceLabel(payload.abilityId), until: Date.now() + 1600 });
      playTone(audioContextRef, { frequency: 290, slideTo: 420, duration: 0.28, gain: 0.035, type: "triangle" });
      pushAlert(`${resourceLabel(payload.abilityId)} triggered.`);
    });
    socket.on("deadzone:ability-sense", (payload: any) => setSenseHotspots(payload.hotspots || []));
    socket.on("deadzone:hit", (payload: any) => {
      setLastHit({ ...payload, at: Date.now() });
      playTone(audioContextRef, {
        frequency: payload.killed ? 180 : 210,
        slideTo: payload.killed ? 120 : 165,
        duration: payload.killed ? 0.14 : 0.08,
        gain: payload.killed ? 0.028 : 0.02,
        type: "square",
      });
    });
    socket.on("deadzone:stored", (payload: any) => {
      const total = Object.values(payload.transferred || {}).reduce((sum: number, value: any) => sum + Number(value || 0), 0);
      pushAlert(`Stored ${total} carried supplies in base lockers.`);
    });
    socket.on("deadzone:repaired", (payload: any) => {
      playTone(audioContextRef, { frequency: 260, slideTo: 320, duration: 0.16, gain: 0.025, type: "triangle" });
      pushAlert(`Repaired structure to ${Math.round((payload.health / payload.maxHealth) * 100)}%.`);
    });

    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const handlePointerLock = () => setPointerLocked(document.pointerLockElement?.id === "deadzone-stage");
    document.addEventListener("pointerlockchange", handlePointerLock);
    return () => document.removeEventListener("pointerlockchange", handlePointerLock);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat) return;
      if (event.code === "KeyB") setBuildMode((current) => !current);
      if (event.code.startsWith("Digit")) {
        const index = Number(event.code.slice(-1)) - 1;
        if (BUILD_ORDER[index]) setSelectedBuild(BUILD_ORDER[index]);
      }
      if (event.code === "Escape") document.exitPointerLock();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const localPlayer = snapshot?.localPlayer;
  const currentSector = useMemo(
    () => snapshot?.sectors?.find((sector: any) => sector.id === snapshot.currentSectorId) || snapshot?.districtSummary?.find((sector: any) => sector.id === snapshot.currentSectorId) || null,
    [snapshot],
  );
  const localBase = useMemo(
    () => snapshot?.bases?.find((base: any) => base.id === localPlayer?.baseId) || null,
    [snapshot, localPlayer?.baseId],
  );
  const nearbyPlayers = snapshot?.otherPlayers || [];
  const nearbyPlayerCount = nearbyPlayers.length;
  const alliesInDanger = nearbyPlayers.filter((player: any) => !player.deadAt && player.health < 45).length;
  const activeSurvivorActions = nearbyPlayers.filter((player: any) => player.lastActionAt && hudNow - player.lastActionAt < 2200).length;
  const currentWeapon = useMemo(() => getWeaponSpec(snapshot, localPlayer?.equippedWeaponId), [snapshot, localPlayer?.equippedWeaponId]);
  const inventoryBurden = useMemo(() => getInventoryBurden(localPlayer?.resources || {}), [localPlayer?.resources]);
  const carryingPressure = clamp(inventoryBurden / INVENTORY_SOFT_CAP, 0, 1.4);
  const reloadRemaining = Math.max(0, sceneHud.reloadUntil - hudNow);
  const reloadProgress = sceneHud.reloadDuration ? 1 - reloadRemaining / sceneHud.reloadDuration : 0;
  const hitMarkerVisible = lastHit && hudNow - lastHit.at < HIT_MARKER_MS;
  const topResources = useMemo(
    () =>
      RESOURCE_KEYS.map((key) => ({ key, value: Number(localPlayer?.resources?.[key] || 0) }))
        .filter((entry) => entry.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    [localPlayer?.resources],
  );
  const lowSupplies = (localPlayer?.health ?? 100) < 50 || (localPlayer?.resources?.water ?? 0) <= 1 || (localPlayer?.resources?.food ?? 0) <= 1;
  const districtDanger = currentSector ? Math.round((currentSector.hordePressure || 0) + (currentSector.infection || 0) * 36) : 0;
  const powerCooldown = Math.max(0, (localPlayer?.powerCooldownUntil || 0) - hudNow);
  const powerCooldownProgress = powerCooldown && localPlayer?.powerCooldownUntil ? clamp(1 - powerCooldown / 14000, 0, 1) : 1;
  const districtStateLabel = currentSector?.overrun ? "Overrun" : districtDanger > 90 ? "Collapse" : districtDanger > 55 ? "High risk" : "Unsteady";

  useEffect(() => {
    if (nearbyPlayerCount > previousNearbyPlayersRef.current && nearbyPlayerCount > 0) {
      setAlerts((current) => [
        { id: crypto.randomUUID(), message: `${nearbyPlayerCount} survivor${nearbyPlayerCount > 1 ? "s" : ""} moving through this district.`, createdAt: Date.now() },
        ...current,
      ].slice(0, MAX_ALERTS));
    }
    previousNearbyPlayersRef.current = nearbyPlayerCount;
  }, [nearbyPlayerCount]);

  return (
    <div
      className={styles.shell}
      style={
        {
          "--zone-tint": `${clamp(sceneHud.zoneTint, 0, 0.72)}`,
          "--danger-accent": currentSector?.overrun ? "#b4513f" : currentSector?.mutationChance > 0.32 ? "#8bb7c9" : "#d9b67b",
          "--damage-flash": `${clamp(sceneHud.damageFlash, 0, 1)}`,
          "--low-health": `${clamp(sceneHud.lowHealth, 0, 1)}`,
          "--exhaustion": `${clamp(sceneHud.exhaustion, 0, 1)}`,
          "--attack-pressure": `${clamp(sceneHud.attackPressure, 0, 1)}`,
          "--siren-pulse": `${clamp(sceneHud.sirenPulse, 0, 1)}`,
        } as CSSProperties
      }
    >
      <div className={styles.stageWrap}>
        <Canvas
          id="deadzone-stage"
          className={styles.canvas}
          shadows
          camera={{ fov: 70, near: 0.1, far: 900 }}
          onPointerDown={() => {
            const stage = document.getElementById("deadzone-stage");
            if (stage && document.pointerLockElement !== stage) stage.requestPointerLock();
          }}
        >
          <Suspense fallback={null}>
            <DeadzoneScene
              snapshot={snapshot}
              socketRef={socketRef}
              pointerLocked={pointerLocked}
              buildMode={buildMode}
              selectedBuild={selectedBuild}
              currentSector={currentSector}
              localBase={localBase}
              lastHit={lastHit}
              onAlert={(message) =>
                setAlerts((current) => [{ id: crypto.randomUUID(), message, createdAt: Date.now() }, ...current].slice(0, MAX_ALERTS))
              }
              onHudChange={setSceneHud}
              audioContextRef={audioContextRef}
            />
          </Suspense>
        </Canvas>

        {!pointerLocked ? (
          <button
            type="button"
            className={styles.lockPrompt}
            onClick={() => {
              document.getElementById("deadzone-stage")?.requestPointerLock();
              playTone(audioContextRef, { frequency: 180, slideTo: 240, duration: 0.22, gain: 0.025, type: "sawtooth" });
            }}
          >
            Enter The Abandoned City
          </button>
        ) : null}

        <div className={`${styles.tintOverlay} ${sceneHud.basePressure ? styles.tintPressure : ""} ${sceneHud.safeZone ? styles.tintSafe : ""}`} />
        <div className={styles.damageOverlay} />
        <div className={styles.pressureOverlay} />
        <div className={`${styles.crosshair} ${hitMarkerVisible ? styles.crosshairHit : ""}`}>
          {hitMarkerVisible ? <div className={styles.hitMarker} /> : null}
        </div>

        <div className={styles.topLeft}>
          <div className={styles.brand}>Deadzone Alpha</div>
          <div className={styles.subtle}>
            {connected ? "Signal locked" : "Linking"} | {joined ? "Shared shard active" : "Authenticating"}
          </div>
          <div className={styles.subtle}>{snapshot ? `Day ${snapshot.world.worldDay} | ${formatClock(snapshot.world.worldClockHours)}` : "Awaiting world state"}</div>
          {currentSector ? (
            <div className={`${styles.location} ${currentSector.overrun ? styles.locationOverrun : ""}`}>
              {currentSector.label} · {districtStateLabel}
            </div>
          ) : null}
          {sceneHud.interactionHint ? <div className={styles.contextHint}>{sceneHud.interactionHint}</div> : null}
        </div>

        {snapshot && localPlayer ? (
          <>
            <div className={styles.leftRail}>
              <CompactStat label="Health" value={localPlayer.health} max={localPlayer.maxHealth} tone="health" />
              <CompactStat label="Stamina" value={localPlayer.stamina} max={100} tone="stamina" />
              <div className={styles.dangerCard}>
                <div className={styles.cardLabel}>District</div>
                <div className={styles.dangerValue}>{currentSector?.label || "Transit"}</div>
                <div className={styles.dangerMeta}>
                  <span>Danger {districtDanger}</span>
                  <span>Mutation {Math.round((currentSector?.mutationChance || 0) * 100)}%</span>
                </div>
                <div className={styles.barTrack}>
                  <div className={`${styles.barFill} ${styles.dangerFill}`} style={{ width: `${clamp(districtDanger, 0, 100)}%` }} />
                </div>
              </div>
              {localBase ? (
                <div className={`${styles.baseCard} ${sceneHud.basePressure ? styles.baseUnderPressure : ""}`}>
                  <div className={styles.cardLabel}>Safehouse</div>
                  <div className={styles.cardValue}>{localBase.label}</div>
                  <div className={styles.cardHint}>{localBase.ownerName || "You"} hold this block.</div>
                  <div className={styles.cardHint}>
                    Threat {Math.round((localBase.threat || 0) * 100)}% · Defense {Math.round(localBase.defenseScore || 0)}
                  </div>
                </div>
              ) : null}
            </div>

            <div className={styles.topRight}>
              <div className={styles.weaponHud}>
                <div className={styles.weaponName}>{currentWeapon?.label || resourceLabel(localPlayer.equippedWeaponId)}</div>
                <div className={styles.weaponAmmo}>
                  <strong>{localPlayer.ammo?.[localPlayer.equippedWeaponId] ?? 0}</strong>
                  <span>/ {localPlayer.ammo?.[`${localPlayer.equippedWeaponId}Reserve`] ?? 0}</span>
                </div>
                {reloadRemaining > 0 ? (
                  <div className={styles.reloadMeter}>
                    <div className={styles.reloadFill} style={{ width: `${clamp(reloadProgress * 100, 0, 100)}%` }} />
                  </div>
                ) : null}
              </div>
              <div className={styles.powerHud}>
                <div className={styles.cardLabel}>Anomaly</div>
                <div className={styles.powerValue}>{localPlayer.powers?.[0] ? resourceLabel(localPlayer.powers[0]) : "Dormant"}</div>
                <div className={styles.powerMeta}>
                  <span>{localPlayer.powerArtifactCharges || 0} charges</span>
                  <span>{powerCooldown > 0 ? `${Math.ceil(powerCooldown / 1000)}s cd` : "ready"}</span>
                </div>
                <div className={styles.cooldownRingWrap}>
                  <div className={styles.cooldownRing} style={{ "--cooldown": `${powerCooldownProgress}` } as CSSProperties} />
                </div>
              </div>
              <div className={styles.survivorHud}>
                <div className={styles.cardLabel}>Nearby survivors</div>
                <div className={styles.cardValue}>{nearbyPlayerCount}</div>
                <div className={styles.cardHint}>
                  {activeSurvivorActions ? `${activeSurvivorActions} active nearby` : "Quiet block"}
                  {alliesInDanger ? ` · ${alliesInDanger} under pressure` : ""}
                </div>
              </div>
            </div>

            <div className={styles.bottomLeft}>
              <div className={styles.resourcePanel}>
                <div className={styles.resourceHeader}>
                  <span>Carried supplies</span>
                  <strong className={carryingPressure >= 1 ? styles.pressureHigh : carryingPressure >= 0.8 ? styles.pressureWarn : ""}>
                    {Math.round(inventoryBurden)} / {INVENTORY_SOFT_CAP}
                  </strong>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={`${styles.barFill} ${carryingPressure >= 1 ? styles.overburden : carryingPressure >= 0.8 ? styles.loadWarn : styles.stamina}`}
                    style={{ width: `${clamp(carryingPressure * 100, 0, 100)}%` }}
                  />
                </div>
                <div className={styles.compactResources}>
                  {topResources.map((entry) => (
                    <div key={entry.key} className={styles.resourceBadge}>
                      <span>{resourceLabel(entry.key)}</span>
                      <strong>{entry.value}</strong>
                    </div>
                  ))}
                </div>
                {carryingPressure >= 0.8 ? <div className={styles.cardHint}>Pack is getting heavy. Stash supplies at storage lockers.</div> : null}
              </div>
              <div className={styles.pickupFeed}>
                {pickupToasts.map((entry) => (
                  <div key={entry.id} className={`${styles.pickupToast} ${styles[entry.rarity]}`}>
                    <strong>
                      +{entry.amount} {entry.label}
                    </strong>
                    <span>{entry.context}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.bottomCenter}>
              <div className={styles.actionStrip}>
                <span>WASD move</span>
                <span>Shift sprint</span>
                <span>Space jump</span>
                <span>C crouch</span>
                <span>E interact</span>
                <span>G repair</span>
                <span>R reload</span>
                <span>Q anomaly</span>
              </div>
              {buildMode ? (
                <div className={`${styles.buildPanel} ${sceneHud.buildValid ? styles.buildGood : styles.buildBad}`}>
                  <span>Build mode</span>
                  <strong>{selectedBuild}</strong>
                  <span>{sceneHud.buildPreviewLabel || "Snap to solid ground and click to place."}</span>
                </div>
              ) : null}
              {abilityCue ? <div className={styles.abilityCue}>{abilityCue.label}</div> : null}
            </div>

            <div className={styles.bottomRight}>
              <div className={styles.eventCard}>
                <div className={styles.cardLabel}>Event</div>
                <div className={styles.cardValue}>{formatEvent(snapshot.world.activeEvent?.kind)}</div>
                <div className={styles.cardHint}>{snapshot.world.activeEvent?.label || "The city breathes in low, dangerous waves."} · Shared shard pressure shifts for every survivor in range.</div>
              </div>
              {senseHotspots.length ? (
                <div className={styles.pulseCard}>
                  <div className={styles.cardLabel}>Pulse readings</div>
                  {senseHotspots.map((spot) => (
                    <div key={spot.label} className={styles.districtRow}>
                      <span>{spot.label}</span>
                      <strong>{Math.round(spot.hordePressure)}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
              {lowSupplies ? <div className={styles.warningCard}>Supplies are thinning. Hit the next district or return to base.</div> : null}
              {localPlayer.deadAt ? (
                <div className={styles.deathReport}>
                  <div className={styles.cardLabel}>Death report</div>
                  <div className={styles.cardValue}>{localPlayer.deathReport?.cause || "Unknown cause"}</div>
                  <div className={styles.cardHint}>Press F to respawn near your base or district edge.</div>
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        <div className={styles.alerts}>
          {alerts.map((alert) => (
            <div key={alert.id} className={styles.alert}>
              {alert.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeadzoneScene({
  snapshot,
  socketRef,
  pointerLocked,
  buildMode,
  selectedBuild,
  currentSector,
  localBase,
  lastHit,
  onAlert,
  onHudChange,
  audioContextRef,
}: {
  snapshot: Snapshot | null;
  socketRef: MutableRefObject<Socket | null>;
  pointerLocked: boolean;
  buildMode: boolean;
  selectedBuild: BuildId;
  currentSector: any;
  localBase: any;
  lastHit: any;
  onAlert: (message: string) => void;
  onHudChange: Dispatch<SetStateAction<SceneHudState>>;
  audioContextRef: MutableRefObject<AudioContext | null>;
}) {
  const { camera, scene } = useThree();
  const latestSnapshotRef = useRef<Snapshot | null>(snapshot);
  const movementRef = useRef({ forward: false, backward: false, left: false, right: false, sprint: false, crouch: false, jumpQueued: false });
  const positionRef = useRef(new THREE.Vector3(-156, 2.2, 26));
  const velocityRef = useRef(new THREE.Vector3());
  const rotationRef = useRef({ yaw: 0, pitch: -0.03 });
  const lookTargetRef = useRef({ yaw: 0, pitch: -0.03 });
  const verticalVelocityRef = useRef(0);
  const bobRef = useRef(0);
  const sprintTiltRef = useRef(0);
  const movementLagRef = useRef(new THREE.Vector3());
  const strafeSwayRef = useRef(0);
  const crouchSettleRef = useRef(0);
  const landingBumpRef = useRef(0);
  const damageJoltRef = useRef({ pitch: 0, yaw: 0, roll: 0, intensity: 0 });
  const pressureShakeRef = useRef(0);
  const fovRef = useRef(70);
  const lastGroundedRef = useRef(true);
  const lastHealthRef = useRef<number | null>(null);
  const lastStaminaRef = useRef<number | null>(null);
  const interactionPulseRef = useRef(0);
  const sendClockRef = useRef(0);
  const fireCooldownUntilRef = useRef(0);
  const reloadTimeoutRef = useRef<number | null>(null);
  const reloadStateRef = useRef({ until: 0, duration: 0, emitted: false });
  const recoilRef = useRef({ pitch: 0, yaw: 0 });
  const muzzleUntilRef = useRef(0);
  const interactionHintRef = useRef("");
  const lastHudPushRef = useRef(0);
  const reactionMapRef = useRef<Record<string, ReactionFx>>({});
  const activeMutationIdsRef = useRef<Set<string>>(new Set());
  const previousZombieMapRef = useRef<Map<string, any>>(new Map());
  const [impacts, setImpacts] = useState<ImpactFx[]>([]);
  const [corpses, setCorpses] = useState<CorpseFx[]>([]);
  const [mutationBursts, setMutationBursts] = useState<MutationBurstFx[]>([]);
  const [buildPreview, setBuildPreview] = useState<{ x: number; z: number; valid: boolean; label: string }>({ x: 0, z: 0, valid: true, label: "" });
  const [ghosts, setGhosts] = useState<ZombieGhost[]>([]);

  useEffect(() => {
    latestSnapshotRef.current = snapshot;
    if (snapshot?.localPlayer?.position) {
      const y = snapshot.localPlayer.crouching ? 1.74 : 2.2;
      positionRef.current.set(snapshot.localPlayer.position.x, y, snapshot.localPlayer.position.z);
      velocityRef.current.set(snapshot.localPlayer.velocity?.x || 0, 0, snapshot.localPlayer.velocity?.z || 0);
      if (lastHealthRef.current == null) lastHealthRef.current = snapshot.localPlayer.health;
      if (lastStaminaRef.current == null) lastStaminaRef.current = snapshot.localPlayer.stamina;
      if (Math.abs(rotationRef.current.yaw) < 0.001 && Math.abs(rotationRef.current.pitch + 0.03) < 0.02) {
        rotationRef.current = {
          yaw: snapshot.localPlayer.rotation?.yaw ?? 0,
          pitch: snapshot.localPlayer.rotation?.pitch ?? -0.03,
        };
        lookTargetRef.current = { ...rotationRef.current };
      }
    }
  }, [snapshot]);

  useEffect(() => {
    if (reloadTimeoutRef.current) {
      window.clearTimeout(reloadTimeoutRef.current);
      reloadTimeoutRef.current = null;
    }
    return () => {
      if (reloadTimeoutRef.current) window.clearTimeout(reloadTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const visibleMutations = new Set<string>();
    for (const zombie of snapshot?.zombies || []) {
      if (zombie.mutation) visibleMutations.add(zombie.id);
      if (zombie.mutation && !activeMutationIdsRef.current.has(zombie.id)) {
        activeMutationIdsRef.current.add(zombie.id);
        setMutationBursts((current) => [
          {
            id: `${zombie.id}-${Date.now()}`,
            position: [zombie.position.x, zombie.archetype === "crawler" ? 0.8 : 1.5, zombie.position.z] as [number, number, number],
            createdAt: Date.now(),
            color: mutationGlow(zombie.mutation),
          },
          ...current,
        ].slice(0, 8));
        playTone(audioContextRef, {
          frequency: zombie.mutation === "electric" ? 420 : 260,
          slideTo: zombie.mutation === "fastTwitch" ? 560 : 360,
          duration: 0.22,
          gain: 0.024,
          type: zombie.mutation === "electric" ? "square" : "triangle",
        });
      }
    }
    activeMutationIdsRef.current.forEach((entry) => {
      if (!visibleMutations.has(entry)) activeMutationIdsRef.current.delete(entry);
    });
  }, [snapshot?.zombies, audioContextRef]);

  useEffect(() => {
    const localPlayer = snapshot?.localPlayer;
    if (!localPlayer) return;
    if (lastHealthRef.current != null && localPlayer.health < lastHealthRef.current) {
      const loss = lastHealthRef.current - localPlayer.health;
      damageJoltRef.current.pitch += clamp(loss / 220, 0.015, 0.08);
      damageJoltRef.current.yaw += (Math.random() - 0.5) * clamp(loss / 260, 0.008, 0.035);
      damageJoltRef.current.roll += (Math.random() - 0.5) * clamp(loss / 300, 0.005, 0.025);
      damageJoltRef.current.intensity = clamp(damageJoltRef.current.intensity + loss / 45, 0, 1);
      playTone(audioContextRef, {
        frequency: 92,
        slideTo: 64,
        duration: clamp(0.08 + loss / 260, 0.08, 0.2),
        gain: clamp(0.02 + loss / 650, 0.02, 0.045),
        type: "sawtooth",
      });
    }
    if (lastStaminaRef.current != null && localPlayer.stamina < 12 && lastStaminaRef.current >= 12) {
      playTone(audioContextRef, { frequency: 74, slideTo: 58, duration: 0.18, gain: 0.012, type: "triangle" });
    }
    lastHealthRef.current = localPlayer.health;
    lastStaminaRef.current = localPlayer.stamina;
  }, [snapshot?.localPlayer?.health, snapshot?.localPlayer?.stamina, audioContextRef]);

  useEffect(() => {
    const nextMap = new Map<string, any>();
    for (const zombie of snapshot?.zombies || []) nextMap.set(zombie.id, zombie);
    for (const [zombieId, zombie] of previousZombieMapRef.current.entries()) {
      if (!nextMap.has(zombieId)) {
        setCorpses((current) => [
          {
            id: `${zombieId}-${Date.now()}`,
            position: [zombie.position.x, zombie.archetype === "crawler" ? 0.3 : 0.2, zombie.position.z] as [number, number, number],
            rotationY: zombie.rotation || 0,
            roll: (Math.random() - 0.5) * 1.4,
            pitch: Math.random() * 0.45,
            createdAt: Date.now(),
            tint: zombieTint(zombie.mutation),
            scale: zombie.scale || 1,
            crawler: zombie.archetype === "crawler",
            drift: [
              Math.sin((zombie.rotation || 0) + Math.PI / 2) * (0.3 + Math.random() * 0.55),
              Math.cos((zombie.rotation || 0) + Math.PI / 2) * (0.3 + Math.random() * 0.55),
            ] as [number, number],
            slump: Math.random() * 0.3,
          },
          ...current,
        ].slice(0, MAX_CORPSES));
      }
    }
    previousZombieMapRef.current = nextMap;
  }, [snapshot?.zombies]);

  useEffect(() => {
    if (!currentSector) return;
    const seedSource = Array.from({ length: Math.min(12, Math.max(4, Math.round((currentSector.hordePressure || 0) / 14))) }, (_, index) => {
      const angle = (index / 12) * Math.PI * 2;
      const radius = 26 + (index % 3) * 18;
      return {
        id: `${currentSector.id}-ghost-${index}`,
        x: currentSector.cx + Math.cos(angle) * radius,
        z: currentSector.cz + Math.sin(angle) * radius,
        seed: index * 1.73,
        pace: 0.5 + (index % 4) * 0.23,
      };
    });
    setGhosts(seedSource);
  }, [currentSector?.id, currentSector?.hordePressure, currentSector?.cx, currentSector?.cz]);

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      if (!pointerLocked) return;
      lookTargetRef.current.yaw -= event.movementX * LOOK_SENSITIVITY * 0.78;
      lookTargetRef.current.pitch = clamp(lookTargetRef.current.pitch - event.movementY * LOOK_SENSITIVITY * 0.58, -1.18, 1.18);
    }

    function handleKey(event: KeyboardEvent, pressed: boolean) {
      if (event.code === "KeyW") movementRef.current.forward = pressed;
      if (event.code === "KeyS") movementRef.current.backward = pressed;
      if (event.code === "KeyA") movementRef.current.left = pressed;
      if (event.code === "KeyD") movementRef.current.right = pressed;
      if (event.code === "ShiftLeft") movementRef.current.sprint = pressed;
      if (event.code === "KeyC") movementRef.current.crouch = pressed;
      if (event.code === "Space" && pressed) movementRef.current.jumpQueued = true;
      if (!pressed) return;

      const localPlayer = latestSnapshotRef.current?.localPlayer;
      if (!localPlayer) return;
      if (event.code === "KeyR") {
        triggerReload();
        return;
      }
      if (event.code === "KeyQ") {
        socketRef.current?.emit("deadzone:ability", { abilityId: localPlayer.powers?.[0] || null });
        return;
      }
      if (event.code === "KeyT") {
        const recipe = localPlayer.health < 60 ? "medkit" : localPlayer.equippedWeaponId === "shotgun" ? "shotgunShells" : "rifleAmmo";
        socketRef.current?.emit("deadzone:craft", { recipeId: recipe });
        return;
      }
      if (event.code === "KeyF" && localPlayer.deadAt) {
        socketRef.current?.emit("deadzone:respawn");
        return;
      }
      if (event.code === "KeyG") {
        const repairable = findNearestRepair(localPlayer);
        if (repairable) {
          socketRef.current?.emit("deadzone:repair", { structureId: repairable.id });
        }
        return;
      }
      if (event.code === "Digit5") socketRef.current?.emit("deadzone:use-consumable", { itemId: "medkit" });
      if (event.code === "Digit6") socketRef.current?.emit("deadzone:use-consumable", { itemId: "bandage" });
      if (event.code === "Digit7") socketRef.current?.emit("deadzone:use-consumable", { itemId: "ration" });
      if (event.code === "Digit8") socketRef.current?.emit("deadzone:use-consumable", { itemId: "waterBottle" });
      if (event.code === "KeyE") {
        if (tryStorageInteraction(localPlayer)) return;
        const node = latestSnapshotRef.current?.sectors
          ?.flatMap((sector: any) => sector.lootNodes || [])
          .find((entry: any) => entry.amount > 0 && Math.hypot(entry.x - localPlayer.position.x, entry.z - localPlayer.position.z) < 6);
        if (node) socketRef.current?.emit("deadzone:collect-loot", { lootId: node.id });
      }

      const weaponIndex = Number(event.code.replace("Digit", "")) - 1;
      const nextWeapon = localPlayer.unlockedWeapons?.[weaponIndex];
      if (nextWeapon) socketRef.current?.emit("deadzone:switch-weapon", { weaponId: nextWeapon });
    }

    function handleMouseDown(event: MouseEvent) {
      if (!pointerLocked) return;
      if (event.button !== 0) return;
      if (buildMode) {
        if (!buildPreview.valid) {
          onAlert("Not enough clearance to place that structure.");
          return;
        }
        socketRef.current?.emit("deadzone:build", {
          buildId: selectedBuild,
          position: { x: buildPreview.x, z: buildPreview.z },
          rotation: rotationRef.current.yaw,
        });
        onAlert(`Placed ${selectedBuild}.`);
      } else {
        fireWeapon();
      }
    }

    const onKeyDown = (event: KeyboardEvent) => handleKey(event, true);
    const onKeyUp = (event: KeyboardEvent) => handleKey(event, false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", handleMouseDown);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [pointerLocked, buildMode, selectedBuild, buildPreview, onAlert]);

  function tryStorageInteraction(localPlayer: any) {
    const base = latestSnapshotRef.current?.bases?.find((entry: any) => entry.id === localPlayer.baseId);
    if (!base) return false;
    const storageStructure = base.structures?.find((structure: any) => structure.buildId === "storage" && Math.hypot(structure.x - localPlayer.position.x, structure.z - localPlayer.position.z) < 8);
    if (!storageStructure) return false;
    socketRef.current?.emit("deadzone:store");
    playTone(audioContextRef, { frequency: 170, slideTo: 130, duration: 0.18, gain: 0.022, type: "triangle" });
    return true;
  }

  function findNearestRepair(localPlayer: any) {
    const base = latestSnapshotRef.current?.bases?.find((entry: any) => entry.id === localPlayer.baseId);
    if (!base) return null;
    return (
      base.structures
        ?.filter((structure: any) => structure.health < structure.maxHealth && Math.hypot(structure.x - localPlayer.position.x, structure.z - localPlayer.position.z) < 8)
        .sort(
          (left: any, right: any) =>
            Math.hypot(left.x - localPlayer.position.x, left.z - localPlayer.position.z) - Math.hypot(right.x - localPlayer.position.x, right.z - localPlayer.position.z),
        )[0] || null
    );
  }

  function triggerReload() {
    const localPlayer = latestSnapshotRef.current?.localPlayer;
    if (!localPlayer || localPlayer.deadAt) return;
    const weapon = getWeaponSpec(latestSnapshotRef.current, localPlayer.equippedWeaponId);
    if (!weapon || weapon.melee) return;
    const currentAmmo = localPlayer.ammo?.[weapon.id] ?? 0;
    const reserveAmmo = localPlayer.ammo?.[`${weapon.id}Reserve`] ?? 0;
    if (reserveAmmo <= 0 || currentAmmo >= weapon.magSize || reloadStateRef.current.until > Date.now()) return;
    const duration = getReloadDuration(weapon.id);
    reloadStateRef.current = { until: Date.now() + duration, duration, emitted: false };
    onHudChange((current) => ({ ...current, reloadUntil: reloadStateRef.current.until, reloadDuration: duration }));
    interactionPulseRef.current = 1;
    playTone(audioContextRef, {
      frequency: weapon.id === "shotgun" ? 104 : weapon.id === "smg" ? 138 : 120,
      slideTo: weapon.id === "shotgun" ? 84 : 96,
      duration: weapon.id === "shotgun" ? 0.28 : 0.24,
      gain: 0.015,
      type: weapon.id === "revolver" ? "triangle" : "sawtooth",
    });
    if (reloadTimeoutRef.current) window.clearTimeout(reloadTimeoutRef.current);
    reloadTimeoutRef.current = window.setTimeout(() => {
      reloadStateRef.current.emitted = true;
      socketRef.current?.emit("deadzone:reload");
      reloadTimeoutRef.current = null;
    }, duration);
  }

  function fireWeapon() {
    const now = Date.now();
    const localPlayer = latestSnapshotRef.current?.localPlayer;
    if (!localPlayer || localPlayer.deadAt) return;
    const weapon = getWeaponSpec(latestSnapshotRef.current, localPlayer.equippedWeaponId);
    const feel = getWeaponFeel(localPlayer.equippedWeaponId);
    if (!weapon) return;
    if (reloadStateRef.current.until > now) return;
    if (fireCooldownUntilRef.current > now) return;
    if (!weapon.melee && (localPlayer.ammo?.[weapon.id] ?? 0) <= 0) {
      onAlert("Magazine dry. Reload.");
      playTone(audioContextRef, { frequency: 108, slideTo: 76, duration: 0.08, gain: 0.02, type: "square" });
      damageJoltRef.current.roll += (Math.random() - 0.5) * 0.01;
      return;
    }
    fireCooldownUntilRef.current = now + weapon.fireDelay;
    recoilRef.current.pitch += feel.recoilPitch;
    recoilRef.current.yaw += (Math.random() - 0.5) * feel.recoilYaw * (weapon.id === "smg" ? 1.3 : 1);
    damageJoltRef.current.pitch += feel.recoilPitch * 0.22;
    damageJoltRef.current.roll += (Math.random() - 0.5) * feel.recoilYaw * 0.4;
    sprintTiltRef.current += feel.recoilPitch * 0.12;
    muzzleUntilRef.current = now + Math.round(40 + feel.flash * 14);
    playTone(audioContextRef, {
      frequency: weapon.id === "shotgun" ? 86 : weapon.id === "smg" ? 160 : 125,
      slideTo: weapon.id === "shotgun" ? 50 : 90,
      duration: weapon.id === "shotgun" ? 0.18 : 0.08,
      gain: weapon.id === "shotgun" ? 0.05 : weapon.id === "rifle" ? 0.034 : 0.03,
      type: "sawtooth",
    });

    const impact = estimateImpact(localPlayer, weapon, feel);
    if (impact) {
      setImpacts((current) => [impact, ...current].slice(0, MAX_IMPACTS));
    }
    socketRef.current?.emit("deadzone:shoot", { yaw: rotationRef.current.yaw });
  }

  function estimateImpact(localPlayer: any, weapon: any, feel: ReturnType<typeof getWeaponFeel>): ImpactFx | null {
    const direction = new THREE.Vector3(Math.sin(rotationRef.current.yaw), 0, Math.cos(rotationRef.current.yaw));
    const zombies = latestSnapshotRef.current?.zombies || [];
    const hit = zombies
      .map((zombie: any) => {
        const dx = zombie.position.x - localPlayer.position.x;
        const dz = zombie.position.z - localPlayer.position.z;
        return {
          zombie,
          projection: dx * direction.x + dz * direction.z,
          lateral: Math.abs(dx * direction.z - dz * direction.x),
        };
      })
      .filter((entry: any) => entry.projection > 0 && entry.projection < weapon.range && entry.lateral < weapon.spread + (weapon.melee ? 2.4 : 0))
      .sort((a: any, b: any) => a.projection - b.projection)[0];

    if (hit) {
      const verticalBias = weapon.id === "shotgun" ? 1.2 : weapon.id === "marksman" || weapon.id === "rifle" || weapon.id === "revolver" ? 1.85 : 1.55;
      const severity = clamp((weapon.damage || 20) / Math.max(40, hit.zombie.maxHealth || 80), 0.18, weapon.id === "shotgun" ? 1 : 0.8);
      reactionMapRef.current[hit.zombie.id] = {
        at: Date.now(),
        yaw: rotationRef.current.yaw,
        power: feel.force * (hit.zombie.archetype === "brute" ? 0.55 : hit.zombie.archetype === "crawler" ? 0.42 : 1),
        upperBias: verticalBias,
        severity,
      };
      return {
        id: crypto.randomUUID(),
        position: [hit.zombie.position.x, hit.zombie.archetype === "crawler" ? 0.68 : verticalBias, hit.zombie.position.z] as [number, number, number],
        createdAt: Date.now(),
        color: hit.zombie.mutation === "electric" ? "#a7e4ff" : weapon.id === "shotgun" ? "#e0b08f" : "#c9b09b",
        scale: feel.impactScale * (weapon.id === "shotgun" && hit.projection < 12 ? 1.4 : 1),
        severity,
      };
    }

    return {
      id: crypto.randomUUID(),
      position: [localPlayer.position.x + direction.x * Math.min(weapon.range, 22), 0.8, localPlayer.position.z + direction.z * Math.min(weapon.range, 22)] as [number, number, number],
      createdAt: Date.now(),
      color: "#7d7568",
      scale: feel.impactScale,
      severity: 0.25,
    };
  }

  useFrame((state, delta) => {
    const localPlayer = latestSnapshotRef.current?.localPlayer;
    if (!localPlayer) return;
    const floorHeight = movementRef.current.crouch ? 1.74 : 2.2;
    const speedInputX = Number(movementRef.current.right) - Number(movementRef.current.left);
    const speedInputZ = Number(movementRef.current.forward) - Number(movementRef.current.backward);
    const inputVector = new THREE.Vector3(speedInputX, 0, speedInputZ);

    rotationRef.current.yaw = lerp(rotationRef.current.yaw, lookTargetRef.current.yaw, LOOK_SMOOTHING);
    rotationRef.current.pitch = lerp(rotationRef.current.pitch, lookTargetRef.current.pitch, LOOK_SMOOTHING);

    const moving = inputVector.lengthSq() > 0;
    const canSprint = Boolean(localPlayer && localPlayer.stamina > 8 && movementRef.current.sprint && !movementRef.current.crouch);
    const burden = clamp(getInventoryBurden(localPlayer.resources || {}) / INVENTORY_SOFT_CAP, 0, 1.5);
    const overloadedPenalty = burden > 1 ? 0.76 : burden > 0.82 ? 0.88 : 1;
    const desiredSpeed = (movementRef.current.crouch ? 3.2 : canSprint ? 11 : 6.1) * overloadedPenalty;
    const desired = moving
      ? inputVector.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationRef.current.yaw).multiplyScalar(desiredSpeed)
      : new THREE.Vector3();
    const accel = movementRef.current.crouch ? 0.12 : canSprint ? 0.14 : 0.11;
    const decel = movementRef.current.crouch ? 0.085 : 0.075;
    velocityRef.current.x = THREE.MathUtils.lerp(velocityRef.current.x, desired.x, moving ? accel : decel);
    velocityRef.current.z = THREE.MathUtils.lerp(velocityRef.current.z, desired.z, moving ? accel : decel);

    const grounded = positionRef.current.y <= floorHeight + 0.02;
    if (movementRef.current.jumpQueued && grounded) {
      verticalVelocityRef.current = 5.8;
      playTone(audioContextRef, { frequency: 118, slideTo: 90, duration: 0.08, gain: 0.01, type: "triangle" });
    }
    movementRef.current.jumpQueued = false;
    verticalVelocityRef.current -= 14.8 * delta;
    positionRef.current.x = clamp(positionRef.current.x + velocityRef.current.x * delta, -300, 300);
    positionRef.current.z = clamp(positionRef.current.z + velocityRef.current.z * delta, -210, 210);
    positionRef.current.y = Math.max(floorHeight, positionRef.current.y + verticalVelocityRef.current * delta);
    if (positionRef.current.y <= floorHeight) verticalVelocityRef.current = 0;

    const horizontalSpeed = Math.hypot(velocityRef.current.x, velocityRef.current.z);
    if (!lastGroundedRef.current && grounded) {
      const landingStrength = clamp(Math.abs(verticalVelocityRef.current) / 6 + horizontalSpeed / 22, 0.04, 0.18);
      landingBumpRef.current += landingStrength;
      playTone(audioContextRef, { frequency: 92, slideTo: 72, duration: 0.06 + landingStrength * 0.18, gain: 0.008, type: "triangle" });
    }
    lastGroundedRef.current = grounded;
    if (grounded && horizontalSpeed > 0.2) {
      bobRef.current += delta * (canSprint ? 10 : 7) * clamp(horizontalSpeed / 6, 0.6, 1.8);
    }
    const bobOffset = grounded && horizontalSpeed > 0.2 ? Math.sin(bobRef.current) * 0.04 + Math.abs(Math.cos(bobRef.current * 2)) * 0.02 : 0;
    const swayTarget = moving ? clamp(speedInputX * 0.04 + velocityRef.current.x * 0.004, -0.08, 0.08) : 0;
    strafeSwayRef.current = THREE.MathUtils.lerp(strafeSwayRef.current, swayTarget, 0.12);
    movementLagRef.current.x = THREE.MathUtils.lerp(movementLagRef.current.x, -velocityRef.current.x * 0.018, 0.08);
    movementLagRef.current.z = THREE.MathUtils.lerp(movementLagRef.current.z, -velocityRef.current.z * 0.012, 0.08);
    crouchSettleRef.current = THREE.MathUtils.lerp(crouchSettleRef.current, movementRef.current.crouch ? -0.08 : 0, 0.12);
    sprintTiltRef.current = THREE.MathUtils.lerp(sprintTiltRef.current, canSprint ? 0.045 : 0, 0.08);
    landingBumpRef.current = THREE.MathUtils.lerp(landingBumpRef.current, 0, 0.12);
    recoilRef.current.pitch = THREE.MathUtils.lerp(recoilRef.current.pitch, 0, getWeaponFeel(localPlayer.equippedWeaponId).recover);
    recoilRef.current.yaw = THREE.MathUtils.lerp(recoilRef.current.yaw, 0, 0.11);
    damageJoltRef.current.pitch = THREE.MathUtils.lerp(damageJoltRef.current.pitch, 0, 0.08);
    damageJoltRef.current.yaw = THREE.MathUtils.lerp(damageJoltRef.current.yaw, 0, 0.08);
    damageJoltRef.current.roll = THREE.MathUtils.lerp(damageJoltRef.current.roll, 0, 0.08);
    damageJoltRef.current.intensity = THREE.MathUtils.lerp(damageJoltRef.current.intensity, 0, 0.06);
    const nearbyPressure = clamp(
      ((latestSnapshotRef.current?.zombies || []).filter((zombie: any) => Math.hypot(zombie.position.x - positionRef.current.x, zombie.position.z - positionRef.current.z) < 5.4).length || 0) / 4,
      0,
      1,
    );
    pressureShakeRef.current = THREE.MathUtils.lerp(pressureShakeRef.current, nearbyPressure, 0.08);
    const lowHealth = clamp(1 - localPlayer.health / Math.max(localPlayer.maxHealth || 100, 1), 0, 1);
    const exhaustion = clamp(1 - localPlayer.stamina / 100, 0, 1);
    const lowHealthDrift = lowHealth > 0.45 ? Math.sin(state.clock.elapsedTime * (2 + lowHealth * 2)) * 0.008 * lowHealth : 0;
    const pressureShakeX = Math.sin(state.clock.elapsedTime * 22) * pressureShakeRef.current * 0.008;
    const pressureShakeY = Math.cos(state.clock.elapsedTime * 18) * pressureShakeRef.current * 0.006;

    camera.position.set(
      positionRef.current.x + movementLagRef.current.x + strafeSwayRef.current,
      positionRef.current.y + bobOffset + crouchSettleRef.current - landingBumpRef.current * 0.18 + pressureShakeY,
      positionRef.current.z + movementLagRef.current.z,
    );
    camera.rotation.order = "YXZ";
    camera.rotation.y = rotationRef.current.yaw + recoilRef.current.yaw + damageJoltRef.current.yaw + pressureShakeX;
    camera.rotation.x = rotationRef.current.pitch + recoilRef.current.pitch + damageJoltRef.current.pitch + lowHealthDrift - landingBumpRef.current * 0.12;
    camera.rotation.z = strafeSwayRef.current * 0.45 + sprintTiltRef.current + damageJoltRef.current.roll;
    fovRef.current = THREE.MathUtils.lerp(
      fovRef.current,
      70 + (canSprint ? 3.2 : 0) - exhaustion * 0.8 + pressureShakeRef.current * 0.4,
      0.08,
    );
    if ("fov" in camera) {
      camera.fov = fovRef.current;
      camera.updateProjectionMatrix();
    }

    const moodDanger = currentSector ? clamp((currentSector.hordePressure || 0) / 140, 0, 1) : 0;
    const moodInfection = currentSector ? clamp(currentSector.infection || 0, 0, 1) : 0;
    const moodMutation = currentSector ? clamp(currentSector.mutationChance || 0, 0, 0.7) / 0.7 : 0;
    const overrun = Boolean(currentSector?.overrun);
    const nearBase = Boolean(localBase && Math.hypot(positionRef.current.x - localBase.x, positionRef.current.z - localBase.z) < 18);
    const tint = clamp(moodInfection * 0.36 + moodMutation * 0.12 + (overrun ? 0.14 : 0) - (nearBase ? 0.12 : 0), 0, 0.62);
    const fogDensity = 0.0048 + moodInfection * 0.0032 + (overrun ? 0.0024 : 0) - (nearBase ? 0.001 : 0);
    const sirenPulse = (currentSector?.kind === "hospital" || currentSector?.kind === "police" || currentSector?.kind === "bunker") ? (Math.sin(state.clock.elapsedTime * 1.4) * 0.5 + 0.5) * 0.22 : 0;
    const fogColor = new THREE.Color("#11181b")
      .lerp(new THREE.Color("#2d1f1a"), moodInfection * 0.55)
      .lerp(new THREE.Color("#1e2830"), moodMutation * 0.5)
      .lerp(new THREE.Color("#2c1c17"), overrun ? 0.4 : 0)
      .lerp(new THREE.Color(currentSector?.kind === "hospital" ? "#3d4754" : currentSector?.kind === "police" ? "#33404d" : currentSector?.kind === "bunker" ? "#3f4035" : "#11181b"), sirenPulse);
    scene.fog = new THREE.FogExp2(fogColor, clamp(fogDensity, 0.0036, 0.01));
    scene.background = fogColor.clone().multiplyScalar(0.8);

    const buildTarget = snapBuildPosition(
      positionRef.current.x + Math.sin(rotationRef.current.yaw) * BUILD_OFFSET_DISTANCE,
      positionRef.current.z + Math.cos(rotationRef.current.yaw) * BUILD_OFFSET_DISTANCE,
    );
    const blockingStructure = snapshot?.bases
      ?.flatMap((base: any) => base.structures || [])
      ?.find((structure: any) => Math.hypot(structure.x - buildTarget.x, structure.z - buildTarget.z) < 2.4);
    const buildValid = !blockingStructure && (!localBase || Math.hypot(buildTarget.x - localBase.x, buildTarget.z - localBase.z) < 16);
    if (buildMode) {
      setBuildPreview({
        x: buildTarget.x,
        z: buildTarget.z,
        valid: buildValid,
        label: buildValid ? `Snapped near ${localBase ? "safehouse perimeter" : "claimed street line"}.` : "Blocked by existing structure or outside safe build radius.",
      });
    }

    const interactionHint = getInteractionHint(snapshot, localPlayer, localBase);
    if (interactionHintRef.current !== interactionHint) {
      interactionHintRef.current = interactionHint;
    }

    if (state.clock.elapsedTime - lastHudPushRef.current > 0.08) {
      lastHudPushRef.current = state.clock.elapsedTime;
      onHudChange({
        interactionHint,
        reloadUntil: reloadStateRef.current.until,
        reloadDuration: reloadStateRef.current.duration,
        zoneTint: tint,
        buildValid,
        buildPreviewLabel: buildMode ? (buildValid ? "Placement snapped. Click to build." : "Placement blocked.") : "",
        basePressure: Boolean(localBase && (localBase.threat || 0) > 0.54),
        safeZone: nearBase,
        damageFlash: damageJoltRef.current.intensity,
        lowHealth,
        exhaustion,
        attackPressure: pressureShakeRef.current,
        sirenPulse,
      });
    }

    sendClockRef.current += delta;
    if (sendClockRef.current > 0.05 && socketRef.current?.connected) {
      sendClockRef.current = 0;
      socketRef.current.emit("deadzone:transform", {
        position: { x: positionRef.current.x, y: 0, z: positionRef.current.z },
        rotation: rotationRef.current,
        velocity: { x: velocityRef.current.x, y: 0, z: velocityRef.current.z },
        crouching: movementRef.current.crouch,
        sprinting: canSprint && horizontalSpeed > 2.2,
      });
    }

    if (currentSector && pointerLocked && Math.random() < delta * clamp((currentSector.hordePressure || 0) / 240, 0.02, 0.08)) {
      playTone(audioContextRef, {
        frequency: overrun ? 120 : 150,
        slideTo: moodMutation > 0.4 ? 210 : 90,
        duration: moodMutation > 0.4 ? 0.38 : 0.24,
        gain: overrun ? 0.014 : 0.009,
        type: moodMutation > 0.4 ? "square" : "triangle",
      });
    }
  });

  useEffect(() => {
    setImpacts((current) => current.filter((entry) => Date.now() - entry.createdAt < 450));
    setCorpses((current) => current.filter((entry) => Date.now() - entry.createdAt < CORPSE_VISIBLE_MS));
    setMutationBursts((current) => current.filter((entry) => Date.now() - entry.createdAt < 900));
  }, [snapshot, lastHit]);

  return (
    <>
      <ambientLight intensity={localBase ? 0.82 : 0.65} color={localBase ? "#d4c8b9" : "#bfc5c8"} />
      <hemisphereLight intensity={0.52} color={currentSector?.overrun ? "#8e7e74" : "#8fa5b0"} groundColor={localBase ? "#1b1b16" : "#0e1113"} />
      <directionalLight
        castShadow
        position={[74, 110, 42]}
        intensity={currentSector?.overrun ? 1.18 : localBase ? 1.42 : 1.28}
        color={currentSector?.mutationChance > 0.32 ? "#d9dce8" : "#eee0cb"}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      {localBase ? <pointLight position={[localBase.x, 5, localBase.z]} intensity={1.4} distance={32} color="#f0c18a" /> : null}
      <Sky distance={450000} sunPosition={[40, 18, -8]} inclination={0.52} azimuth={0.11} turbidity={currentSector?.overrun ? 13 : 10} rayleigh={0.38} />
      <Stars radius={360} depth={38} count={1200} factor={1.5} saturation={0.05} fade />
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color={localBase ? "#2d2b28" : "#2a2d30"} roughness={1} />
      </mesh>
      {snapshot ? (
        <WorldGeometry
          snapshot={snapshot}
          localBase={localBase}
          currentSector={currentSector}
          buildMode={buildMode}
          selectedBuild={selectedBuild}
          buildPreview={buildPreview}
          impacts={impacts}
          corpses={corpses}
          mutationBursts={mutationBursts}
          ghosts={ghosts}
          reactions={reactionMapRef.current}
          muzzleActive={muzzleUntilRef.current > Date.now()}
          cameraPosition={camera.position}
        />
      ) : null}
    </>
  );
}

function getInteractionHint(snapshot: Snapshot | null, localPlayer: any, localBase: any) {
  if (!snapshot || !localPlayer) return "";
  if (localPlayer.deadAt) return "Press F to respawn.";
  const storage = localBase?.structures?.find((structure: any) => structure.buildId === "storage" && Math.hypot(structure.x - localPlayer.position.x, structure.z - localPlayer.position.z) < 8);
  if (storage) return "Press E to stash supplies in storage.";
  const repairable = localBase?.structures?.find((structure: any) => structure.health < structure.maxHealth && Math.hypot(structure.x - localPlayer.position.x, structure.z - localPlayer.position.z) < 8);
  if (repairable) return "Press G to repair damaged defenses.";
  const node = snapshot.sectors
    ?.flatMap((sector: any) => sector.lootNodes || [])
    .find((entry: any) => entry.amount > 0 && Math.hypot(entry.x - localPlayer.position.x, entry.z - localPlayer.position.z) < 6);
  if (node) return `Press E to search ${resourceLabel(node.resource)} cache.`;
  if (!localPlayer.baseId) return "Press B to claim a foothold and start building.";
  return "";
}

function WorldGeometry({
  snapshot,
  localBase,
  currentSector,
  buildMode,
  selectedBuild,
  buildPreview,
  impacts,
  corpses,
  mutationBursts,
  ghosts,
  reactions,
  muzzleActive,
  cameraPosition,
}: {
  snapshot: Snapshot;
  localBase: any;
  currentSector: any;
  buildMode: boolean;
  selectedBuild: BuildId;
  buildPreview: { x: number; z: number; valid: boolean; label: string };
  impacts: ImpactFx[];
  corpses: CorpseFx[];
  mutationBursts: MutationBurstFx[];
  ghosts: ZombieGhost[];
  reactions: Record<string, ReactionFx>;
  muzzleActive: boolean;
  cameraPosition: THREE.Vector3;
}) {
  return (
    <group>
      {snapshot.sectors?.map((sector: any) => (
        <SectorChunk key={sector.id} sector={sector} highlight={sector.id === snapshot.currentSectorId} />
      ))}
      {ghosts.map((ghost) => (
        <DistantGhost key={ghost.id} ghost={ghost} currentSector={currentSector} />
      ))}
      {snapshot.bases?.map((base: any) => (
        <BaseCluster key={base.id} base={base} localBase={localBase?.id === base.id} />
      ))}
      {snapshot.zombies?.map((zombie: any) => (
        <ZombieActor key={zombie.id} zombie={zombie} reactionAt={reactions[zombie.id]} cameraPosition={cameraPosition} />
      ))}
      {snapshot.otherPlayers?.map((player: any) => (
        <OtherSurvivor key={player.playerId} player={player} localBaseId={localBase?.id || null} />
      ))}
      {impacts.map((impact) => (
        <ImpactMarker key={impact.id} impact={impact} />
      ))}
      {corpses.map((corpse) => (
        <CorpseMarker key={corpse.id} corpse={corpse} />
      ))}
      {mutationBursts.map((burst) => (
        <MutationBurst key={burst.id} burst={burst} />
      ))}
      {buildMode ? <BuildGhost preview={buildPreview} buildId={selectedBuild} valid={buildPreview.valid} /> : null}
      {muzzleActive ? <MuzzleFlash position={[cameraPosition.x, cameraPosition.y - 0.18, cameraPosition.z]} /> : null}
    </group>
  );
}

function SectorChunk({ sector, highlight }: { sector: any; highlight: boolean }) {
  const tint = useMemo(() => sectorColor(sector.kind, sector.infection), [sector.kind, sector.infection]);
  const landmarkHeight =
    sector.kind === "tower" || sector.kind === "apartment"
      ? 34
      : sector.kind === "hospital" || sector.kind === "police" || sector.kind === "fire"
        ? 18
        : sector.kind === "garage" || sector.kind === "warehouse"
          ? 12
          : 10;
  const accent = sector.overrun ? "#6f2c20" : sector.mutationChance > 0.32 ? "#475765" : "#2a2d30";
  const cueLight =
    sector.kind === "hospital"
      ? "#7fa1bb"
      : sector.kind === "police"
        ? "#88a8c8"
        : sector.kind === "bunker"
          ? "#c7b17d"
          : sector.kind === "quarantine"
            ? "#93c275"
            : null;

  return (
    <group position={[sector.cx, 0, sector.cz]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[sector.size, sector.size]} />
        <meshStandardMaterial color={tint} roughness={1} metalness={0.04} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <planeGeometry args={[sector.size * 0.92, 13]} />
        <meshStandardMaterial color={accent} roughness={0.93} />
      </mesh>
      {highlight ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <ringGeometry args={[sector.size * 0.28, sector.size * 0.32, 32]} />
          <meshBasicMaterial color="#d5b583" transparent opacity={0.28} />
        </mesh>
      ) : null}
      {cueLight ? <pointLight position={[0, 8, 0]} intensity={0.45 + (sector.overrun ? 0.15 : 0)} distance={32} color={cueLight} /> : null}
      <group position={[sector.size * 0.2, 0.5, -sector.size * 0.16]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.2, 3.2]} />
          <meshBasicMaterial color={sector.overrun ? "#46322d" : "#90908a"} transparent opacity={0.06 + sector.infection * 0.05} />
        </mesh>
      </group>
      <Landmark sector={sector} landmarkHeight={landmarkHeight} />
      {(sector.lootNodes || [])
        .filter((node: any) => node.amount > 0)
        .map((node: any) => (
          <group key={node.id} position={[node.x - sector.cx, 0, node.z - sector.cz]}>
            <mesh castShadow position={[0, 0.7, 0]}>
              <boxGeometry args={[1.15, 0.82, 1.15]} />
              <meshStandardMaterial color={node.rarity === "rare" ? "#9f8c50" : node.rarity === "uncommon" ? "#6f7c88" : "#5d615f"} roughness={0.78} metalness={0.22} />
            </mesh>
            <mesh position={[0, 1.35, 0]}>
              <sphereGeometry args={[0.11, 10, 10]} />
              <meshBasicMaterial color={node.rarity === "rare" ? "#ead792" : node.rarity === "uncommon" ? "#9bc2d7" : "#ddd6c8"} />
            </mesh>
          </group>
        ))}
    </group>
  );
}

function Landmark({ sector, landmarkHeight }: { sector: any; landmarkHeight: number }) {
  const footprint = sector.kind === "tower" ? [12, landmarkHeight, 12] : sector.kind === "highway" ? [34, 4, 12] : [18, landmarkHeight, 16];
  const roofHeight = sector.kind === "hospital" || sector.kind === "fire" ? 2.2 : 1.4;
  const detailColor = sector.kind === "hospital" ? "#8f8f98" : sector.kind === "police" ? "#5d6773" : sector.kind === "apartment" ? "#716961" : "#615e5b";
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, footprint[1] / 2, 0]}>
        <boxGeometry args={footprint as [number, number, number]} />
        <meshStandardMaterial color={detailColor} roughness={0.94} />
      </mesh>
      <mesh castShadow position={[0, footprint[1] + roofHeight / 2, 0]}>
        <boxGeometry args={[footprint[0] * 1.02, roofHeight, footprint[2] * 0.48]} />
        <meshStandardMaterial color="#48413d" roughness={0.87} />
      </mesh>
      {Array.from({ length: 4 }).map((_, index) => (
        <mesh key={index} castShadow position={[-14 + index * 9, 4.5, sector.kind === "highway" ? 9 : -13]}>
          <boxGeometry args={[5.5, 8 + (index % 2) * 4, 5.5]} />
          <meshStandardMaterial color="#55504c" roughness={0.96} />
        </mesh>
      ))}
    </group>
  );
}

function ZombieActor({ zombie, reactionAt, cameraPosition }: { zombie: any; reactionAt?: ReactionFx; cameraPosition: THREE.Vector3 }) {
  const elapsed = (Date.now() % 100000) / 1000;
  const tint = zombieTint(zombie.mutation);
  const glow = mutationGlow(zombie.mutation);
  const headScale = zombie.archetype === "bloater" ? 0.52 : zombie.archetype === "crawler" ? 0.28 : 0.34;
  const crawlOffset = zombie.archetype === "crawler" ? 0.48 : 1.1;
  const distanceToCamera = Math.hypot(cameraPosition.x - zombie.position.x, cameraPosition.z - zombie.position.z);
  const jitter = zombie.mutation === "fastTwitch" ? Math.sin(elapsed * 14 + zombie.position.x) * 0.08 + Math.cos(elapsed * 8 + zombie.position.z) * 0.04 : 0;
  const attackLean = distanceToCamera < 2.4 ? Math.sin(elapsed * 10) * (zombie.mutation === "oversizedLimb" ? 0.14 : 0.08) : 0;
  const reactionStrength = reactionAt && Date.now() - reactionAt.at < 220 ? 1 - (Date.now() - reactionAt.at) / 220 : 0;
  const electricSpark = zombie.mutation === "electric" ? Math.abs(Math.sin(elapsed * 11 + zombie.position.z)) : 0;
  const cloakedPulse = zombie.mutation === "cloaked" ? 0.34 + (Math.sin(elapsed * 5 + zombie.position.x) * 0.5 + 0.5) * 0.28 : 1;
  const hitKick = reactionAt ? reactionAt.power * reactionStrength : 0;
  const hitYawOffset = reactionAt ? Math.sin(reactionAt.yaw) * hitKick * 0.28 : 0;
  const hitPitch = reactionAt ? reactionAt.upperBias * hitKick * 0.08 : 0;
  const bruteWeight = zombie.archetype === "brute" ? 0.6 : zombie.archetype === "crawler" ? 0.42 : 1;
  const mutationRoll = zombie.mutation === "oversizedLimb" ? Math.sin(elapsed * 5 + zombie.position.x) * 0.07 : 0;

  return (
    <group
      position={[zombie.position.x + jitter + hitYawOffset, hitPitch, zombie.position.z]}
      rotation={[0, (zombie.rotation || 0) + attackLean + mutationRoll, hitKick * 0.12 * bruteWeight]}
      scale={zombie.scale || 1}
    >
      <mesh castShadow position={[0, crawlOffset, 0]}>
        <capsuleGeometry args={[zombie.mutation === "oversizedLimb" ? 0.48 : 0.42, zombie.archetype === "crawler" ? 0.45 : zombie.mutation === "armored" ? 1.28 : 1.15, 4, 8]} />
        <meshStandardMaterial
          color={tint}
          emissive={glow}
          emissiveIntensity={(zombie.mutation ? 0.12 : 0) + electricSpark * 0.2 + reactionStrength * 0.22 * bruteWeight}
          roughness={zombie.mutation === "armored" ? 0.56 : 0.92}
          metalness={zombie.mutation === "armored" ? 0.24 : 0.02}
          transparent={zombie.mutation === "cloaked"}
          opacity={zombie.mutation === "cloaked" ? cloakedPulse : 1}
        />
      </mesh>
      <mesh castShadow position={[0, zombie.archetype === "crawler" ? 0.98 : 2.02 + reactionStrength * 0.08, 0]}>
        <sphereGeometry args={[headScale, 10, 10]} />
        <meshStandardMaterial color="#bcaf9c" roughness={0.95} emissive={reactionStrength > 0 ? "#ffb48f" : "#000000"} emissiveIntensity={reactionStrength * 0.32 * bruteWeight} />
      </mesh>
      <mesh castShadow position={[0.48, zombie.archetype === "crawler" ? 0.64 : 1.32, 0]}>
        <boxGeometry args={[zombie.mutation === "oversizedLimb" ? 0.26 : 0.16, zombie.mutation === "oversizedLimb" ? 0.98 : 0.72, 0.16]} />
        <meshStandardMaterial color={tint} roughness={0.95} />
      </mesh>
      <mesh castShadow position={[-0.48, zombie.archetype === "crawler" ? 0.64 : 1.32, zombie.mutation === "oversizedLimb" ? 0.1 : 0]}>
        <boxGeometry args={[zombie.mutation === "oversizedLimb" ? 0.18 : 0.16, zombie.mutation === "oversizedLimb" ? 0.62 : 0.72, 0.16]} />
        <meshStandardMaterial color={tint} roughness={0.95} />
      </mesh>
      {zombie.mutation && distanceToCamera > 14 ? (
        <mesh position={[0, zombie.archetype === "crawler" ? 1 : 2.25, 0]}>
          <sphereGeometry args={[0.1 + electricSpark * 0.03, 8, 8]} />
          <meshBasicMaterial color={glow} transparent opacity={0.22 + electricSpark * 0.18} />
        </mesh>
      ) : null}
      {zombie.mutation === "electric" ? (
        <group>
          <mesh position={[0.24, 1.65, 0]}>
            <sphereGeometry args={[0.08 + electricSpark * 0.05, 8, 8]} />
            <meshBasicMaterial color="#8bd2ff" transparent opacity={0.4 + electricSpark * 0.3} />
          </mesh>
          <mesh position={[-0.32, 1.1, 0.2]}>
            <sphereGeometry args={[0.05 + electricSpark * 0.04, 8, 8]} />
            <meshBasicMaterial color="#b8ecff" transparent opacity={0.3 + electricSpark * 0.4} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

function DistantGhost({ ghost, currentSector }: { ghost: ZombieGhost; currentSector: any }) {
  const t = (Date.now() % 100000) / 1000;
  const sway = Math.sin(t * ghost.pace + ghost.seed) * 1.4;
  const rush = currentSector?.overrun ? Math.sin(t * (ghost.pace * 1.8) + ghost.seed) * 2.2 : 0;
  return (
    <group position={[ghost.x + sway, 0, ghost.z + rush]}>
      <mesh position={[0, 1.2, 0]}>
        <capsuleGeometry args={[0.28, 0.98, 4, 6]} />
        <meshBasicMaterial color="#090b0d" transparent opacity={0.42} />
      </mesh>
      <mesh position={[0, 2.02, 0]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshBasicMaterial color="#0d1114" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

type OtherSurvivorProps = {
  player: any;
  localBaseId: string | null;
};

const OtherSurvivor = ({ player, localBaseId }: OtherSurvivorProps) => {
  const visualRef = useRef({
    x: player.position.x,
    z: player.position.z,
    yaw: player.rotation?.yaw || 0,
    crouch: player.crouching ? 1 : 0,
    sprint: player.sprinting ? 1 : 0,
  });
  const targetRef = useRef({
    x: player.position.x,
    z: player.position.z,
    yaw: player.rotation?.yaw || 0,
    crouch: player.crouching ? 1 : 0,
    sprint: player.sprinting ? 1 : 0,
  });

  useEffect(() => {
    targetRef.current = {
      x: player.position.x,
      z: player.position.z,
      yaw: player.rotation?.yaw || 0,
      crouch: player.crouching ? 1 : 0,
      sprint: player.sprinting ? 1 : 0,
    };
  }, [player.position.x, player.position.z, player.rotation?.yaw, player.crouching, player.sprinting]);

  useFrame((_, delta) => {
    const smooth = Math.min(1, delta * 8);
    visualRef.current.x = lerp(visualRef.current.x, targetRef.current.x, smooth);
    visualRef.current.z = lerp(visualRef.current.z, targetRef.current.z, smooth);
    const yawDelta = Math.atan2(Math.sin(targetRef.current.yaw - visualRef.current.yaw), Math.cos(targetRef.current.yaw - visualRef.current.yaw));
    visualRef.current.yaw += yawDelta * smooth;
    visualRef.current.crouch = lerp(visualRef.current.crouch, targetRef.current.crouch, Math.min(1, delta * 10));
    visualRef.current.sprint = lerp(visualRef.current.sprint, targetRef.current.sprint, Math.min(1, delta * 8));
  });

  const actionAge = player.lastActionAt ? Date.now() - player.lastActionAt : Number.POSITIVE_INFINITY;
  const recentAction = actionAge < 2200 ? player.lastAction : null;
  const isFiring = recentAction === "firing" && actionAge < 180;
  const isReloading = recentAction === "reloading" && actionAge < 1200;
  const isBuilding = recentAction === "building" && actionAge < 1200;
  const isLooting = recentAction === "looting" && actionAge < 1200;
  const isRepairing = recentAction === "repairing" && actionAge < 1200;
  const isHealing = recentAction === "healing" && actionAge < 1200;
  const isRespawning = recentAction === "respawned" && actionAge < 1800;
  const healthRatio = clamp((player.health || 0) / 100, 0, 1);
  const crouchBlend = visualRef.current.crouch;
  const sprintBlend = visualRef.current.sprint;
  const baseColor = player.baseId && player.baseId === localBaseId ? "#6d8597" : "#556476";

  return (
    <group position={[visualRef.current.x, 0, visualRef.current.z]} rotation={[0, visualRef.current.yaw, 0]}>
      <mesh castShadow position={[0, 1.95 - crouchBlend * 0.42, 0]}>
        <coneGeometry args={[0.18, 0.45, 3]} />
        <meshBasicMaterial color={player.deadAt ? "#8a4d44" : "#d7c7a8"} transparent opacity={0.75} />
      </mesh>
      <mesh castShadow position={[0, 1.15 - crouchBlend * 0.2, 0]}>
        <capsuleGeometry args={[0.36, 1.12 - crouchBlend * 0.3, 4, 8]} />
        <meshStandardMaterial color={baseColor} roughness={0.8} emissive={player.deadAt ? "#5f2923" : "#000000"} emissiveIntensity={player.deadAt ? 0.2 : 0} />
      </mesh>
      <mesh castShadow position={[0, 2.02 - crouchBlend * 0.42, 0]}>
        <sphereGeometry args={[0.3, 10, 10]} />
        <meshStandardMaterial color="#bca182" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0.48, 1.28 - crouchBlend * 0.18, -0.24]} rotation={[0.3, 0.2, 0]}>
        <boxGeometry args={[0.12, 0.12, 1.2]} />
        <meshStandardMaterial color="#1d2227" roughness={0.44} metalness={0.24} />
      </mesh>
      {sprintBlend > 0.2 ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.65, 0.86 + sprintBlend * 0.14, 18]} />
          <meshBasicMaterial color="#b7d5e7" transparent opacity={0.18 + sprintBlend * 0.14} />
        </mesh>
      ) : null}
      {isFiring ? (
        <group position={[0.22, 1.22 - crouchBlend * 0.18, 0.72]}>
          <mesh>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color="#ffd59c" transparent opacity={0.85} />
          </mesh>
          <pointLight intensity={0.75} distance={3.6} color="#ffcf98" />
        </group>
      ) : null}
      {isReloading ? (
        <mesh position={[0, 2.55, 0]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshBasicMaterial color="#d8c49b" transparent opacity={0.65} />
        </mesh>
      ) : null}
      {isBuilding || isRepairing ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[0.92, 1.16, 18]} />
          <meshBasicMaterial color={isRepairing ? "#d79c74" : "#8dc5d5"} transparent opacity={0.28} />
        </mesh>
      ) : null}
      {isLooting || isHealing || isRespawning ? (
        <mesh position={[0, 2.46, 0]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial color={isHealing ? "#9fcf93" : isRespawning ? "#d0b4ff" : "#d7c17d"} transparent opacity={0.42} />
        </mesh>
      ) : null}
      <Html position={[0, 2.72, 0]} center distanceFactor={18} style={{ pointerEvents: "none" }}>
        <div className={`${styles.remoteTag} ${player.deadAt ? styles.remoteTagDanger : ""}`}>
          <strong>{player.name}</strong>
          <span>{player.deadAt ? "Down" : healthRatio < 0.45 ? "In danger" : recentAction ? formatActionLabel(recentAction) : player.sprinting ? "Moving" : player.crouching ? "Holding" : "Nearby"}</span>
        </div>
      </Html>
    </group>
  );
};

function BaseCluster({ base, localBase }: { base: any; localBase: boolean }) {
  const underPressure = (base.threat || 0) > 0.54;
  return (
    <group position={[base.x, 0, base.z]}>
      <mesh receiveShadow position={[0, 0.03, 0]}>
        <cylinderGeometry args={[10, 11.6, 0.4, 24]} />
        <meshStandardMaterial color={localBase ? "#4d4135" : "#38312d"} roughness={0.96} />
      </mesh>
      <mesh castShadow position={[0, 2.8, 0]}>
        <boxGeometry args={[9, 5.6, 9]} />
        <meshStandardMaterial color={localBase ? "#736152" : "#5f534b"} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[10.5, 13.8, 24]} />
        <meshBasicMaterial color={underPressure ? "#c77456" : localBase ? "#e2b47e" : "#8f745a"} transparent opacity={underPressure ? 0.18 : localBase ? 0.18 : 0.08} />
      </mesh>
      <Html position={[0, 6.8, 0]} center distanceFactor={28} style={{ pointerEvents: "none" }}>
        <div className={`${styles.baseTag} ${underPressure ? styles.baseTagHot : ""}`}>
          <strong>{base.label}</strong>
          <span>{base.ownerName || "Unknown survivor"}{underPressure ? " · under attack" : " · survivor-built"}</span>
        </div>
      </Html>
      {base.structures?.map((structure: any) => (
        <BaseStructure key={structure.id} base={base} structure={structure} />
      ))}
    </group>
  );
}

function BaseStructure({ base, structure }: { base: any; structure: any }) {
  const style = structureStyle(structure.buildId);
  const integrity = clamp((structure.health || style.size[1]) / (structure.maxHealth || 1), 0, 1);
  const damagePulse = integrity < 0.45 ? 0.5 + (Math.sin(Date.now() / 250) * 0.5 + 0.5) * 0.5 : 0;
  return (
    <group position={[structure.x - base.x, 0, structure.z - base.z]} rotation={[0, structure.rotation || 0, 0]}>
      <mesh castShadow receiveShadow position={[0, style.size[1] / 2, 0]}>
        <boxGeometry args={style.size} />
        <meshStandardMaterial color={style.color} roughness={0.86} metalness={structure.buildId === "turret" ? 0.14 : structure.buildId === "gate" ? 0.08 : 0.02} />
      </mesh>
      {structure.buildId === "gate" ? (
        <mesh castShadow position={[0, style.size[1] * 0.58, 0.42]}>
          <boxGeometry args={[style.size[0] * 0.82, 0.24, 0.12]} />
          <meshStandardMaterial color="#494848" roughness={0.54} metalness={0.3} />
        </mesh>
      ) : null}
      {structure.buildId === "storage" ? (
        <mesh castShadow position={[0, style.size[1] + 0.35, 0]}>
          <boxGeometry args={[1.4, 0.24, 0.8]} />
          <meshStandardMaterial color="#474441" roughness={0.72} />
        </mesh>
      ) : null}
      {structure.buildId === "generator" ? (
        <mesh position={[0, style.size[1] + 0.5, 0]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial color="#f2b26f" transparent opacity={0.5 + Math.sin(Date.now() / 400) * 0.1} />
        </mesh>
      ) : null}
      {integrity < 0.98 ? (
        <mesh position={[0, style.size[1] + 0.18, 0]}>
          <planeGeometry args={[style.size[0] * 0.8, 0.14]} />
          <meshBasicMaterial color={integrity < 0.45 ? "#d46852" : "#d4b46a"} transparent opacity={0.8} />
        </mesh>
      ) : null}
      {integrity < 0.45 ? (
        <mesh position={[0, style.size[1] + 0.5, 0]}>
          <sphereGeometry args={[0.14 + damagePulse * 0.08, 8, 8]} />
          <meshBasicMaterial color="#d56d53" transparent opacity={0.18 + damagePulse * 0.2} />
        </mesh>
      ) : null}
    </group>
  );
}

function ImpactMarker({ impact }: { impact: ImpactFx }) {
  const age = clamp((Date.now() - impact.createdAt) / 420, 0, 1);
  const scale = impact.scale * (0.25 + age * 0.9);
  return (
    <group position={impact.position}>
      <mesh>
        <sphereGeometry args={[scale * 0.32, 8, 8]} />
        <meshBasicMaterial color={impact.color} transparent opacity={0.4 + impact.severity * 0.18 - age * 0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <ringGeometry args={[scale * 0.18, scale * 0.56, 16]} />
        <meshBasicMaterial color={impact.color} transparent opacity={0.22 + impact.severity * 0.16 - age * 0.28} />
      </mesh>
    </group>
  );
}

function CorpseMarker({ corpse }: { corpse: CorpseFx }) {
  const age = clamp((Date.now() - corpse.createdAt) / CORPSE_VISIBLE_MS, 0, 1);
  const driftX = corpse.drift[0] * Math.min(age * 2.8, 1);
  const driftZ = corpse.drift[1] * Math.min(age * 2.8, 1);
  return (
    <group position={[corpse.position[0] + driftX, corpse.position[1], corpse.position[2] + driftZ]} rotation={[corpse.pitch + corpse.slump * age, corpse.rotationY, corpse.roll]} scale={corpse.scale}>
      <mesh castShadow position={[0, corpse.crawler ? 0.22 : 0.38 - age * 0.08, 0]}>
        <capsuleGeometry args={[0.34, corpse.crawler ? 0.46 : 0.9, 4, 8]} />
        <meshStandardMaterial color={corpse.tint} roughness={0.98} transparent opacity={0.42 - age * 0.18} />
      </mesh>
    </group>
  );
}

function MutationBurst({ burst }: { burst: MutationBurstFx }) {
  const age = clamp((Date.now() - burst.createdAt) / 900, 0, 1);
  const scale = 0.5 + age * 1.8;
  return (
    <group position={burst.position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[scale * 0.45, scale * 0.66, 18]} />
        <meshBasicMaterial color={burst.color} transparent opacity={0.34 - age * 0.3} />
      </mesh>
      <mesh>
        <sphereGeometry args={[scale * 0.12, 8, 8]} />
        <meshBasicMaterial color={burst.color} transparent opacity={0.24 - age * 0.2} />
      </mesh>
    </group>
  );
}

function BuildGhost({ preview, buildId, valid }: { preview: { x: number; z: number; valid: boolean }; buildId: BuildId; valid: boolean }) {
  const style = structureStyle(buildId);
  return (
    <group position={[preview.x, 0, preview.z]}>
      <mesh position={[0, style.size[1] / 2, 0]}>
        <boxGeometry args={style.size} />
        <meshStandardMaterial color={valid ? "#8ec0d5" : "#c56a5d"} transparent opacity={0.34} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.3, 1.72, 20]} />
        <meshBasicMaterial color={valid ? "#9ad5ee" : "#d67b6d"} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

function MuzzleFlash({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0.18, -0.02, 0.7]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#ffd59c" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0.14, -0.01, 0.96]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshBasicMaterial color="#b8b1aa" transparent opacity={0.22} />
      </mesh>
      <pointLight intensity={0.9} distance={4.2} color="#ffcf98" />
    </group>
  );
}

function CompactStat({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "health" | "stamina";
}) {
  return (
    <div className={styles.compactStat}>
      <div className={styles.compactStatRow}>
        <span>{label}</span>
        <strong>
          {Math.round(value)} / {Math.round(max)}
        </strong>
      </div>
      <div className={styles.barTrack}>
        <div className={`${styles.barFill} ${styles[tone]}`} style={{ width: `${clamp((value / max) * 100, 0, 100)}%` }} />
      </div>
    </div>
  );
}
