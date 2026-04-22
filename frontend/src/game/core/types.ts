export type CameraMode = "third_person" | "first_person";
export type ActorRole = "civilian" | "technician" | "officer" | "enforcer" | "target";
export type AIState = "routine" | "investigating" | "alert" | "searching" | "escort" | "down";
export type AlertTier = "calm" | "suspicious" | "investigating" | "compromised" | "lockdown";
export type DisguiseId = "civilian" | "worker" | "technician" | "security_grunt" | "officer";
export type SolutionType = "social" | "poison" | "environmental";
export type PlayerPosture = "stand" | "crouch" | "dragging";
export type StealthState = "clear" | "noticed" | "suspicious" | "investigating" | "compromised";
export type WatcherKind = "sentry" | "checkpoint" | "searchlight";
export type AccessTier = 0 | 1 | 2 | 3 | 4;
export type AccessState = "legal" | "soft_restricted" | "hard_restricted" | "enforcer_compromised";
export type DominantRiskSource = "none" | "trespass" | "exposure" | "behavior" | "enforcer" | "recent_crime";
export type AiRole = "civilian" | "staff" | "guard" | "target" | "bodyguard";
export type AiState = "routine" | "patrol" | "stationed" | "suspicious" | "investigating" | "searching" | "alerted" | "escort" | "returning" | "down" | "fleeing" | "reporting";
export type StimulusType = "sound" | "body_found" | "unconscious_found" | "sabotage" | "trespass" | "sighting" | "report";
export type IncidentCategory = "sound" | "crime" | "body" | "sabotage" | "trespass";
export type GuardResponseRole = "lead" | "support" | "perimeter" | "report" | "flee" | "protect" | "none";
export type BodyguardFormation = "loose" | "screen" | "diamond" | "wedge";
export type MissionDetourState = "none" | "annex_inspection" | "ballroom_recovery" | "vip_fallback";
export type EscortSplitState = "none" | "annex" | "service" | "security";
export type MissionRouteUnlock = "annex" | "basement" | "terrace";
export type CameraPresentationState =
  | "exploration"
  | "stealth_focus"
  | "trespass_tension"
  | "alert_danger"
  | "interaction_focus"
  | "target_focus";
export type TensionPresentationState = "calm" | "watchful" | "pressed" | "critical";
export type AnimationClipRole =
  | "idle"
  | "walk"
  | "run"
  | "alert"
  | "investigate"
  | "search"
  | "panic"
  | "escort"
  | "bodyguard"
  | "civilian"
  | "target";
export type AudioTensionState = "calm" | "suspicion" | "investigation" | "alert" | "crisis";
export type SessionMode = "solo" | "coop";
export type SessionStatus = "idle" | "matchmaking" | "lobby" | "loading" | "in_mission" | "extracting" | "resolved" | "disconnected";
export type AgentRoleProfile = "infiltrator" | "disruptor" | "scout" | "support";
export type MissionTone = "oppressive" | "urgent" | "paranoid" | "defiant" | "elegant" | "desperate" | "volatile" | "mournful";
export type MissionPacingType = "slow_burn" | "pressure_rise" | "cat_and_mouse" | "fracture_then_escape" | "infiltration_to_crisis";
export type NarrativeRole = "surveillance_collapse" | "propaganda_fracture" | "logistics_sabotage" | "resistance_expansion" | "internal_betrayal" | "retaliation_suppression" | "regime_collapse";
export type RegimeSystemFocus = "surveillance" | "propaganda" | "logistics" | "enforcement" | "leadership" | "discipline" | "civilian_control";
export type IncidentSource =
  | "disguise_swap"
  | "behavior"
  | "trespass"
  | "sabotage"
  | "poison_prep"
  | "objective_theft"
  | "body_handling"
  | "target_elimination"
  | "mission_shift";

export type Vec3 = [number, number, number];

export interface WorldSnapshot {
  gameTime: string;
  regions: { name: string; difficultyModifier: number; alertLevel: string }[];
  highCommand: { id: string; name: string; rank: string; region: string; difficultyModifier: number; isAlive: boolean }[];
  keyNpcs: { id: string; name: string; npcType: string; region: string; currentLocation: string; currentAction: string }[];
  newsFeed: { id: string; type: string; text: string; timestamp: string }[];
  missionConsequences?: { id: string; title?: string; summary: string; region: string; timestamp: string }[];
  campaign?: CampaignWorldState;
  liveContent?: LiveContentState;
  sharedContribution?: SharedCampaignContribution;
  storyState?: StoryStateSnapshot;
}

