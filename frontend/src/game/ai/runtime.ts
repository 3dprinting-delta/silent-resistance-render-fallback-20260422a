import type {
  AccessState,
  AiActorDefinition,
  AiActorRuntime,
  AiMemoryEvent,
  AiState,
  BodyguardFormation,
  DangerZone,
  GuardResponseRole,
  IncidentCategory,
  IncidentRecord,
  MissionProgressState,
  MissionVariantConfig,
  PatrolRoute,
  SearchAssignment,
  StimulusEvent,
  Vec3,
} from "@/game/core/types";
import { foundationShell } from "@/game/data/foundationShell";
import { clamp, distance2D } from "@/game/utils/math";

const ROUTE_MAP = Object.fromEntries([...foundationShell.aiRoutes, ...foundationShell.searchNodes].map((route) => [route.id, route]));
const ROUTINE_MAP = Object.fromEntries(foundationShell.aiRoutines.map((routine) => [routine.id, routine]));
const REACTION_POST_MAP = Object.fromEntries(foundationShell.reactionPosts.map((post) => [post.id, post]));
const SAFE_POST_MAP = Object.fromEntries(foundationShell.safeRetreatPosts.map((post) => [post.id, post]));
const CLUSTER_BY_ZONE = Object.fromEntries(foundationShell.zoneClusters.flatMap((cluster) => cluster.zoneIds.map((zoneId) => [zoneId, cluster.id])));
const CLUSTER_MAP = Object.fromEntries(foundationShell.zoneClusters.map((cluster) => [cluster.id, cluster]));
const GUARD_GROUPS = Object.fromEntries(foundationShell.guardRouteGroups.map((group) => [group.zoneClusterId, group]));

function getRoute(routeId: string | null | undefined) {
  return routeId ? ROUTE_MAP[routeId] || null : null;
}

function getPoint(route: PatrolRoute | null, index: number, fallback: Vec3): Vec3 {
  return route?.points[index] || fallback;
}

function clusterIdForZone(zoneId?: string | null) {
  return (zoneId && CLUSTER_BY_ZONE[zoneId]) || "public-north";
}

function categoryForStimulus(type: StimulusEvent["type"]): IncidentCategory {
  if (type === "body_found" || type === "unconscious_found") return "body";
  if (type === "sabotage") return "sabotage";
  if (type === "trespass") return "trespass";
  if (type === "sighting" || type === "report") return "crime";
  return "sound";
}

function zoneDistancePenalty(a: string, b: string) {
  return a === b ? 0 : 7;
}

function createRuntimeActor(actor: AiActorDefinition, variant?: MissionVariantConfig | null): AiActorRuntime {
  const routine = actor.routineId ? ROUTINE_MAP[actor.routineId] : null;
  const initialRouteId = actor.defaultRouteId || routine?.stops[0]?.routeId || actor.fallbackRouteId || null;
  const initialRoute = getRoute(initialRouteId);
  const securityBias = variant?.securityTier === "lockdown" ? 1.18 : variant?.securityTier === "hardened" ? 1.08 : 1;
  const targetLabel = actor.role === "target" && variant?.targetProfile?.label ? variant.targetProfile.label : actor.label;
  return {
    ...actor,
    label: targetLabel,
    position: getPoint(initialRoute, 0, actor.spawnPosition),
    facing: 0,
    state: actor.role === "guard" ? "patrol" : actor.role === "bodyguard" || actor.role === "target" ? "escort" : "routine",
    currentRouteId: initialRouteId,
    routeIndex: 0,
    pauseRemaining: initialRoute?.pauseSeconds || 0,
    routineIndex: 0,
    routineElapsed: 0,
    patrolSpeed: actor.patrolSpeed * securityBias,
    alertSpeed: actor.alertSpeed * securityBias,
    perception: {
      ...actor.perception,
      sightRange: actor.perception.sightRange * securityBias,
      hearingRange: actor.perception.hearingRange * securityBias,
      trespassSensitivity: actor.perception.trespassSensitivity * securityBias,
    },
    alertLevel: variant?.securityTier === "lockdown" ? 0.6 : variant?.securityTier === "hardened" ? 0.2 : 0,
    awareness: 0,
    investigateTarget: null,
    searchTarget: null,
    lastStimulusId: null,
    lastKnownPlayerPosition: null,
    challengedAt: null,
    returningToRoute: false,
    hidden: false,
    memory: [],
    currentIncidentId: null,
    responseRole: "none",
    dangerAvoidanceTarget: null,
    inspectRemaining: 0,
    formation: "loose",
  };
}

export function createInitialAiActors(variant?: MissionVariantConfig | null) {
  return foundationShell.aiActors.map((actor) => createRuntimeActor(actor, variant));
}

