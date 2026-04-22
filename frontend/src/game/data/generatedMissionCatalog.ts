import type {
  GeneratedMissionDefinition,
  LayoutVariant,
  LiveRotationSeed,
  MissionTemplate,
  MissionVariantConfig,
  SectorStatus,
} from "@/game/core/types";
import { buildMissionStoryProfile, buildStoryMissionCount } from "@/game/data/missionStoryFabric";

const layoutVariants: LayoutVariant[] = [
  { id: "lobby-pressure", label: "Lobby Pressure", propLayoutSeed: 17, lightingBias: "warm_public", landmarkFocus: "lobby" },
  { id: "annex-tight", label: "Annex Tightening", propLayoutSeed: 24, lightingBias: "vip_after_hours", landmarkFocus: "annex" },
  { id: "marina-surge", label: "Marina Sweep", propLayoutSeed: 31, lightingBias: "cold_security", landmarkFocus: "marina" },
  { id: "service-blackout", label: "Service Blackout", propLayoutSeed: 42, lightingBias: "storm_service", landmarkFocus: "service" },
];

const azureVariants: MissionVariantConfig[] = [
  {
    id: "azure-summit-fall",
    label: "Summit Fall",
    siteId: "azure-meridian",
    worldRegion: "Harbor Facility",
    targetProfile: { id: "hc-2", label: "Commandant Ilse Voss", role: "harbor_prefect" },
    objectiveBundle: {
      primary: "Eliminate the harbor prefect during the summit flow.",
      secondary: "Steal the summit ledger before command realizes the breach.",
      extraction: "Exfiltrate through the marina before the harbor sweep locks down.",
    },
    securityTier: "guarded",
    entryPool: [
      { id: "marina-default", label: "Marina Arrival", position: [0, 1, 46], zoneId: "arrival-esplanade", disguiseId: "civilian" },
      { id: "service-entry", label: "West Service Cut-In", position: [-34, 1, 22], zoneId: "west-service-yard", disguiseId: "worker" },
    ],
    extractionPool: [{ id: "marina-exfil", label: "Marina Exfiltration", zoneId: "marina-dock" }],
    lightingProfileId: "public-luxury",
    layoutVariantId: "lobby-pressure",
    zoneTagOverrides: ["public", "summit"],
    propLayoutSeed: 17,
    challengeModifiers: ["silent_opening", "ledger_theft"],
    liveEventOverlay: "Summit traffic is still masking clean movement across the lobby and ballroom.",
    recommendedTeamSize: 2,
    maxTeamSize: 3,
    coopSubObjectives: ["One agent isolates the target route while another lifts the summit ledger.", "Team extraction through the marina stays cleaner if one agent suppresses ballroom pressure."],
    quickMatchEligible: true,
    teamExtractionRule: "all_extract",
  },
  {
    id: "azure-annex-lock",
    label: "Annex Lock",
    siteId: "azure-meridian",
    worldRegion: "Harbor Facility",
    targetProfile: { id: "hc-2", label: "Consul Lucien Vale", role: "summit_consul" },
    objectiveBundle: {
      primary: "Break the annex command chain by isolating Vale during a private tasting loop.",
      secondary: "Turn the annex reserve route into a compromised audit trail.",
      extraction: "Slip out through the annex promenade before the screening wing seals.",
    },
    securityTier: "hardened",
    entryPool: [
      { id: "annex-promenade", label: "Annex Promenade", position: [60, 1, 10], zoneId: "annex-promenade", disguiseId: "civilian" },
      { id: "annex-service-bay", label: "Annex Service Bay", position: [68, 1, 26], zoneId: "annex-service-bay", disguiseId: "technician" },
    ],
    extractionPool: [{ id: "annex-withdrawal", label: "Annex Withdrawal", zoneId: "annex-promenade" }],
    lightingProfileId: "vip-night",
    layoutVariantId: "annex-tight",
    zoneTagOverrides: ["annex", "screening"],
    propLayoutSeed: 24,
    challengeModifiers: ["annex_pressure", "noisy_recovery"],
    liveEventOverlay: "Screening teams are cycling VIPs through the annex, compressing the escort geometry.",
    recommendedTeamSize: 2,
    maxTeamSize: 4,
    coopSubObjectives: ["Split the escort between annex promenade and service bay.", "One player recovers route intelligence while the other forces Vale into the tasting pocket."],
    quickMatchEligible: true,
    teamExtractionRule: "all_extract",
  },
  {
    id: "azure-marina-quarantine",
    label: "Marina Quarantine",
    siteId: "azure-meridian",
    worldRegion: "Harbor Facility",
    targetProfile: { id: "hc-2", label: "Harbor Security Prefect", role: "harbor_prefect" },
    objectiveBundle: {
      primary: "Strike a quarantine inspection detail before it hardens the marina perimeter.",
      secondary: "Sabotage checkpoint logistics to force a panicked redeployment.",
      extraction: "Escape through the sea terrace or dock perimeter while the patrol net is re-vectoring.",
    },
    securityTier: "lockdown",
    entryPool: [
      { id: "terrace-scout", label: "Sea Terrace Overlook", position: [24, 1, -8], zoneId: "ballroom-terrace", disguiseId: "civilian" },
      { id: "checkpoint-shadow", label: "Pier Shadow Route", position: [56, 1, -48], zoneId: "pier-security-checkpoint", disguiseId: "security_grunt" },
    ],
    extractionPool: [{ id: "terrace-breakout", label: "Sea Terrace Breakout", zoneId: "ballroom-terrace" }],
    lightingProfileId: "security-cold",
    layoutVariantId: "marina-surge",
    zoneTagOverrides: ["marina", "checkpoint"],
    propLayoutSeed: 31,
    challengeModifiers: ["checkpoint_stress", "high_alert_opening"],
    liveEventOverlay: "Harbor command has shifted into verification sweeps and checkpoint re-routing.",
    recommendedTeamSize: 3,
    maxTeamSize: 4,
    coopSubObjectives: ["One agent burns checkpoint attention while another sabotages logistics and a third secures the target route."],
    quickMatchEligible: true,
    teamExtractionRule: "partial_credit",
  },
  {
    id: "azure-service-blackout",
    label: "Service Blackout",
    siteId: "azure-meridian",
    worldRegion: "Harbor Facility",
    targetProfile: { id: "hc-2", label: "Operations Curator Rooke", role: "propaganda_curator" },
    objectiveBundle: {
      primary: "Trigger a kitchen-to-basement blackout and erase the curator inside the recovery flow.",
      secondary: "Steal internal guest routing to expose how the summit manipulates civilian access.",
      extraction: "Withdraw through the basement spine before security re-establishes utility control.",
    },
    securityTier: "hardened",
    entryPool: [
      { id: "kitchen-entry", label: "Kitchen Entry", position: [-33, 1, 6], zoneId: "kitchens", disguiseId: "worker" },
      { id: "cellar-entry", label: "Wine Cellar", position: [-28, -2, -12], zoneId: "wine-cellar", disguiseId: "technician" },
    ],
    extractionPool: [{ id: "basement-spine", label: "Basement Service Spine", zoneId: "basement-service-spine" }],
    lightingProfileId: "service-industrial",
    layoutVariantId: "service-blackout",
    zoneTagOverrides: ["service", "utility"],
    propLayoutSeed: 42,
    challengeModifiers: ["blackout_chain", "body_hide_pressure"],
    liveEventOverlay: "Power fluctuations and service panic are distorting normal staff movement.",
    recommendedTeamSize: 2,
    maxTeamSize: 3,
    coopSubObjectives: ["Coordinate blackout timing across kitchen and cellar nodes.", "Hide casualties and pull the curator into the service spine together."],
    quickMatchEligible: true,
    teamExtractionRule: "first_exit_unlocks",
  },
];