export interface SectorStatus {
  id: string;
  label: string;
  status: "contested" | "fracturing" | "liberating" | "crackdown";
  missionId: string;
  instability: number;
  propagandaControl: number;
  surveillanceCoverage: number;
  logisticsStrength: number;
  enforcementPressure: number;
  resistanceSupport: number;
  civilianUnrest: number;
  intelligenceLeaks: number;
  internalFractures: number;
}

export interface CampaignWorldState {
  chapterId: string;
  chapterLabel: string;
  regimeStability: number;
  resistanceMomentum: number;
  publicFear: number;
  activePriorityTargetId: string | null;
  sectors: SectorStatus[];
}

export interface OperationCard {
  id: string;
  missionId: string;
  title: string;
  type: "priority_assassination" | "intel_theft" | "sabotage_op" | "extraction_op" | "disruption_contract" | "sector_crisis";
  sectorId: string;
  priority: "critical" | "high" | "rising";
  objective: string;
  strategicEffect: string;
  rewardHint: string;
  timeWindow: string;
}

export interface ChallengeBoardEntry {
  id: string;
  label: string;
  cadence: "daily" | "weekly";
  goal: string;
  reward: string;
}

export interface LiveContentState {
  seasonId: string;
  seasonLabel: string;
  dailySeed: string;
  weeklySeed: string;
  activeOperations: GeneratedMissionDefinition[];
  challengeBoard: ChallengeBoardEntry[];
  activeCountermeasure: string;
  activeResistanceOpportunity: string;
  activeMissionChains: Array<{ id: string; label: string; trigger: string; followUp: string }>;
  sectorAdaptationFlags: SectorAdaptationState[];
  quickMatchOperationIds: string[];
  availableStoryMissionCount?: number;
}

export interface ObjectiveBundle {
  primary: string;
  secondary: string;
  extraction: string;
}

export interface LayoutVariant {
  id: string;
  label: string;
  propLayoutSeed: number;
  lightingBias: "warm_public" | "cold_security" | "storm_service" | "vip_after_hours";
  landmarkFocus: "lobby" | "annex" | "marina" | "service";
}

export interface MissionVariantConfig {
  id: string;
  label: string;
  siteId: "azure-meridian" | "kronstadt-shell";
  worldRegion: string;
  targetProfile: {
    id: string;
    label: string;
    role: "harbor_prefect" | "summit_consul" | "discipline_chief" | "propaganda_curator";
  };
  objectiveBundle: ObjectiveBundle;
  securityTier: "guarded" | "hardened" | "lockdown";
  entryPool: Array<{ id: string; label: string; position: Vec3; zoneId: string; disguiseId: DisguiseId }>;
  extractionPool: Array<{ id: string; label: string; zoneId: string }>;
  lightingProfileId: string;
  layoutVariantId: string;
  zoneTagOverrides: string[];
  propLayoutSeed: number;
  challengeModifiers: string[];
  liveEventOverlay: string;
  recommendedTeamSize: number;
  maxTeamSize: number;
  coopSubObjectives: string[];
  quickMatchEligible: boolean;
  teamExtractionRule: "all_extract" | "partial_credit" | "first_exit_unlocks";
}

export interface MissionTemplate {
  missionId: string;
  title: string;
  summary: string;
  siteId: "azure-meridian" | "kronstadt-shell";
  variants: MissionVariantConfig[];
}

export interface GeneratedMissionDefinition extends OperationCard {
  templateId: string;
  variantId: string;
  summary: string;
  runtimeConfig: MissionVariantConfig;
  story: MissionStoryProfile;
}

export interface LiveRotationSeed {
  dailySeed: string;
  weeklySeed: string;
  revision: number;
  runCount: number;
}

export interface SectorAdaptationState {
  sectorId: string;
  recentSuccesses: number;
  recentFailures: number;
  verificationPressure: number;
  unrestOpportunity: number;
}

export interface AudioCueEvent {
  id: string;
  cue: "near_detection" | "body_discovered" | "target_isolated" | "objective_complete" | "extraction_open" | "mission_result";
  severity: number;
  createdAt: number;
}

