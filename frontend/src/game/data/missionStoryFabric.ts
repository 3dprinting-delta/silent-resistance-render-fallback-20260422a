import type {
  AftermathStorySummary,
  CampaignProgressState,
  GeneratedMissionDefinition,
  MissionArcProfile,
  MissionIdentityTagSet,
  MissionMemoryRecord,
  MissionStoryProfile,
  MissionTone,
  NarrativeFunctionProfile,
  NarrativeRole,
  PacingProfile,
  RegimeSystemFocus,
  StoryDeliveryPackage,
  StoryStateSnapshot,
  TurningPointDefinition,
} from "@/game/core/types";

type StoryArchetype = {
  id: string;
  codenamePrefix: string;
  operationFantasy: string;
  tone: MissionTone;
  pacingType: MissionStoryProfile["pacingType"];
  narrativeRole: NarrativeRole;
  regimeSystem: RegimeSystemFocus;
  targetClass: string;
  escalationProfile: MissionIdentityTagSet["escalationProfile"];
  sonicIdentity: StoryDeliveryPackage["sonicIdentity"];
  setup: string;
  complication: string;
  turningPoint: string;
  aftermathBeat: string;
  barks: string[];
  clues: string[];
};

type StorylessOperation = Omit<GeneratedMissionDefinition, "story">;

