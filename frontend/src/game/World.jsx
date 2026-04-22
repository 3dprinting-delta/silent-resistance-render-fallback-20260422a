// Legacy prototype world view. The active R3F mission scene is EnvironmentScene.tsx.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, PointerLockControls, Sky, Stats } from "@react-three/drei";
import { Vector3 } from "three";
import { checkSuspicion, useSuspicionStore } from "@/game/DisguiseSystem";
import { getRouteById, getZoneByPosition, missionActors, missionBrief, missionTarget, missionZones } from "@/game/missionData";
import { resolveMissionOperation } from "@/lib/worldApi";
import { useMissionStore } from "@/store/missionStore";
import { useWorldStore } from "@/store/worldStore";

const disguises = ["civilian", "vanguard_grunt", "vanguard_technician", "vanguard_officer"];
const blocks = [
  [-32, 7, -38, 15, 14, 15, "#1f1f1f"], [-32, 8, -18, 16, 16, 18, "#1c1c1c"], [-31, 10, 8, 18, 20, 22, "#212121"],
  [-31, 7, 32, 16, 14, 18, "#202020"], [32, 7, -38, 15, 14, 15, "#202020"], [32, 8, -18, 16, 16, 18, "#1e1e1e"],
  [31, 10, 8, 18, 20, 22, "#1b1b1b"], [31, 7, 32, 16, 14, 18, "#232323"], [0, 7, -45, 28, 14, 12, "#181818"],
  [0, 7, 48, 30, 14, 14, "#1c1c1c"],
];
const lamps = [[-14,0,-28],[14,0,-28],[-14,0,-8],[14,0,-8],[-14,0,12],[14,0,12],[-14,0,30],[14,0,30]];
const crates = [[18,.9,25],[20,.9,23],[22,.9,20],[-18,.9,20],[-21,.9,26],[8,.9,30]];
const trucks = [[-5.5,0,4],[7.5,0,18]];
const posters = [[-22,4,-13],[22,4,5],[-22,4,24]];

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function Building({ data }) {
  const [x, y, z, w, h, d, color] = data;
  return (
    <group position={[x, y, z]}>
      <mesh castShadow receiveShadow><boxGeometry args={[w, h, d]} /><meshStandardMaterial color={color} roughness={0.94} /></mesh>
      {[-0.3, 0, 0.3].map((o) => (
        <mesh key={o} position={[0, h * o, d / 2 + 0.03]}>
          <planeGeometry args={[w * 0.72, h * 0.14]} />
          <meshStandardMaterial color="#101010" />
        </mesh>
      ))}
    </group>
  );
}

function StreetLamp({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 2.8, 0]} castShadow><cylinderGeometry args={[0.1, 0.13, 5.6, 10]} /><meshStandardMaterial color="#474747" /></mesh>
      <mesh position={[0.72, 4.9, 0]}><boxGeometry args={[0.2, 0.32, 0.2]} /><meshStandardMaterial color="#702121" emissive="#8f2a2a" emissiveIntensity={1.5} /></mesh>
      <pointLight position={[0.72, 4.72, 0]} intensity={10} distance={22} color="#a63f30" />
    </group>
  );
}

function FenceRun({ position, width, rotationY = 0 }) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 1.2, 0]}><boxGeometry args={[width, 2.4, 0.12]} /><meshStandardMaterial color="#5b5b5b" /></mesh>
      {Array.from({ length: Math.floor(width / 2) + 1 }, (_, i) => (
        <mesh key={i} position={[-width / 2 + i * 2, 1.3, 0]}><boxGeometry args={[0.12, 2.6, 0.18]} /><meshStandardMaterial color="#6e6e6e" /></mesh>
      ))}
    </group>
  );
}

function Truck({ position }) {
  const wheels = [[-1.55,.46,-2.3],[1.55,.46,-2.3],[-1.55,.46,2.6],[1.55,.46,2.6]];
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 1, 0]}><boxGeometry args={[3.8, 2, 7.4]} /><meshStandardMaterial color="#343434" /></mesh>
      <mesh castShadow receiveShadow position={[0, 1.35, -2.5]}><boxGeometry args={[3.9, 2.6, 2.4]} /><meshStandardMaterial color="#2b2b2b" /></mesh>
      {wheels.map((wheel) => (
        <mesh key={wheel.join("-")} castShadow position={wheel} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.5, 0.5, 0.5, 16]} /><meshStandardMaterial color="#111111" /></mesh>
      ))}
    </group>
  );
}