export interface AudioLayerProfile {
  state: AudioTensionState;
  droneFrequency: number;
  pulseFrequency: number;
  noiseIntensity: number;
  gain: number;
}

export interface CampaignProgressState {
  onboardingStage: "intro" | "first_run" | "first_debrief" | "complete";
  unlockedStarts: string[];
  unlockedModifiers: string[];
  unlockedIntelAdvantages: string[];
  unlockedMissionIds: string[];
  codexEntries: string[];
  routeMastery: Record<string, number>;
  sectorLiberation: Record<string, number>;
  discoveredOpportunities: string[];
  operationHistory: {
    id: string;
    missionId: string;
    rating: string;
    score: number;
    timestamp: number;
    teamSize?: number;
    sessionId?: string | null;
  }[];
  recentHighlights: RunHighlightBundle[];
  legendMoments: LegendMomentRecord[];
  lastChallengePayload: ChallengeSharePayload | null;
  nextRecommendedOperationId: string | null;
}

export interface PlayerPresence {
  playerId: string;
  deviceId?: string;
  identityProvider?: "anonymous" | "linked_account";
  name: string;
  role: AgentRoleProfile;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  joinedAt: number;
  lastSeenAt: number;
}

export interface ReplicatedPlayerState extends PlayerPresence {
  position: Vec3;
  velocity: Vec3;
  facing: number;
  posture: PlayerPosture;
  disguiseId: DisguiseId;
  accessState: AccessState;
  stealthState: StealthState;
  suspicion: number;
  currentZoneId: string;
  carriedBodyId: string | null;
  pingMs?: number;
  authorityAckSequence?: number;
  authorityUpdatedAt?: number;
  linkProviders?: string[];
}

export interface TeamObjectiveState {
  primaryComplete: boolean;
  secondaryComplete: boolean;
  targetEliminated: boolean;
  extractionReady: boolean;
  missionComplete: boolean;
  sabotageFlags: Record<string, boolean>;
  extractedPlayerIds: string[];
  compromisedPlayerIds: string[];
  assistCount: number;
  sharedFailure: boolean;
}

export interface MissionPingMarker {
  id: string;
  playerId: string;
  label: string;
  position: Vec3;
  createdAt: number;
}

export interface ReplicatedMissionState {
  operationId: string | null;
  sessionMode: SessionMode;
  globalAlertLevel: number;
  targetWindowState: "guarded" | "vulnerable" | "relocating";
  missionPressure: MissionPressureState;
  activeIncidents: Array<{
    id: string;
    category: IncidentCategory;
    zoneClusterId: string;
    severity: number;
    ownerPlayerId?: string | null;
    createdAt: number;
  }>;
  teamObjectives: TeamObjectiveState;
  pings: MissionPingMarker[];
  extractionState: "locked" | "available" | "partial" | "complete";
  authorityRevision?: number;
  authoritySource?: "backend" | "client_fallback";
  serverTime?: number;
  eventLog?: Array<{
    id: string;
    kind: "incident" | "alert" | "lockdown" | "target_window" | "extraction" | "objective";
    summary: string;
    severity: "info" | "warning" | "critical";
    ownerPlayerId?: string | null;
    createdAt: number;
  }>;
  joinInProgressAllowed?: boolean;
}

export interface LobbyState {
  sessionId: string;
  code: string;
  partyId?: string;
  operationId: string | null;
  privacy: "private" | "public";
  quickMatchEligible: boolean;
  status: SessionStatus;
  maxPlayers: number;
  players: ReplicatedPlayerState[];
  selectedMissionTitle?: string | null;
}

export interface SessionState {
  sessionId: string | null;
  code: string | null;
  mode: SessionMode;
  status: SessionStatus;
  localPlayerId: string | null;
  operationId: string | null;
  players: ReplicatedPlayerState[];
  missionState: ReplicatedMissionState | null;
  reconnectToken?: string | null;
  deviceId?: string | null;
  backendConnected: boolean;
  authoritySource?: "backend" | "solo_fallback";
}

export interface CoopDebriefState {
  sessionId: string | null;
  teamSize: number;
  extractedAgents: number;
  compromisedAgents: number;
  teamStealthScore: number;
  assistActions: number;
  contributionSummary: string[];
}

export interface SharedCampaignContribution {
  totalAgentsDeployed: number;
  coopOperationsResolved: number;
  soloOperationsResolved: number;
  sharedDisruptions: number;
  sectorsWeakened: string[];
  lastSessionId: string | null;
  lastUpdatedAt: string | null;
}

