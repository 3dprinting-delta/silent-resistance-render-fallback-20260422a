// Legacy prototype canvas. The live hotel mission runs through EnvironmentCanvas.tsx.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, PointerLockControls, Sky } from "@react-three/drei";
import { Vector3 } from "three";
import { actors as actorDefs, interactables, missionMeta, routes, zones } from "@/game/data/mission";
import { useSandboxStore } from "@/game/core/store";
import { stepActors } from "@/game/ai/simulation";
import { deriveAlertTier, computeSuspicionDelta } from "@/game/systems/stealth";
import { commitMissionOutcome } from "@/game/systems/worldClient";
import { clamp, distance2D, getZoneAtPosition } from "@/game/utils/math";
import { computeMissionScore } from "@/game/systems/scoring";

const buildingData = [
  [-34, 7, -40, 14, 14, 16, "#1a1a1a"], [-34, 8, -18, 14, 16, 18, "#191919"], [-34, 8, 10, 15, 16, 20, "#1d1d1d"],
  [-34, 7, 34, 15, 14, 18, "#202020"], [34, 7, -40, 14, 14, 16, "#1a1a1a"], [34, 8, -18, 14, 16, 18, "#181818"],
  [34, 8, 10, 15, 16, 20, "#1f1f1f"], [34, 7, 34, 15, 14, 18, "#202020"], [0, 7, -46, 24, 14, 10, "#161616"], [0, 7, 50, 28, 14, 12, "#171717"],
];

function Building({ item }) {
  const [x, y, z, w, h, d, color] = item;
  return (
    <group position={[x, y, z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {[-0.3, 0, 0.3].map((offset) => (
        <mesh key={offset} position={[0, h * offset, d / 2 + 0.03]}>
          <planeGeometry args={[w * 0.7, h * 0.16]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      ))}
    </group>
  );
}

function District() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[220, 220]} /><meshStandardMaterial color="#0a0a0a" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]} receiveShadow><planeGeometry args={[30, 150]} /><meshStandardMaterial color="#161616" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 18]} receiveShadow><planeGeometry args={[160, 26]} /><meshStandardMaterial color="#1f1f1f" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, -12]} receiveShadow><planeGeometry args={[160, 20]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-22, 0.03, 20]} receiveShadow><planeGeometry args={[14, 42]} /><meshStandardMaterial color="#21323a" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[23, 0.03, 20]} receiveShadow><planeGeometry args={[18, 36]} /><meshStandardMaterial color="#2d2a25" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[18, 4.5, 0]} receiveShadow><planeGeometry args={[18, 12]} /><meshStandardMaterial color="#2d2d2d" /></mesh>
      <mesh position={[18, 4.2, 0]} castShadow receiveShadow><boxGeometry args={[18, 0.4, 12]} /><meshStandardMaterial color="#1e1e1e" /></mesh>
      <mesh position={[0, 2.4, -28]} castShadow receiveShadow><boxGeometry args={[14, 4.8, 14]} /><meshStandardMaterial color="#1f1f1f" /></mesh>
      <mesh position={[0, 5.1, -28]} castShadow><boxGeometry args={[10, 0.5, 3]} /><meshStandardMaterial color="#171717" /></mesh>
      <mesh position={[0, 0.2, -16]} receiveShadow><boxGeometry args={[18, 0.3, 5]} /><meshStandardMaterial color="#141414" /></mesh>
      <mesh position={[0, 2.4, -2]} castShadow receiveShadow><boxGeometry args={[12, 4.8, 3.6]} /><meshStandardMaterial color="#232323" /></mesh>
      <mesh position={[-13, 2, 21]} castShadow receiveShadow><boxGeometry args={[8, 3.6, 8]} /><meshStandardMaterial color="#212121" /></mesh>
      <mesh position={[18, 1.5, 23]} castShadow receiveShadow><boxGeometry args={[12, 3, 9]} /><meshStandardMaterial color="#242424" /></mesh>
      {buildingData.map((item) => <Building key={item.join("-")} item={item} />)}
      {[-15, 15].map((x) => <mesh key={x} position={[x, 5, 9]} castShadow><boxGeometry args={[2.4, 10, 2.4]} /><meshStandardMaterial color="#202020" /></mesh>)}
      {[[18, 13], [20, 18], [22, 24], [-20, 16], [-22, 23], [-24, 28]].map((p) => <mesh key={p.join("-")} position={[p[0], 1, p[1]]} castShadow receiveShadow><boxGeometry args={[1.6, 1.6, 1.6]} /><meshStandardMaterial color="#555" /></mesh>)}
      {[-30, -15, 0, 15, 30].map((z) => <mesh key={`road-${z}`} rotation-x={-Math.PI / 2} position={[0, 0.04, z]}><planeGeometry args={[0.35, 6]} /><meshStandardMaterial color="#727272" /></mesh>)}
      {zones.map((zone) => {
        const x = (zone.bounds.minX + zone.bounds.maxX) / 2;
        const z = (zone.bounds.minZ + zone.bounds.maxZ) / 2;
        const w = zone.bounds.maxX - zone.bounds.minX;
        const d = zone.bounds.maxZ - zone.bounds.minZ;
        const color = zone.id === "annex-interior" ? "#6f1616" : zone.id === "checkpoint" ? "#7b2e14" : zone.id === "service-lane" ? "#1b5266" : "#303030";
        return <mesh key={zone.id} position={[x, 0.03, z]} rotation-x={-Math.PI / 2}><planeGeometry args={[w, d]} /><meshStandardMaterial color={color} transparent opacity={0.12} /></mesh>;
      })}
      {interactables.map((item) => (
        <mesh key={item.id} position={item.position} castShadow>
          <boxGeometry args={item.type === "container" ? [2.2, 1.6, 1.8] : [0.8, 0.8, 0.8]} />
          <meshStandardMaterial color={item.type === "disguise" ? "#3d5970" : item.type === "poison" ? "#6d7e8b" : item.type === "sabotage" ? "#8e5a1e" : item.type === "extraction" ? "#5a1f1f" : "#4f4f4f"} />
        </mesh>
      ))}
    </>
  );
}

