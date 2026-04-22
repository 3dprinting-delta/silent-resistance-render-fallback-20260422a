"use client";

import { useEffect, useRef } from "react";
import { PLAYER_ID, arrowTuning } from "@/game/ragdollArchers/core/constants";
import { buildProgressionEffects } from "@/game/ragdollArchers/core/progression";
import { useRagdollArchersStore } from "@/game/ragdollArchers/core/store";
import type { ActorSnapshot, ActiveTreatment, ArrowSnapshot, InjuryRecord, MatchResult, MedicalSupplyId, SupplyStack } from "@/game/ragdollArchers/core/types";
import { applyConsumableEffect, applyTreatmentStage, buildDeathReport, buildMedicalSummary, computeDerivedVitals, consumeSupply, createDefaultVitals, createInjuryFromHit, getTreatmentAction, getTreatmentStatus, supplyCatalog, tickInjuryProgression, tickVitals } from "@/game/ragdollArchers/systems/survival";

type PointName = "head" | "chest" | "pelvis" | "handFront" | "handBack" | "footFront" | "footBack";
type RagdollPoint = { x: number; y: number; px: number; py: number; r: number };
type RagdollBody = {
  id: string; name: string; color: string; isPlayer: boolean; facing: 1 | -1; health: number; maxHealth: number; stability: number; alive: boolean; drawCharge: number; fireCooldown: number; moveIntent: number; jumpQueued: boolean; aimX: number; aimY: number; vitals: ReturnType<typeof createDefaultVitals>; injuries: InjuryRecord[]; ammo: Record<"standard" | "heavy" | "explosive" | "light", number>; points: Record<PointName, RagdollPoint>;
};
type Arrow = { id: string; ownerId: string; type: "standard" | "heavy" | "explosive" | "light"; x: number; y: number; vx: number; vy: number; life: number };
type Pickup = { id: string; kind: "coins" | "supply" | "food" | "relic"; amount: number; itemId?: MedicalSupplyId; x: number; y: number; bob: number };