const storyArchetypes: StoryArchetype[] = [
  {
    id: "surveillance-collapse",
    codenamePrefix: "Glass Wire",
    operationFantasy: "Blind the regime's eyes while the target believes the floor is still under control.",
    tone: "paranoid",
    pacingType: "pressure_rise",
    narrativeRole: "surveillance_collapse",
    regimeSystem: "surveillance",
    targetClass: "watch commander",
    escalationProfile: "layered",
    sonicIdentity: "cold_hum",
    setup: "The district appears orderly, but every checkpoint is already running silent verification drills.",
    complication: "A secondary screening pattern exposes how deeply the target is nesting inside the watch network.",
    turningPoint: "The surveillance loop fractures and everyone nearby realizes the grid is lying to them.",
    aftermathBeat: "The regime loses certainty and overcorrects in public.",
    barks: ["Control is ghosting half the cameras.", "No one told the tower the pier is blind.", "Keep the consuls moving while the feeds stabilize."],
    clues: ["Camera arrays blink out of sequence.", "Security tablets show conflicting patrol routes.", "Checkpoint staff are repeating mismatched passphrases."],
  },
  {
    id: "propaganda-fracture",
    codenamePrefix: "Velvet Rupture",
    operationFantasy: "Expose the polished lie underneath a curated public spectacle.",
    tone: "elegant",
    pacingType: "slow_burn",
    narrativeRole: "propaganda_fracture",
    regimeSystem: "propaganda",
    targetClass: "curator",
    escalationProfile: "contained",
    sonicIdentity: "luxury_dread",
    setup: "The venue is immaculate, but staff are rehearsing lines they do not believe.",
    complication: "Hidden messaging reveals the target is shaping a narrative weapon, not just hosting an event.",
    turningPoint: "A polished public ritual becomes visibly predatory.",
    aftermathBeat: "The machine still smiles, but the audience has seen the gears underneath.",
    barks: ["Keep the cameras on the applause line.", "No one improvises when the curator is on the floor.", "They want elegance, not witnesses."],
    clues: ["Press cards are pre-stamped with replacement statements.", "Decorative panels hide emergency doctrine notices.", "Ballroom signage doubles as crowd control instructions."],
  },
  {
    id: "logistics-sabotage",
    codenamePrefix: "Iron Throat",
    operationFantasy: "Turn a supply chain into a choke point and let command feel the system seize up.",
    tone: "urgent",
    pacingType: "fracture_then_escape",
    narrativeRole: "logistics_sabotage",
    regimeSystem: "logistics",
    targetClass: "quartermaster",
    escalationProfile: "spiraling",
    sonicIdentity: "industrial_pulse",
    setup: "Crates move on time, staff keep their heads down, and everyone knows a delay is punishable.",
    complication: "The target is redistributing scarcity on purpose to bait dissenters into the open.",
    turningPoint: "A controlled logistics flow turns into a visible supply panic.",
    aftermathBeat: "The sector keeps running, but now every delivery feels like a weakness.",
    barks: ["Manifest says the shipment never landed.", "If command asks, the shortages are sabotage, not policy.", "Move the reserve stock before the workers see it."],
    clues: ["Priority manifests are hand-corrected to erase missing stock.", "Service elevators carry emergency requisition seals.", "Reserve stock is rerouted away from public-facing rooms."],
  },
  {
    id: "resistance-expansion",
    codenamePrefix: "Signal Bloom",
    operationFantasy: "Use stealth to prove resistance cells can act inside the regime's most controlled rooms.",
    tone: "defiant",
    pacingType: "cat_and_mouse",
    narrativeRole: "resistance_expansion",
    regimeSystem: "civilian_control",
    targetClass: "liaison",
    escalationProfile: "layered",
    sonicIdentity: "fracture_static",
    setup: "Dissent is quiet but present, hiding inside routine service traffic and coded gestures.",
    complication: "The operation reveals that the target is using ordinary civilians as a pressure valve for command.",
    turningPoint: "An ally signal appears just as the regime starts tightening local control.",
    aftermathBeat: "The resistance network becomes bolder and harder to erase.",
    barks: ["The service route changed again; someone is feeding us windows.", "If the contact misses this transfer, the whole cell burns.", "They are counting workers, not people."],
    clues: ["Utility closets carry chalk marks only visible from stealth routes.", "Small acts of refusal appear in staff staging areas.", "Service timetables have hidden handoff marks."],
  },
  {
    id: "internal-betrayal",
    codenamePrefix: "Severed Crest",
    operationFantasy: "Exploit a private power struggle before the regime closes ranks again.",
    tone: "volatile",
    pacingType: "infiltration_to_crisis",
    narrativeRole: "internal_betrayal",
    regimeSystem: "leadership",
    targetClass: "consul",
    escalationProfile: "spiraling",
    sonicIdentity: "cold_hum",
    setup: "Everyone in the room is smiling too carefully because everyone suspects an unseen purge.",
    complication: "The target is not just paranoid; they are actively preparing to bury a rival inside the operation window.",
    turningPoint: "A hidden purge becomes visible and the mission means more than the briefing admitted.",
    aftermathBeat: "The regime survives the night, but trust inside it does not.",
    barks: ["No one leaves the annex without secondary clearance.", "If the consul asks again, you never saw the transfer.", "They are purging someone tonight; they just do not know who."],
    clues: ["Escort routes overlap like an ambush, not protection.", "Confiscated personal items sit near VIP posts.", "Annex staff have been stripped of normal privileges."],
  },
  {
    id: "retaliation-suppression",
    codenamePrefix: "Quiet Hammer",
    operationFantasy: "Break an incoming crackdown before it hardens into sector doctrine.",
    tone: "desperate",
    pacingType: "pressure_rise",
    narrativeRole: "retaliation_suppression",
    regimeSystem: "enforcement",
    targetClass: "discipline chief",
    escalationProfile: "spiraling",
    sonicIdentity: "industrial_pulse",
    setup: "The operation begins in the shadow of a crackdown that has already been approved.",
    complication: "The target is treating the district as a live rehearsal for a broader purge.",
    turningPoint: "Suppression teams begin to mobilize and the player realizes this op is buying time, not just kills.",
    aftermathBeat: "The crackdown stalls, but the regime remembers who embarrassed it.",
    barks: ["They want the district soft before dawn.", "Once the discipline chief signs off, every route closes.", "This is not security, it is rehearsal for punishment."],
    clues: ["Detention kits wait in public-facing zones.", "Checkpoint rosters include extra names with no shift rotation.", "Service doors are tagged for emergency closure."],
  },
];

