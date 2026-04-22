export type GamePhase = "menu" | "playing" | "paused" | "result";
export type GameModeId = "duel" | "firstperson";
export type LaunchModeId = "quick_duel" | "survival_run" | "challenge_run";
export type ArenaId = "forge-basin" | "windbreak-hills" | "shatter-isles";
export type ArrowType = "standard" | "heavy" | "explosive" | "light";
export type ActorTeam = "player" | "enemy";
export type DifficultyId = "rookie" | "veteran" | "nightmare";
export type BalanceState = "stable" | "unstable" | "fallen" | "recovering";
export type HitBodyPart = "head" | "chest" | "abdomen" | "arm" | "leg";
export type Injury = {
  id: string;
  type: "bleeding" | "fracture" | "organ" | "concussion" | "painShock";
  severity: "minor" | "moderate" | "severe" | "critical";
  bodyPart: HitBodyPart;
  effects: {
    healthDrain?: number;
    staminaDrain?: number;
    aimPenalty?: number;
    movementPenalty?: number;
  };
};
export type InjurySeverity = "minor" | "moderate" | "severe" | "critical";
export type TreatmentState = "idle" | "preparing" | "applying" | "interrupted" | "completed";
export type MedicalEventType =
  | "hit_received"
  | "injury_added"
  | "injury_worsened"
  | "treatment_started"
  | "treatment_interrupted"
  | "treatment_completed"
  | "consumable_used"
  | "stamina_crash"
  | "critical_state_entered"
  | "death";
export type InjuryCategory =
  | "bleeding-wound"
  | "deep-puncture"
  | "fractured-bone"
  | "dislocated-joint"
  | "muscle-tear"
  | "collapsed-lung"
  | "organ-trauma"
  | "concussion"
  | "pain-shock"
  | "infection-risk";
export type MedicalSupplyId =
  | "bandage"
  | "gauze"
  | "pressure-bandage"
  | "clotting-gauze"
  | "splint"
  | "wrap"
  | "painkiller"
  | "antibiotic"
  | "chest-seal"
  | "trauma-pack"
  | "antiseptic"
  | "medical-scissors"
  | "water"
  | "coffee"
  | "cake"
  | "pizza"
  | "monster"
  | "red-bull"
  | "apple"
  | "enchanted-golden-apple"
  | "undying-totem";
export type SupplyCategory = "medical" | "food" | "drink" | "relic" | "tool";
export type SupplyRarity = "common" | "uncommon" | "rare" | "legendary";
export type LimbName =
  | "head"
  | "torso"
  | "pelvis"
  | "upperArmLeft"
  | "lowerArmLeft"
  | "upperArmRight"
  | "lowerArmRight"
  | "upperLegLeft"
  | "lowerLegLeft"
  | "upperLegRight"
  | "lowerLegRight";

export interface MatchSettings {
  mode: GameModeId;
  arenaId: ArenaId;
  difficulty: DifficultyId;
  seed?: number;
}

export type HitPayload = {
  targetId: string;
  bodyPart: HitBodyPart;
  force: number;
  penetrationDepth: number;
  arrowType: string;
};

export interface SupplyStack {
  id: MedicalSupplyId;
  label: string;
  quantity: number;
}

export interface SupplyPresentation {
  id: MedicalSupplyId;
  label: string;
  shortLabel: string;
  category: SupplyCategory;
  rarity: SupplyRarity;
  visualKey: string;
  accentColor: string;
  quickUse?: boolean;
  staminaGain?: number;
  energyGain?: number;
  hydrationGain?: number;
  bloodGain?: number;
  shockRelief?: number;
  stimulantCrashPenalty?: number;
  medicalUse?: string;
}

export interface InjuryRequirement {
  supplyId: MedicalSupplyId;
  quantity: number;
}