const WORLD = { width: 1280, height: 720, floorY: 610, gravity: 1500 };
const CONSTRAINTS: Array<[PointName, PointName, number]> = [["head", "chest", 54], ["chest", "pelvis", 60], ["chest", "handFront", 68], ["chest", "handBack", 58], ["pelvis", "footFront", 72], ["pelvis", "footBack", 72], ["handFront", "handBack", 74], ["footFront", "footBack", 56]];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const makePoint = (x: number, y: number, r: number): RagdollPoint => ({ x, y, px: x, py: y, r });
const pointVelocity = (p: RagdollPoint) => ({ x: p.x - p.px, y: p.y - p.py });
const addImpulse = (p: RagdollPoint, x: number, y: number) => { p.px -= x; p.py -= y; };
const applyConstraint = (a: RagdollPoint, b: RagdollPoint, length: number) => { const dx = b.x - a.x; const dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1; const diff = (d - length) / d; const ox = dx * 0.5 * diff; const oy = dy * 0.5 * diff; a.x += ox; a.y += oy; b.x -= ox; b.y -= oy; };
const limbFromPoint = (name: PointName) => name === "head" ? "head" : name === "handFront" || name === "handBack" ? "upperArmRight" : name === "footFront" || name === "footBack" ? "upperLegLeft" : "torso";
const createAmmo = (bonus: number) => ({ standard: 12 + bonus, heavy: 5 + Math.ceil(bonus / 2), explosive: 2 + Math.floor(bonus / 4), light: 10 + bonus });
function bodyCenter(body: RagdollBody) { return body.points.pelvis; }
function drawSupplyPickup(context: CanvasRenderingContext2D, pickup: Pickup, x: number, y: number) {
  const item = pickup.itemId ? supplyCatalog[pickup.itemId] : null;
  context.save();
  context.translate(x, y);

  if (!item) {
    context.fillStyle = pickup.kind === "coins" ? "#f0bf52" : "#7ec4ce";
    context.beginPath();
    context.arc(0, 0, pickup.kind === "coins" ? 12 : 14, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  if (item.visualKey === "enchanted-golden-apple") {
    context.fillStyle = "rgba(202, 84, 255, 0.28)";
    context.fillRect(-14, -14, 28, 28);
    context.fillStyle = "#7d3bb0";
    context.fillRect(-2, -12, 4, 6);
    context.fillStyle = "#5fc26d";
    context.fillRect(2, -13, 5, 4);
    context.fillStyle = "#8c4d13";
    context.fillRect(-10, -4, 20, 16);
    context.fillStyle = "#f0c247";
    context.fillRect(-8, -6, 16, 16);
    context.fillStyle = "#f9e382";
    context.fillRect(-4, -2, 6, 6);
    context.fillStyle = "#d55cff";
    context.fillRect(3, -5, 4, 4);
    context.fillRect(-7, 5, 4, 4);
  } else if (item.visualKey === "undying-totem") {
    context.fillStyle = "rgba(131, 216, 129, 0.2)";
    context.fillRect(-15, -15, 30, 30);
    context.fillStyle = "#5c6f41";
    context.fillRect(-8, -10, 16, 20);
    context.fillStyle = "#d6cb8f";
    context.fillRect(-6, -12, 12, 8);
    context.fillStyle = "#2f3a21";
    context.fillRect(-4, -9, 3, 2);
    context.fillRect(1, -9, 3, 2);
    context.fillStyle = "#8ec16f";
    context.fillRect(-10, -2, 4, 10);
    context.fillRect(6, -2, 4, 10);
    context.fillRect(-3, 8, 6, 5);
  } else {
    context.fillStyle = item.accentColor;
    context.fillRect(-12, -12, 24, 24);
    context.fillStyle = "#0f141b";
    context.font = "700 9px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(item.shortLabel.slice(0, 2).toUpperCase(), 0, 1);
  }

  context.restore();
}

function createBody(id: string, name: string, x: number, facing: 1 | -1, color: string, maxHealth: number, ammoBonus: number, isPlayer: boolean): RagdollBody {
  const py = WORLD.floorY - 50;
  return { id, name, color, isPlayer, facing, health: maxHealth, maxHealth, stability: 100, alive: true, drawCharge: 0, fireCooldown: 0, moveIntent: 0, jumpQueued: false, aimX: x + facing * 180, aimY: WORLD.floorY - 180, vitals: createDefaultVitals(), injuries: [], ammo: createAmmo(ammoBonus), points: { head: makePoint(x, py - 108, 18), chest: makePoint(x, py - 58, 16), pelvis: makePoint(x, py, 18), handFront: makePoint(x + facing * 46, py - 44, 11), handBack: makePoint(x - facing * 34, py - 42, 11), footFront: makePoint(x + facing * 22, WORLD.floorY, 12), footBack: makePoint(x - facing * 22, WORLD.floorY, 12) } };
}

function bodyToSnapshot(body: RagdollBody): ActorSnapshot {
  const center = bodyCenter(body); const velocity = pointVelocity(body.points.pelvis);
  return { id: body.id, name: body.name, team: body.isPlayer ? "player" : "enemy", isPlayer: body.isPlayer, alive: body.alive, knockedOut: !body.alive, health: body.health, stability: body.stability, balanceState: body.stability < 16 ? "fallen" : body.stability < 52 ? "unstable" : "stable", drawCharge: body.drawCharge, vitals: { ...body.vitals }, injuries: JSON.parse(JSON.stringify(body.injuries)), position: [center.x / 80, (WORLD.floorY - center.y) / 80, 0], velocity: [velocity.x / 80, -velocity.y / 80, 0], aimYaw: Math.atan2(body.aimY - center.y, body.aimX - center.x), aimPitch: 0, ammo: { ...body.ammo }, limbs: { head: { hp: 20, disabled: false }, torso: { hp: 55, disabled: false }, pelvis: { hp: 50, disabled: false }, upperArmLeft: { hp: 22, disabled: false }, lowerArmLeft: { hp: 18, disabled: false }, upperArmRight: { hp: 22, disabled: false }, lowerArmRight: { hp: 18, disabled: false }, upperLegLeft: { hp: 28, disabled: false }, lowerLegLeft: { hp: 24, disabled: false }, upperLegRight: { hp: 28, disabled: false }, lowerLegRight: { hp: 24, disabled: false } } };
}

export function Duel2DMatch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const startedAtRef = useRef(0);
  const waveRef = useRef(1);
  const scoreRef = useRef(0);
  const killsRef = useRef(0);
  const nextWaveAtRef = useRef<number | null>(null);
  const playerRef = useRef<RagdollBody | null>(null);
  const enemiesRef = useRef<RagdollBody[]>([]);
  const arrowsRef = useRef<Arrow[]>([]);
  const pickupsRef = useRef<Pickup[]>([]);
  const treatmentRef = useRef<ActiveTreatment | null>(null);
  const finishedRef = useRef(false);
  const pointerRef = useRef({ x: 920, y: 320, inside: false });
  const keysRef = useRef({ left: false, right: false, jump: false, drawHeld: false });

  const activeArrowType = useRagdollArchersStore((state) => state.activeArrowType);
  const progression = useRagdollArchersStore((state) => state.progression);
  const realismMode = useRagdollArchersStore((state) => state.realismMode);
  const supplies = useRagdollArchersStore((state) => state.supplies);
  const pendingSelfAction = useRagdollArchersStore((state) => state.pendingSelfAction);
  const clearSelfAction = useRagdollArchersStore((state) => state.clearSelfAction);
  const setActors = useRagdollArchersStore((state) => state.setActors);
  const setArrows = useRagdollArchersStore((state) => state.setArrows);
  const setMatchSnapshot = useRagdollArchersStore((state) => state.setMatchSnapshot);
  const setTreatmentStatus = useRagdollArchersStore((state) => state.setTreatmentStatus);
  const setSupplies = useRagdollArchersStore((state) => state.setSupplies);
  const setDerivedVitals = useRagdollArchersStore((state) => state.setDerivedVitals);
  const setActiveTreatment = useRagdollArchersStore((state) => state.setActiveTreatment);
  const clearActiveTreatment = useRagdollArchersStore((state) => state.clearActiveTreatment);
  const setDeathReport = useRagdollArchersStore((state) => state.setDeathReport);
  const setMedicalSummary = useRagdollArchersStore((state) => state.setMedicalSummary);
  const completeMatch = useRagdollArchersStore((state) => state.completeMatch);
  const pushMedicalEvent = useRagdollArchersStore((state) => state.pushMedicalEvent);
  const pushToast = useRagdollArchersStore((state) => state.pushToast);
  const awardProgression = useRagdollArchersStore((state) => state.awardProgression);
  const supplyBagRef = useRef<SupplyStack[]>(supplies);

  useEffect(() => { supplyBagRef.current = supplies; }, [supplies]);

  const spawnWaveRef = useRef((wave: number) => {});

  useEffect(() => {
    const effects = buildProgressionEffects(progression);
    spawnWaveRef.current = (wave: number) => {
      if (!playerRef.current) {
        playerRef.current = createBody(PLAYER_ID, "Field Archer", 260, 1, "#f0c38d", effects.maxHealth, effects.ammoBonus, true);
        playerRef.current.vitals.stamina = effects.maxStamina;
        playerRef.current.vitals.energy = effects.maxStamina;
      }
      const enemyCount = Math.min(3, 1 + Math.floor((wave - 1) / 2));
      enemiesRef.current = Array.from({ length: enemyCount }, (_, index) => createBody(`enemy-${wave}-${index}`, enemyCount === 1 ? "Raider" : `Raider ${index + 1}`, 900 + index * 120, -1, index % 2 === 0 ? "#a0b7cb" : "#d98e6a", 72 + wave * 8, Math.floor(wave / 3), false));
      arrowsRef.current = [];
      pickupsRef.current = [];
      waveRef.current = wave;
      nextWaveAtRef.current = null;
      pushToast({ title: wave === 1 ? "Classic mode live" : `Wave ${wave}`, body: wave === 1 ? "Floppy bodies, short rounds, and fast retries." : `${enemyCount} ragdoll archer${enemyCount > 1 ? "s" : ""} entered.`, tone: "neutral" });
    };
    playerRef.current = createBody(PLAYER_ID, "Field Archer", 260, 1, "#f0c38d", effects.maxHealth, effects.ammoBonus, true);
    playerRef.current.vitals.stamina = effects.maxStamina;
    playerRef.current.vitals.energy = effects.maxStamina;
    finishedRef.current = false;
    waveRef.current = 1; scoreRef.current = 0; killsRef.current = 0; startedAtRef.current = 0; lastRef.current = 0;
    spawnWaveRef.current(1);
    setMatchSnapshot({ activeMode: "duel", wave: 1, kills: 0, score: 0, remainingEnemies: enemiesRef.current.length, wind: [0.15, 0, 0] });
  }, [progression, pushToast, setMatchSnapshot]);

  useEffect(() => {
    const kd = (event: KeyboardEvent) => { if (event.code === "KeyA") keysRef.current.left = true; if (event.code === "KeyD") keysRef.current.right = true; if (event.code === "Space") keysRef.current.jump = true; };
    const ku = (event: KeyboardEvent) => { if (event.code === "KeyA") keysRef.current.left = false; if (event.code === "KeyD") keysRef.current.right = false; if (event.code === "Space") keysRef.current.jump = false; };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const getPoint = (event: PointerEvent) => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) }; };
    const pm = (event: PointerEvent) => { const p = getPoint(event); pointerRef.current = { ...p, inside: true }; };
    const pd = (event: PointerEvent) => { const p = getPoint(event); pointerRef.current = { ...p, inside: true }; keysRef.current.drawHeld = true; };
    const pu = () => { keysRef.current.drawHeld = false; };
    const pl = () => { pointerRef.current.inside = false; };
    canvas.addEventListener("pointermove", pm); canvas.addEventListener("pointerdown", pd); canvas.addEventListener("pointerleave", pl); window.addEventListener("pointerup", pu);
    return () => { canvas.removeEventListener("pointermove", pm); canvas.removeEventListener("pointerdown", pd); canvas.removeEventListener("pointerleave", pl); window.removeEventListener("pointerup", pu); };
  }, []);

  useEffect(() => {
    const effects = buildProgressionEffects(progression);
    const pushArrow = (body: RagdollBody, type: Arrow["type"], power: number, aimX: number, aimY: number) => {
      const origin = body.points.handFront; const dx = aimX - origin.x; const dy = aimY - origin.y; const distance = Math.hypot(dx, dy) || 1; const speed = arrowTuning[type].speed * 8.4 * power;
      arrowsRef.current.push({ id: `arrow-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ownerId: body.id, type, x: origin.x, y: origin.y, vx: (dx / distance) * speed, vy: (dy / distance) * speed, life: 0 });
    };
    const finishMatch = (result: MatchResult, player: RagdollBody, killer: string) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const survivedMs = Math.max(1, performance.now() - startedAtRef.current);
      const report = buildDeathReport({ injuries: player.injuries, vitals: player.vitals, derivedVitals: computeDerivedVitals(player.vitals, player.injuries), killer, weapon: "War Bow", survivedMs, medicalEvents: [] });
      setMedicalSummary(buildMedicalSummary({ injuries: player.injuries, medicalEvents: [], survivedMs, causeOfDeath: result.success ? null : report.causeOfDeath }));
      if (!result.success) setDeathReport(report);
      completeMatch(result);
    };
    const handleDeath = (body: RagdollBody, killer: string) => {
      if (!body.alive) return;
      body.alive = false;
      if (body.isPlayer) {
        finishMatch({ title: "Run over", body: "The ragdoll finally folded under pressure.", success: false, kills: killsRef.current, score: scoreRef.current }, body, killer);
        return;
      }
      killsRef.current += 1;
      scoreRef.current += 180 + waveRef.current * 55;
      const center = bodyCenter(body); const roll = Math.random();
      pickupsRef.current.push(
        roll < 0.32
          ? { id: `pickup-${body.id}`, kind: "coins", amount: 20 + waveRef.current * 6, x: center.x, y: WORLD.floorY - 14, bob: Math.random() * Math.PI }
          : roll < 0.62
            ? { id: `pickup-${body.id}`, kind: "food", amount: 1, itemId: Math.random() > 0.5 ? "pizza" : "coffee", x: center.x, y: WORLD.floorY - 14, bob: Math.random() * Math.PI }
            : roll < 0.88
              ? { id: `pickup-${body.id}`, kind: "supply", amount: 1, itemId: Math.random() > 0.5 ? "bandage" : "gauze", x: center.x, y: WORLD.floorY - 14, bob: Math.random() * Math.PI }
              : { id: `pickup-${body.id}`, kind: "relic", amount: 1, itemId: Math.random() > 0.5 ? "enchanted-golden-apple" : "undying-totem", x: center.x, y: WORLD.floorY - 14, bob: Math.random() * Math.PI },
      );
    };
    const updateBody = (body: RagdollBody, dt: number) => {
      if (!body.alive) return;
      body.fireCooldown = Math.max(0, body.fireCooldown - dt);
      body.moveIntent = body.isPlayer ? (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0) : body.moveIntent;
      body.jumpQueued = body.isPlayer ? keysRef.current.jump : body.jumpQueued;
      const pelvis = body.points.pelvis; const chest = body.points.chest; const feet = [body.points.footFront, body.points.footBack];
      const moveSpeed = 420 * (1 - Math.min(0.6, body.injuries.reduce((sum, injury) => sum + injury.mobilityPenalty, 0)));
      const targetX = clamp(pelvis.x + body.moveIntent * moveSpeed * dt, 80, WORLD.width - 80);
      addImpulse(pelvis, (targetX - pelvis.x) * 0.16, 0); addImpulse(chest, (targetX - chest.x) * 0.14, 0);
      if (body.jumpQueued && feet.every((foot) => foot.y >= WORLD.floorY - 1.5)) [pelvis, chest, ...feet].forEach((point) => addImpulse(point, 0, -12));
      body.jumpQueued = false;

      if (body.isPlayer) {
        body.aimX = pointerRef.current.x; body.aimY = pointerRef.current.y;
        if (keysRef.current.drawHeld) body.drawCharge = Math.min(1, body.drawCharge + dt * 1.65 * effects.drawSpeed);
        else if (body.drawCharge > 0.14 && body.fireCooldown <= 0 && body.ammo[activeArrowType] > 0) {
          pushArrow(body, activeArrowType, 0.42 + body.drawCharge * 0.9, body.aimX, body.aimY);
          body.fireCooldown = 0.45; body.ammo[activeArrowType] -= 1; body.drawCharge = 0;
        } else if (!keysRef.current.drawHeld) body.drawCharge = 0;
      } else {
        const player = playerRef.current; if (!player?.alive) return;
        const playerCenter = bodyCenter(player); body.facing = playerCenter.x > pelvis.x ? 1 : -1;
        body.moveIntent = Math.abs(playerCenter.x - pelvis.x) > 340 ? body.facing : Math.abs(playerCenter.x - pelvis.x) < 220 ? -body.facing : 0;
        body.aimX = player.points.chest.x + (Math.random() - 0.5) * 18; body.aimY = player.points.chest.y + (Math.random() - 0.5) * 22;
        body.drawCharge = Math.min(1, body.drawCharge + dt * (0.8 + waveRef.current * 0.05));
        if (body.fireCooldown <= 0 && body.drawCharge > 0.65 && body.ammo.standard > 0) {
          pushArrow(body, "standard", 0.52 + body.drawCharge * 0.45, body.aimX, body.aimY);
          body.fireCooldown = Math.max(0.5, 1.3 - waveRef.current * 0.05); body.ammo.standard -= 1; body.drawCharge = 0;
        }
      }

      const shoulderX = chest.x + body.facing * 18; const shoulderY = chest.y - 4; const aimDx = body.aimX - shoulderX; const aimDy = body.aimY - shoulderY; const aimDistance = Math.hypot(aimDx, aimDy) || 1; const aimNX = aimDx / aimDistance; const aimNY = aimDy / aimDistance; const drawOffset = body.isPlayer ? body.drawCharge * 48 : body.drawCharge * 30;
      addImpulse(body.points.handFront, ((shoulderX + aimNX * (44 - drawOffset * 0.22)) - body.points.handFront.x) * 0.28, ((shoulderY + aimNY * (44 - drawOffset * 0.22)) - body.points.handFront.y) * 0.28);
      addImpulse(body.points.handBack, ((shoulderX - aimNX * (12 + drawOffset)) - body.points.handBack.x) * 0.2, ((shoulderY - aimNY * (8 + drawOffset * 0.25)) - body.points.handBack.y) * 0.2);

      (Object.values(body.points) as RagdollPoint[]).forEach((point) => { const vx = (point.x - point.px) * 0.985; const vy = (point.y - point.py) * 0.985; point.px = point.x; point.py = point.y; point.x += vx; point.y += vy + WORLD.gravity * dt * dt; });
      for (let iteration = 0; iteration < 6; iteration += 1) {
        CONSTRAINTS.forEach(([a, b, length]) => applyConstraint(body.points[a], body.points[b], length));
        (Object.values(body.points) as RagdollPoint[]).forEach((point) => { point.x = clamp(point.x, 30, WORLD.width - 30); if (point.y > WORLD.floorY) point.y = WORLD.floorY; });
      }

      const torsoTilt = Math.abs(body.points.chest.x - body.points.pelvis.x);
      body.stability = clamp(100 - torsoTilt * 1.5 - Math.abs(pointVelocity(body.points.pelvis).x) * 0.6 - body.injuries.reduce((sum, injury) => sum + injury.aimPenalty * 40, 0), 0, 100);
      tickVitals(body.vitals, body.injuries, dt * effects.recoveryRate, Math.abs(pointVelocity(body.points.pelvis).x) > 2);
      tickInjuryProgression(body.vitals, body.injuries, dt, { elapsedMs: Math.max(1, performance.now() - startedAtRef.current), sprinting: Math.abs(pointVelocity(body.points.pelvis).x) > 10, balanceState: body.stability < 16 ? "fallen" : body.stability < 50 ? "unstable" : "stable" });
      body.health = clamp(body.health - body.injuries.reduce((sum, injury) => sum + injury.bleedingRate * (injury.treated ? 0.01 : 0.03), 0) * dt, 0, body.maxHealth);
      if (body.health <= 0 || body.vitals.bloodLevel <= 0 || body.vitals.oxygen <= 0 || body.vitals.unconscious) handleDeath(body, body.isPlayer ? "Arena collapse" : "Field Archer");
    };
    const nearestHit = (body: RagdollBody, x: number, y: number): { name: PointName; distance: number } | null => {
      let best: { name: PointName; distance: number } | null = null;
      (Object.keys(body.points) as PointName[]).forEach((name) => { const p = body.points[name]; const d = Math.hypot(p.x - x, p.y - y); if (!best || d < best.distance) best = { name, distance: d }; });
      return best;
    };
    const collectPickups = (player: RagdollBody) => {
      const center = bodyCenter(player);
      pickupsRef.current = pickupsRef.current.filter((pickup) => {
        pickup.bob += 0.05;
        if (Math.abs(pickup.x - center.x) > 42) return true;
        if (pickup.kind === "coins") awardProgression({ coins: pickup.amount });
        else if (pickup.itemId) {
          supplyBagRef.current = supplyBagRef.current.some((stack) => stack.id === pickup.itemId) ? supplyBagRef.current.map((stack) => stack.id === pickup.itemId ? { ...stack, quantity: stack.quantity + pickup.amount } : stack) : [...supplyBagRef.current, { id: pickup.itemId, label: supplyCatalog[pickup.itemId].label, quantity: pickup.amount }];
          setSupplies(supplyBagRef.current);
        }
        return false;
      });
    };
    const drawBody = (context: CanvasRenderingContext2D, body: RagdollBody) => {
      const p = body.points; context.strokeStyle = body.alive ? body.color : "#8f6b66"; context.lineWidth = 8; context.lineCap = "round"; context.beginPath();
      context.moveTo(p.head.x, p.head.y); context.lineTo(p.chest.x, p.chest.y); context.lineTo(p.pelvis.x, p.pelvis.y);
      context.moveTo(p.chest.x, p.chest.y); context.lineTo(p.handFront.x, p.handFront.y);
      context.moveTo(p.chest.x, p.chest.y); context.lineTo(p.handBack.x, p.handBack.y);
      context.moveTo(p.pelvis.x, p.pelvis.y); context.lineTo(p.footFront.x, p.footFront.y);
      context.moveTo(p.pelvis.x, p.pelvis.y); context.lineTo(p.footBack.x, p.footBack.y);
      context.stroke();
      context.fillStyle = body.alive ? "#f3e2c8" : "#d16d64"; context.beginPath(); context.arc(p.head.x, p.head.y, p.head.r, 0, Math.PI * 2); context.fill();
      context.strokeStyle = "#cc9f58"; context.lineWidth = 5; context.beginPath(); context.moveTo(p.handBack.x, p.handBack.y); context.lineTo(p.handFront.x, p.handFront.y); context.stroke();
      if (body.isPlayer) { context.fillStyle = "rgba(255,255,255,0.14)"; context.fillRect(p.chest.x - 44, p.head.y - 48, 88, 8); context.fillStyle = "#f2a94d"; context.fillRect(p.chest.x - 44, p.head.y - 48, 88 * body.drawCharge, 8); }
    };
    const step = (now: number) => {
      if (!startedAtRef.current) startedAtRef.current = now;
      if (!lastRef.current) lastRef.current = now;
      const dt = Math.min(0.022, (now - lastRef.current) / 1000); lastRef.current = now;
      const canvas = canvasRef.current; const context = canvas?.getContext("2d"); const player = playerRef.current;
      if (!canvas || !context || !player) { frameRef.current = requestAnimationFrame(step); return; }

      if (!finishedRef.current && pendingSelfAction) {
        if (pendingSelfAction.type === "consume") {
          const stack = supplyBagRef.current.find((entry) => entry.id === pendingSelfAction.target);
          if (stack?.quantity) {
            supplyBagRef.current = consumeSupply(supplyBagRef.current, pendingSelfAction.target as MedicalSupplyId, 1);
            if (pendingSelfAction.target === "undying-totem") { player.health = clamp(player.health + 22, 0, player.maxHealth); player.vitals.bloodLevel = clamp(player.vitals.bloodLevel + 16, 0, 100); player.vitals.shock = clamp(player.vitals.shock - 18, 0, 100); }
            else applyConsumableEffect(player.vitals, pendingSelfAction.target as MedicalSupplyId);
            setSupplies(supplyBagRef.current);
          }
        } else {
          const injury = player.injuries.find((entry) => entry.id === pendingSelfAction.target);
          if (injury && !treatmentRef.current) {
            const status = getTreatmentStatus(player.injuries.filter((entry) => !entry.treated), supplyBagRef.current);
            if (status.canTreatNow) { treatmentRef.current = { ...getTreatmentAction(injury, supplyBagRef.current), state: "applying", startedAt: now, progress: 0 }; setActiveTreatment(treatmentRef.current); }
            else pushToast({ title: "Need treatment kit", body: "You do not have the full combination of supplies for that injury.", tone: "warn" });
          }
        }
        clearSelfAction();
      }

      if (treatmentRef.current) {
        const pelvisVelocity = pointVelocity(player.points.pelvis);
        const playerTooUnstable = Math.abs(pelvisVelocity.x) > 5 || Math.abs(pelvisVelocity.y) > 3 || player.stability < 18;
        if (playerTooUnstable) {
          pushToast({ title: "Treatment interrupted", body: "Hold still long enough to stabilize the injury.", tone: "warn" });
          treatmentRef.current = null;
          clearActiveTreatment();
        }
      }

      if (treatmentRef.current) {
        treatmentRef.current = { ...treatmentRef.current, progress: clamp((now - treatmentRef.current.startedAt) / treatmentRef.current.durationMs, 0, 1) };
        setActiveTreatment(treatmentRef.current);
        if (treatmentRef.current.progress >= 1) {
          const injury = player.injuries.find((entry) => entry.id === treatmentRef.current?.injuryId);
          if (injury) {
            const stageResult = applyTreatmentStage(injury, treatmentRef.current.stage);
            treatmentRef.current.requiredSupplies.forEach((requirement) => { supplyBagRef.current = consumeSupply(supplyBagRef.current, requirement.supplyId, requirement.quantity); });
            setSupplies(supplyBagRef.current);
            pushMedicalEvent({ timestampMs: Date.now(), type: "treatment_completed", source: PLAYER_ID, target: PLAYER_ID, bodyPart: injury.bodyRegion, severity: injury.severity, result: `${injury.treatmentStage} completed`, details: { message: stageResult.unresolvedRisk ? "Stabilized, but more care is still required." : "Treatment cycle completed." } });
            pushToast({ title: injury.treated ? "Treatment complete" : injury.treatmentStage === "recovering" ? "Recovery stage reached" : "Injury stabilized", body: injury.treated ? "The injury is now treated." : "The body is still vulnerable and needs more care.", tone: injury.treated ? "success" : "neutral" });
          }
          treatmentRef.current = null; clearActiveTreatment();
        }
      }

      updateBody(player, dt); enemiesRef.current.forEach((enemy) => updateBody(enemy, dt)); collectPickups(player);
      arrowsRef.current = arrowsRef.current.filter((arrow) => {
        arrow.life += dt; arrow.x += arrow.vx * dt; arrow.y += arrow.vy * dt; arrow.vy += WORLD.gravity * dt * 0.35; arrow.vx *= 0.998;
        if (arrow.y > WORLD.floorY + 30 || arrow.x < -30 || arrow.x > WORLD.width + 30 || arrow.life > 4.8) return false;
        const targets: RagdollBody[] = arrow.ownerId === PLAYER_ID ? enemiesRef.current.filter((enemy) => enemy.alive) : player.alive ? [player] : [];
        for (const target of targets) {
          const hit = nearestHit(target, arrow.x, arrow.y);
          if (!hit || hit.distance > 22) continue;
          const point = target.points[hit.name]; addImpulse(point, arrow.vx * 0.02, arrow.vy * 0.02);
          const injury = createInjuryFromHit({ actorId: target.id, limb: limbFromPoint(hit.name), arrowType: arrow.type, force: arrowTuning[arrow.type].impulse + Math.abs(arrow.vx) * 0.08, impactAngle: Math.atan2(arrow.vy, arrow.vx), penetrationDepth: clamp(0.22 + Math.abs(arrow.vx) / 420, 0, 1) });
          target.injuries.push(injury); target.health = clamp(target.health - (hit.name === "head" ? 48 : arrowTuning[arrow.type].damage * 0.42), 0, target.maxHealth); target.stability = clamp(target.stability - arrowTuning[arrow.type].impulse * 1.3, 0, 100);
          pushMedicalEvent({ timestampMs: Date.now(), type: "injury_added", source: arrow.ownerId, target: target.id, bodyPart: injury.bodyRegion, severity: injury.severity, result: `${target.name} hit`, details: { message: `${injury.severity} ${injury.category.replaceAll("-", " ")} to the ${injury.bodyRegion}.` } });
          if (arrow.ownerId === PLAYER_ID) scoreRef.current += hit.name === "head" ? 120 : 65;
          if (target.health <= 0) handleDeath(target, arrow.ownerId === PLAYER_ID ? "Field Archer" : "Raider");
          return false;
        }
        return true;
      });

      const liveEnemies = enemiesRef.current.filter((enemy) => enemy.alive);
      if (!finishedRef.current && liveEnemies.length === 0) {
        if (!nextWaveAtRef.current) { awardProgression({ coins: 35 + waveRef.current * 12, upgradePoints: 1, bestWave: waveRef.current, highestScore: scoreRef.current }); nextWaveAtRef.current = now + 1200; pushToast({ title: "Wave cleared", body: "Upgrade point awarded. Keep the loop moving.", tone: "success" }); }
        else if (now >= nextWaveAtRef.current) spawnWaveRef.current(waveRef.current + 1);
      }

      const derivedVitals = computeDerivedVitals(player.vitals, player.injuries);
      setDerivedVitals(PLAYER_ID, derivedVitals);
      setTreatmentStatus(getTreatmentStatus(player.injuries.filter((entry) => !entry.treated), supplyBagRef.current));
      setMatchSnapshot({ activeMode: "duel", wave: waveRef.current, kills: killsRef.current, score: scoreRef.current, remainingEnemies: liveEnemies.length, wind: [0.15 + waveRef.current * 0.03, 0, 0] });
      setActors({ [PLAYER_ID]: bodyToSnapshot(player), ...Object.fromEntries(enemiesRef.current.map((enemy) => [enemy.id, bodyToSnapshot(enemy)])) });
      setArrows(arrowsRef.current.map<ArrowSnapshot>((arrow) => ({ id: arrow.id, ownerId: arrow.ownerId, type: arrow.type, active: true, position: [arrow.x / 80, (WORLD.floorY - arrow.y) / 80, 0], velocity: [arrow.vx / 80, -arrow.vy / 80, 0], life: arrow.life })));

      const sky = context.createLinearGradient(0, 0, 0, canvas.height); sky.addColorStop(0, "#20344b"); sky.addColorStop(0.62, "#38545d"); sky.addColorStop(1, "#181a1d"); context.fillStyle = sky; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = "#32412d"; context.fillRect(0, WORLD.floorY, canvas.width, canvas.height - WORLD.floorY); context.fillStyle = "#54675c"; context.fillRect(0, WORLD.floorY - 8, canvas.width, 8);
      drawBody(context, player); enemiesRef.current.forEach((enemy) => drawBody(context, enemy));
      context.fillStyle = "#f7d9a0";
      arrowsRef.current.forEach((arrow) => { context.save(); context.translate(arrow.x, arrow.y); context.rotate(Math.atan2(arrow.vy, arrow.vx)); context.fillRect(-16, -2, 32, 4); context.beginPath(); context.moveTo(17, 0); context.lineTo(10, -5); context.lineTo(10, 5); context.closePath(); context.fill(); context.restore(); });
      pickupsRef.current.forEach((pickup) => {
        const y = pickup.y + Math.sin(pickup.bob) * 5;
        drawSupplyPickup(context, pickup, pickup.x, y);
      });
      context.fillStyle = "rgba(7, 12, 18, 0.65)"; context.fillRect(24, 22, 420, 82); context.fillStyle = "#f4efe5"; context.font = "700 22px Georgia, serif"; context.fillText("Classic 2D Ragdoll Mode", 42, 52); context.font = "15px Georgia, serif"; context.fillText("A / D move, Space jump, hold mouse to draw, release to fire", 42, 77); context.fillText("Floppy bodies, obvious pickups, quick retries, upgrade-driven waves", 42, 98);
      if (!finishedRef.current && !player.alive) finishMatch({ title: "Run over", body: "The ragdoll finally folded under pressure.", success: false, kills: killsRef.current, score: scoreRef.current }, player, "Arena collapse");
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [activeArrowType, awardProgression, clearActiveTreatment, clearSelfAction, completeMatch, pendingSelfAction, progression, pushMedicalEvent, pushToast, realismMode, setActiveTreatment, setActors, setArrows, setDeathReport, setDerivedVitals, setMatchSnapshot, setMedicalSummary, setSupplies, setTreatmentStatus]);

  return <canvas ref={canvasRef} className="h-full w-full" width={WORLD.width} height={WORLD.height} />;
}