export interface MissionIdentityTagSet {
  sector: string;
  operationType: string;
  threatLevel: "routine" | "pressured" | "critical";
  timeContext: "dawn" | "day" | "dusk" | "night";
  tone: MissionTone;
  pacing: MissionPacingType;
  narrativeRole: NarrativeRole;
  regimeSystem: RegimeSystemFocus;
  targetClass: string;
  resistanceRelevance: "local" | "regional" | "campaign";
  escalationProfile: "contained" | "layered" | "spiraling";
}

export interface NarrativeFunctionProfile {
  weakens: RegimeSystemFocus;
  pressureCreated: string;
  futureHook: string;
  campaignMeaning: string;
}

export interface MissionArcProfile {
  arcId: string;
  thread: NarrativeRole;
  predecessorCondition: string;
  followUpHook: string;
  callbackTag: string;
}

export interface PacingProfile {
  setup: string;
  complication: string;
  turningPoint: string;
  aftermathBeat: string;
}

export interface TurningPointDefinition {
  trigger: "timer" | "target_window" | "incident_spike" | "objective_progress" | "alert_escalation";
  summary: string;
  bark: string;
}

export interface StoryDeliveryPackage {
  briefingHook: string;
  preMissionIntel: string;
  briefingTone: string;
  dossierHook: string;
  callbackHooks: string[];
  overheardBarks: string[];
  environmentalClues: string[];
  targetBehaviorNote: string;
  revealLine: string;
  aftermathTemplate: string;
  aftermathReportLine: string;
  impactCallouts: string[];
  clueCadence: "sparse" | "steady" | "dense";
  sonicIdentity: "cold_hum" | "luxury_dread" | "industrial_pulse" | "fracture_static";
}

export interface MissionStoryProfile {
  codename: string;
  operationFantasy: string;
  emotionalTone: MissionTone;
  pacingType: MissionPacingType;
  pressureClass: "contained" | "volatile" | "critical";
  identity: MissionIdentityTagSet;
  narrative: NarrativeFunctionProfile;
  arc: MissionArcProfile;
  pacing: PacingProfile;
  delivery: StoryDeliveryPackage;
  turningPoints: TurningPointDefinition[];
  targetCharacterization: string;
  boardTags: string[];
}

export interface MissionMemoryRecord {
  id: string;
  missionId: string;
  codename: string;
  headline: string;
  summary: string;
  callbackTag: string;
  sectorId: string;
  timestamp: string;
  arcId: string;
  callbackPriority: number;
  impactSummary: string;
  unresolvedRisk: string;
}

export interface AftermathStorySummary {
  headline: string;
  resistanceReaction: string;
  regimeReaction: string;
  worldScar: string;
  nextHook: string;
  impactLine: string;
  chainRisk: string;
  reportLine: string;
}

export interface StoryStateSnapshot {
  missionTimeline: MissionMemoryRecord[];
  arcProgress: Record<string, number>;
  sectorScars: Record<string, string[]>;
}

export type MomentHighlightCategory =
  | "Clutch Save"
  | "Perfect Ghost Chain"
  | "Catastrophic Recovery"
  | "Elegant Sabotage"
  | "Impossible Escape"
  | "Co-op Miracle"
  | "Regime Breaker"
  | "Archive-Worthy Incident";

export type DetectedMomentType =
  | "clutch_recovery"
  | "perfect_chain"
  | "chaos_spike"
  | "rare_window"
  | "coop_save"
  | "last_second_extraction"
  | "high_risk_success"
  | "creative_objective"
  | "unexpected_isolation"
  | "chain_reaction"
  | "coop_recovery"
  | "ghost_sequence"
  | "story_chaos_combo"
  | "rare_outcome_combo";

export interface DetectedMoment {
  id: string;
  type: DetectedMomentType;
  label: string;
  headline: string;
  summary: string;
  severity: "info" | "warning" | "critical";
  createdAt: number;
  sequenceIndex: number;
  missionId: string;
  operationId: string | null;
  objectiveId?: string | null;
  sectorId: string;
  tensionLevel: number;
  rarityScore: number;
  shareabilityScore: number;
  highlightCategory: MomentHighlightCategory;
  tags: string[];
}

