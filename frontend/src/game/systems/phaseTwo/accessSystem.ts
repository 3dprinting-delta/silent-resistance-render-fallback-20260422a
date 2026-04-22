import type { AccessState, DisguiseDefinition, PhaseOneZone, ZoneAccessProfile } from "@/game/core/types";

export function getZoneAccessProfile(zone: PhaseOneZone | null, disguise: DisguiseDefinition): ZoneAccessProfile {
  if (!zone) {
    return {
      zoneId: "unknown",
      legal: true,
      accessState: "legal",
      zoneFit: "native",
      trespassRate: 0,
      witnessWeight: 1,
      stealthModifier: 1,
      lingerGraceSeconds: 8,
      scrutinyLevel: 0,
    };
  }

  const allowedTags = zone.allowedTags || zone.accessTags || ["public"];
  const hasTag = allowedTags.some((tag) => disguise.clearanceTags.includes(tag));
  const tierGap = Math.max(0, (zone.requiredTier || 0) - disguise.accessTier);

  let accessState: AccessState = "legal";
  if (!hasTag) accessState = "hard_restricted";
  else if (tierGap >= 2) accessState = "hard_restricted";
  else if (tierGap === 1) accessState = "soft_restricted";

  const zoneFit =
    zone.publicBehaviorProfile === disguise.behaviorProfile || allowedTags.includes(disguise.behaviorProfile)
      ? "native"
      : hasTag
        ? "acceptable"
        : "mismatched";

  const legal = accessState === "legal";
  return {
    zoneId: zone.id,
    legal,
    accessState,
    zoneFit,
    trespassRate: zone.trespassRate || 0,
    witnessWeight: zone.witnessWeight || 1,
    stealthModifier: zone.stealthModifier || 1,
    lingerGraceSeconds: zone.lingerGraceSeconds || 0,
    scrutinyLevel: zone.scrutinyLevel || 1,
  };
}

export function describeZoneLegality(zone: PhaseOneZone | null, accessState: AccessState) {
  if (!zone) return "Unclassified";
  if (accessState === "legal") return `${zone.label} legal for current cover`;
  if (accessState === "soft_restricted") return `${zone.label} allows entry, but lingering is risky`;
  if (accessState === "enforcer_compromised") return `${zone.label} is compromised by enforcer scrutiny`;
  return `${zone.label} is hard restricted for current cover`;
}