function CameraRig() {
  const { camera } = useThree();
  const cameraMode = useSandboxStore((state) => state.cameraMode);
  const playerPosition = useSandboxStore((state) => state.playerPosition);
  const dir = useMemo(() => new Vector3(), []);
  useFrame(() => {
    if (cameraMode === "first_person") {
      camera.position.set(playerPosition[0], playerPosition[1] + 1.2, playerPosition[2]);
      return;
    }
    const forward = camera.getWorldDirection(dir);
    const len = Math.hypot(forward.x, forward.z) || 1;
    camera.position.set(playerPosition[0] - (forward.x / len) * 7.5, playerPosition[1] + 4, playerPosition[2] - (forward.z / len) * 7.5);
    camera.lookAt(playerPosition[0], playerPosition[1] + 1.6, playerPosition[2]);
  });
  return null;
}

function ActorMesh({ actor }) {
  if (actor.hidden) return null;
  const color = actor.role === "civilian" ? "#767676" : actor.role === "technician" ? "#4f6470" : actor.role === "officer" ? "#7d8791" : actor.role === "target" ? "#9aa0a6" : "#7b1d1d";
  return (
    <group position={actor.position} rotation-y={actor.facing || 0}>
      <mesh castShadow><capsuleGeometry args={[0.33, 0.96, 4, 8]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 1.52, 0]} castShadow><sphereGeometry args={[0.22, 12, 12]} /><meshStandardMaterial color="#b7ada5" /></mesh>
    </group>
  );
}

function PlayerMesh() {
  const playerPosition = useSandboxStore((state) => state.playerPosition);
  const cameraMode = useSandboxStore((state) => state.cameraMode);
  if (cameraMode === "first_person") return null;
  return <group position={playerPosition}><mesh castShadow><capsuleGeometry args={[0.35, 1, 4, 8]} /><meshStandardMaterial color="#d3d3d3" /></mesh></group>;
}