const kronstadtVariants: MissionVariantConfig[] = [
  {
    id: "kronstadt-blackout-shell",
    label: "Kronstadt Blackout Window",
    siteId: "kronstadt-shell",
    worldRegion: "Kronstadt District",
    targetProfile: { id: "hc-3", label: "Director Otto Mahr", role: "discipline_chief" },
    objectiveBundle: {
      primary: "Destroy the discipline chief during an industrial blackout shell operation.",
      secondary: "Disrupt factory routing intelligence and break worker-tracking discipline.",
      extraction: "Use the rail-trench style withdrawal window before district command stabilizes.",
    },
    securityTier: "hardened",
    entryPool: [
      { id: "worker-shell", label: "Worker Square Cover", position: [-16, 1, 22], zoneId: "grand-lobby", disguiseId: "worker" },
      { id: "service-shell", label: "Maintenance Access", position: [-36, 1, 16], zoneId: "west-service-yard", disguiseId: "technician" },
    ],
    extractionPool: [{ id: "rail-shell", label: "Rail Trench Exit", zoneId: "arrival-esplanade" }],
    lightingProfileId: "service-industrial",
    layoutVariantId: "service-blackout",
    zoneTagOverrides: ["industrial", "discipline"],
    propLayoutSeed: 57,
    challengeModifiers: ["district_blackout", "worker_flow"],
    liveEventOverlay: "Industrial curfew and ration queues are being simulated through the hotel shell as a resistance training contract.",
    recommendedTeamSize: 3,
    maxTeamSize: 4,
    coopSubObjectives: ["Split between worker square disruption and maintenance access infiltration.", "Extract factory routing intel before rail-trench withdrawal collapses."],
    quickMatchEligible: true,
    teamExtractionRule: "partial_credit",
  },
];