function moveToward(actor: AiActorRuntime, target: Vec3, delta: number, speed: number) {
  const dx = target[0] - actor.position[0];
  const dz = target[2] - actor.position[2];
  const dist = Math.hypot(dx, dz);
  if (dist < 0.12) {
    return { actor: { ...actor, position: [target[0], target[1], target[2]] as Vec3, facing: actor.facing }, arrived: true };
  }
  const step = Math.min(dist, speed * delta);
  return {
    actor: {
      ...actor,
      position: [actor.position[0] + (dx / dist) * step, target[1], actor.position[2] + (dz / dist) * step] as Vec3,
      facing: Math.atan2(dx, dz),
    },
    arrived: dist - step <= 0.12,
  };
}

function nextRouteIndex(route: PatrolRoute, currentIndex: number) {
  if (route.loop) return (currentIndex + 1) % route.points.length;
  return Math.min(route.points.length - 1, currentIndex + 1);
}

function getRoutineStop(actor: AiActorRuntime) {
  const routine = actor.routineId ? ROUTINE_MAP[actor.routineId] : null;
  return routine?.stops[actor.routineIndex] || null;
}

function updateRouteLoop(actor: AiActorRuntime, delta: number, routeId: string, speed: number, state: AiState) {
  const route = getRoute(routeId);
  if (!route) return actor;
  let next: AiActorRuntime = { ...actor, currentRouteId: routeId, state };
  const targetPoint = route.points[next.routeIndex] || route.points[0];
  if (next.pauseRemaining > 0) {
    next.pauseRemaining = Math.max(0, next.pauseRemaining - delta);
    return next;
  }
  const moved = moveToward(next, targetPoint, delta, speed);
  next = moved.actor;
  if (moved.arrived) {
    next.routeIndex = nextRouteIndex(route, next.routeIndex);
    next.pauseRemaining = route.pauseSeconds || 0;
  }
  return next;
}

function findClosestRouteId(position: Vec3, routeIds: string[]) {
  let bestId = routeIds[0] || null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const routeId of routeIds) {
    const route = getRoute(routeId);
    if (!route?.points.length) continue;
    const distance = Math.min(...route.points.map((point) => distance2D(position, point)));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = routeId;
    }
  }
  return bestId;
}

function getSearchRouteId(actor: AiActorRuntime, incident: IncidentRecord | null, responseRole: GuardResponseRole) {
  const zoneClusterId = incident?.zoneClusterId || actor.zoneClusterId || "public-north";
  const routeGroup = GUARD_GROUPS[zoneClusterId];
  const ids =
    responseRole === "lead"
      ? routeGroup?.leadRouteIds
      : responseRole === "support"
        ? routeGroup?.supportRouteIds
        : responseRole === "perimeter"
          ? routeGroup?.perimeterRouteIds
          : actor.searchRouteIds;
  return findClosestRouteId(incident?.position || actor.position, ids?.length ? ids : foundationShell.searchNodes.map((route) => route.id)) || null;
}

function getReportRouteId(actor: AiActorRuntime, position?: Vec3 | null) {
  const reportRoutes = foundationShell.aiRoutes.filter((route) => route.id.startsWith("report-")).map((route) => route.id);
  return findClosestRouteId(position || actor.position, reportRoutes) || null;
}

function getFallbackTarget(actor: AiActorRuntime): Vec3 {
  const safePost = actor.safePostId ? SAFE_POST_MAP[actor.safePostId] : null;
  if (safePost && (actor.role === "civilian" || actor.role === "staff")) return safePost.position;
  const post = actor.reactionPostId ? REACTION_POST_MAP[actor.reactionPostId] : null;
  if (post) return post.position;
  const route = getRoute(actor.fallbackRouteId || actor.currentRouteId);
  return getPoint(route, 0, actor.spawnPosition);
}

function memoryEntryFromIncident(incident: IncidentRecord): AiMemoryEvent {
  return {
    incidentId: incident.id,
    category: incident.category,
    zoneClusterId: incident.zoneClusterId,
    position: incident.position,
    rememberedUntil: incident.expiresAt + 4000,
  };
}