function Runtime() {
  const { camera } = useThree();
  const setPlayerPosition = useSandboxStore((state) => state.setPlayerPosition);
  const setPlayerBehavior = useSandboxStore((state) => state.setPlayerBehavior);
  const setActiveZoneId = useSandboxStore((state) => state.setActiveZoneId);
  const addSuspicion = useSandboxStore((state) => state.addSuspicion);
  const decaySuspicion = useSandboxStore((state) => state.decaySuspicion);
  const setAlertTier = useSandboxStore((state) => state.setAlertTier);
  const setMissionPhase = useSandboxStore((state) => state.setMissionPhase);
  const setActors = useSandboxStore((state) => state.setActors);
  const setActivePrompt = useSandboxStore((state) => state.setActivePrompt);
  const raiseSearch = useSandboxStore((state) => state.raiseSearch);
  const pushEvent = useSandboxStore((state) => state.pushEvent);
  const actors = useSandboxStore((state) => state.actors);
  const playerPosition = useSandboxStore((state) => state.playerPosition);
  const disguise = useSandboxStore((state) => state.disguise);
  const alertTier = useSandboxStore((state) => state.alertTier);
  const opportunities = useSandboxStore((state) => state.opportunities);
  const bodyFound = useSandboxStore((state) => state.bodyFound);
  const distractionPoint = useSandboxStore((state) => state.distractionPoint);
  const searchOrigin = useSandboxStore((state) => state.searchOrigin);
  const keys = useRef({});
  const suspicionTimer = useRef(0);
  const bodyTimer = useRef(0);
  const trespassTimer = useRef(0);
  const lastAlertTier = useRef(alertTier);
  const trespassWarned = useRef(false);
  const dir = useMemo(() => new Vector3(), []);

  useEffect(() => {
    setMissionPhase("infiltration");
    const down = (event) => { keys.current[event.code] = true; };
    const up = (event) => { keys.current[event.code] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [setMissionPhase]);

  useFrame((_state, delta) => {
    const forward = camera.getWorldDirection(dir);
    forward.y = 0;
    const len = Math.hypot(forward.x, forward.z) || 1;
    const fx = forward.x / len;
    const fz = forward.z / len;
    const rx = -fz;
    const rz = fx;
    let moveX = 0;
    let moveZ = 0;
    if (keys.current.KeyW) { moveX += fx; moveZ += fz; }
    if (keys.current.KeyS) { moveX -= fx; moveZ -= fz; }
    if (keys.current.KeyA) { moveX -= rx; moveZ -= rz; }
    if (keys.current.KeyD) { moveX += rx; moveZ += rz; }

    const magnitude = Math.hypot(moveX, moveZ);
    const running = Boolean(keys.current.ShiftLeft || keys.current.ShiftRight);
    const behavior = running ? "run" : magnitude > 0 ? "walk" : "idle";
    setPlayerBehavior(behavior);

    if (magnitude > 0) {
      const speed = running ? 8.5 : 4.6;
      const nextPosition = [
        clamp(playerPosition[0] + (moveX / magnitude) * speed * delta, -36, 36),
        1,
        clamp(playerPosition[2] + (moveZ / magnitude) * speed * delta, -52, 56),
      ];
      setPlayerPosition(nextPosition);
      const activeZone = getZoneAtPosition(nextPosition, zones);
      setActiveZoneId(activeZone?.id || "worker-square");
    }

    const nextActors = stepActors({
      actors,
      routes,
      delta,
      distractionPoint,
      searchOrigin,
      lockdown: alertTier === "lockdown" || alertTier === "compromised",
      targetPoisoned: opportunities.poisonPrepared,
      transformerSabotaged: opportunities.transformerSabotaged,
    });

    const target = nextActors.find((actor) => actor.id === "target");
    if (target && opportunities.poisonPrepared && !opportunities.targetEliminated && target.nodeIndex === 0) {
      useSandboxStore.getState().eliminateTarget("poison");
      target.hidden = true;
      setActivePrompt("The poisoned routine has taken effect. District command is destabilizing.");
      raiseSearch([target.position[0], target.position[1], target.position[2]]);
    }
    if (target && opportunities.transformerSabotaged && !opportunities.targetEliminated && (target.nodeIndex === 2 || target.nodeIndex === 3)) {
      useSandboxStore.getState().eliminateTarget("environmental");
      target.hidden = true;
      setActivePrompt("The sabotage has cascaded into a lethal equipment failure. Break contact immediately.");
      raiseSearch([target.position[0], target.position[1], target.position[2]]);
    }
    setActors(nextActors);

    if (opportunities.targetEliminated && !bodyFound && opportunities.solution === "social") {
      bodyTimer.current += delta;
      if (bodyTimer.current > 12) {
        useSandboxStore.setState((state) => ({ bodyFound: true, score: { ...state.score, bodiesFound: state.score.bodiesFound + 1 } }));
        raiseSearch([useSandboxStore.getState().playerPosition[0], 1, useSandboxStore.getState().playerPosition[2]]);
      }
    }

    suspicionTimer.current += delta;
    if (suspicionTimer.current >= 0.85) {
      suspicionTimer.current = 0;
      const zone = getZoneAtPosition(useSandboxStore.getState().playerPosition, zones);
      const illegalZone = Boolean(zone && !zone.clearance.includes(disguise));
      if (illegalZone) {
        trespassTimer.current += 0.85;
      } else {
        trespassTimer.current = 0;
        trespassWarned.current = false;
      }
      const total = nextActors.reduce((sum, actor) => {
        if (actor.role === "target" && actor.hidden) return sum;
        return sum + computeSuspicionDelta({
          actor,
          playerPosition: useSandboxStore.getState().playerPosition,
          disguise,
          zone,
          behavior: useSandboxStore.getState().playerBehavior,
          bodySeen: bodyFound,
          sabotageSeen: opportunities.transformerSabotaged && actor.role === "technician",
        }) / 20;
      }, 0);
      const trespassPenalty = illegalZone ? Math.min(22, Math.round(trespassTimer.current * 3.5)) : 0;
      if (total <= 2 && useSandboxStore.getState().playerBehavior === "idle" && !illegalZone) decaySuspicion(3);
      else addSuspicion(Math.round(total + trespassPenalty));
      const tier = deriveAlertTier(useSandboxStore.getState().suspicion);
      setAlertTier(tier);
      if (illegalZone && trespassTimer.current > 2.5 && !trespassWarned.current) {
        trespassWarned.current = true;
        setActivePrompt(`You are trespassing in ${zone?.label}. Your disguise no longer matches the social pattern here.`);
        pushEvent(`Trespass pressure rising inside ${zone?.label}. Lingering here will force a coordinated response.`, "warning");
      }
      if (tier === "investigating" || tier === "compromised" || tier === "lockdown") {
        raiseSearch([useSandboxStore.getState().playerPosition[0], 1, useSandboxStore.getState().playerPosition[2]]);
        if (tier === "compromised" || tier === "lockdown") {
          useSandboxStore.setState((state) => ({ score: { ...state.score, witnessedActions: state.score.witnessedActions + 1 } }));
        }
      }
      if (tier !== lastAlertTier.current) {
        const severity = tier === "lockdown" || tier === "compromised" ? "critical" : tier === "investigating" || tier === "suspicious" ? "warning" : "info";
        pushEvent(`District alert shifted from ${lastAlertTier.current} to ${tier}.`, severity);
        lastAlertTier.current = tier;
      }
    }
  });

  return (
    <>
      <color attach="background" args={["#050505"]} />
      <fog attach="fog" args={["#050505", 18, 100]} />
      <Sky distance={450000} sunPosition={[-1.1, 0.45, -1]} inclination={0.53} azimuth={0.18} turbidity={18} />
      <ambientLight intensity={0.45} color="#532020" />
      <directionalLight castShadow position={[-22, 30, 14]} intensity={1.1} color="#e9dfcf" shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <spotLight position={[0, 24, 18]} intensity={16} angle={0.28} penumbra={0.72} color="#8d2020" />
      <District />
      <PointerLockControls />
      <CameraRig />
      {actors.map((actor) => <ActorMesh key={actor.id} actor={actor} />)}
      <PlayerMesh />
      <Grid args={[220, 220]} cellColor="#151515" sectionColor="#2c1010" fadeDistance={130} fadeStrength={2} infiniteGrid />
    </>
  );
}

export default function MissionCanvas() {
  const world = useSandboxStore((state) => state.world);
  const activeZoneId = useSandboxStore((state) => state.activeZoneId);
  const disguise = useSandboxStore((state) => state.disguise);
  const inventory = useSandboxStore((state) => state.inventory);
  const actors = useSandboxStore((state) => state.actors);
  const opportunities = useSandboxStore((state) => state.opportunities);
  const missionPhase = useSandboxStore((state) => state.missionPhase);
  const setDisguise = useSandboxStore((state) => state.setDisguise);
  const setActivePrompt = useSandboxStore((state) => state.setActivePrompt);
  const raiseSearch = useSandboxStore((state) => state.raiseSearch);
  const hideEvidence = useSandboxStore((state) => state.hideEvidence);
  const pushEvent = useSandboxStore((state) => state.pushEvent);
  const useCoin = useSandboxStore((state) => state.useCoin);
  const setConnectionState = useSandboxStore((state) => state.setConnectionState);
  const setWorld = useSandboxStore((state) => state.setWorld);
  const sabotageTransformer = useSandboxStore((state) => state.sabotageTransformer);
  const preparePoison = useSandboxStore((state) => state.preparePoison);
  const playerPosition = useSandboxStore((state) => state.playerPosition);
  const [submitting, setSubmitting] = useState(false);

  const nearbyInteractables = interactables.filter((item) => distance2D(item.position, playerPosition) < 3.4);
  const closestInteractable = nearbyInteractables[0] || null;
  const target = actors.find((actor) => actor.id === "target");
  const nearTarget = target && !target.hidden && distance2D(target.position, playerPosition) < 2.8;
  const activeZone = zones.find((zone) => zone.id === activeZoneId);
  const canTakeWorker = closestInteractable?.type === "disguise" && closestInteractable?.disguise === "worker";
  const canTakeTech = closestInteractable?.type === "disguise" && closestInteractable?.disguise === "technician";
  const canTakeGrunt = closestInteractable?.type === "disguise" && closestInteractable?.disguise === "grunts";
  const canTakeOfficer = closestInteractable?.type === "disguise" && closestInteractable?.disguise === "officer";
  const canSocial = Boolean(nearTarget && (disguise === "officer" || disguise === "technician") && (activeZoneId === "annex-court" || activeZoneId === "annex-interior") && !opportunities.targetEliminated);
  const canPreparePoison = closestInteractable?.type === "poison" && activeZoneId === "annex-interior" && !opportunities.poisonPrepared && inventory.poison;
  const canSabotage = closestInteractable?.type === "sabotage" && !opportunities.transformerSabotaged && inventory.wrench;
  const canHideEvidence = closestInteractable?.type === "container" && (useSandboxStore.getState().bodyFound || opportunities.targetEliminated);
  const canExtract = closestInteractable?.type === "extraction" && opportunities.targetEliminated && activeZoneId === missionMeta.extractionZoneId && missionPhase !== "complete";

  function runContextAction() {
    if (canExtract && !submitting) {
      void extractMission();
      return;
    }
    if (canSocial && target) {
      useSandboxStore.getState().eliminateTarget("social");
      useSandboxStore.setState({ activePrompt: "The close-approach route succeeded. Get clear before the escort ring collapses inward." });
      pushEvent("Close-contact elimination executed inside the command ring. Escorts are converging on the last known disturbance.", "critical");
      raiseSearch([target.position[0], target.position[1], target.position[2]]);
      return;
    }
    if (canPreparePoison) {
      preparePoison();
      return;
    }
    if (canSabotage) {
      sabotageTransformer();
      return;
    }
    if (canHideEvidence) {
      hideEvidence();
      return;
    }
    if (closestInteractable?.type === "disguise") {
      const nextDisguise = closestInteractable.disguise;
      if (nextDisguise) {
        setDisguise(nextDisguise);
        setActivePrompt(`${closestInteractable.label} acquired. Blend with the local movement pattern before pushing deeper.`);
        pushEvent(`Disguise changed to ${nextDisguise}. Nearby witness expectations have shifted.`, "info");
      }
    }
  }

  useEffect(() => {
    if (closestInteractable) setActivePrompt(closestInteractable.prompt);
  }, [closestInteractable, setActivePrompt]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.repeat) return;
      if (event.code === "KeyE") {
        runContextAction();
      }
      if (event.code === "KeyQ" && inventory.coins > 0) {
        useCoin([playerPosition[0] + 4, 1, playerPosition[2] - 4]);
        pushEvent("A coin distraction was thrown to peel nearby staff off their routine.", "info");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closestInteractable, canExtract, canHideEvidence, canPreparePoison, canSabotage, canSocial, inventory.coins, playerPosition, pushEvent]);

  async function extractMission() {
    try {
      setSubmitting(true);
      setConnectionState("connecting");
      const snapshot = await commitMissionOutcome({
        targetId: missionMeta.targetId,
        title: "Kronstadt annex command collapse",
        summary: "District command fractured after the operation, forcing emergency succession and a new security dragnet.",
        broadcast: "Emergency district transmissions report severe command disruption after a senior industrial official disappears.",
      });
      setWorld(snapshot);
      pushEvent("Mission outcome transmitted to the shared world state. Regional command is now reconfiguring.", "critical");
      const result = computeMissionScore(useSandboxStore.getState().score, opportunities.solution);
      useSandboxStore.setState((state) => ({
        world: snapshot,
        connectionState: "connected",
        missionPhase: "complete",
        score: { ...state.score, finishTime: Date.now(), score: result.score, rating: result.rating },
        activePrompt: `Extraction complete. Final rating: ${result.rating}.`,
      }));
    } catch {
      setConnectionState("disconnected");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative h-full min-h-[720px]">
      <Canvas shadows camera={{ position: [0, 5, 52], fov: 54 }}>
        <Runtime />
      </Canvas>

      <div className="absolute left-4 top-4 z-20 flex max-w-md flex-col gap-3">
        <div className="panel-surface rounded-3xl px-4 py-3 text-xs uppercase tracking-[0.28em] text-neutral-300">
          Live zone: {activeZone?.label || "Transit"} | Shared time: {world?.gameTime || "syncing"}
        </div>

        {(activeZoneId === "service-lane" || activeZoneId === "roof-overpass" || activeZoneId === "tram-exit") ? (
          <div className="panel-surface rounded-3xl px-4 py-3 text-xs uppercase tracking-[0.24em] text-neutral-300">
            Hidden route pressure: service and roof paths reduce witnesses but can funnel searchers if compromised.
          </div>
        ) : null}

        <div className="panel-surface space-y-3 rounded-3xl p-4">
          <div className="text-xs uppercase tracking-[0.25em] text-red-500">Disguise pickups</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button disabled={!canTakeWorker} className="rounded-2xl border border-neutral-800 bg-black/50 px-4 py-3 text-left text-sm text-neutral-100 disabled:text-neutral-500" onClick={runContextAction}>Worker cover</button>
            <button disabled={!canTakeTech} className="rounded-2xl border border-neutral-800 bg-black/50 px-4 py-3 text-left text-sm text-neutral-100 disabled:text-neutral-500" onClick={runContextAction}>Technician cover</button>
            <button disabled={!canTakeGrunt} className="rounded-2xl border border-neutral-800 bg-black/50 px-4 py-3 text-left text-sm text-neutral-100 disabled:text-neutral-500" onClick={runContextAction}>Grunt cover</button>
            <button disabled={!canTakeOfficer} className="rounded-2xl border border-neutral-800 bg-black/50 px-4 py-3 text-left text-sm text-neutral-100 disabled:text-neutral-500" onClick={runContextAction}>Officer cover</button>
          </div>
        </div>

        <div className="panel-surface space-y-3 rounded-3xl p-4">
          <div className="text-xs uppercase tracking-[0.25em] text-red-500">Context actions</div>
          <div className="grid gap-2">
            <button disabled={!canSocial} className="rounded-2xl border border-neutral-800 bg-black/50 px-4 py-3 text-left text-sm text-neutral-100 disabled:text-neutral-500" onClick={runContextAction}>Social stealth elimination</button>
            <button disabled={!canPreparePoison} className="rounded-2xl border border-neutral-800 bg-black/50 px-4 py-3 text-left text-sm text-neutral-100 disabled:text-neutral-500" onClick={runContextAction}>Poison annex tea service</button>
            <button disabled={!canSabotage} className="rounded-2xl border border-neutral-800 bg-black/50 px-4 py-3 text-left text-sm text-neutral-100 disabled:text-neutral-500" onClick={runContextAction}>Sabotage transformer overload</button>
            <button disabled={!canHideEvidence} className="rounded-2xl border border-neutral-800 bg-black/50 px-4 py-3 text-left text-sm text-neutral-100 disabled:text-neutral-500" onClick={runContextAction}>Hide evidence in container</button>
            <button disabled={!canExtract || submitting} className="rounded-2xl border border-neutral-800 bg-black/50 px-4 py-3 text-left text-sm text-neutral-100 disabled:text-neutral-500" onClick={extractMission}>{submitting ? "Transmitting outcome..." : "Extract and commit mission"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
