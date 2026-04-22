import type { PhaseOneBounds, Vec3 } from "@/game/core/types";
import { clamp } from "@/game/utils/math";

let lastMoveCheckLogAt = 0;

function intersects(bounds: PhaseOneBounds, x: number, z: number, radius: number) {
  return x + radius > bounds.minX && x - radius < bounds.maxX && z + radius > bounds.minZ && z - radius < bounds.maxZ;
}

export function resolvePlayerMotion(params: {
  position: Vec3;
  yaw: number;
  inputX: number;
  inputZ: number;
  speed: number;
  delta: number;
  blockers: PhaseOneBounds[];
  worldBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  collisionRadius?: number;
}) {
  const radius = params.collisionRadius ?? 0.7;
  const sinYaw = Math.sin(params.yaw);
  const cosYaw = Math.cos(params.yaw);
  const forwardX = sinYaw;
  const forwardZ = cosYaw;
  const rightX = forwardZ;
  const rightZ = -forwardX;
  const desiredX = params.inputZ * forwardX + params.inputX * rightX;
  const desiredZ = params.inputZ * forwardZ + params.inputX * rightZ;
  const magnitude = Math.hypot(desiredX, desiredZ);
  const normalizedX = magnitude > 0.0001 ? desiredX / magnitude : 0;
  const normalizedZ = magnitude > 0.0001 ? desiredZ / magnitude : 0;
  const stepX = normalizedX * params.speed * params.delta;
  const stepZ = normalizedZ * params.speed * params.delta;

  let nextX = clamp(params.position[0] + stepX, params.worldBounds.minX + radius, params.worldBounds.maxX - radius);
  let nextZ = clamp(params.position[2] + stepZ, params.worldBounds.minZ + radius, params.worldBounds.maxZ - radius);

  for (const blocker of params.blockers) {
    if (intersects(blocker, nextX, nextZ, radius)) {
      const blockedX = intersects(blocker, nextX, params.position[2], radius);
      const blockedZ = intersects(blocker, params.position[0], nextZ, radius);
      if (blockedX) nextX = params.position[0];
      if (blockedZ) nextZ = params.position[2];
      if (blockedX && blockedZ) {
        nextX = params.position[0];
        nextZ = params.position[2];
      }
    }
  }

  if (magnitude > 0.01 && typeof performance !== "undefined" && performance.now() - lastMoveCheckLogAt > 350) {
    lastMoveCheckLogAt = performance.now();
    console.info("[MOVE CHECK] forward, right vectors", {
      yaw: Number(params.yaw.toFixed(3)),
      forward: [Number(forwardX.toFixed(3)), 0, Number(forwardZ.toFixed(3))],
      right: [Number(rightX.toFixed(3)), 0, Number(rightZ.toFixed(3))],
      input: { x: params.inputX, z: params.inputZ },
    });
  }

  const facing = magnitude > 0.01 ? Math.atan2(normalizedX, normalizedZ) : params.yaw;

  return {
    position: [nextX, params.position[1], nextZ] as Vec3,
    facing,
    velocity: [stepX / Math.max(params.delta, 0.0001), 0, stepZ / Math.max(params.delta, 0.0001)] as Vec3,
  };
}