function Searchlights() {
  const left = useRef(null);
  const right = useRef(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (left.current) {
      left.current.target.position.set(Math.sin(t * 0.32) * 12, 0, -8 + Math.cos(t * 0.18) * 16);
      left.current.target.updateMatrixWorld();
    }
    if (right.current) {
      right.current.target.position.set(Math.sin(t * 0.28) * -12, 0, 10 + Math.cos(t * 0.22) * 14);
      right.current.target.updateMatrixWorld();
    }
  });
  const tower = (position, ref) => (
    <group position={position}>
      <mesh castShadow position={[0, 5, 0]}><boxGeometry args={[2.8, 10, 2.8]} /><meshStandardMaterial color="#252525" /></mesh>
      <mesh castShadow position={[0, 10.9, 0]}><boxGeometry args={[4.2, 1.8, 4.2]} /><meshStandardMaterial color="#181818" /></mesh>
      <spotLight ref={ref} position={[0, 10.7, 0]} intensity={26} angle={0.25} penumbra={0.55} distance={56} color="#bd5540" castShadow />
    </group>
  );
  return <>{tower([-17, 0, 9], left)}{tower([17, 0, 9], right)}</>;
}

function ZonePlanes() {
  return missionZones.map((zone) => {
    const width = zone.bounds.maxX - zone.bounds.minX;
    const depth = zone.bounds.maxZ - zone.bounds.minZ;
    const x = (zone.bounds.maxX + zone.bounds.minX) / 2;
    const z = (zone.bounds.maxZ + zone.bounds.minZ) / 2;
    const color = zone.id === "annex_interior" ? "#6c1515" : zone.id === "command_court" ? "#6b2323" : zone.id === "service_alley" ? "#20445a" : "#323232";
    return <mesh key={zone.id} position={[x, 0.03, z]} rotation-x={-Math.PI / 2}><planeGeometry args={[width, depth]} /><meshStandardMaterial color={color} transparent opacity={0.14} /></mesh>;
  });
}

function District() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[210, 210]} /><meshStandardMaterial color="#0d0d0d" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0,.01,0]} receiveShadow><planeGeometry args={[28, 150]} /><meshStandardMaterial color="#171717" roughness={1} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0,.012,-8]} receiveShadow><planeGeometry args={[150, 18]} /><meshStandardMaterial color="#161616" roughness={1} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0,.013,24]} receiveShadow><planeGeometry args={[150, 18]} /><meshStandardMaterial color="#161616" roughness={1} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-22,.02,0]} receiveShadow><planeGeometry args={[14, 150]} /><meshStandardMaterial color="#2a2a2a" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[22,.02,0]} receiveShadow><planeGeometry args={[14, 150]} /><meshStandardMaterial color="#2a2a2a" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0,.02,-20]} receiveShadow><planeGeometry args={[150, 8]} /><meshStandardMaterial color="#2b2b2b" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0,.02,14]} receiveShadow><planeGeometry args={[150, 8]} /><meshStandardMaterial color="#2c2c2c" /></mesh>
      <ZonePlanes />
      {[-30,-15,0,15,30].map((z) => <mesh key={`v-${z}`} rotation-x={-Math.PI / 2} position={[0,.05,z]}><planeGeometry args={[.34, 6]} /><meshStandardMaterial color="#7c7c7c" /></mesh>)}
      {[-24,-6,12,30].map((z) => <mesh key={`h-${z}`} rotation-x={-Math.PI / 2} position={[0,.05,z]}><planeGeometry args={[24, .26]} /><meshStandardMaterial color="#6f6f6f" /></mesh>)}
      <mesh position={[0,2.5,-1.6]} castShadow receiveShadow><boxGeometry args={[13,5,4]} /><meshStandardMaterial color="#242424" /></mesh>
      <mesh position={[0,5.5,-.2]} castShadow><boxGeometry args={[16,1.2,1.8]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
      <mesh position={[0,2.8,-30]} castShadow receiveShadow><boxGeometry args={[14,5.6,14]} /><meshStandardMaterial color="#202020" /></mesh>
      <mesh position={[0,.18,-17]} receiveShadow><boxGeometry args={[16,.35,5]} /><meshStandardMaterial color="#141414" /></mesh>
      <mesh position={[-14,1.8,20]} castShadow receiveShadow><boxGeometry args={[8,3.6,8]} /><meshStandardMaterial color="#222222" /></mesh>
      <mesh position={[18,1.5,23]} castShadow receiveShadow><boxGeometry args={[12,3,10]} /><meshStandardMaterial color="#232323" /></mesh>
      {blocks.map((b) => <Building key={b.join("-")} data={b} />)}
      <FenceRun position={[-11,0,11]} width={12} /><FenceRun position={[11,0,11]} width={12} />
      <FenceRun position={[-32,0,18]} width={24} rotationY={Math.PI / 2} /><FenceRun position={[32,0,18]} width={24} rotationY={Math.PI / 2} />
      {trucks.map((t) => <Truck key={t.join("-")} position={t} />)}
      {crates.map((c) => <mesh key={c.join("-")} position={c} castShadow receiveShadow><boxGeometry args={[1.3,1.3,1.3]} /><meshStandardMaterial color="#474747" /></mesh>)}
      {lamps.map((l) => <StreetLamp key={l.join("-")} position={l} />)}
      {posters.map((p) => <mesh key={p.join("-")} position={p}><planeGeometry args={[2.4,4.6]} /><meshStandardMaterial color="#661414" /></mesh>)}
      <Searchlights />
    </>
  );
}