export interface InjuryRecord {
  id: string;
  actorId: string;
  bodyRegion: LimbName | "neck" | "chest" | "abdomen";
  category: InjuryCategory;
  severity: InjurySeverity;
  arrowType: ArrowType;
  impactAngle: number;
  penetrationDepth: number;
  force: number;
  affectedTissues: Array<"bone" | "muscle" | "artery" | "organ" | "lung" | "brain" | "joint">;
  bleedingRate: number;
  pain: number;
  staminaPenalty: number;
  mobilityPenalty: number;
  aimPenalty: number;
  oxygenPenalty: number;
  infectionRisk: number;
  stabilized: boolean;
  treated: boolean;
  requirements: InjuryRequirement[];
  requiredTool?: MedicalSupplyId;
  treatmentStage?: "untreated" | "stabilized" | "recovering" | "treated";
  lastProgressionAt?: number;
  lastTreatmentAt?: number;
  createdAt: number;
}

export interface DerivedVitals {
  bloodLossLevel: number;
  breathingCapacity: number;
  painLoad: number;
  shockRisk: number;
}

export interface InjuryEffectModifiers {
  healthDrainPerSecond: number;
  staminaDrainPerSecond: number;
  aimPenalty: number;
  movementPenalty: number;
  warnings: {
    severeBloodLoss: boolean;
    breathingCompromised: boolean;
    highPain: boolean;
    shockRiskHigh: boolean;
  };
}

