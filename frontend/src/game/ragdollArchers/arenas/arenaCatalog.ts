import type { ArenaConfig } from "@/game/ragdollArchers/core/types";

export const arenaCatalog: ArenaConfig[] = [
  {
    id: "forge-basin",
    label: "Forge Basin",
    description: "Flat sight lines, hard cover, and explosive clutter built for classic duels.",
    sky: "dawn",
    floorColor: "#574639",
    floorType: "flat",
    spawnPoints: {
      player: [-14, 3, 0],
      enemies: [
        [14, 3, 0],
        [16, 3, 5],
        [16, 3, -5],
      ],
    },
    coverNodes: [
      [-4, 2, 5],
      [-4, 2, -5],
      [4, 2, 4],
      [4, 2, -4],
    ],
    props: [
      { id: "crate-a", kind: "crate", position: [-2, 1.3, 5], size: [1.4, 1.4, 1.4], mass: 2 },
      { id: "crate-b", kind: "crate", position: [1.5, 1.1, -4.5], size: [1.2, 1.2, 1.2], mass: 2 },
      { id: "barrel-a", kind: "barrel", position: [0.5, 1, 0], size: [0.55, 1.1, 0.55], mass: 1.2, explosive: true },
      { id: "pillar-a", kind: "pillar", position: [6, 2.4, 0], size: [0.7, 2.4, 0.7], mass: 0 },
      { id: "pillar-b", kind: "pillar", position: [-6, 2.4, 0], size: [0.7, 2.4, 0.7], mass: 0 },
    ],
  },
  {
    id: "windbreak-hills",
    label: "Windbreak Hills",
    description: "Rolling dunes and shifting elevation that reward prediction and punishes tunnel vision.",
    sky: "storm",
    floorColor: "#5f6952",
    floorType: "hills",
    spawnPoints: {
      player: [-18, 4, -4],
      enemies: [
        [12, 5.5, 2],
        [18, 4.5, -8],
        [6, 6.2, 10],
        [20, 6, 8],
      ],
    },
    coverNodes: [
      [-6, 4.2, -2],
      [3, 5.4, 5],
      [8, 6.2, -6],
      [13, 5.8, 8],
    ],
    props: [
      { id: "crate-c", kind: "crate", position: [2, 4.8, 5], size: [1.5, 1.5, 1.5], mass: 2 },
      { id: "barrel-c", kind: "barrel", position: [8, 5.9, -6], size: [0.55, 1.1, 0.55], mass: 1.2, explosive: true },
      { id: "platform-c", kind: "platform", position: [-1, 4.1, 9], size: [2.2, 0.3, 2.2], movingAxis: "x", travel: 4, speed: 0.65 },
      { id: "pillar-c", kind: "pillar", position: [12, 5.7, 7], size: [0.8, 2.8, 0.8], mass: 0 },
    ],
  },
  {
    id: "shatter-isles",
    label: "Shatter Isles",
    description: "Floating islands, broken bridges, moving platforms, and vertical kill zones for chaotic battlefields.",
    sky: "void",
    floorColor: "#384654",
    floorType: "islands",
    spawnPoints: {
      player: [-10, 8, -2],
      enemies: [
        [10, 8, 2],
        [17, 10, -8],
        [4, 11, 9],
        [19, 8, 10],
        [24, 12, -2],
      ],
    },
    coverNodes: [
      [-3, 8.2, 1],
      [6, 8.2, -1],
      [13, 10.4, -7],
      [18, 8.1, 8],
    ],
    props: [
      { id: "crate-s1", kind: "crate", position: [2, 8.8, 0], size: [1.2, 1.2, 1.2], mass: 2.2 },
      { id: "crate-s2", kind: "crate", position: [15, 10.8, -8], size: [1.3, 1.3, 1.3], mass: 2 },
      { id: "barrel-s1", kind: "barrel", position: [8, 8.7, 5], size: [0.55, 1.1, 0.55], mass: 1.1, explosive: true },
      { id: "platform-s1", kind: "platform", position: [11, 7.2, -2], size: [2.5, 0.32, 2], movingAxis: "z", travel: 8, speed: 0.9 },
      { id: "platform-s2", kind: "platform", position: [20, 9, 2], size: [2.2, 0.32, 2.2], movingAxis: "x", travel: 5, speed: 0.8 },
    ],
  },
];

export function getArenaConfig(arenaId: ArenaConfig["id"]) {
  return arenaCatalog.find((arena) => arena.id === arenaId) || arenaCatalog[0];
}