function mergeIncidents(params: { stimuli: StimulusEvent[]; previousIncidents: IncidentRecord[] }) {
  const now = Date.now();
  const incidents = params.previousIncidents.filter((incident) => incident.expiresAt > now).map((incident) => ({ ...incident }));

  for (const stimulus of params.stimuli) {
    const zoneId = stimulus.zoneId || "worker-square";
    const zoneClusterId = stimulus.zoneClusterId || clusterIdForZone(zoneId);
    const category = stimulus.category || categoryForStimulus(stimulus.type);
    const existing = incidents.find(
      (incident) => incident.zoneClusterId === zoneClusterId && incident.category === category && distance2D(incident.position, stimulus.position) < Math.max(8, stimulus.radius * 0.9),
    );

    if (existing) {
      existing.position = stimulus.position;
      existing.severity = Math.max(existing.severity, stimulus.severity);
      existing.updatedAt = now;
      existing.expiresAt = Math.max(existing.expiresAt, stimulus.expiresAt + 4000);
      existing.confirmed = existing.confirmed || Boolean(stimulus.confirmed) || category === "body" || category === "trespass";
    } else {
      incidents.push({
        id: stimulus.incidentId || `incident-${zoneClusterId}-${category}-${stimulus.createdAt}`,
        type: stimulus.type,
        category,
        zoneId,
        zoneClusterId,
        position: stimulus.position,
        severity: stimulus.severity,
        confirmed: Boolean(stimulus.confirmed) || category === "body" || category === "trespass",
        createdAt: stimulus.createdAt,
        updatedAt: now,
        expiresAt: stimulus.expiresAt + 4000,
        sourceActorId: stimulus.sourceId,
        ownerActorId: null,
      });
    }
  }

  return incidents.sort((a, b) => b.severity - a.severity || b.updatedAt - a.updatedAt).slice(0, 10);
}

function createDangerZones(incidents: IncidentRecord[]): DangerZone[] {
  return incidents.map((incident) => ({
    id: `danger-${incident.id}`,
    incidentId: incident.id,
    zoneClusterId: incident.zoneClusterId,
    center: incident.position,
    radius: 8 + incident.severity * 1.7,
    expiresAt: incident.expiresAt,
    severity: incident.severity,
  }));
}

function evaluateDirectPlayerThreat(params: {
  actor: AiActorRuntime;
  playerPosition: Vec3;
  accessState: AccessState;
  zoneFit?: "native" | "acceptable" | "mismatched";
  disguiseId?: string;
  posture: "stand" | "crouch" | "dragging";
  suspicion: number;
  carriedBody: boolean;
  recentCrime: boolean;
  zoneId: string;
}) {
  const { actor, playerPosition, accessState, zoneFit, disguiseId, posture, suspicion, carriedBody, recentCrime, zoneId } = params;
  const distance = distance2D(actor.position, playerPosition);
  if (distance > actor.perception.sightRange) return null;
  const dx = playerPosition[0] - actor.position[0];
  const dz = playerPosition[2] - actor.position[2];
  const facingDelta = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - actor.facing), Math.cos(Math.atan2(dx, dz) - actor.facing)));
  if (facingDelta > actor.perception.fov * 0.55) return null;

  let severity = 0;
  if (accessState === "hard_restricted" || accessState === "enforcer_compromised") severity += 3.1;
  if (accessState === "soft_restricted") severity += 1.8;
  if (zoneFit === "mismatched") severity += actor.role === "guard" || actor.role === "bodyguard" ? 1.25 : 0.65;
  if (posture === "dragging" || carriedBody) severity += 3.4;
  if (posture === "crouch") severity += actor.role === "guard" || actor.role === "bodyguard" ? 1.2 : 0.5;
  if (disguiseId === "officer" && (posture === "crouch" || recentCrime)) severity += 1.1;
  if ((disguiseId === "worker" || disguiseId === "technician") && zoneFit === "mismatched") severity += 0.9;
  if (recentCrime) severity += 1.5;
  severity += suspicion > 65 ? 2.4 : suspicion > 35 ? 1.2 : 0;
  if (severity < 1) return null;

  const type: "trespass" | "sighting" = accessState === "hard_restricted" || accessState === "enforcer_compromised" ? "trespass" : "sighting";
  const category: IncidentCategory = type === "trespass" ? "trespass" : "crime";
  return {
    id: `sighting-${actor.id}-${Math.floor(Date.now() / 1000)}`,
    type,
    category,
    zoneId,
    zoneClusterId: clusterIdForZone(zoneId),
    position: playerPosition,
    radius: 5,
    severity,
    createdAt: Date.now(),
    expiresAt: Date.now() + 3800,
    sourceId: actor.id,
    confirmed: type === "trespass",
  } satisfies StimulusEvent;
}

function scoreIncidentForActor(actor: AiActorRuntime, incident: IncidentRecord) {
  const distanceScore = distance2D(actor.position, incident.position);
  const clusterPenalty = zoneDistancePenalty(actor.zoneClusterId || "", incident.zoneClusterId);
  const roleModifier =
    actor.role === "guard" ? 0 :
    actor.role === "bodyguard" ? 2 :
    actor.role === "staff" ? (incident.category === "sabotage" ? -1 : 4) :
    actor.role === "civilian" ? 7 :
    6;
  return distanceScore + clusterPenalty + roleModifier - incident.severity * 3;
}