export interface ChallengeSharePayload {
  version: 1;
  operationId: string | null;
  missionId: string;
  variantId: string | null;
  codename: string;
  missionTitle: string;
  seedReference: string;
  hook: string;
  restriction: string;
  beatThisText: string;
  payloadCode: string;
}

export interface ReplaySeedPayload {
  version: 1;
  operationId: string | null;
  missionId: string;
  variantId: string | null;
  seedReference: string;
  recommendedTeamSize: number;
  pressureProfile: string | null;
  worldStateHint: string | null;
  challengeRestriction: string | null;
  challengeHook: string;
}

export interface ShareExportPayload {
  version: 1;
  runId: string;
  missionTitle: string;
  codename: string;
  headline: string;
  summary: string;
  operationId: string | null;
  variantId: string | null;
  sectorId: string;
  challengeText: string;
  challengeCode: string;
  tags: string[];
}

export interface ShareMediaPayload {
  imageDataUrl?: string | null;
  thumbnailDataUrl?: string | null;
  clipDataUrl?: string | null;
  cardSvg?: string | null;
  clipSupported?: boolean;
  clipFilename?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  clipUrl?: string | null;
}

export interface StoredShareRecord {
  id: string;
  createdAt: number;
  ownerAccountId: string | null;
  ownerPlayerId: string | null;
  missionId: string | null;
  operationId: string | null;
  variantId: string | null;
  sectorId: string | null;
  headline: string;
  recap: string;
  campaignImpact: string | null;
  consequenceLine: string | null;
  personalAchievement: string | null;
  coopSummary: string | null;
  shareSummary: string;
  tags: string[];
  topMoments: DetectedMoment[];
  exportPayload: ShareExportPayload | null;
  challenge: ChallengeSharePayload | null;
  replaySeed: ReplaySeedPayload;
  media: ShareMediaPayload | null;
  analytics?: {
    views: number;
    uniqueVisitors: number;
    launches: number;
    completions: number;
    returnVisits: number;
    lastViewedAt: number | null;
    lastCompletedAt: number | null;
  };
}

export interface ShareLookupResponse {
  ok: true;
  share: StoredShareRecord;
}

export interface ShareCreateRequest extends RunHighlightBundle {
  ownerAccountId?: string | null;
  ownerPlayerId?: string | null;
  replaySeed: ReplaySeedPayload;
  media?: ShareMediaPayload | null;
}

export interface RunHighlightBundle {
  id: string;
  missionId: string;
  operationId: string | null;
  variantId: string | null;
  sectorId: string;
  generatedAt: number;
  headline: string;
  recap: string;
  campaignImpact: string;
  personalAchievement: string;
  consequenceLine: string;
  coopSummary: string | null;
  shareSummary: string;
  challenge: ChallengeSharePayload;
  replaySeed: ReplaySeedPayload;
  exportPayload: ShareExportPayload;
  topMoments: DetectedMoment[];
  tags: string[];
}

export interface LegendMomentRecord {
  id: string;
  label: string;
  headline: string;
  summary: string;
  category: MomentHighlightCategory;
  operationId: string | null;
  missionId: string;
  sectorId: string;
  createdAt: number;
  shareabilityScore: number;
  tags: string[];
  challengeText: string;
}

export interface LinkedIdentityReference {
  accountId: string;
  provider: "nextauth";
  linkedAt: number;
}