export const missionTemplates: MissionTemplate[] = [
  {
    missionId: "azure-meridian",
    title: "Azure Meridian Operations",
    summary: "A luxury summit complex where public glamour, private annex pressure, and service logistics all collide.",
    siteId: "azure-meridian",
    variants: azureVariants,
  },
  {
    missionId: "kronstadt-blackout",
    title: "Kronstadt Blackout",
    summary: "An industrial crackdown mission package staged through the current shell until a dedicated map is built.",
    siteId: "kronstadt-shell",
    variants: kronstadtVariants,
  },
];

export function getLayoutVariant(layoutVariantId: string) {
  return layoutVariants.find((variant) => variant.id === layoutVariantId) || layoutVariants[0];
}

export function getMissionVariantById(variantId: string) {
  return missionTemplates.flatMap((template) => template.variants).find((variant) => variant.id === variantId) || null;
}

function priorityForVariant(variant: MissionVariantConfig, sector: SectorStatus) {
  if (sector.enforcementPressure >= 78 || variant.securityTier === "lockdown") return "critical" as const;
  if (sector.instability >= 44 || sector.intelligenceLeaks >= 40) return "high" as const;
  return "rising" as const;
}

function typeForVariant(variant: MissionVariantConfig) {
  if (variant.challengeModifiers.includes("ledger_theft")) return "intel_theft" as const;
  if (variant.challengeModifiers.includes("blackout_chain")) return "sabotage_op" as const;
  if (variant.securityTier === "lockdown") return "priority_assassination" as const;
  return "disruption_contract" as const;
}

export function buildGeneratedOperations(params: {
  sectors: SectorStatus[];
  dailySeed: string;
  weeklySeed: string;
  revision: number;
}) {
  const sectorCycle = [...params.sectors].sort((a, b) => (b.instability + b.intelligenceLeaks + b.enforcementPressure) - (a.instability + a.intelligenceLeaks + a.enforcementPressure));
  const pool = [...azureVariants, ...kronstadtVariants];

  return pool.slice(0, 5).map((variant, index): GeneratedMissionDefinition => {
    const sector = sectorCycle[index % sectorCycle.length];
    const template = missionTemplates.find((entry) => entry.variants.some((item) => item.id === variant.id)) || missionTemplates[0];
    const baseOperation = {
      id: `${variant.id}-${params.dailySeed}-${index}`,
      missionId: template.missionId,
      templateId: template.missionId,
      variantId: variant.id,
      title: `${variant.label}`,
      summary: `${template.summary} ${variant.liveEventOverlay}`,
      type: typeForVariant(variant),
      sectorId: sector.id,
      priority: priorityForVariant(variant, sector),
      objective: variant.objectiveBundle.primary,
      strategicEffect: `${variant.objectiveBundle.secondary} Sector pressure will pivot toward ${sector.label}.`,
      rewardHint: variant.securityTier === "lockdown" ? "High campaign damage, high verification backlash." : "Strong liberation pressure and new codex/intel progress.",
      timeWindow: index < 3 ? "active this cycle" : "queued by weekly board",
      runtimeConfig: variant,
    };
    return {
      ...baseOperation,
      story: buildMissionStoryProfile(baseOperation, params.revision + index),
    };
  });
}

export function getAvailableStoryMissionCount() {
  return buildStoryMissionCount([...azureVariants, ...kronstadtVariants].length);
}

export function createRotationSeed(params: { day: number; hour: number; revision: number; runCount?: number }): LiveRotationSeed {
  return {
    dailySeed: `day-${params.day}-hour-${params.hour}`,
    weeklySeed: `week-${Math.floor((params.day - 1) / 7) + 1}`,
    revision: params.revision,
    runCount: params.runCount || 0,
  };
}