function assignResponses(actors: AiActorRuntime[], incidents: IncidentRecord[]) {
  const assignments = new Map<string, { incidentId: string; role: GuardResponseRole }>();
  const updatedIncidents = incidents.map((incident) => ({ ...incident, ownerActorId: null as string | null }));

  for (const incident of updatedIncidents) {
    const guards = actors
      .filter((actor) => actor.role === "guard" && actor.state !== "down")
      .sort((a, b) => scoreIncidentForActor(a, incident) - scoreIncidentForActor(b, incident));
    const bodyguards = actors
      .filter((actor) => actor.role === "bodyguard" && actor.state !== "down")
      .sort((a, b) => scoreIncidentForActor(a, incident) - scoreIncidentForActor(b, incident));
    const staff = actors
      .filter((actor) => actor.role === "staff" && actor.state !== "down")
      .sort((a, b) => scoreIncidentForActor(a, incident) - scoreIncidentForActor(b, incident));
    const civilians = actors
      .filter((actor) => actor.role === "civilian" && actor.state !== "down")
      .sort((a, b) => scoreIncidentForActor(a, incident) - scoreIncidentForActor(b, incident));

    if (guards[0]) {
      assignments.set(guards[0].id, { incidentId: incident.id, role: "lead" });
      incident.ownerActorId = guards[0].id;
    }
    if (guards[1]) assignments.set(guards[1].id, { incidentId: incident.id, role: "support" });
    if (guards[2]) assignments.set(guards[2].id, { incidentId: incident.id, role: "perimeter" });

    if ((incident.category === "sabotage" || incident.category === "crime") && staff[0]) {
      assignments.set(staff[0].id, { incidentId: incident.id, role: incident.category === "sabotage" ? "report" : "support" });
    }

    if ((incident.category === "body" || incident.category === "trespass") && civilians[0]) {
      assignments.set(civilians[0].id, { incidentId: incident.id, role: "flee" });
    }

    if ((incident.category === "body" || incident.category === "trespass" || incident.severity >= 3) && bodyguards.length) {
      for (const bodyguard of bodyguards) {
        assignments.set(bodyguard.id, { incidentId: incident.id, role: "protect" });
      }
    }
  }

  return { assignments, incidents: updatedIncidents };
}

function updateRoutine(actor: AiActorRuntime, delta: number) {
  if ((actor.role === "civilian" || actor.role === "staff") && actor.dangerAvoidanceTarget && actor.memory.length) {
    return { ...actor, state: actor.role === "civilian" ? "fleeing" : "reporting" as AiState };
  }
  const stop = getRoutineStop(actor);
  if (!stop) return actor;
  const route = getRoute(stop.routeId);
  if (!route) return actor;

  let next: AiActorRuntime = { ...actor, currentRouteId: stop.routeId, state: stop.state, routineElapsed: actor.routineElapsed + delta };
  const targetPoint = route.points[next.routeIndex] || route.points[0];

  if (next.pauseRemaining > 0) {
    next.pauseRemaining = Math.max(0, next.pauseRemaining - delta);
  } else {
    const moved = moveToward(next, targetPoint, delta, next.patrolSpeed);
    next = moved.actor;
    if (moved.arrived) {
      next.routeIndex = nextRouteIndex(route, next.routeIndex);
      next.pauseRemaining = route.pauseSeconds || 0;
    }
  }

  if (next.routineElapsed >= stop.durationSeconds) {
    next.routineIndex = (next.routineIndex + 1) % (ROUTINE_MAP[next.routineId || ""]?.stops.length || 1);
    next.routineElapsed = 0;
    next.routeIndex = 0;
    next.pauseRemaining = 0;
  }

  return next;
}

function updateInvestigating(actor: AiActorRuntime, delta: number, incident: IncidentRecord | null) {
  const target = actor.investigateTarget || incident?.position;
  if (!target) return { ...actor, state: "returning" as AiState };

  let next: AiActorRuntime = { ...actor };
  const moved = moveToward(next, target, delta, actor.alertSpeed);
  next = moved.actor;
  if (moved.arrived) {
    next.state = "suspicious";
    next.inspectRemaining = Math.max(next.inspectRemaining, 1.6 + (incident?.severity || 1) * 0.35);
    next.pauseRemaining = 0;
    next.searchTarget = target;
    next.investigateTarget = null;
  }
  return next;
}

