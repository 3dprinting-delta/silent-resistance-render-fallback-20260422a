import type { ActorDefinition, ActorRuntime, RouteDefinition, Vec3 } from "@/game/core/types";
import { distance2D } from "@/game/utils/math";

function getRouteMap(routes: RouteDefinition[]) {
  return Object.fromEntries(routes.map((route) => [route.id, route]));
}

export function createInitialActors(actors: ActorDefinition[], routes: RouteDefinition[]): ActorRuntime[] {
  const routeMap = getRouteMap(routes);
  return actors.map((actor) => {
    const route = routeMap[actor.routeId];
    const index = actor.startIndex || 0;
    return {
      ...actor,
      position: route?.points[index] || [0, 1, 0],
      nodeIndex: index,
      state: actor.role === "target" ? "escort" : "routine",
      pauseRemaining: actor.pauseMs || 0,
      investigateTarget: null,
      lastKnownPlayerPosition: null,
      awareness: 0,
      hidden: false,
    };
  });
}

export function stepActors(params: {
  actors: ActorRuntime[];
  routes: RouteDefinition[];
  delta: number;
  distractionPoint?: Vec3 | null;
  searchOrigin?: Vec3 | null;
  lockdown: boolean;
  targetPoisoned: boolean;
  transformerSabotaged: boolean;
}) {
  const routeMap = getRouteMap(params.routes);
  return params.actors.map((actor) => {
    if (actor.hidden) return actor;

    let next = { ...actor };
    const route = routeMap[actor.routeId];
    if (!route || route.points.length < 2) return next;

    if (params.lockdown && actor.role !== "civilian") {
      next.state = actor.role === "target" ? "escort" : "alert";
      next.speed = actor.speed * 1.18;
    }

    if (params.distractionPoint && actor.role !== "target" && distance2D(actor.position, params.distractionPoint) < 12) {
      next.state = "investigating";
      next.investigateTarget = params.distractionPoint;
      next.awareness = Math.min(100, (next.awareness || 0) + 14);
    }

    if (params.searchOrigin && actor.role !== "civilian" && distance2D(actor.position, params.searchOrigin) < 28) {
      next.state = params.lockdown ? "searching" : "investigating";
      next.investigateTarget = params.searchOrigin;
      next.lastKnownPlayerPosition = params.searchOrigin;
      next.awareness = Math.min(100, (next.awareness || 0) + 20);
      next.speed = actor.speed * (params.lockdown ? 1.28 : 1.14);
    }

    if (next.pauseRemaining > 0) {
      next.pauseRemaining -= params.delta * 1000;
      next.awareness = Math.max(0, (next.awareness || 0) - params.delta * 3);
      return next;
    }

    const targetPoint = next.investigateTarget || route.points[(next.nodeIndex + 1) % route.points.length];
    const dx = targetPoint[0] - next.position[0];
    const dz = targetPoint[2] - next.position[2];
    const distance = Math.hypot(dx, dz);

    if (distance < 0.25) {
      if (next.investigateTarget) {
        next.investigateTarget = null;
        next.state = params.lockdown ? "searching" : "routine";
        next.awareness = Math.max(0, (next.awareness || 0) - 10);
      } else {
        next.nodeIndex = (next.nodeIndex + 1) % route.points.length;
      }
      next.pauseRemaining = next.pauseMs || 0;
      return next;
    }

    next.position = [
      next.position[0] + (dx / distance) * next.speed * params.delta,
      targetPoint[1] || next.position[1],
      next.position[2] + (dz / distance) * next.speed * params.delta,
    ];
    next.facing = Math.atan2(dx, dz);
    next.awareness = Math.max(0, (next.awareness || 0) - params.delta * 2);
    return next;
  });
}