export interface StealthCloudProfile {
  accountId: string;
  linkedPlayerIds: string[];
  recentHighlights: RunHighlightBundle[];
  legendMoments: LegendMomentRecord[];
  lastChallengePayload: ChallengeSharePayload | null;
  progressionSummary: string | null;
  notifications: Array<{ id: string; type: string; message: string; createdAt: number }>;
  stats: {
    shareClicks: number;
    challengeCompletions: number;
    returningUsers: number;
  };
  lastVisitedAt: number | null;
  visitCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ZoneDefinition {
  id: string;
  label: string;
  clearance: DisguiseId[];
  witnessWeight: number;
  stealthModifier: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface RouteDefinition {
  id: string;
  points: Vec3[];
  loop?: boolean;
}

export interface ActorDefinition {
  id: string;
  label: string;
  role: ActorRole;
  routeId: string;
  speed: number;
  visionRange: number;
  recognition: number;
  startIndex?: number;
  pauseMs?: number;
  disguiseEnforcer?: boolean;
  patrolBias?: number;
}

export interface ActorRuntime extends ActorDefinition {
  position: Vec3;
  nodeIndex: number;
  state: AIState;
  pauseRemaining: number;
  investigateTarget?: Vec3 | null;
  lastKnownPlayerPosition?: Vec3 | null;
  awareness?: number;
  facing?: number;
  hidden?: boolean;
}

export interface OpportunityDefinition {
  id: string;
  label: string;
  solution: SolutionType;
  zoneId: string;
  prompt: string;
  cooldownMs?: number;
}

export interface InteractableDefinition {
  id: string;
  label: string;
  type: "disguise" | "poison" | "sabotage" | "container" | "extraction" | "intel" | "pickup" | "door" | "body";
  position: Vec3;
  zoneId: string;
  disguise?: DisguiseId;
  prompt: string;
  effects?: InteractionEffect[];
}

export interface InventoryState {
  poison: boolean;
  coins: number;
  wrench: boolean;
  keycard: boolean;
}

export interface ScoreState {
  suspicionPeak: number;
  alarmsTriggered: number;
  bodiesFound: number;
  witnessedActions: number;
  nonTargetCasualties: number;
  disguiseBreaks: number;
  disguisesUsed: number;
  evidenceLeftBehind: number;
  objectivesCompleted: number;
  startTime: number;
  finishTime?: number | null;
  rating?: string;
  score?: number;
}

export interface MissionScoreBreakdown {
  label: string;
  value: number;
  kind: "bonus" | "penalty" | "neutral";
}

export interface MissionScoreResult {
  score: number;
  rating: string;
  durationSeconds: number;
  breakdown: MissionScoreBreakdown[];
  challenges: string[];
}

export interface CareerRecord {
  bestScore: number;
  bestRating: string;
  completedChallenges: string[];
  discoveredSolutions: SolutionType[];
  totalRuns: number;
  signatureMoments: string[];
}

export interface MissionEvent {
  id: string;
  text: string;
  severity: "info" | "warning" | "critical";
  timestamp: number;
}

export interface PhaseOneBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PhaseOneZone {
  id: string;
  label: string;
  height?: number;
  accessTags?: string[];
  allowedTags?: string[];
  requiredTier?: AccessTier;
  scrutinyLevel?: number;
  publicBehaviorProfile?: string;
  restrictedBehaviorProfile?: string;
  trespassRate?: number;
  witnessWeight?: number;
  stealthModifier?: number;
  lingerGraceSeconds?: number;
  publicComposureRules?: string[];
  bounds: PhaseOneBounds;
}

export interface PhaseOneStructure {
  id: string;
  type: "building" | "platform" | "support" | "prop";
  solid: boolean;
  color: string;
  position: Vec3;
  size: [number, number, number];
  bounds: PhaseOneBounds;
}

export interface PhaseOneGateState {
  id: string;
  label: string;
  open: boolean;
  bounds: PhaseOneBounds;
}

export interface DisguiseDefinition {
  id: DisguiseId;
  label: string;
  accessTags: string[];
  clearanceTags: string[];
  accessTier: AccessTier;
  behaviorProfile: string;
  suspiciousBehaviors: Array<"running" | "crouching_public" | "dragging_body" | "sabotage" | "illegal_interaction">;
  scrutinyMultiplier: number;
  rank: number;
  enforcerPenalty: number;
  heatCapacity: number;
  coverInstabilitySeconds: number;
  behaviorBias: number;
  enforcerRisk: number;
}

export interface WatcherDefinition {
  id: string;
  label: string;
  kind: WatcherKind;
  position: Vec3;
  zoneIds: string[];
  facing: number;
  fov: number;
  range: number;
  awarenessRate: number;
  enforcer: boolean;
  enforcementTier?: AccessTier;
  memorySeconds?: number;
  sweepAmplitude?: number;
  sweepSpeed?: number;
  witnessWeight?: number;
}

export interface ZoneAccessProfile {
  zoneId: string;
  legal: boolean;
  accessState: AccessState;
  zoneFit: "native" | "acceptable" | "mismatched";
  trespassRate: number;
  witnessWeight: number;
  stealthModifier: number;
  lingerGraceSeconds: number;
  scrutinyLevel: number;
}

export interface SuspicionBreakdown {
  totalDelta: number;
  distance: number;
  los: number;
  zone: number;
  behavior: number;
  enforcer: number;
  recentCrime: number;
  dominantWatcherId: string | null;
}

export interface SuspicionChannels {
  trespass: number;
  exposure: number;
  behavior: number;
  enforcer: number;
  recentCrime: number;
}

export interface WatcherExposureState {
  watcherId: string;
  observation: number;
  visible: boolean;
  lastSeenAt: number | null;
}

export interface ZoneRiskProfile {
  accessState: AccessState;
  dominantRiskSource: DominantRiskSource;
  lingerRisk: boolean;
  enforcerRisk: boolean;
}

export interface PatrolRoute {
  id: string;
  label: string;
  points: Vec3[];
  loop?: boolean;
  pauseSeconds?: number;
}

export interface RoutineStop {
  routeId: string;
  durationSeconds: number;
  state: "routine" | "patrol" | "stationed" | "escort";
}

export interface RoutineSchedule {
  id: string;
  stops: RoutineStop[];
}

export interface PerceptionProfile {
  sightRange: number;
  fov: number;
  hearingRange: number;
  bodyDetectionRange: number;
  trespassSensitivity: number;
  authority: number;
}

export interface SearchAssignment {
  actorId: string;
  routeId: string;
  target: Vec3;
  incidentId?: string;
  responseRole?: GuardResponseRole;
}

export interface StimulusEvent {
  id: string;
  type: StimulusType;
  position: Vec3;
  radius: number;
  severity: number;
  createdAt: number;
  expiresAt: number;
  sourceId?: string;
  zoneId?: string;
  incidentId?: string;
  confirmed?: boolean;
  category?: IncidentCategory;
  zoneClusterId?: string;
}

export interface IncidentRecord {
  id: string;
  type: StimulusType;
  category: IncidentCategory;
  zoneId: string;
  zoneClusterId: string;
  position: Vec3;
  severity: number;
  confirmed: boolean;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  sourceActorId?: string;
  ownerActorId?: string | null;
}

export interface DangerZone {
  id: string;
  incidentId: string;
  zoneClusterId: string;
  center: Vec3;
  radius: number;
  expiresAt: number;
  severity: number;
}

export interface MissionConsequence {
  id: string;
  source: IncidentSource;
  zoneId: string;
  zoneClusterId: string;
  category: IncidentCategory;
  severity: number;
  confirmed: boolean;
  radius: number;
  ttlMs: number;
  text?: string;
}

export interface ResponsePressureProfile {
  id: string;
  zoneClusterId: string;
  categories: readonly IncidentCategory[];
  minimumSeverity: number;
  confirmedOnly?: boolean;
  detour?: MissionDetourState;
  escortSplit?: EscortSplitState;
}

export interface MissionPressureState {
  annexPressure: boolean;
  ballroomPressure: boolean;
  securityPressure: boolean;
  targetProtection: "routine" | "tightened" | "fallback";
  extractionRisk: "low" | "elevated" | "severe";
  activeLeadIncidentId: string | null;
}

export interface LightingProfile {
  id: string;
  label: string;
  zoneIds: string[];
  keyColor: string;
  fillColor: string;
  accentColor: string;
  ambientIntensity: number;
  directionalIntensity: number;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  practicalIntensity: number;
  shadowBias?: number;
}

export interface EnvironmentProfile {
  id: string;
  zoneIds: string[];
  floorMaterial: "marble" | "stone" | "carpet" | "service_tile" | "concrete" | "roof";
  wallMaterial: "paneled" | "plaster" | "service_paint" | "utility_concrete" | "glass";
  trimColor: string;
  accentColor: string;
}

export interface AssetManifestEntry {
  id: string;
  type: "character" | "animation" | "environment" | "prop" | "material" | "hdri" | "audio";
  label: string;
  path: string;
  format: "glb" | "gltf" | "fbx" | "obj" | "bvh" | "hdr" | "exr" | "png" | "jpg" | "jpeg" | "wav" | "mp3" | "ogg" | "folder";
  tags?: string[];
  rigProfileId?: string;
  clipRole?: AnimationClipRole;
  needsRetargeting?: boolean;
  variants?: string[];
}

export interface RigProfileDefinition {
  id: string;
  label: string;
  skeletonType: "mixamo" | "humanoid_generic" | "custom";
  rootBone?: string;
  hipBone?: string;
  spineBones?: string[];
  headBone?: string;
  leftHandBone?: string;
  rightHandBone?: string;
}

export interface AiMemoryEvent {
  incidentId: string;
  category: IncidentCategory;
  zoneClusterId: string;
  position: Vec3;
  rememberedUntil: number;
}

export interface AiActorDefinition {
  id: string;
  label: string;
  role: AiRole;
  color: string;
  spawnPosition: Vec3;
  defaultRouteId?: string;
  routineId?: string;
  fallbackRouteId?: string;
  reactionPostId?: string;
  searchRouteIds?: string[];
  escortGroupId?: string;
  escortTargetId?: string;
  guardAnchorId?: string;
  vulnerableRouteIds?: string[];
  redirectableNodeIds?: string[];
  patrolSpeed: number;
  alertSpeed: number;
  perception: PerceptionProfile;
  safePostId?: string;
  supportRouteIds?: string[];
  perimeterRouteIds?: string[];
  zoneClusterId?: string;
  formationSlot?: "front" | "left" | "right" | "rear";
}

export interface AiActorRuntime extends AiActorDefinition {
  position: Vec3;
  facing: number;
  state: AiState;
  currentRouteId: string | null;
  routeIndex: number;
  pauseRemaining: number;
  routineIndex: number;
  routineElapsed: number;
  alertLevel: number;
  awareness: number;
  investigateTarget: Vec3 | null;
  searchTarget: Vec3 | null;
  lastStimulusId: string | null;
  lastKnownPlayerPosition: Vec3 | null;
  challengedAt: number | null;
  returningToRoute: boolean;
  hidden: boolean;
  memory: AiMemoryEvent[];
  currentIncidentId: string | null;
  responseRole: GuardResponseRole;
  dangerAvoidanceTarget: Vec3 | null;
  inspectRemaining: number;
  formation: BodyguardFormation;
}

export interface MissionProgressState {
  hasPoison: boolean;
  poisonPrepared: boolean;
  accidentArmed: boolean;
  secondaryObjectiveComplete: boolean;
  secondaryObjectiveSource: "security_hub" | "annex_transfer" | null;
  targetEliminated: boolean;
  extractionReady: boolean;
  missionComplete: boolean;
  hiddenBodies: number;
  solution: SolutionType | null;
  resultScore: number | null;
  resultRating: string | null;
  activeDetour: MissionDetourState;
  escortSplit: EscortSplitState;
  unlockedRoutes: Record<MissionRouteUnlock, boolean>;
  reserveRelocated: boolean;
  alternateIntelRouteUsed: boolean;
  suspicionPeak: number;
  alarmsTriggered: number;
  bodiesFound: number;
  nonTargetCasualties: number;
  disguisesUsed: DisguiseId[];
  evidenceLeftBehind: number;
  completedChallenges: string[];
  scoreBreakdown: MissionScoreBreakdown[];
  durationSeconds: number | null;
  storyAftermath: AftermathStorySummary | null;
  notableMoments: DetectedMoment[];
}

export type InteractionEffect =
  | { type: "message"; message: string }
  | { type: "teleport"; destination: Vec3; message: string }
  | { type: "toggleGate"; gateId: string; openMessage: string; closedMessage: string }
  | { type: "equipDisguise"; disguiseId: DisguiseId; message: string }
  | { type: "markSabotage"; sabotageId: string; message: string; suspicionBurst: number }
  | { type: "toggleCarryBody"; bodyId: string; pickMessage: string; dropMessage: string }
  | { type: "acquirePoison"; poisonId: string; message: string }
  | { type: "preparePoison"; stationId: string; message: string; failMessage: string }
  | { type: "armAccident"; accidentId: string; message: string; suspicionBurst?: number }
  | { type: "collectObjective"; objectiveId: string; message: string }
  | { type: "unlockRoute"; routeId: MissionRouteUnlock; message: string }
  | { type: "queueTargetDetour"; detour: MissionDetourState; message: string }
  | { type: "splitEscort"; split: EscortSplitState; message: string }
  | { type: "advanceSecondaryObjective"; source: "security_hub" | "annex_transfer"; message: string }
  | { type: "attemptCloseElimination"; targetId: string; radius: number; successMessage: string; failMessage: string }
  | { type: "stashBody"; containerId: string; message: string; failMessage: string }
  | { type: "extractMission"; successMessage: string; failMessage: string };