function CameraRig() {
  const { camera } = useThree();
  const mode = useMissionStore((s) => s.cameraMode);
  const player = useMissionStore((s) => s.playerPosition);
  const direction = useMemo(() => new Vector3(), []);
  useFrame(() => {
    if (mode === "first_person") {
      camera.position.set(player[0], player[1] + 1.15, player[2]);
      return;
    }
    const f = camera.getWorldDirection(direction);
    const len = Math.hypot(f.x, f.z) || 1;
    camera.position.set(player[0] - (f.x / len) * 8, player[1] + 4, player[2] - (f.z / len) * 8);
    camera.lookAt(player[0], player[1] + 1.5, player[2]);
  });
  return null;
}

function PointerLockBridge() {
  const setInputLocked = useMissionStore((s) => s.setInputLocked);
  return <PointerLockControls onLock={() => setInputLocked(true)} onUnlock={() => setInputLocked(false)} />;
}

function MovementDirector({ actorsRef, targetRef }) {
  const { camera } = useThree();
  const setPlayerPosition = useMissionStore((s) => s.setPlayerPosition);
  const setCurrentZoneId = useMissionStore((s) => s.setCurrentZoneId);
  const setPlayerBehavior = useMissionStore((s) => s.setPlayerBehavior);
  const setRouteNote = useMissionStore((s) => s.setRouteNote);
  const addSuspicion = useSuspicionStore((s) => s.addSuspicion);
  const bleedSuspicion = useSuspicionStore((s) => s.bleedSuspicion);
  const keys = useRef({});
  const pos = useRef({ x: 0, y: 1.1, z: 43 });
  const timer = useRef(0);
  const direction = useMemo(() => new Vector3(), []);
  const notes = useMemo(() => ({
    tram_extraction: missionBrief.routeNotes[3], worker_square: missionBrief.routeNotes[0], service_alley: missionBrief.routeNotes[1],
    command_court: missionBrief.routeNotes[2], annex_interior: "The annex interior is the tightest security layer. Officer posture matters more than speed.",
    checkpoint_boulevard: "Checkpoint boulevard is uniform space. Soldier or officer cover draws far less scrutiny here.",
    cargo_yard: "Cargo yard gives you cover pockets, but patrol visibility is longer and harsher.",
  }), []);
  useEffect(() => {
    const down = (e) => { keys.current[e.code] = true; };
    const up = (e) => { keys.current[e.code] = false; };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
  useFrame((_s, delta) => {
    const f = camera.getWorldDirection(direction); f.y = 0;
    const len = Math.hypot(f.x, f.z) || 1; const fx = f.x / len; const fz = f.z / len; const rx = -fz; const rz = fx;
    let mx = 0; let mz = 0;
    if (keys.current.KeyW) { mx += fx; mz += fz; } if (keys.current.KeyS) { mx -= fx; mz -= fz; }
    if (keys.current.KeyA) { mx -= rx; mz -= rz; } if (keys.current.KeyD) { mx += rx; mz += rz; }
    const run = Boolean(keys.current.ShiftLeft || keys.current.ShiftRight); const speed = run ? 8.6 : 4.6; const mlen = Math.hypot(mx, mz);
    if (mlen > 0.001) { pos.current.x += (mx / mlen) * speed * delta; pos.current.z += (mz / mlen) * speed * delta; setPlayerBehavior(run ? "run" : "walk"); }
    else setPlayerBehavior("idle");
    pos.current.x = clamp(pos.current.x, -34, 34); pos.current.z = clamp(pos.current.z, -48, 52);
    const p = [pos.current.x, pos.current.y, pos.current.z];
    setPlayerPosition(p);
    const zone = getZoneByPosition(p); setCurrentZoneId(zone?.id || "worker_square"); if (zone) setRouteNote(notes[zone.id] || missionBrief.routeNotes[0]);
    timer.current += delta; if (timer.current < 0.85) return; timer.current = 0;
    const state = useMissionStore.getState(); const disguise = state.currentDisguise; const action = state.playerBehavior;
    if (!zone) { addSuspicion(6); return; }
    const nearby = Object.values(actorsRef.current).filter((a) => Math.hypot(a.position[0] - pos.current.x, a.position[2] - pos.current.z) < 6);
    const target = targetRef.current?.position ? [{ kind: "officer", position: targetRef.current.position }] : [];
    const witnesses = [...nearby, ...target];
    if (!witnesses.length && zone.clearance.includes(disguise) && action === "idle") { bleedSuspicion(3); return; }
    const total = witnesses.reduce((sum, actor) => {
      const dist = Math.hypot(actor.position[0] - pos.current.x, actor.position[2] - pos.current.z);
      return sum + checkSuspicion(disguise, actor.kind, action, { distance: dist, allowedDisguises: zone.clearance, witnessWeight: zone.witnessWeight, zonePenalty: zone.clearance.includes(disguise) ? 0 : 22 }) / 18;
    }, zone.clearance.includes(disguise) ? 0 : 6);
    addSuspicion(Math.round(total));
  });
  return null;
}

function RouteActor({ actor, actorsRef }) {
  const ref = useRef(null);
  const route = useMemo(() => getRouteById(actor.routeId), [actor.routeId]);
  const state = useRef({ index: actor.startIndex || 0, pause: actor.pauseMs || 0, pos: [...(route[actor.startIndex || 0] || route[0] || [0, 0])] });
  useFrame((_s, delta) => {
    if (!ref.current || route.length < 2) return;
    const cur = state.current;
    if (cur.pause > 0) { cur.pause -= delta * 1000; actorsRef.current[actor.id] = { kind: actor.kind, position: [cur.pos[0], 1, cur.pos[1]] }; return; }
    const next = (cur.index + 1) % route.length; const target = route[next]; const dx = target[0] - cur.pos[0]; const dz = target[1] - cur.pos[1]; const dist = Math.hypot(dx, dz);
    if (dist < 0.24) { cur.index = next; cur.pause = actor.pauseMs || 0; } else { cur.pos[0] += (dx / dist) * actor.speed * delta; cur.pos[1] += (dz / dist) * actor.speed * delta; ref.current.rotation.y = Math.atan2(dx, dz); }
    ref.current.position.set(cur.pos[0], 1, cur.pos[1]); actorsRef.current[actor.id] = { kind: actor.kind, position: [cur.pos[0], 1, cur.pos[1]] };
  });
  return <group ref={ref} position={[state.current.pos[0], 1, state.current.pos[1]]}><mesh castShadow><capsuleGeometry args={[.32,.96,4,8]} /><meshStandardMaterial color={actor.color} /></mesh><mesh position={[0,1.55,0]} castShadow><sphereGeometry args={[.22,14,14]} /><meshStandardMaterial color="#b5aca5" /></mesh></group>;
}

function TargetActor({ targetRef }) {
  const neutralized = useMissionStore((s) => s.targetNeutralized);
  const ref = useRef(null);
  const route = useMemo(() => getRouteById(missionTarget.routeId), []);
  const state = useRef({ index: 0, pause: missionTarget.pauseMs, pos: [...route[0]] });
  useFrame((_s, delta) => {
    if (neutralized || !ref.current || route.length < 2) { if (neutralized) targetRef.current = null; return; }
    const cur = state.current;
    if (cur.pause > 0) { cur.pause -= delta * 1000; targetRef.current = { position: [cur.pos[0], 1, cur.pos[1]], routeIndex: cur.index }; return; }
    const next = (cur.index + 1) % route.length; const target = route[next]; const dx = target[0] - cur.pos[0]; const dz = target[1] - cur.pos[1]; const dist = Math.hypot(dx, dz);
    if (dist < 0.24) { cur.index = next; cur.pause = missionTarget.pauseMs; } else { cur.pos[0] += (dx / dist) * missionTarget.speed * delta; cur.pos[1] += (dz / dist) * missionTarget.speed * delta; ref.current.rotation.y = Math.atan2(dx, dz); }
    ref.current.position.set(cur.pos[0], 1, cur.pos[1]); targetRef.current = { position: [cur.pos[0], 1, cur.pos[1]], routeIndex: cur.index };
  });
  if (neutralized) return null;
  return <group ref={ref} position={[route[0][0], 1, route[0][1]]}><mesh castShadow><capsuleGeometry args={[.35,1,4,8]} /><meshStandardMaterial color="#7b8086" /></mesh><mesh position={[0,1.6,0]} castShadow><sphereGeometry args={[.24,14,14]} /><meshStandardMaterial color="#b6aea7" /></mesh></group>;
}

function PlayerMarker() {
  const position = useMissionStore((s) => s.playerPosition);
  const mode = useMissionStore((s) => s.cameraMode);
  if (mode === "first_person") return null;
  return <group position={position}><mesh castShadow><capsuleGeometry args={[.34,1,4,8]} /><meshStandardMaterial color="#a7a7a7" /></mesh></group>;
}

function MissionBridge({ targetRef }) {
  const markTargetNeutralized = useMissionStore((s) => s.markTargetNeutralized);
  const markMissionCommitted = useMissionStore((s) => s.markMissionCommitted);
  const setRouteNote = useMissionStore((s) => s.setRouteNote);
  const updateWorld = useWorldStore((s) => s.updateWorld);
  const setConnectionState = useWorldStore((s) => s.setConnectionState);
  const addSuspicion = useSuspicionStore((s) => s.addSuspicion);
  const [submitting, setSubmitting] = useState(false);
  const [interaction, setInteraction] = useState({ canNeutralize: false, canExtract: false });
  async function commitMission() {
    try {
      setSubmitting(true); setConnectionState("connecting");
      const world = await resolveMissionOperation({ targetId: missionBrief.targetId, title: "Kronstadt command disruption", summary: "The district command chain fractured after the operation, forcing the regime to harden security and elevate a replacement.", broadcast: "Emergency district radio orders immediate checkpoint escalation after a senior industrial command figure disappears." });
      updateWorld(world); markMissionCommitted(); addSuspicion(8); setConnectionState("connected");
    } catch (_e) { setConnectionState("disconnected"); } finally { setSubmitting(false); }
  }
  useFrame(() => {
    const state = useMissionStore.getState();
    const player = state.playerPosition;
    const disguise = state.currentDisguise;
    const canNeutralize = Boolean(
      targetRef.current &&
      !state.targetNeutralized &&
      missionTarget.vulnerabilityWindow.routeIndices.includes(targetRef.current.routeIndex) &&
      ["vanguard_officer", "vanguard_technician"].includes(disguise) &&
      Math.hypot(targetRef.current.position[0] - player[0], targetRef.current.position[2] - player[2]) <= missionTarget.interactionRadius
    );
    const canExtract = state.targetNeutralized && state.currentZoneId === missionBrief.extractionZoneId && !state.missionCommitted;
    if (canNeutralize !== interaction.canNeutralize || canExtract !== interaction.canExtract) {
      setInteraction({ canNeutralize, canExtract });
    }
  });
  useEffect(() => {
    if (interaction.canNeutralize) setRouteNote(`${missionTarget.label} is isolated enough to strike. ${missionTarget.vulnerabilityWindow.note}`);
    if (interaction.canExtract) setRouteNote("Extraction route is viable. Break contact and transmit the mission outcome from the tram trench.");
  }, [interaction, setRouteNote]);
  useEffect(() => {
    useMissionStore.setState({ interactionState: { canNeutralize: interaction.canNeutralize, canExtract: interaction.canExtract, submitting, neutralize: () => { markTargetNeutralized(); addSuspicion(14); }, extract: commitMission } });
  }, [addSuspicion, interaction, submitting, markTargetNeutralized]);
  return null;
}

function Scene() {
  const actorsRef = useRef({});
  const targetRef = useRef(null);
  return (
    <>
      <color attach="background" args={["#060707"]} />
      <fog attach="fog" args={["#060707", 20, 96]} />
      <Sky distance={450000} sunPosition={[-1.2, 0.45, -1]} inclination={0.53} azimuth={0.18} turbidity={20} />
      <ambientLight intensity={0.5} color="#522121" />
      <directionalLight castShadow position={[-22, 30, 16]} intensity={1.08} color="#ece3d2" shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <spotLight position={[0, 24, 18]} intensity={19} angle={0.28} penumbra={0.72} color="#872020" />
      <District />
      <PointerLockBridge />
      <CameraRig />
      <MovementDirector actorsRef={actorsRef} targetRef={targetRef} />
      {missionActors.map((actor) => <RouteActor key={actor.id} actor={actor} actorsRef={actorsRef} />)}
      <TargetActor targetRef={targetRef} />
      <MissionBridge targetRef={targetRef} />
      <PlayerMarker />
      <Grid args={[210,210]} cellColor="#141414" sectionColor="#2b1010" fadeDistance={120} fadeStrength={2} infiniteGrid />
      <Stats className="world-stats" />
    </>
  );
}

export default function World() {
  const suspicion = useSuspicionStore((s) => s.suspicion);
  const resetSuspicion = useSuspicionStore((s) => s.resetSuspicion);
  const cameraMode = useMissionStore((s) => s.cameraMode);
  const setCameraMode = useMissionStore((s) => s.setCameraMode);
  const disguise = useMissionStore((s) => s.currentDisguise);
  const setDisguise = useMissionStore((s) => s.setCurrentDisguise);
  const zoneId = useMissionStore((s) => s.currentZoneId);
  const missionPhase = useMissionStore((s) => s.missionPhase);
  const routeNote = useMissionStore((s) => s.routeNote);
  const interaction = useMissionStore((s) => s.interactionState);
  const zone = missionZones.find((entry) => entry.id === zoneId);
  return (
    <section className="world-column">
      <div className="panel world-panel">
        <div className="section-title-row">
          <div><p className="eyebrow red-accent">Mission Vertical Slice</p><h2>Large occupied district with hybrid camera, patrol routes, disguise-safe lanes, and live extraction flow</h2></div>
          <span>Click inside scene to lock pointer</span>
        </div>
        <div className="world-frame"><Canvas shadows camera={{ position: [0, 5, 50], fov: 52 }}><Scene /></Canvas></div>
      </div>
      <div className="panel controls-panel">
        <div className="section-title-row"><h3>Mission Runtime</h3><span>Suspicion: {suspicion}%</span></div>
        <div className="mission-status-grid">
          <div className="compact-item"><strong>Operation</strong><span>{missionBrief.title}</span></div>
          <div className="compact-item"><strong>Phase</strong><span>{missionPhase}</span></div>
          <div className="compact-item"><strong>Zone</strong><span>{zone?.label || "Outside route grid"}</span></div>
          <div className="compact-item"><strong>Camera</strong><span>{cameraMode === "third_person" ? "Third-person stealth" : "First-person immersion"}</span></div>
        </div>
        <div className="control-cluster"><label className="control-label" htmlFor="camera-select">Camera mode</label><select id="camera-select" value={cameraMode} onChange={(e) => setCameraMode(e.target.value)}><option value="third_person">third_person</option><option value="first_person">first_person</option></select></div>
        <div className="control-cluster"><label className="control-label" htmlFor="disguise-select">Active disguise</label><select id="disguise-select" value={disguise} onChange={(e) => setDisguise(e.target.value)}>{disguises.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
        <div className="mission-note panel"><p className="eyebrow red-accent">Route note</p><p>{routeNote}</p></div>
        <div className="action-grid">
          <button className="red-accent button-like" type="button" disabled={!interaction?.canNeutralize} onClick={() => interaction?.neutralize?.()}>Neutralize target</button>
          <button className="red-accent button-like" type="button" disabled={!interaction?.canExtract || interaction?.submitting} onClick={() => interaction?.extract?.()}>{interaction?.submitting ? "Committing..." : "Extract and transmit"}</button>
          <button className="button-like" type="button" onClick={resetSuspicion}>Reset suspicion</button>
        </div>
      </div>
    </section>
  );
}