const tonalSuffixes = ["Protocol", "Veil", "Rift", "Thread", "Ledger", "Static", "Echo", "Spiral"];
const sectorContexts = ["summit", "annex", "marina", "service", "district"];
const pressureBands = ["routine", "frayed", "fracturing", "crackdown"];

function hash(value: string) {
  return value.split("").reduce((total, character, index) => total + character.charCodeAt(0) * (index + 1), 0);
}

function pickArchetype(index: number) {
  return storyArchetypes[index % storyArchetypes.length];
}

function toSectorLabel(sectorId: string) {
  return sectorId.replaceAll("-", " ");
}

function buildIdentity(operation: StorylessOperation, index: number): MissionIdentityTagSet {
  const seed = hash(`${operation.variantId}-${operation.sectorId}-${index}`);
  const archetype = pickArchetype(index);
  const timeBands = ["dawn", "day", "dusk", "night"] as const;
  return {
    sector: operation.sectorId,
    operationType: operation.type,
    threatLevel: operation.priority === "critical" ? "critical" : operation.priority === "high" ? "pressured" : "routine",
    timeContext: timeBands[seed % timeBands.length],
    tone: archetype.tone,
    pacing: archetype.pacingType,
    narrativeRole: archetype.narrativeRole,
    regimeSystem: archetype.regimeSystem,
    targetClass: archetype.targetClass,
    resistanceRelevance: operation.priority === "critical" ? "campaign" : operation.priority === "high" ? "regional" : "local",
    escalationProfile: archetype.escalationProfile,
  };
}

function buildNarrative(archetype: StoryArchetype, operation: StorylessOperation): NarrativeFunctionProfile {
  return {
    weakens: archetype.regimeSystem,
    pressureCreated: `${archetype.regimeSystem} control in ${toSectorLabel(operation.sectorId)} will destabilize if the operation lands cleanly.`,
    futureHook: `A follow-up strike can open once ${operation.runtimeConfig.targetProfile.label} loses control of ${archetype.regimeSystem}.`,
    campaignMeaning: `${operation.runtimeConfig.targetProfile.label} is a pressure point inside the Iron Meridian's ${archetype.regimeSystem} apparatus.`,
  };
}

function buildArc(archetype: StoryArchetype, operation: StorylessOperation): MissionArcProfile {
  return {
    arcId: `${archetype.narrativeRole}-${operation.sectorId}`,
    thread: archetype.narrativeRole,
    predecessorCondition: `Pressure in ${toSectorLabel(operation.sectorId)} has risen enough for a ${archetype.narrativeRole.replaceAll("_", " ")} episode.`,
    followUpHook: `If this op succeeds, the next strike can widen the ${archetype.narrativeRole.replaceAll("_", " ")} thread in ${toSectorLabel(operation.sectorId)}.`,
    callbackTag: `${archetype.id}-${operation.runtimeConfig.targetProfile.role}`,
  };
}

function buildPacing(archetype: StoryArchetype): PacingProfile {
  return {
    setup: archetype.setup,
    complication: archetype.complication,
    turningPoint: archetype.turningPoint,
    aftermathBeat: archetype.aftermathBeat,
  };
}

function buildTurningPoints(archetype: StoryArchetype, operation: StorylessOperation): TurningPointDefinition[] {
  return [
    {
      trigger: "timer",
      summary: archetype.complication,
      bark: archetype.barks[0],
    },
    {
      trigger: operation.runtimeConfig.securityTier === "lockdown" ? "alert_escalation" : "target_window",
      summary: archetype.turningPoint,
      bark: archetype.barks[1] || archetype.barks[0],
    },
    {
      trigger: "objective_progress",
      summary: `The operation's true cost becomes clear once ${operation.runtimeConfig.objectiveBundle.secondary.toLowerCase()}.`,
      bark: archetype.barks[2] || archetype.barks[0],
    },
  ];
}

