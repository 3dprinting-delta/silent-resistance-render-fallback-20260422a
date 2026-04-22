import type {
  AccessState,
  DisguiseDefinition,
  DominantRiskSource,
  PhaseOneBounds,
  PhaseOneZone,
  PlayerPosture,
  SuspicionBreakdown,
  Vec3,
  WatcherDefinition,
  WatcherExposureState,
} from "@/game/core/types";
import { distance2D } from "@/game/utils/math";

function normalizeAngle(value: number) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function intersectsBounds(bounds: PhaseOneBounds, a: Vec3, b: Vec3) {
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const x = a[0] + (b[0] - a[0]) * t;
    const z = a[2] + (b[2] - a[2]) * t;
    if (x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ) {
      return true;
    }
  }
  return false;
}

function watcherFacing(watcher: WatcherDefinition, elapsedSeconds: number) {
  if (watcher.kind !== "searchlight") return watcher.facing;
  return watcher.facing + Math.sin(elapsedSeconds * (watcher.sweepSpeed || 1)) * (watcher.sweepAmplitude || 0.6);
}

function behaviorPenalty(params: {
  posture: PlayerPosture;
  behavior: "idle" | "walk" | "run";
  zone: PhaseOneZone | null;
  sabotageRecent: boolean;
  carryingBody: boolean;
  accessState: AccessState;
  zoneFit: "native" | "acceptable" | "mismatched";
}) {
  let penalty = 0;
  const scrutiny = params.zone?.scrutinyLevel || 1;
  if (params.behavior === "run") penalty += (params.zone?.publicBehaviorProfile === "command" || params.zone?.publicBehaviorProfile === "checkpoint" || scrutiny >= 4) ? 14 : 6;
  if (params.posture === "crouch" && params.zone?.publicComposureRules?.includes("no_crouch_public")) penalty += 10;
  if (params.carryingBody || params.posture === "dragging") penalty += 26;
  if (params.sabotageRecent) penalty += 20;
  if (params.accessState === "soft_restricted" && params.behavior === "idle") penalty += 4;
  if (params.zoneFit === "mismatched") penalty += 5;
  if (params.zone?.publicComposureRules?.includes("no_loiter") && params.behavior === "idle") penalty += 4;
  return penalty;
}