function updateInspecting(actor: AiActorRuntime, delta: number, incident: IncidentRecord | null) {
  let next: AiActorRuntime = { ...actor, inspectRemaining: Math.max(0, actor.inspectRemaining - delta), pauseRemaining: 0 };
  if (next.inspectRemaining > 0) return next;

  if (actor.role === "civilian") {
    next.state = incident && incident.severity >= 2 ? "fleeing" : "reporting";
  } else if (actor.role === "staff") {
    next.state = incident?.category === "sabotage" ? "reporting" : incident?.category === "sound" ? "returning" : "reporting";
  } else if (actor.role === "guard") {
    next.state = incident && (incident.confirmed || incident.severity >= 2.4) ? "searching" : "returning";
  } else if (actor.role === "bodyguard") {
    next.state = "alerted";
  } else {
    next.state = "escort";
  }

  next.currentRouteId = getSearchRouteId(next, incident, next.responseRole);
  next.routeIndex = 0;
  return next;
}

function updateSearching(actor: AiActorRuntime, delta: number, incident: IncidentRecord | null) {
  if (actor.responseRole === "perimeter") {
    const route = getRoute(actor.currentRouteId || getSearchRouteId(actor, incident, actor.responseRole));
    if (!route) return { ...actor, state: "returning" as AiState };
    let next: AiActorRuntime = { ...actor, currentRouteId: route.id };
    const holdPoint = route.points[0] || actor.position;
    const moved = moveToward(next, holdPoint, delta, next.alertSpeed * 0.92);
    next = moved.actor;
    if (moved.arrived) {
      next.pauseRemaining = Math.max(next.pauseRemaining, 1.6);
    } else {
      next.pauseRemaining = 0;
    }
    next.alertLevel = clamp(next.alertLevel - delta * 0.04, 0, 4);
    if (!incident || incident.expiresAt < Date.now()) next.state = "returning";
    return next;
  }

  const route = getRoute(actor.currentRouteId || getSearchRouteId(actor, incident, actor.responseRole));
  if (!route) return { ...actor, state: "returning" as AiState };
  let next: AiActorRuntime = { ...actor, currentRouteId: route.id };
  const targetPoint = route.points[next.routeIndex] || route.points[0];

  if (next.pauseRemaining > 0) {
    next.pauseRemaining = Math.max(0, next.pauseRemaining - delta);
  } else {
    const moved = moveToward(next, targetPoint, delta, next.alertSpeed);
    next = moved.actor;
    if (moved.arrived) {
      next.routeIndex = nextRouteIndex(route, next.routeIndex);
      next.pauseRemaining = route.pauseSeconds || 0.6;
    }
  }

  next.alertLevel = clamp(next.alertLevel - delta * 0.06, 0, 4);
  if (!incident || incident.expiresAt < Date.now()) {
    next.state = "returning";
  }
  return next;
}

function updateReporting(actor: AiActorRuntime, delta: number, incident: IncidentRecord | null) {
  const route = getRoute(actor.currentRouteId || getReportRouteId(actor, incident?.position || actor.position));
  if (!route) return { ...actor, state: "stationed" as AiState };
  let next: AiActorRuntime = { ...actor, currentRouteId: route.id };
  const targetPoint = route.points[next.routeIndex] || route.points[route.points.length - 1];
  const moved = moveToward(next, targetPoint, delta, actor.alertSpeed);
  next = moved.actor;
  if (moved.arrived) {
    if (next.routeIndex >= route.points.length - 1) {
      next.state = "stationed";
      next.pauseRemaining = 2.2;
      next.routeIndex = 0;
    } else {
      next.routeIndex += 1;
    }
  }
  return next;
}

function updateFleeing(actor: AiActorRuntime, delta: number) {
  const target = actor.dangerAvoidanceTarget || getFallbackTarget(actor);
  const moved = moveToward(actor, target, delta, actor.alertSpeed * 1.03);
  let next: AiActorRuntime = { ...moved.actor };
  if (moved.arrived) {
    next.state = "stationed";
    next.pauseRemaining = 2.6;
    next.dangerAvoidanceTarget = target;
  }
  return next;
}

function updateReturning(actor: AiActorRuntime, delta: number) {
  if ((actor.role === "civilian" || actor.role === "staff") && actor.dangerAvoidanceTarget && actor.memory.length) {
    return { ...actor, state: actor.role === "civilian" ? "fleeing" : "reporting" as AiState };
  }
  const target = getFallbackTarget(actor);
  const moved = moveToward(actor, target, delta, actor.patrolSpeed);
  let next: AiActorRuntime = { ...moved.actor, returningToRoute: true };
  if (moved.arrived) {
    next = {
      ...next,
      state: actor.role === "guard" ? "patrol" : actor.role === "bodyguard" || actor.role === "target" ? "escort" : "routine",
      currentRouteId: actor.fallbackRouteId || actor.defaultRouteId || actor.currentRouteId,
      routeIndex: 0,
      routineElapsed: 0,
      awareness: clamp(actor.awareness - 8, 0, 100),
      lastKnownPlayerPosition: null,
      currentIncidentId: null,
      responseRole: "none",
      returningToRoute: false,
      inspectRemaining: 0,
    };
  }
  return next;
}