function buildDelivery(archetype: StoryArchetype, operation: StorylessOperation, index: number): StoryDeliveryPackage {
  const suffix = tonalSuffixes[index % tonalSuffixes.length];
  const pressureClass =
    operation.priority === "critical" ? "critical" : operation.priority === "high" ? "volatile" : "contained";
  return {
    briefingHook: `${archetype.setup} ${operation.runtimeConfig.liveEventOverlay}`,
    preMissionIntel: `${operation.runtimeConfig.targetProfile.label} has become the living face of ${archetype.regimeSystem} pressure in this sector, and resistance analysts believe the window will collapse fast if this episode turns public.`,
    briefingTone:
      pressureClass === "critical"
        ? "Command already assumes this district is sliding toward emergency doctrine."
        : pressureClass === "volatile"
          ? "The district is holding together on appearances and threat discipline."
          : "The floor still looks orderly, but the operation is entering a controlled fault line.",
    dossierHook: `${operation.runtimeConfig.targetProfile.label} is not just a target. They are the political instrument carrying ${archetype.regimeSystem} pressure through ${operation.sectorId.replaceAll("-", " ")}.`,
    callbackHooks: [
      `If this strike lands, ${archetype.regimeSystem} doctrine in ${operation.sectorId.replaceAll("-", " ")} will have to overreact in public.`,
      `If it goes loud, command will use the breach to justify harsher control patterns in the same sector.`,
      `${operation.runtimeConfig.targetProfile.label}'s removal would sharpen the ${archetype.narrativeRole.replaceAll("_", " ")} thread immediately.`,
    ],
    overheardBarks: archetype.barks,
    environmentalClues: archetype.clues,
    targetBehaviorNote: `${operation.runtimeConfig.targetProfile.label} behaves like a ${archetype.targetClass}, not a passive objective.`,
    revealLine: `${archetype.turningPoint} The operation is now about more than ${operation.runtimeConfig.objectiveBundle.primary.toLowerCase()}.`,
    aftermathTemplate: `${archetype.aftermathBeat} Resistance archivists will remember this as ${archetype.codenamePrefix} ${suffix}.`,
    aftermathReportLine: `After-action interpretation: ${archetype.aftermathBeat} ${operation.runtimeConfig.targetProfile.label}'s network will not recover cleanly from this shock.`,
    impactCallouts: [
      `${archetype.regimeSystem} control is weakening in visible ways.`,
      `Resistance confidence is rising because this sector can no longer pretend the machine is seamless.`,
      `Future operations in ${operation.sectorId.replaceAll("-", " ")} now inherit the scar left by this strike.`,
    ],
    clueCadence: archetype.pacingType === "slow_burn" ? "sparse" : archetype.pacingType === "pressure_rise" || archetype.pacingType === "infiltration_to_crisis" ? "dense" : "steady",
    sonicIdentity: archetype.sonicIdentity,
  };
}

export function buildMissionStoryProfile(operation: StorylessOperation, index: number): MissionStoryProfile {
  const archetype = pickArchetype(index);
  const suffix = tonalSuffixes[(hash(operation.id) + index) % tonalSuffixes.length];
  const pressureClass =
    operation.priority === "critical" ? "critical" : operation.priority === "high" ? "volatile" : "contained";
  return {
    codename: `${archetype.codenamePrefix} ${suffix}`,
    operationFantasy: archetype.operationFantasy,
    emotionalTone: archetype.tone,
    pacingType: archetype.pacingType,
    pressureClass,
    identity: buildIdentity(operation, index),
    narrative: buildNarrative(archetype, operation),
    arc: buildArc(archetype, operation),
    pacing: buildPacing(archetype),
    delivery: buildDelivery(archetype, operation, index),
    turningPoints: buildTurningPoints(archetype, operation),
    targetCharacterization: `${operation.runtimeConfig.targetProfile.label} is the sector's ${archetype.targetClass}, carrying the emotional weight of a ${archetype.tone} episode.`,
    boardTags: [
      archetype.regimeSystem.replaceAll("_", " "),
      archetype.pacingType.replaceAll("_", " "),
      archetype.targetClass,
      pressureClass,
    ],
  };
}