export interface MedicalEventDetails {
  message?: string;
  sourceType?: string;
  targetType?: string;
  itemOrTool?: string;
  preventable?: boolean;
  progress?: number;
  remainingMs?: number;
  cause?: string;
  highlightTag?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface MedicalEvent {
  id: string;
  timestampMs: number;
  type: MedicalEventType;
  source: string;
  target: string;
  bodyPart?: string;
  severity?: InjurySeverity;
  suppliesUsed?: MedicalSupplyId[];
  result: string;
  details?: MedicalEventDetails;
}

export interface ActiveTreatment {
  injuryId: string;
  label: string;
  stage: string;
  state: TreatmentState;
  startedAt: number;
  durationMs: number;
  progress: number;
  requiredSupplies: InjuryRequirement[];
  requiredTool?: MedicalSupplyId;
  interruptedReason?: string;
}

export interface TreatmentStageResult {
  stoppedBleeding: boolean;
  reducedPain: boolean;
  improvedMobility: boolean;
  temporaryStabilization: boolean;
  unresolvedRisk: boolean;
}

export interface MatchMedicalSummary {
  totalInjuries: number;
  criticalInjuries: number;
  causeOfDeath: string | null;
  treatmentAttempts: number;
  treatmentSuccessRate: number;
  consumablesUsed: string[];
  survivalDurationMs: number;
  accuracyWhileInjured?: number | null;
}

export type ReplayHighlightTag =
  | "critical-hit"
  | "preventable-death"
  | "treatment-failed-near-death"
  | "survived-critical-injury"
  | "totem-save";

export interface BufferedReplayEvent {
  id: string;
  timestampMs: number;
  category: "medical" | "network" | "presentation";
  eventType: string;
  summary: string;
  payload: Record<string, unknown>;
  highlightTag?: ReplayHighlightTag;
}

export interface ReplaySnapshot {
  id: string;
  capturedAt: number;
  startedAt: number;
  durationMs: number;
  events: BufferedReplayEvent[];
  highlightTag?: ReplayHighlightTag;
}

export interface ArrowSpawnPayload {
  ownerId: string;
  type: ArrowType;
  origin: [number, number, number];
  direction: [number, number, number];
  power: number;
}

export interface DamageEvent {
  actorId: string;
  sourceActorId: string;
  limb: LimbName;
  arrowType: ArrowType;
  damage: number;
  impulse: number;
  headshot: boolean;
  position: [number, number, number];
}

export interface HitResolutionPayload {
  actorId: string;
  limb: LimbName;
  arrowType: ArrowType;
  impactPoint: [number, number, number];
  impulse: number;
  sourceActorId: string;
}

export interface CinematicEvent {
  id: string;
  type: "critical-hit" | "arrow-cam" | "explosion";
  actorId?: string;
  arrowId?: string;
  strength: number;
  title: string;
  startedAt: number;
  durationMs: number;
}

export interface HitFeedbackEvent {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  actorId?: string;
  limb?: LimbName;
  startedAt: number;
}

export interface ActorVitals {
  bloodLevel: number;
  pain: number;
  oxygen: number;
  hydration: number;
  energy: number;
  stamina: number;
  shock: number;
  infectionLoad: number;
  unconscious: boolean;
}

export interface LimbState {
  hp: number;
  disabled: boolean;
}

export interface AmmoState {
  standard: number;
  heavy: number;
  explosive: number;
  light: number;
}

export interface ActorSnapshot {
  id: string;
  name: string;
  team: ActorTeam;
  isPlayer: boolean;
  alive: boolean;
  knockedOut: boolean;
  health: number;
  stability: number;
  balanceState: BalanceState;
  drawCharge: number;
  vitals: ActorVitals;
  injuries: InjuryRecord[];
  position: [number, number, number];
  velocity: [number, number, number];
  aimYaw: number;
  aimPitch: number;
  ammo: AmmoState;
  limbs: Record<LimbName, LimbState>;
}

export interface ArrowSnapshot {
  id: string;
  ownerId: string;
  type: ArrowType;
  active: boolean;
  position: [number, number, number];
  velocity: [number, number, number];
  life: number;
}

export interface HudToast {
  id: string;
  title: string;
  body: string;
  tone: "neutral" | "warn" | "danger" | "success";
}

export interface ArenaPropDescriptor {
  id: string;
  kind: "crate" | "barrel" | "platform" | "pillar";
  position: [number, number, number];
  size: [number, number, number];
  mass?: number;
  explosive?: boolean;
  movingAxis?: "x" | "z";
  travel?: number;
  speed?: number;
}

export interface ArenaConfig {
  id: ArenaId;
  label: string;
  description: string;
  sky: "dawn" | "storm" | "void";
  floorColor: string;
  floorType: "flat" | "hills" | "islands";
  spawnPoints: {
    player: [number, number, number];
    enemies: [number, number, number][];
  };
  coverNodes: [number, number, number][];
  props: ArenaPropDescriptor[];
}

export interface MatchResult {
  title: string;
  body: string;
  success: boolean;
  kills: number;
  score: number;
}

export interface DeathTimelineEvent {
  id: string;
  timestampMs: number;
  label: string;
  detail: string;
}

export interface MedicalDeathReport {
  primaryFatalInjury: string;
  contributingInjuries: string[];
  causeOfDeath: string;
  bodyRegion: string;
  timeSurvivedMs: number;
  estimatedBloodLossMl: number;
  statusEffects: string[];
  preventability: "low" | "moderate" | "high";
  missingRequirements: InjuryRequirement[];
  missingTools: MedicalSupplyId[];
  killer: string;
  weapon: string;
  timeline: DeathTimelineEvent[];
  timeFromCriticalInjuryMs?: number;
  lastSuccessfulTreatment?: string;
  failedTreatments: string[];
  chronologicalTimeline: MedicalEvent[];
  bloodLossAtDeath?: number;
  breathingCapacityAtDeath?: number;
  shockRiskAtDeath?: number;
  causeExplanation?: string;
}

export interface AudioEvent {
  id: string;
  kind: "draw" | "release" | "impact" | "whistle" | "explosion" | "ko" | "ui";
  strength: number;
}

export interface MatchSnapshot {
  wave: number;
  score: number;
  kills: number;
  remainingEnemies: number;
  wind: [number, number, number];
  activeMode: GameModeId;
}

export interface TreatmentStatus {
  currentInjury: InjuryRecord | null;
  canTreatNow: boolean;
  missingSupplies: InjuryRequirement[];
  missingTools: MedicalSupplyId[];
  availableOptions: Array<{
    injuryId: string;
    label: string;
    body: string;
  }>;
}

export interface ActiveHighlightState {
  tag: ReplayHighlightTag;
  message: string;
  startedAt: number;
}

export interface ReplayState {
  latestSnapshot: ReplaySnapshot | null;
  latestHighlight: ReplayHighlightTag | null;
}

export interface ChallengeModifierSet {
  disableTreatment?: boolean;
  ammoOverride?: Partial<AmmoState>;
  startCritical?: boolean;
  oxygenMultiplier?: number;
  triggerStimulantCrash?: boolean;
  grantTotem?: boolean;
}

export interface ChallengeDefinition {
  id: string;
  label: string;
  description: string;
  baseMode: GameModeId;
  starterFriendly?: boolean;
  intensity?: "low" | "medium" | "high";
  recommendedLabel?: string;
  modifiers: ChallengeModifierSet;
}

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
}

