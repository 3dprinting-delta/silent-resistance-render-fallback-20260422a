import {
  INITIAL_HIGH_COMMAND,
  INITIAL_REGION_DIFFICULTY,
  REGION_NAMES,
  START_DAY,
  START_HOUR,
  TICK_INTERVAL_MS,
  WORLD_ANCHOR_MS,
} from "@/lib/simulation/constants";
import { buildGeneratedOperations, createRotationSeed, getAvailableStoryMissionCount } from "@/game/data/generatedMissionCatalog";
import { buildAftermathSummary, buildMissionMemoryRecord } from "@/game/data/missionStoryFabric";
import { generateRealisticRoutine } from "@/lib/simulation/npcRoutines";
import { eliminateTarget as eliminateHighCommandTarget, updateHighCommand } from "@/lib/simulation/highCommand";

function formatGameTime(day, hour) {
  return `Day ${day} ${String(hour).padStart(2, "0")}:00`;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function createNpcName(prefix, regionIndex, npcIndex) {
  return `${prefix} ${regionIndex + 1}-${npcIndex + 1}`;
}

function createRegion(regionName, regionIndex) {
  const npcTemplates = [
    { npcType: "vanguard_officer", count: 2, prefix: "Officer" },
    { npcType: "civilian_worker", count: 4, prefix: "Worker" },
    { npcType: "vanguard_technician", count: 2, prefix: "Technician" },
    { npcType: "enforcer", count: 2, prefix: "Enforcer" },
  ];

  const npcs = npcTemplates.flatMap((template) =>
    Array.from({ length: template.count }, (_, npcIndex) => {
      const schedule = generateRealisticRoutine(template.npcType, regionName);
      const current = schedule[START_HOUR];

      return {
        id: `${regionName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${template.npcType}-${npcIndex + 1}`,
        name: createNpcName(template.prefix, regionIndex, npcIndex),
        npcType: template.npcType,
        region: regionName,
        rank: template.npcType === "vanguard_officer" ? "Deputy Officer" : "Field Asset",
        schedule,
        currentLocation: current.location,
        currentAction: current.action,
        isHighCommand: false,
      };
    }),
  );

  return {
    name: regionName,
    alertLevel: "guarded",
    difficultyModifier: INITIAL_REGION_DIFFICULTY[regionName] || 1,
    activeAlertModifier: 0,
    npcs,
  };
}

function seedNews(day, hour) {
  return [
    {
      id: "seed-1",
      type: "intercepted memo",
      text: "Vanguard logistics requests additional patrol units near harbor manifests.",
      timestamp: formatGameTime(day, hour),
    },
  ];
}

function createSectorState(regionName) {
  const id = slugify(regionName);
  const baseMissionId = regionName === "Kronstadt District" ? "kronstadt-blackout" : regionName === "Harbor Facility" ? "azure-meridian" : "vanguard-null";

  return {
    id,
    label: regionName,
    status: "contested",
    missionId: baseMissionId,
    instability: regionName === "Kronstadt District" ? 22 : regionName === "Harbor Facility" ? 16 : 12,
    propagandaControl: regionName === "Vanguard HQ" ? 82 : 68,
    surveillanceCoverage: regionName === "Harbor Facility" ? 74 : 62,
    logisticsStrength: regionName === "Kronstadt District" ? 78 : 58,
    enforcementPressure: regionName === "Vanguard HQ" ? 86 : 64,
    resistanceSupport: regionName === "Kronstadt District" ? 30 : 24,
    civilianUnrest: regionName === "Kronstadt District" ? 26 : 18,
    intelligenceLeaks: regionName === "Harbor Facility" ? 22 : 15,
    internalFractures: regionName === "Vanguard HQ" ? 12 : 18,
  };
}

function createCampaignState() {
  return {
    chapterId: "fracture-the-meridian",
    chapterLabel: "Fracture the Meridian",
    regimeStability: 82,
    resistanceMomentum: 18,
    publicFear: 74,
    activePriorityTargetId: "hc-2",
    sectors: REGION_NAMES.map(createSectorState),
  };
}

function computeSectorStatus(sector) {
  if (sector.enforcementPressure >= 88 || sector.propagandaControl >= 86) return "crackdown";
  if (sector.resistanceSupport >= 58 || sector.internalFractures >= 55) return "liberating";
  if (sector.instability >= 48 || sector.intelligenceLeaks >= 46) return "fracturing";
  return "contested";
}

function createChallengeBoard(worldState) {
  const dailyIndex = (worldState.day + worldState.hour) % 3;
  const weeklyIndex = worldState.day % 3;
  const dailyTemplates = [
    {
      id: `daily-silent-${worldState.day}`,
      label: "Silent Pressure",
      cadence: "daily",
      goal: "Finish an operation with no alarms and leave the district posture below active search.",
      reward: "Intel cache: softer patrol geometry on the next run.",
    },
    {
      id: `daily-disrupt-${worldState.day}`,
      label: "Disrupt the Grid",
      cadence: "daily",
      goal: "Complete sabotage before target elimination and extract through a live pressure route.",
      reward: "Resistance surge: raises instability in the chosen sector.",
    },
    {
      id: `daily-clean-${worldState.day}`,
      label: "No Loose Ends",
      cadence: "daily",
      goal: "Finish with zero non-target casualties and at least one hidden body or erased trace.",
      reward: "Codex intercept: unlocks an internal Iron Meridian briefing.",
    },
  ];
  const weeklyTemplates = [
    {
      id: `weekly-kronstadt-${worldState.day}`,
      label: "Break the Factory Chain",
      cadence: "weekly",
      goal: "Resolve three operations that weaken logistics or production-linked sectors.",
      reward: "Chapter damage: logistics strength permanently reduced across one sector.",
    },
    {
      id: `weekly-watch-${worldState.day}`,
      label: "Blind the Watchers",
      cadence: "weekly",
      goal: "Trigger two surveillance disruptions or anti-enforcer contracts across the board.",
      reward: "Resistance routing: new infiltration start pool for the next chapter.",
    },
    {
      id: `weekly-command-${worldState.day}`,
      label: "Command Fracture",
      cadence: "weekly",
      goal: "Eliminate or expose a priority target while leaving campaign fear below escalation threshold.",
      reward: "Regime fracture: raises internal fracture and intelligence leak values globally.",
    },
  ];

  return [dailyTemplates[dailyIndex], weeklyTemplates[weeklyIndex]];
}

function createLiveContentState(worldState) {
  const rotationSeed = createRotationSeed({
    day: worldState.day,
    hour: worldState.hour,
    revision: worldState.revision || 1,
    runCount: worldState.missionConsequences?.length || 0,
  });
  const sectors = worldState.campaign.sectors;
  const highestPressureSector = [...sectors].sort((a, b) => b.enforcementPressure - a.enforcementPressure)[0];
  const weakestSector = [...sectors].sort((a, b) => (a.propagandaControl + a.enforcementPressure) - (b.propagandaControl + b.enforcementPressure))[0];
  const unstableSector = [...sectors].sort((a, b) => (b.instability + b.intelligenceLeaks) - (a.instability + a.intelligenceLeaks))[0];
  const sectorAdaptationFlags = sectors.map((sector) => {
    const recentSuccesses = worldState.missionConsequences.filter((entry) => slugify(entry.region) === sector.id).length;
    const recentFailures = Math.max(0, Math.round((sector.enforcementPressure - sector.resistanceSupport) / 22));
    return {
      sectorId: sector.id,
      recentSuccesses,
      recentFailures,
      verificationPressure: Math.min(100, Math.round(sector.enforcementPressure * 0.72 + recentSuccesses * 8)),
      unrestOpportunity: Math.min(100, Math.round((sector.instability + sector.intelligenceLeaks + sector.resistanceSupport) / 3)),
    };
  });
  const activeMissionChains = [
    {
      id: `chain-${unstableSector.id}-fracture`,
      label: `Fracture ${unstableSector.label}`,
      trigger: `Instability and leaks are opening a sabotage-intel-assassination chain in ${unstableSector.label}.`,
      followUp: "Complete an intel or sabotage contract to unlock a harder priority strike.",
    },
    {
      id: `chain-${highestPressureSector.id}-retaliation`,
      label: `Break ${highestPressureSector.label} Retaliation`,
      trigger: `Verification pressure is climbing in ${highestPressureSector.label}.`,
      followUp: "Clean runs in this sector soften patrol escalation and open resistance corridors.",
    },
  ];

  const activeOperations = buildGeneratedOperations({
    sectors,
    dailySeed: rotationSeed.dailySeed,
    weeklySeed: rotationSeed.weeklySeed,
    revision: rotationSeed.revision + rotationSeed.runCount,
  });

  return {
    seasonId: "season-iron-breaker",
    seasonLabel: "Operation: Iron Breaker",
    dailySeed: rotationSeed.dailySeed,
    weeklySeed: rotationSeed.weeklySeed,
    activeOperations,
    challengeBoard: createChallengeBoard(worldState),
    activeCountermeasure:
      highestPressureSector.enforcementPressure >= 75
        ? "Checkpoint net expanded. Enforcers are shifting into layered verification sweeps."
        : "Command has ordered more discreet background checks in high-value districts.",
    activeResistanceOpportunity:
      weakestSector.resistanceSupport >= 42
        ? `Resistance cells in ${weakestSector.label} can support a follow-up strike.`
        : `Dormant cells in ${weakestSector.label} are asking for proof that the regime can bleed.`,
    activeMissionChains,
    sectorAdaptationFlags,
    quickMatchOperationIds: activeOperations.filter((operation) => operation.runtimeConfig.quickMatchEligible).map((operation) => operation.id),
    availableStoryMissionCount: getAvailableStoryMissionCount(),
  };
}

function ensureCampaignState(worldState) {
  if (!worldState.campaign) {
    worldState.campaign = createCampaignState();
  }
  worldState.campaign.sectors = worldState.campaign.sectors.map((sector) => ({
    ...sector,
    status: computeSectorStatus(sector),
  }));
  const averageStability =
    worldState.campaign.sectors.reduce(
      (total, sector) => total + sector.propagandaControl + sector.enforcementPressure + sector.logisticsStrength,
      0,
    ) /
    (worldState.campaign.sectors.length * 3);
  const averageMomentum =
    worldState.campaign.sectors.reduce(
      (total, sector) => total + sector.resistanceSupport + sector.intelligenceLeaks + sector.internalFractures,
      0,
    ) /
    (worldState.campaign.sectors.length * 3);
  worldState.campaign.regimeStability = Math.round(averageStability);
  worldState.campaign.resistanceMomentum = Math.round(averageMomentum);
  worldState.campaign.publicFear = Math.round(
    worldState.campaign.sectors.reduce((total, sector) => total + sector.civilianUnrest + sector.enforcementPressure, 0) /
      (worldState.campaign.sectors.length * 2),
  );
  worldState.liveContent = createLiveContentState(worldState);
}

export function createInitialWorldState() {
  const state = {
    day: START_DAY,
    hour: START_HOUR,
    lastTickAt: WORLD_ANCHOR_MS,
    revision: 1,
    lastOutcomeAt: null,
    regions: REGION_NAMES.map(createRegion),
    highCommand: structuredClone(INITIAL_HIGH_COMMAND),
    newsFeed: seedNews(START_DAY, START_HOUR),
    missionConsequences: [],
    sharedContribution: {
      totalAgentsDeployed: 0,
      coopOperationsResolved: 0,
      soloOperationsResolved: 0,
      sharedDisruptions: 0,
      sectorsWeakened: [],
      lastSessionId: null,
      lastUpdatedAt: null,
    },
    storyState: {
      missionTimeline: [],
      arcProgress: {},
      sectorScars: {},
    },
  };
  state.campaign = createCampaignState();
  state.liveContent = createLiveContentState(state);
  return state;
}

function computeAlertLevel(region, hour) {
  const hourBand = hour >= 20 || hour <= 5 ? "curfew" : "guarded";
  const dangerScore = region.difficultyModifier + (region.activeAlertModifier || 0);

  if (dangerScore >= 5) {
    return "lockdown";
  }

  if (dangerScore >= 4 || hourBand === "curfew") {
    return "curfew";
  }

  return "guarded";
}

function recordNews(worldState, entry) {
  worldState.newsFeed.unshift(entry);
  worldState.newsFeed = worldState.newsFeed.slice(0, 12);
}

function pushNews(worldState) {
  const region = worldState.regions[worldState.hour % worldState.regions.length];
  const templates = [
    `Vanguard announces curfew extension after routine disturbances in ${region.name}.`,
    `Intercepted radio traffic suggests increased inspections near ${region.npcs[0].currentLocation}.`,
    `Workers whisper about disappearances after security patrols intensified inside ${region.name}.`,
  ];

  recordNews(worldState, {
    id: `news-${worldState.day}-${worldState.hour}`,
    type: worldState.hour % 2 === 0 ? "radio broadcast" : "intercepted memo",
    text: templates[worldState.hour % templates.length],
    timestamp: formatGameTime(worldState.day, worldState.hour),
  });
}

function advanceRegionalPressure(nextState) {
  nextState.regions.forEach((region) => {
    if (region.activeAlertModifier > 0 && nextState.hour % 3 === 0) {
      region.activeAlertModifier = Math.max(0, region.activeAlertModifier - 1);
    }
    region.alertLevel = computeAlertLevel(region, nextState.hour);
  });
}

function normalizeCampaignPressure(nextState) {
  ensureCampaignState(nextState);
  nextState.campaign.sectors = nextState.campaign.sectors.map((sector) => {
    const region = nextState.regions.find((entry) => slugify(entry.name) === sector.id);
    const difficultyPressure = region ? Math.round(region.difficultyModifier * 6 + (region.activeAlertModifier || 0) * 8) : 0;
    const enforcementPressure = Math.min(100, Math.max(12, sector.enforcementPressure + Math.round(difficultyPressure * 0.15) - 1));
    const surveillanceCoverage = Math.min(100, Math.max(10, sector.surveillanceCoverage + (region?.alertLevel === "curfew" ? 2 : 0)));

    return {
      ...sector,
      enforcementPressure,
      surveillanceCoverage,
      resistanceSupport: Math.min(100, Math.max(0, sector.resistanceSupport - (sector.status === "crackdown" ? 1 : 0))),
      internalFractures: Math.min(100, Math.max(0, sector.internalFractures + (sector.status === "fracturing" ? 1 : 0))),
      status: computeSectorStatus({ ...sector, enforcementPressure, surveillanceCoverage }),
    };
  });
  ensureCampaignState(nextState);
}

export function tickWorldState(inputState, tickCount = 1) {
  let nextState = structuredClone(inputState);

  for (let index = 0; index < tickCount; index += 1) {
    nextState.hour += 1;
    if (nextState.hour >= 24) {
      nextState.hour = 0;
      nextState.day += 1;
    }

    nextState.regions.forEach((region) => {
      region.npcs.forEach((npc) => {
        const scheduleEntry = npc.schedule[nextState.hour];
        npc.currentLocation = scheduleEntry.location;
        npc.currentAction = scheduleEntry.action;
      });
    });

    advanceRegionalPressure(nextState);
    normalizeCampaignPressure(nextState);
    nextState = updateHighCommand(nextState);
    nextState.revision += 1;
    pushNews(nextState);
  }

  nextState.lastTickAt = Date.now();
  ensureCampaignState(nextState);
  return nextState;
}

export function catchUpWorldState(worldState) {
  const now = Date.now();
  const elapsed = now - (worldState.lastTickAt || now);
  const tickCount = Math.floor(elapsed / TICK_INTERVAL_MS);
  if (tickCount <= 0) {
    return worldState;
  }
  return tickWorldState(worldState, tickCount);
}

export function applyEliminations(worldState, eliminatedTargetIds = []) {
  return eliminatedTargetIds.reduce((currentState, targetId) => {
    const nextState = eliminateTarget(currentState, targetId);
    return nextState || currentState;
  }, structuredClone(worldState));
}

export function serializeWorldState(worldState) {
  ensureCampaignState(worldState);
  return {
    gameTime: formatGameTime(worldState.day, worldState.hour),
    regions: worldState.regions.map((region) => ({
      name: region.name,
      difficultyModifier: region.difficultyModifier,
      alertLevel: region.alertLevel,
    })),
    highCommand: worldState.highCommand.filter((target) => !target.replaced),
    keyNpcs: worldState.regions.flatMap((region) =>
      region.npcs
        .filter((npc) => npc.npcType !== "civilian_worker")
        .slice(0, 4)
        .map((npc) => ({
          id: npc.id,
          name: npc.name,
          npcType:
            npc.npcType === "vanguard_technician"
              ? "technician"
              : npc.npcType === "vanguard_officer"
                ? "officer"
                : npc.npcType === "enforcer"
                  ? "enforcer"
                  : "civilian",
          region: region.name,
          currentLocation: npc.currentLocation,
          currentAction: npc.currentAction,
        })),
    ),
    newsFeed: worldState.newsFeed,
    missionConsequences: worldState.missionConsequences.slice(0, 6),
    campaign: worldState.campaign,
    liveContent: worldState.liveContent,
    sharedContribution: worldState.sharedContribution,
    storyState: worldState.storyState,
  };
}

export function eliminateTarget(worldState, targetId) {
  const nextState = eliminateHighCommandTarget(worldState, targetId);
  if (!nextState) {
    return null;
  }

  nextState.revision = (nextState.revision || 0) + 1;
  recordNews(nextState, {
    id: `elimination-${targetId}-${Date.now()}`,
    type: "intercepted memo",
    text: "An encrypted bulletin confirms a senior Vanguard official has vanished under suspicious circumstances.",
    timestamp: formatGameTime(nextState.day, nextState.hour),
  });
  return updateHighCommand(nextState);
}

export function resolveMissionOutcome(worldState, missionOutcome) {
  const target = worldState.highCommand.find((entry) => entry.id === missionOutcome.targetId);
  if (!target) {
    return null;
  }

  const nextState = eliminateTarget(worldState, missionOutcome.targetId);
  if (!nextState) {
    return null;
  }

  const affectedRegion = nextState.regions.find((region) => region.name === (target.region || missionOutcome.region));
  ensureCampaignState(nextState);
  const affectedSector = nextState.campaign.sectors.find((sector) => sector.id === slugify(target.region || missionOutcome.region || ""));
  const resolvedOperation =
    nextState.liveContent?.activeOperations.find(
      (operation) =>
        operation.variantId === missionOutcome.variantId ||
        operation.id === missionOutcome.operationId ||
        operation.runtimeConfig.targetProfile.id === missionOutcome.targetId,
    ) || null;
  if (affectedRegion) {
    affectedRegion.activeAlertModifier = Math.min(3, (affectedRegion.activeAlertModifier || 0) + 2);
    affectedRegion.difficultyModifier += 1;
    affectedRegion.alertLevel = computeAlertLevel(affectedRegion, nextState.hour);
  }
  if (affectedSector) {
    const wasClean = (missionOutcome.alarmsTriggered || 0) === 0 && (missionOutcome.evidenceLeftBehind || 0) === 0;
    const teamSize = Math.max(1, Number(missionOutcome.teamSize) || 1);
    const coopBonus = teamSize > 1 ? Math.min(12, teamSize * 2) : 0;
    affectedSector.instability = Math.min(100, affectedSector.instability + (missionOutcome.targetEliminated ? 14 : 6) + (missionOutcome.secondaryObjectiveComplete ? 8 : 0));
    affectedSector.propagandaControl = Math.max(0, affectedSector.propagandaControl - (missionOutcome.targetEliminated ? 10 : 4));
    affectedSector.surveillanceCoverage = Math.max(0, affectedSector.surveillanceCoverage - (missionOutcome.solution === "poison" ? 3 : 1) - Math.round(coopBonus * 0.25));
    affectedSector.logisticsStrength = Math.max(0, affectedSector.logisticsStrength - (missionOutcome.secondaryObjectiveComplete ? 10 : 2) - Math.round(coopBonus * 0.3));
    affectedSector.enforcementPressure = Math.min(100, affectedSector.enforcementPressure + (wasClean ? 4 : 12));
    affectedSector.resistanceSupport = Math.min(100, affectedSector.resistanceSupport + (wasClean ? 10 : 6) + Math.round(coopBonus * 0.6));
    affectedSector.civilianUnrest = Math.min(100, affectedSector.civilianUnrest + (missionOutcome.targetEliminated ? 8 : 4) + Math.round(coopBonus * 0.3));
    affectedSector.intelligenceLeaks = Math.min(100, affectedSector.intelligenceLeaks + (missionOutcome.secondaryObjectiveComplete ? 10 : 5) + Math.round(coopBonus * 0.5));
    affectedSector.internalFractures = Math.min(100, affectedSector.internalFractures + (missionOutcome.targetEliminated ? 9 : 3) + Math.round(coopBonus * 0.4));
    affectedSector.status = computeSectorStatus(affectedSector);
    nextState.campaign.activePriorityTargetId = nextState.highCommand.find((entry) => entry.isAlive)?.id || null;
  }

  nextState.sharedContribution = nextState.sharedContribution || {
    totalAgentsDeployed: 0,
    coopOperationsResolved: 0,
    soloOperationsResolved: 0,
    sharedDisruptions: 0,
    sectorsWeakened: [],
    lastSessionId: null,
    lastUpdatedAt: null,
  };
  const teamSize = Math.max(1, Number(missionOutcome.teamSize) || 1);
  nextState.sharedContribution.totalAgentsDeployed += teamSize;
  nextState.sharedContribution.sharedDisruptions += (missionOutcome.secondaryObjectiveComplete ? 1 : 0) + (missionOutcome.targetEliminated ? 1 : 0);
  nextState.sharedContribution.lastSessionId = missionOutcome.sessionId || null;
  nextState.sharedContribution.lastUpdatedAt = formatGameTime(nextState.day, nextState.hour);
  if (teamSize > 1) nextState.sharedContribution.coopOperationsResolved += 1;
  else nextState.sharedContribution.soloOperationsResolved += 1;
  if (affectedSector && !nextState.sharedContribution.sectorsWeakened.includes(affectedSector.id)) {
    nextState.sharedContribution.sectorsWeakened.push(affectedSector.id);
  }

  nextState.lastOutcomeAt = Date.now();
  nextState.revision += 1;
  if (!nextState.storyState) {
    nextState.storyState = {
      missionTimeline: [],
      arcProgress: {},
      sectorScars: {},
    };
  }
  const storyAftermath =
    resolvedOperation &&
    buildAftermathSummary(resolvedOperation, {
      rating: missionOutcome.rating || null,
      alarmsTriggered: missionOutcome.alarmsTriggered || 0,
      evidenceLeftBehind: missionOutcome.evidenceLeftBehind || 0,
      targetEliminated: Boolean(missionOutcome.targetEliminated),
      secondaryObjectiveComplete: Boolean(missionOutcome.secondaryObjectiveComplete),
    });

  nextState.missionConsequences.unshift({
    id: `mission-${missionOutcome.targetId}-${nextState.revision}`,
    targetId: missionOutcome.targetId,
    title: storyAftermath?.headline || missionOutcome.title || "Mission outcome recorded",
    summary:
      storyAftermath?.resistanceReaction ||
      missionOutcome.summary ||
      "Resistance intercepts confirm the operation destabilized local command and triggered emergency countermeasures.",
    region: target.region,
    timestamp: formatGameTime(nextState.day, nextState.hour),
  });
  nextState.missionConsequences = nextState.missionConsequences.slice(0, 8);

  recordNews(nextState, {
    id: `mission-news-${missionOutcome.targetId}-${Date.now()}`,
    type: "radio broadcast",
    text:
      storyAftermath?.regimeReaction ||
      missionOutcome.broadcast ||
      `Emergency transmissions report command disruption and sudden checkpoint escalation in ${target.region}.`,
    timestamp: formatGameTime(nextState.day, nextState.hour),
  });

  if (resolvedOperation && storyAftermath) {
    const memory = buildMissionMemoryRecord({
      operation: resolvedOperation,
      summary: storyAftermath,
      timestamp: formatGameTime(nextState.day, nextState.hour),
    });
    nextState.storyState.missionTimeline = [memory, ...(nextState.storyState.missionTimeline || [])].slice(0, 18);
    nextState.storyState.arcProgress = {
      ...(nextState.storyState.arcProgress || {}),
      [resolvedOperation.story.arc.arcId]: (nextState.storyState.arcProgress?.[resolvedOperation.story.arc.arcId] || 0) + 1,
    };
    nextState.storyState.sectorScars = {
      ...(nextState.storyState.sectorScars || {}),
      [resolvedOperation.sectorId]: [
        storyAftermath.worldScar,
        ...((nextState.storyState.sectorScars?.[resolvedOperation.sectorId] || []).filter((entry) => entry !== storyAftermath.worldScar)),
      ].slice(0, 4),
    };
  }

  ensureCampaignState(nextState);
  return nextState;
}
