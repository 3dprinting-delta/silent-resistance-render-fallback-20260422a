export type DoorSide = "left" | "right";

export type ViewMode = "office" | "camera" | "database" | "menu" | "ending";

export type GamePhase = "menu" | "running" | "paused" | "jumpscare" | "ending";

export type CameraId =
  | "CAM-01"
  | "CAM-02"
  | "CAM-03"
  | "CAM-04"
  | "CAM-05"
  | "CAM-06"
  | "CAM-07"
  | "CAM-08";

export type RoomId =
  | "statueVault"
  | "archive"
  | "maintenance"
  | "records"
  | "surgery"
  | "northHub"
  | "generator"
  | "boiler"
  | "westHall"
  | "eastHall"
  | "leftDoor"
  | "rightDoor";

export type EntityId = "scp173" | "scp096" | "scp106" | "scp457";

export type EndingId =
  | "night-clear"
  | "termination-postponed"
  | "archivist"
  | "breach"
  | "apollyon"
  | "casualty";

export type NightId = 1 | 2 | 3 | 4 | 5;

export type CustomNightConfig = Record<EntityId, number>;

export type EventTone = "info" | "warn" | "danger";

export type IncidentStage =
  | "nominal"
  | "sector-instability"
  | "multi-zone-event"
  | "response-degraded"
  | "archive-continuity-only";

export type LogEntry = {
  id: string;
  title: string;
  clearance: string;
  body: string;
  unlockNight: number;
  unlockByEntity?: EntityId;
};

export type EndingDefinition = {
  id: EndingId;
  title: string;
  classification: string;
  body: string;
};

export type CameraNode = {
  id: CameraId;
  name: string;
  roomId: RoomId;
  tier: "safe" | "medium" | "danger";
  notes: string;
  adjacency: CameraId[];
};

export type NightPreset = {
  id: NightId;
  label: string;
  summary: string;
  call: string[];
  aggressions: CustomNightConfig;
  randomEventRate: number;
};

export type SaveState = {
  version: number;
  unlockedNights: number[];
  unlockedLogs: string[];
  endingsSeen: EndingId[];
  bestClearRecords: Partial<Record<string, { powerRemaining: number; completionMs: number }>>;
  failures: number;
  customNightUnlocked: boolean;
  customNightConfig: CustomNightConfig;
  archiveTag: string;
  sessionSerial: number;
  lastSessionId: string;
  priorOperators: string[];
  archiveNotes: string[];
  carryoverTitles: string[];
};

export type FacilityEvent = {
  id: string;
  title: string;
  body: string;
  tone: EventTone;
  timestamp: number;
  acknowledged: boolean;
};

export type EntityState = {
  id: EntityId;
  roomId: RoomId;
  moveProgress: number;
  aggression: number;
  rage: number;
  heat: number;
  cooldownMs: number;
  pathVariant: DoorSide;
  manifesting: boolean;
  seenFace: boolean;
  breachCountdownMs: number;
};

export type LockdownState = {
  active: boolean;
  timerMs: number;
  cooldownMs: number;
};

export type EndingOutcome = {
  id: EndingId;
  title: string;
  classification: string;
  body: string;
  survived: boolean;
  nightLabel: string;
};

export type GameState = {
  phase: GamePhase;
  viewMode: ViewMode;
  activeTab: "overview" | "database" | "custom" | "help";
  selectedCamera: CameraId;
  cameraMonitorOpen: boolean;
  timeMinutes: number;
  elapsedMs: number;
  power: number;
  emergencyMode: boolean;
  currentNight: number | "custom" | null;
  currentNightLabel: string;
  incidentStage: IncidentStage;
  jumpscareEntity: EntityId | null;
  jumpscareTimerMs: number;
  ending: EndingOutcome | null;
  callLines: string[];
  doors: Record<DoorSide, boolean>;
  lights: Record<DoorSide, boolean>;
  lockdown: LockdownState;
  events: FacilityEvent[];
  entities: Record<EntityId, EntityState>;
  randomEventTimerMs: number;
  observedRooms: RoomId[];
  encounterFlags: Record<EntityId, boolean>;
  paranoiaPressure: number;
  cameraSwitchBurst: number;
  systemInstability: number;
  monitorStallMs: number;
  controlLagMs: number;
  silenceMs: number;
  falseNegativeMs: number;
  timestampSkewMs: number;
  phantomGlitchMs: number;
  warningLagMs: number;
  powerMisreportMs: number;
  doorIndicatorLagMs: number;
  unseenEventTimerMs: number;
  unseenHintMs: number;
  unseenLogLagMs: number;
  unseenCameraId: CameraId | null;
  unseenSignalType: "metal" | "static" | "movement" | null;
  unseenSignalToken: number;
  unseenDelayedTitle: string | null;
  unseenDelayedBody: string | null;
  behaviorCameraFocusMs: Record<CameraId, number>;
  behaviorCameraVisits: Record<CameraId, number>;
  behaviorHesitationMs: number;
  behaviorPatternCameraId: CameraId | null;
  neglectedCameraId: CameraId | null;
  metaEventTimerMs: number;
  metaHintMs: number;
  metaLogLagMs: number;
  metaTargetCameraId: CameraId | null;
  metaSignalType: "watch" | "echo" | "hold" | null;
  metaSignalToken: number;
  metaDelayedTitle: string | null;
  metaDelayedBody: string | null;
};