export interface HighlightSummaryCard {
  title: string;
  mode: string;
  survivalTimeLabel: string;
  notableTag: string | null;
  summary: string;
}

export interface DeathSummaryCard {
  title: string;
  mode: string;
  causeOfDeath: string;
  survivalTimeLabel: string;
  criticalInjuries: number;
  treatmentFailures: string[];
  summary: string;
}

export interface ChallengeCompletionCard {
  title: string;
  challengeLabel: string;
  outcomeLabel: string;
  summary: string;
}

export interface ResultPresentation {
  headline: string;
  subhead: string;
  shareText: string;
  emotionalLine?: string;
  causeLabel?: string;
  mistakeLabel?: string;
  fixLabel?: string;
  primaryFailure?: string;
  primaryClutchMoment?: string;
  preventabilityLabel?: string;
  highlightCard?: HighlightSummaryCard;
  deathCard?: DeathSummaryCard;
  challengeCard?: ChallengeCompletionCard;
}

export interface ReplayPresentationStep {
  id: string;
  label: string;
  detail: string;
  emphasis: "low" | "medium" | "high";
}

export interface MatchHistoryEntry {
  id: string;
  playedAt: number;
  launchMode: LaunchModeId;
  gameMode: GameModeId;
  success: boolean;
  score: number;
  kills: number;
  survivalTimeMs: number;
  causeOfDeath?: string | null;
  notableTag?: ReplayHighlightTag | null;
}

export interface LaunchSettings {
  streamerMode: boolean;
  cleanHud: boolean;
  reducedClutter: boolean;
  cinematicBanners: boolean;
  autoHidePanels: boolean;
  eventFeedDensity: "low" | "standard" | "high";
  screenShakeLevel: number;
  slowMoLevel: number;
  hudDensity: "compact" | "standard";
}

export interface TutorialState {
  seen: boolean;
  completed: boolean;
  skipped: boolean;
  visible: boolean;
  currentStep: number;
}

export interface ReplayPresentationState {
  open: boolean;
  mode: "replay" | "highlight" | null;
}

export interface AnalyticsEvent {
  type:
    | "mode_started"
    | "tutorial_completed"
    | "replay_viewed"
    | "retry_clicked"
    | "challenge_started"
    | "challenge_completed"
    | "death_report_viewed"
    | "streamer_mode_enabled";
  payload?: Record<string, string | number | boolean | null | undefined>;
}

export interface RemotePlayerState {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  aimYaw: number;
  aimPitch: number;
  selectedArrowType: ArrowType;
  balanceState: BalanceState;
}

export interface MapDefinition {
  id: string;
  label: string;
  arenaId: ArenaId;
  props: ArenaPropDescriptor[];
  spawnPoints: ArenaConfig["spawnPoints"];
  coverNodes: ArenaConfig["coverNodes"];
}

export interface PlayerAccountStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  level: number;
  xp: number;
  unlockedCosmetics: string[];
  selectedLoadout: string[];
  injuryCount: number;
  deaths: number;
  accuracy: number;
  shotsFired: number;
  shotsHit: number;
  survivalTimeSeconds: number;
  bestSurvivalTimeSeconds: number;
  mostCommonCauseOfDeath: string | null;
  treatmentsUsed: number;
  successfulStabilizations: number;
  criticalInjuriesSurvived: number;
  duelMatchesPlayed: number;
  firstPersonMatchesPlayed: number;
  duelWins: number;
  firstPersonWins: number;
}

export interface PersistedPlayerProfile {
  id: string;
  email: string;
  displayName: string;
  settingsJson: string;
  inventory: SupplyStack[];
  recentMatches: MatchHistoryEntry[];
  challengeCompletions: string[];
  banners: string[];
  titles: string[];
  cosmeticTags: string[];
  stats: PlayerAccountStats;
}

export interface RagdollHudState {
  showMedicalPanel: boolean;
}
