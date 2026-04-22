import type { PersistedPlayerProfile } from "@/game/ragdollArchers/core/types";

export type UpgradeId = "vitality" | "endurance" | "draw" | "quiver" | "recovery" | "fieldMedicine";

export interface PlayerProgression {
  coins: number;
  upgradePoints: number;
  bestWave: number;
  highestScore: number;
  realismUnlocked: boolean;
  upgrades: Record<UpgradeId, number>;
}

export interface ProgressionEffects {
  maxHealth: number;
  maxStamina: number;
  drawSpeed: number;
  ammoBonus: number;
  recoveryRate: number;
  treatmentEfficiency: number;
}

export function createDefaultProgression(): PlayerProgression {
  return {
    coins: 0,
    upgradePoints: 0,
    bestWave: 0,
    highestScore: 0,
    realismUnlocked: true,
    upgrades: {
      vitality: 0,
      endurance: 0,
      draw: 0,
      quiver: 0,
      recovery: 0,
      fieldMedicine: 0,
    },
  };
}

export function parseProfileProgression(profile: PersistedPlayerProfile | null): PlayerProgression {
  const fallback = createDefaultProgression();
  if (!profile?.settingsJson) return fallback;

  try {
    const parsed = JSON.parse(profile.settingsJson) as { progression?: Partial<PlayerProgression> & { upgrades?: Partial<Record<UpgradeId, number>> } };
    const stored = parsed.progression;
    if (!stored) return fallback;
    return {
      ...fallback,
      ...stored,
      upgrades: {
        ...fallback.upgrades,
        ...(stored.upgrades || {}),
      },
    };
  } catch {
    return fallback;
  }
}

export function buildProgressionEffects(progression: PlayerProgression): ProgressionEffects {
  return {
    maxHealth: 100 + progression.upgrades.vitality * 14,
    maxStamina: 100 + progression.upgrades.endurance * 12,
    drawSpeed: 1 + progression.upgrades.draw * 0.14,
    ammoBonus: progression.upgrades.quiver * 2,
    recoveryRate: 1 + progression.upgrades.recovery * 0.12,
    treatmentEfficiency: 1 + progression.upgrades.fieldMedicine * 0.16,
  };
}

export function getUpgradeLabel(upgradeId: UpgradeId) {
  switch (upgradeId) {
    case "vitality":
      return "Vitality";
    case "endurance":
      return "Endurance";
    case "draw":
      return "Draw Speed";
    case "quiver":
      return "Quiver";
    case "recovery":
      return "Recovery";
    case "fieldMedicine":
      return "Field Medicine";
    default:
      return upgradeId;
  }
}