export function evaluateDetection(params: {
  playerPosition: Vec3;
  zone: PhaseOneZone | null;
  disguise: DisguiseDefinition;
  posture: PlayerPosture;
  behavior: "idle" | "walk" | "run";
  watchers: WatcherDefinition[];
  blockers: PhaseOneBounds[];
  elapsedSeconds: number;
  trespassExposure: number;
  sabotageRecent: boolean;
  carryingBody: boolean;
  accessState: AccessState;
  zoneFit: "native" | "acceptable" | "mismatched";
  previousExposure: Record<string, WatcherExposureState>;
  coverInstabilityUntil: number | null;
}) {
  let dominantWatcherId: string | null = null;
  let bestTotal = 0;
  const activeWatcherIds: string[] = [];
  let los = 0;
  let distancePressure = 0;
  let behavior = 0;
  let enforcer = 0;
  const watcherExposure: Record<string, WatcherExposureState> = {};

  const zoneWeight = (params.zone?.witnessWeight || 1) * (params.zone?.stealthModifier ? 1 / Math.max(0.55, params.zone.stealthModifier) : 1);
  const zone = params.accessState === "legal" ? 0 : params.accessState === "soft_restricted" ? Math.min(20, params.trespassExposure * 0.32) : Math.min(28, params.trespassExposure * 0.52);

  for (const watcher of params.watchers) {
    if (params.zone && watcher.zoneIds.length > 0 && !watcher.zoneIds.includes(params.zone.id)) continue;
    const distance = distance2D(params.playerPosition, watcher.position);
    if (distance > watcher.range) {
      const existing = params.previousExposure[watcher.id];
      watcherExposure[watcher.id] = {
        watcherId: watcher.id,
        observation: Math.max(0, (existing?.observation || 0) - 8),
        visible: false,
        lastSeenAt: existing?.lastSeenAt || null,
      };
      continue;
    }

    const facing = watcherFacing(watcher, params.elapsedSeconds);
    const dx = params.playerPosition[0] - watcher.position[0];
    const dz = params.playerPosition[2] - watcher.position[2];
    const toPlayer = Math.atan2(dx, dz);
    const angleDelta = Math.abs(normalizeAngle(toPlayer - facing));
    const withinCone = angleDelta <= watcher.fov / 2 || distance <= 2.4;
    const occluded = params.blockers.some((blocker) => intersectsBounds(blocker, watcher.position, params.playerPosition));
    const visible = withinCone && (watcher.kind === "checkpoint" || !occluded);
    const previous = params.previousExposure[watcher.id];
    const observation = visible
      ? Math.min(100, (previous?.observation || 0) + watcher.awarenessRate * (distance <= watcher.range * 0.45 ? 1.4 : 1))
      : Math.max(0, (previous?.observation || 0) - 9);

    watcherExposure[watcher.id] = {
      watcherId: watcher.id,
      observation,
      visible,
      lastSeenAt: visible ? Date.now() : previous?.lastSeenAt || null,
    };

    const remembered = !visible && previous?.lastSeenAt && watcher.memorySeconds ? Date.now() - previous.lastSeenAt < watcher.memorySeconds * 1000 : false;
    if (!visible && !remembered) continue;

    activeWatcherIds.push(watcher.id);
    const localDistance = Math.max(0, (watcher.range - distance) / watcher.range) * watcher.awarenessRate * (watcher.witnessWeight || 1);
    const localLos = visible ? (angleDelta <= watcher.fov / 2 ? watcher.awarenessRate : watcher.awarenessRate * 0.45) * zoneWeight : 0;
    const localBehavior = behaviorPenalty({
      posture: params.posture,
      behavior: params.behavior,
      zone: params.zone,
      sabotageRecent: params.sabotageRecent,
      carryingBody: params.carryingBody,
      accessState: params.accessState,
      zoneFit: params.zoneFit,
    }) * params.disguise.scrutinyMultiplier;

    const tierGap = Math.max(0, (watcher.enforcementTier || 0) - params.disguise.accessTier);
    const instability = params.coverInstabilityUntil && Date.now() < params.coverInstabilityUntil ? 8 : 0;
    const localEnforcer =
      watcher.enforcer
        ? Math.max(0, ((watcher.awarenessRate * 0.75) + tierGap * 4 + instability) * params.disguise.enforcerPenalty * params.disguise.enforcerRisk)
        : 0;

    const observationPressure = observation * 0.14;
    const total = localDistance + localLos + localBehavior + localEnforcer + observationPressure;
    if (total > bestTotal) {
      bestTotal = total;
      dominantWatcherId = watcher.id;
    }

    distancePressure += localDistance + observationPressure;
    los += localLos;
    behavior += localBehavior;
    enforcer += localEnforcer;
  }

  const breakdown: SuspicionBreakdown = {
    totalDelta: Math.round(distancePressure + los + zone + behavior + enforcer),
    distance: Math.round(distancePressure),
    los: Math.round(los),
    zone: Math.round(zone),
    behavior: Math.round(behavior),
    enforcer: Math.round(enforcer),
    recentCrime: 0,
    dominantWatcherId,
  };

  const dominantRiskSource: DominantRiskSource =
    breakdown.enforcer > Math.max(breakdown.zone, breakdown.behavior, breakdown.distance + breakdown.los)
      ? "enforcer"
      : breakdown.zone > Math.max(breakdown.behavior, breakdown.distance + breakdown.los)
        ? "trespass"
        : breakdown.behavior > breakdown.distance + breakdown.los
          ? "behavior"
          : breakdown.distance + breakdown.los > 0
            ? "exposure"
            : "none";

  return { breakdown, activeWatcherIds, watcherExposure, dominantRiskSource };
}