function getFormationForAlert(globalAlertLevel: number, dangerNearTarget: boolean): BodyguardFormation {
  if (globalAlertLevel >= 3 || dangerNearTarget) return "wedge";
  if (globalAlertLevel >= 2) return "diamond";
  if (globalAlertLevel >= 1) return "screen";
  return "loose";
}

function updateEscort(actor: AiActorRuntime, delta: number, actorsById: Map<string, AiActorRuntime>, globalAlertLevel: number, dangerZones: DangerZone[], mission: MissionProgressState) {
  if (actor.role === "target") {
    const dangerNearTarget = dangerZones.some((zone) => distance2D(zone.center, actor.position) < zone.radius + 2);
    const detourRouteId =
      mission.activeDetour === "annex_inspection"
        ? "target-annex-detour"
        : mission.activeDetour === "ballroom_recovery"
          ? "target-ballroom-recovery"
          : mission.activeDetour === "vip_fallback" || dangerNearTarget || globalAlertLevel >= 2
            ? "target-vip-fallback"
            : null;
    const next = detourRouteId
      ? updateRouteLoop({ ...actor, state: "escort" as AiState, formation: getFormationForAlert(globalAlertLevel, dangerNearTarget) }, delta, detourRouteId, actor.patrolSpeed, "escort")
      : updateRoutine({ ...actor, state: "escort" as AiState, formation: getFormationForAlert(globalAlertLevel, dangerNearTarget) }, delta);
    return { ...next, patrolSpeed: dangerNearTarget ? actor.patrolSpeed * 0.88 : globalAlertLevel >= 2 ? actor.patrolSpeed * 0.92 : actor.patrolSpeed } as AiActorRuntime;
  }

  const escortTarget = actor.escortTargetId ? actorsById.get(actor.escortTargetId) : null;
  if (!escortTarget) {
    return updateRoutine({ ...actor, state: "escort" }, delta);
  }

  const dangerNearTarget = dangerZones.some((zone) => distance2D(zone.center, escortTarget.position) < zone.radius + 2.4);
  const formation = getFormationForAlert(globalAlertLevel, dangerNearTarget);
  const splitRouteId =
    mission.escortSplit === "annex" && actor.formationSlot === "left"
      ? "bodyguard-annex-response"
      : mission.escortSplit === "service" && actor.formationSlot === "rear"
        ? "bodyguard-service-response"
        : mission.escortSplit === "security" && actor.formationSlot === "right"
          ? "bodyguard-security-response"
          : null;
  if (splitRouteId) {
    return {
      ...updateRouteLoop(actor, delta, splitRouteId, actor.alertSpeed, "alerted"),
      formation: "screen",
      responseRole: "protect",
      currentIncidentId: mission.activeDetour !== "none" ? `detour-${mission.activeDetour}` : actor.currentIncidentId,
    } as AiActorRuntime;
  }
  const slot = actor.formationSlot || "rear";
  const formationOffsets = foundationShell.bodyguardFormations[formation];
  const offset = formationOffsets[slot] || formationOffsets.rear;
  const desired: Vec3 = [escortTarget.position[0] + offset[0], escortTarget.position[1], escortTarget.position[2] + offset[2]];
  const moved = moveToward(actor, desired, delta, globalAlertLevel >= 2 || dangerNearTarget ? actor.alertSpeed : actor.patrolSpeed);
  return {
    ...moved.actor,
    state: globalAlertLevel >= 2 || dangerNearTarget ? "alerted" : "escort",
    formation,
    currentIncidentId: dangerNearTarget ? actor.currentIncidentId : null,
    responseRole: dangerNearTarget ? "protect" : actor.responseRole,
  } as AiActorRuntime;
}

function applyMemory(actor: AiActorRuntime, incidents: IncidentRecord[]) {
  const now = Date.now();
  const memory = actor.memory.filter((entry) => entry.rememberedUntil > now);
  const incident = actor.currentIncidentId ? incidents.find((entry) => entry.id === actor.currentIncidentId) : null;
  if (incident && !memory.some((entry) => entry.incidentId === incident.id)) {
    memory.unshift(memoryEntryFromIncident(incident));
  }
  return memory.slice(0, 4);
}

