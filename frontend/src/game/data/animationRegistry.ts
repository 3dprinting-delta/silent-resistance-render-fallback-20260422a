import type { AnimationClipRole, AiRole, AssetManifestEntry } from "@/game/core/types";
import { assetManifest } from "@/game/data/assetManifest";

export const animationStateMap: Record<string, AnimationClipRole[]> = {
  player_idle: ["idle"],
  player_move: ["walk", "run"],
  player_restricted: ["alert", "investigate"],
  civilian_routine: ["idle", "civilian", "walk"],
  civilian_panic: ["panic", "run"],
  guard_routine: ["idle", "walk", "alert"],
  guard_search: ["investigate", "search", "run"],
  bodyguard_cover: ["bodyguard", "escort", "alert"],
  target_public: ["target", "walk", "idle"],
};

export function getAnimationAssets() {
  return assetManifest.filter((entry) => entry.type === "animation");
}

export function getClipsByRole(role: AnimationClipRole) {
  return getAnimationAssets().filter((entry) => entry.clipRole === role);
}

export function getPreferredClipRolesForActorRole(role: AiRole): AnimationClipRole[] {
  switch (role) {
    case "guard":
      return ["alert", "investigate", "search", "walk", "idle"];
    case "bodyguard":
      return ["bodyguard", "escort", "alert", "walk", "idle"];
    case "target":
      return ["target", "escort", "walk", "idle"];
    case "staff":
      return ["escort", "walk", "idle"];
    case "civilian":
    default:
      return ["civilian", "panic", "walk", "idle"];
  }
}

export function getCompatibleAnimationSet(rigProfileId: string | undefined | null) {
  return getAnimationAssets().filter((entry) => !entry.rigProfileId || !rigProfileId || entry.rigProfileId === rigProfileId);
}

export function summarizeAnimationCoverage() {
  const summary: Record<AnimationClipRole, number> = {
    idle: 0,
    walk: 0,
    run: 0,
    alert: 0,
    investigate: 0,
    search: 0,
    panic: 0,
    escort: 0,
    bodyguard: 0,
    civilian: 0,
    target: 0,
  };

  for (const asset of getAnimationAssets()) {
    if (asset.clipRole) summary[asset.clipRole] += 1;
  }

  return summary;
}

export function buildAnimationAssignmentProfile(rigProfileId: string | undefined | null, actorRole: AiRole) {
  const compatible = getCompatibleAnimationSet(rigProfileId);
  const preferred = getPreferredClipRolesForActorRole(actorRole);

  return preferred.map((clipRole) => ({
    clipRole,
    assets: compatible.filter((entry: AssetManifestEntry) => entry.clipRole === clipRole),
  }));
}
