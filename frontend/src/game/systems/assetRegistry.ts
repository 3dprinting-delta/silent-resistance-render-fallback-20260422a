import { assetManifest, rigProfiles } from "@/game/data/assetManifest";
import { buildAnimationAssignmentProfile, summarizeAnimationCoverage } from "@/game/data/animationRegistry";

export function getAssetById(id: string) {
  return assetManifest.find((asset) => asset.id === id) || null;
}

export function getAssetsByType(type: (typeof assetManifest)[number]["type"]) {
  return assetManifest.filter((asset) => asset.type === type);
}

export function getRigProfileById(id: string | undefined | null) {
  if (!id) return null;
  return rigProfiles.find((profile) => profile.id === id) || null;
}

export function summarizeAssetCoverage() {
  return {
    characters: getAssetsByType("character").length,
    animations: getAssetsByType("animation").length,
    environments: getAssetsByType("environment").length,
    props: getAssetsByType("prop").length,
    materials: getAssetsByType("material").length,
    hdris: getAssetsByType("hdri").length,
    animationCoverage: summarizeAnimationCoverage(),
  };
}

export function getAnimationAssignmentProfile(rigProfileId: string | undefined | null, actorRole: "civilian" | "staff" | "guard" | "target" | "bodyguard") {
  return buildAnimationAssignmentProfile(rigProfileId, actorRole);
}