export function buildStoryMissionCount(baseVariants: number) {
  return baseVariants * storyArchetypes.length * tonalSuffixes.length * sectorContexts.length * pressureBands.length;
}

export function buildAftermathSummary(
  operation: Pick<GeneratedMissionDefinition, "sectorId" | "story">,
  result: {
    rating: string | null;
    alarmsTriggered: number;
    evidenceLeftBehind: number;
    targetEliminated: boolean;
    secondaryObjectiveComplete: boolean;
  },
): AftermathStorySummary {
  const wasClean = result.alarmsTriggered === 0 && result.evidenceLeftBehind === 0;
  return {
    headline: `${operation.story.codename} / ${result.rating || "Pending"}`,
    resistanceReaction: result.secondaryObjectiveComplete
      ? `Resistance cells are circulating the leverage recovered during ${operation.story.codename}.`
      : `Resistance cells are treating ${operation.story.codename} as proof that ${operation.story.identity.regimeSystem} can still be cut open.`,
    regimeReaction:
      result.alarmsTriggered > 0 || result.evidenceLeftBehind > 0
        ? `Iron Meridian command is tightening ${toSectorLabel(operation.sectorId)} after visible signs of breach.`
        : `Command knows something broke in ${toSectorLabel(operation.sectorId)}, but not who authored ${operation.story.codename}.`,
    worldScar: `${toSectorLabel(operation.sectorId)} now carries the scar of ${operation.story.arc.callbackTag}.`,
    nextHook: operation.story.arc.followUpHook,
    impactLine: wasClean
      ? `${toSectorLabel(operation.sectorId)} absorbed a clean wound. The regime lost certainty faster than it gained evidence.`
      : `${toSectorLabel(operation.sectorId)} was damaged, but the backlash is now part of the story of this sector.`,
    chainRisk: result.alarmsTriggered > 0 || result.evidenceLeftBehind > 0
      ? `Command can weaponize this breach into heavier verification and retaliation patterns.`
      : `The next operation inherits confusion, panic, and a thinner command picture instead of immediate certainty.`,
    reportLine: operation.story.delivery.aftermathReportLine,
  };
}

export function buildMissionMemoryRecord(params: {
  operation: Pick<GeneratedMissionDefinition, "id" | "missionId" | "sectorId" | "story">;
  summary: AftermathStorySummary;
  timestamp: string;
}): MissionMemoryRecord {
  return {
    id: `${params.operation.id}-memory`,
    missionId: params.operation.missionId,
    codename: params.operation.story.codename,
    headline: params.summary.headline,
    summary: `${params.summary.resistanceReaction} ${params.summary.regimeReaction}`,
    callbackTag: params.operation.story.arc.callbackTag,
    sectorId: params.operation.sectorId,
    timestamp: params.timestamp,
    arcId: params.operation.story.arc.arcId,
    callbackPriority: params.summary.chainRisk.includes("heavier verification") ? 3 : 2,
    impactSummary: params.summary.impactLine,
    unresolvedRisk: params.summary.chainRisk,
  };
}

export function buildStoryContinuityStack(params: {
  operation: GeneratedMissionDefinition | null;
  storyState?: StoryStateSnapshot | null;
  progress?: CampaignProgressState | null;
}) {
  const timeline = params.storyState?.missionTimeline || [];
  const sameSector = params.operation ? timeline.find((memory) => memory.sectorId === params.operation?.sectorId) : null;
  const sameArc = params.operation ? timeline.find((memory) => memory.arcId === params.operation?.story.arc.arcId) : null;
  const sameCallback = params.operation ? timeline.find((memory) => memory.callbackTag === params.operation?.story.arc.callbackTag) : null;
  const latest = timeline[0] || null;
  const decisiveRun = params.progress?.operationHistory?.find((entry) => entry.rating === "Silent Phantom" || entry.rating === "Ghost") || params.progress?.operationHistory?.[0] || null;

  return {
    latest,
    sameSector,
    sameArc,
    sameCallback,
    decisiveRun,
    primaryCallback: sameSector || sameArc || sameCallback || latest,
  };
}