function computeDangerAvoidanceTarget(actor: AiActorRuntime, dangerZones: DangerZone[]) {
  const nearbyDanger = dangerZones.find((zone) => distance2D(zone.center, actor.position) < zone.radius + 2);
  if (!nearbyDanger) return actor.dangerAvoidanceTarget;
  const safePost = actor.safePostId ? SAFE_POST_MAP[actor.safePostId] : null;
  return safePost?.position || getFallbackTarget(actor);
}

export function stepAiActors(params: {
  actors: AiActorRuntime[];
  stimuli: StimulusEvent[];
  previousIncidents?: IncidentRecord[];
  delta: number;
  playerPosition: Vec3;
  accessState: AccessState;
  zoneFit?: "native" | "acceptable" | "mismatched";
  disguiseId?: string;
  posture: "stand" | "crouch" | "dragging";
  suspicion: number;
  carriedBodyId: string | null;
  recentCrime: boolean;
  currentZoneId: string;
  mission: MissionProgressState;
}): {
  actors: AiActorRuntime[];
  stimuli: StimulusEvent[];
  incidents: IncidentRecord[];
  dangerZones: DangerZone[];
  guardResponseAssignments: { actorId: string; incidentId: string; role: GuardResponseRole }[];
  globalAlertLevel: number;
  targetWindowState: "guarded" | "vulnerable" | "relocating";
  searchAssignments: SearchAssignment[];
} {
  const nextStimuli = [...params.stimuli];
  const previousIncidents = params.previousIncidents || [];

  for (const actor of params.actors) {
    const directStimulus = evaluateDirectPlayerThreat({
      actor,
      playerPosition: params.playerPosition,
      accessState: params.accessState,
      zoneFit: params.zoneFit,
      disguiseId: params.disguiseId,
      posture: params.posture,
      suspicion: params.suspicion,
      carriedBody: Boolean(params.carriedBodyId),
      recentCrime: params.recentCrime,
      zoneId: params.currentZoneId,
    });
    if (directStimulus) nextStimuli.push(directStimulus);
  }

  const incidents = mergeIncidents({ stimuli: nextStimuli, previousIncidents });
  const dangerZones = createDangerZones(incidents);
  const { assignments, incidents: coordinatedIncidents } = assignResponses(params.actors, incidents);
  const actorsById = new Map(params.actors.map((actor) => [actor.id, actor]));
  const incidentPressure = coordinatedIncidents.reduce((max, incident) => Math.max(max, incident.confirmed ? incident.severity + 0.6 : incident.severity), 0);
  const escortAlertLevel = Math.max(Math.max(...params.actors.map((entry) => entry.alertLevel || 0), 0), incidentPressure, params.suspicion >= 72 ? 2.2 : 0);

  const nextActors = params.actors.map((actor) => {
    if (actor.state === "down") {
      return {
        ...actor,
        alertLevel: clamp(actor.alertLevel - params.delta * 0.02, 0, 4),
        memory: applyMemory(actor, coordinatedIncidents),
      };
    }

    const assignment = assignments.get(actor.id);
    const incident = assignment ? coordinatedIncidents.find((entry) => entry.id === assignment.incidentId) || null : actor.currentIncidentId ? coordinatedIncidents.find((entry) => entry.id === actor.currentIncidentId) || null : null;
    let next: AiActorRuntime = {
      ...actor,
      currentIncidentId: assignment?.incidentId || actor.currentIncidentId,
      responseRole: assignment?.role || actor.responseRole,
      memory: applyMemory(actor, coordinatedIncidents),
      dangerAvoidanceTarget: computeDangerAvoidanceTarget(actor, dangerZones),
    };

    if (incident) {
      next.lastKnownPlayerPosition = incident.position;
      next.awareness = clamp(next.awareness + incident.severity * params.delta * 8, 0, 100);
      next.alertLevel = clamp(Math.max(next.alertLevel, incident.severity * 0.9), 0, 4);
      if (next.state === "routine" || next.state === "patrol" || next.state === "stationed" || next.state === "returning") {
        if (next.role === "civilian") {
          next.state = incident.category === "sound" && incident.severity < 2 ? "reporting" : "fleeing";
        } else if (next.role === "staff") {
          next.state = incident.category === "sabotage" ? "investigating" : incident.category === "sound" ? "routine" : "reporting";
        } else if (next.role === "guard") {
          next.state = "investigating";
        } else if (next.role === "bodyguard") {
          next.state = "escort";
        }
      }
      if (next.state === "investigating" && !next.investigateTarget) {
        next.investigateTarget = incident.position;
      }
    } else {
      next.alertLevel = clamp(next.alertLevel - params.delta * 0.08, 0, 4);
      next.awareness = clamp(next.awareness - params.delta * 5, 0, 100);
      if (
        next.role === "guard" &&
        (params.suspicion >= 58 || params.accessState === "hard_restricted" || params.accessState === "enforcer_compromised") &&
        next.zoneClusterId === clusterIdForZone(params.currentZoneId)
      ) {
        next.alertLevel = clamp(Math.max(next.alertLevel, params.suspicion >= 75 ? 2.4 : 1.35), 0, 4);
      }
    }

    if ((next.role === "civilian" || next.role === "staff") && next.dangerAvoidanceTarget && (incident || next.memory.length)) {
      if (next.state === "routine" || next.state === "patrol") {
        next.state = next.role === "civilian" ? "fleeing" : "reporting";
      }
    }

    switch (next.state) {
      case "investigating":
      case "alerted":
        next = updateInvestigating(next, params.delta, incident);
        break;
      case "suspicious":
        next = updateInspecting(next, params.delta, incident);
        break;
      case "searching":
        next = updateSearching(next, params.delta, incident);
        break;
      case "reporting":
        next = updateReporting(next, params.delta, incident);
        break;
      case "fleeing":
        next = updateFleeing(next, params.delta);
        break;
      case "stationed":
        if (next.pauseRemaining > 0) {
          next.pauseRemaining = Math.max(0, next.pauseRemaining - params.delta);
        } else {
          next.state = next.role === "civilian" || next.role === "staff" ? "returning" : "patrol";
        }
        break;
      case "returning":
        next = updateReturning(next, params.delta);
        break;
      case "escort":
        next = updateEscort(next, params.delta, actorsById, escortAlertLevel, dangerZones, params.mission);
        break;
      default:
        next = updateRoutine(next, params.delta);
        break;
    }

    if (
      next.role === "guard" &&
      !incident &&
      (next.state === "patrol" || next.state === "routine") &&
      (incidentPressure >= 2 || next.alertLevel >= 1.35)
    ) {
      const localIncident =
        coordinatedIncidents.find((entry) => entry.zoneClusterId === (next.zoneClusterId || actor.zoneClusterId)) ||
        coordinatedIncidents[0] ||
        null;
      const responseRole: GuardResponseRole = next.alertLevel >= 2.25 || incidentPressure >= 3 ? "perimeter" : "support";
      const hotRouteId = getSearchRouteId(next, localIncident, responseRole);
      if (hotRouteId) {
        next = updateRouteLoop(
          {
            ...next,
            currentRouteId: hotRouteId,
            routeIndex: next.currentRouteId === hotRouteId ? next.routeIndex : 0,
            pauseRemaining: next.currentRouteId === hotRouteId ? next.pauseRemaining : 0,
          },
          params.delta,
          hotRouteId,
          next.alertSpeed * 0.82,
          "patrol",
        );
      }
    }

    return next;
  });

  const globalAlertLevel = clamp(nextActors.reduce((max, actor) => Math.max(max, actor.alertLevel), 0), 0, 4);
  const target = nextActors.find((actor) => actor.role === "target");
  const bodyguards = nextActors.filter((actor) => actor.role === "bodyguard");
  const dangerNearTarget = target ? dangerZones.some((zone) => distance2D(zone.center, target.position) < zone.radius + 2) : false;
  const targetWindowState =
    !target ? "guarded" :
    dangerNearTarget || globalAlertLevel >= 2 || bodyguards.some((guard) => distance2D(guard.position, target.position) < 1.8) ? "guarded" :
    target.vulnerableRouteIds?.includes(target.currentRouteId || "") ? "vulnerable" :
    "relocating";

  const searchAssignments: SearchAssignment[] = nextActors
    .filter((actor) => actor.state === "searching" && actor.currentRouteId && actor.searchTarget)
    .map((actor) => ({
      actorId: actor.id,
      routeId: actor.currentRouteId!,
      target: actor.searchTarget!,
      incidentId: actor.currentIncidentId || undefined,
      responseRole: actor.responseRole,
    }));

  const guardResponseAssignments = [...assignments.entries()].map(([actorId, assignment]) => ({
    actorId,
    incidentId: assignment.incidentId,
    role: assignment.role,
  }));

  return {
    actors: nextActors,
    stimuli: nextStimuli.filter((stimulus) => stimulus.expiresAt > Date.now()),
    incidents: coordinatedIncidents,
    dangerZones: dangerZones.filter((zone) => zone.expiresAt > Date.now()),
    guardResponseAssignments,
    globalAlertLevel,
    targetWindowState,
    searchAssignments,
  };
}
