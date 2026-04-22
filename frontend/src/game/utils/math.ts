import type { Vec3, ZoneDefinition } from "@/game/core/types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function distance2D(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function getZoneAtPosition(position: Vec3, zones: ZoneDefinition[]) {
  return (
    zones.find(
      (zone) =>
        position[0] >= zone.bounds.minX &&
        position[0] <= zone.bounds.maxX &&
        position[2] >= zone.bounds.minZ &&
        position[2] <= zone.bounds.maxZ,
    ) || null
  );
}

export function getBoundedZoneAtPosition<T extends { bounds: { minX: number; maxX: number; minZ: number; maxZ: number } }>(position: Vec3, zones: T[]) {
  return (
    zones.find(
      (zone) =>
        position[0] >= zone.bounds.minX &&
        position[0] <= zone.bounds.maxX &&
        position[2] >= zone.bounds.minZ &&
        position[2] <= zone.bounds.maxZ,
    ) || null
  );
}
