import type { ArrowType, DifficultyId } from "@/game/ragdollArchers/core/types";

export const FIXED_STEP = 1 / 60;
export const SNAPSHOT_INTERVAL = 0.1;
export const MAX_ACTIVE_ARROWS = 36;
export const PLAYER_ID = "player-archer";

export const difficultyTuning: Record<
  DifficultyId,
  {
    enemyAccuracy: number;
    enemyAggression: number;
    enemyHealth: number;
    waveSizeBonus: number;
  }
> = {
  rookie: { enemyAccuracy: 0.74, enemyAggression: 0.72, enemyHealth: 0.92, waveSizeBonus: 0 },
  veteran: { enemyAccuracy: 0.9, enemyAggression: 1, enemyHealth: 1, waveSizeBonus: 1 },
  nightmare: { enemyAccuracy: 1.08, enemyAggression: 1.2, enemyHealth: 1.15, waveSizeBonus: 2 },
};

export const arrowTuning: Record<
  ArrowType,
  {
    speed: number;
    damage: number;
    impulse: number;
    drag: number;
    radius: number;
    blastRadius?: number;
  }
> = {
  standard: { speed: 42, damage: 34, impulse: 15, drag: 0.018, radius: 0.16 },
  heavy: { speed: 31, damage: 48, impulse: 21, drag: 0.024, radius: 0.18 },
  explosive: { speed: 28, damage: 22, impulse: 18, drag: 0.026, radius: 0.2, blastRadius: 4.8 },
  light: { speed: 56, damage: 18, impulse: 8, drag: 0.012, radius: 0.14 },
};

export const arrowOrder: ArrowType[] = ["standard", "heavy", "explosive", "light"];

export const defaultAmmo = {
  standard: 18,
  heavy: 8,
  explosive: 5,
  light: 14,
};
