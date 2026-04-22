import type { ArenaConfig } from "@/game/ragdollArchers/core/types";

export function sampleArenaHeight(arena: ArenaConfig, x: number, z: number) {
  if (arena.floorType === "flat") return 0;
  if (arena.floorType === "hills") {
    return Math.sin(x * 0.22) * 1.1 + Math.cos(z * 0.18) * 0.8 + Math.sin((x + z) * 0.08) * 0.9;
  }

  const islandCenters: [number, number, number][] = [
    [-10, 6.2, -2],
    [0, 6.8, 0],
    [10, 6.1, 3],
    [18, 8.4, -7],
    [21, 7.2, 10],
  ];
  for (const [cx, cy, cz] of islandCenters) {
    const dx = x - cx;
    const dz = z - cz;
    if (Math.hypot(dx, dz) < 7.5) {
      return cy + Math.cos(dx * 0.32) * 0.45 + Math.sin(dz * 0.28) * 0.35;
    }
  }
  return -16;
}
