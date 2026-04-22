import {
  CameraNode,
  CustomNightConfig,
  EndingDefinition,
  EntityId,
  IncidentStage,
  LogEntry,
  NightPreset,
  RoomId,
} from "@/game/scpNightwatch/core/types";

export const SAVE_VERSION = 1;

export const DEFAULT_CUSTOM_NIGHT: CustomNightConfig = {
  scp173: 8,
  scp096: 8,
  scp106: 8,
  scp457: 8,
};

export const CAMERA_NODES: CameraNode[] = [
  { id: "CAM-01", name: "Statue Vault", roomId: "statueVault", tier: "danger", notes: "Direct containment feed. Blink at your own risk.", adjacency: ["CAM-02", "CAM-03"] },
  { id: "CAM-02", name: "Archive Spine", roomId: "archive", tier: "medium", notes: "Records corridor between heavy blast shutters.", adjacency: ["CAM-01", "CAM-04", "CAM-07"] },
  { id: "CAM-03", name: "Maintenance Run", roomId: "maintenance", tier: "medium", notes: "Coolant pipes and service trench.", adjacency: ["CAM-01", "CAM-05", "CAM-08"] },
  { id: "CAM-04", name: "Records Wing", roomId: "records", tier: "safe", notes: "Document vault and mirror-lined audit bay.", adjacency: ["CAM-02", "CAM-06"] },
  { id: "CAM-05", name: "Surgical Prep", roomId: "surgery", tier: "danger", notes: "Biohazard drapes. Avoid prolonged exposure.", adjacency: ["CAM-03", "CAM-06"] },
  { id: "CAM-06", name: "North Hub", roomId: "northHub", tier: "medium", notes: "Shared junction above the operator hallways.", adjacency: ["CAM-04", "CAM-05", "CAM-07", "CAM-08"] },
  { id: "CAM-07", name: "Generator Cage", roomId: "generator", tier: "danger", notes: "Substation heat signatures and unstable arcs.", adjacency: ["CAM-02", "CAM-06"] },
  { id: "CAM-08", name: "Boiler Throat", roomId: "boiler", tier: "danger", notes: "Thermal bloom and corrosive vapor.", adjacency: ["CAM-03", "CAM-06"] },
];

export const ROOM_LABELS: Record<RoomId, string> = {
  statueVault: "Statue Vault",
  archive: "Archive Spine",
  maintenance: "Maintenance Run",
  records: "Records Wing",
  surgery: "Surgical Prep",
  northHub: "North Hub",
  generator: "Generator Cage",
  boiler: "Boiler Throat",
  westHall: "West Hall",
  eastHall: "East Hall",
  leftDoor: "Left Blast Door",
  rightDoor: "Right Blast Door",
};

export const SCP_LABELS: Record<EntityId, string> = {
  scp173: "SCP-173",
  scp096: "SCP-096",
  scp106: "SCP-106",
  scp457: "SCP-457",
};

export const SCP_DESCRIPTIONS: Record<EntityId, string> = {
  scp173: "Concrete predator. Immobilized while directly observed by surveillance or hall floodlight.",
  scp096: "Triggered by visual confirmation. Camera exposure spikes rage and door pressure.",
  scp106: "Corrosive intruder. Ignores standard path discipline and answers only to lockdown timing.",
  scp457: "Low-power ignition entity. Remains dormant until the grid surrenders.",
};

export const NIGHT_PRESETS: NightPreset[] = [
  {
    id: 1,
    label: "Night 1",
    summary: "Orientation shift. 173 patrols early, the rest probe slowly.",
    call: [
      "SITE-17 NIGHTWATCH / SHIFT BRIEF",
      "Class-D operator, maintain line-of-sight discipline on SCP-173.",
      "Do not linger on surgical feeds. Engineering reports thermal drift below generator level.",
    ],
    aggressions: { scp173: 6, scp096: 2, scp106: 1, scp457: 0 },
    randomEventRate: 26000,
  },
  {
    id: 2,
    label: "Night 2",
    summary: "096 begins appearing in the camera lattice.",
    call: [
      "Containment review notes increased membrane noise in Records Wing.",
      "If a camera feed stares back, close the monitor and wait it out.",
      "Lockdown remains experimental. Do not waste it.",
    ],
    aggressions: { scp173: 8, scp096: 7, scp106: 3, scp457: 2 },
    randomEventRate: 22000,
  },
  {
    id: 3,
    label: "Night 3",
    summary: "106 contaminates feed routing and shortcuts to the hallways.",
    call: [
      "Corrosion traces were found inside sealed ducts.",
      "If you hear wet metal, prepare lockdown immediately.",
      "Power budgeting is no longer optional.",
    ],
    aggressions: { scp173: 10, scp096: 10, scp106: 9, scp457: 4 },
    randomEventRate: 18000,
  },
  {
    id: 4,
    label: "Night 4",
    summary: "System strain escalates and low-grid anomalies wake faster.",
    call: [
      "Multiple wings are redacted from your map because they are gone.",
      "Emergency power has been downgraded to hopeful suggestion.",
      "If the lights die, something hot starts breathing.",
    ],
    aggressions: { scp173: 12, scp096: 12, scp106: 12, scp457: 11 },
    randomEventRate: 15000,
  },
  {
    id: 5,
    label: "Night 5",
    summary: "Full breach pressure. Survive and the Foundation might keep you alive.",
    call: [
      "This is not a test shift. Command is evacuating around you.",
      "Every anomaly on your board is active. Every watt matters.",
      "Hold until 06:00 and await termination postponement.",
    ],
    aggressions: { scp173: 15, scp096: 15, scp106: 15, scp457: 15 },
    randomEventRate: 12000,
  },
];

export const LOG_ENTRIES: LogEntry[] = [
  {
    id: "log-173",
    title: "SCP-173 / Observation Mandate",
    clearance: "Level 2",
    body: "Object halts under active observation. Camera static does not count as a blink, but your hesitation does.",
    unlockNight: 1,
    unlockByEntity: "scp173",
  },
  {
    id: "log-096",
    title: "SCP-096 / Facial Cascade",
    clearance: "Level 3",
    body: "Partial visual acquisition through surveillance is sufficient to trigger an escalating behavioral spike. Disengage optics immediately.",
    unlockNight: 2,
    unlockByEntity: "scp096",
  },
  {
    id: "log-106",
    title: "SCP-106 / Lockdown Countermeasure",
    clearance: "Level 4",
    body: "Standard doors slow optics, not corrosion. Local lockdown briefly hardens the room geometry enough to repel phase entry.",
    unlockNight: 3,
    unlockByEntity: "scp106",
  },
  {
    id: "log-457",
    title: "SCP-457 / Thermal Hunger",
    clearance: "Level 3",
    body: "Entity remains quiescent under stable facility load. When power fails, it interprets the site as fuel.",
    unlockNight: 4,
    unlockByEntity: "scp457",
  },
  {
    id: "log-operator",
    title: "Operator Notice / [REDACTED]",
    clearance: "Level 5",
    body: "Class-D retention may be considered if all active data dossiers are recovered and a five-night breach sequence is documented.",
    unlockNight: 5,
  },
];

export const ENDINGS: Record<string, EndingDefinition> = {
  "night-clear": {
    id: "night-clear",
    title: "Shift Record Preserved",
    classification: "Operational Review",
    body: "The operator interval concluded before sunrise, but downstream containment status remained incomplete in the recovered archive.",
  },
  "termination-postponed": {
    id: "termination-postponed",
    title: "Termination Postponed",
    classification: "Conditional Retention",
    body: "The operator remained viable through sustained site degradation. Disposal scheduling was deferred pending incident review.",
  },
  archivist: {
    id: "archivist",
    title: "Archivist",
    classification: "Restricted Continuance",
    body: "Every surviving annex, breach note, and corridor record was preserved. Continued retention was justified as evidentiary necessity.",
  },
  breach: {
    id: "breach",
    title: "Containment Breach",
    classification: "Fatality",
    body: "The station becomes another forgotten room in the site. Your post is sealed and renamed.",
  },
  apollyon: {
    id: "apollyon",
    title: "Apollyon Shift",
    classification: "Impossible Survival",
    body: "Custom Night is cleared at maximum hostility. Internal records classify the event as inadmissible and erase your name.",
  },
  casualty: {
    id: "casualty",
    title: "Operator Casualty",
    classification: "Postmortem Review",
    body: "The preserved feed terminated before the event resolved. Follow-up documentation catalogs the room, not the operator who remained inside it.",
  },
};

export const RANDOM_EVENTS = [
  {
    title: "Intercom Burst",
    body: "A clipped intercom fragment referenced a distant sector and terminated before acknowledgement.",
    tone: "warn" as const,
  },
  {
    title: "Vent Traffic",
    body: "Metalwork above the ceiling rang once, then the remote relay marked an unrelated corridor breach.",
    tone: "danger" as const,
  },
  {
    title: "CRT Drift",
    body: "The surveillance matrix bloomed with static while archive timing slipped against the incident ledger.",
    tone: "info" as const,
  },
  {
    title: "Generator Surge",
    body: "Power load spiked sitewide and follow-up diagnostics never reached the operator station.",
    tone: "warn" as const,
  },
];

export const INCIDENT_STAGE_LABELS: Record<IncidentStage, string> = {
  nominal: "Nominal",
  "sector-instability": "Sector Instability",
  "multi-zone-event": "Multi-Zone Event",
  "response-degraded": "Response Degraded",
  "archive-continuity-only": "Archive Continuity Only",
};

export const REMOTE_INCIDENT_EVENTS: Record<Exclude<IncidentStage, "nominal">, Array<{ title: string; body: string; tone: "info" | "warn" | "danger" }>> = {
  "sector-instability": [
    {
      title: "Sector C-3 Fluctuation",
      body: "Remote lattice telemetry from elevator sublevel C-3 fell out of sync for 11 seconds.",
      tone: "warn",
    },
    {
      title: "Medical Annex Delay",
      body: "Triage corridor acknowledgement remained queued with no human response attached.",
      tone: "warn",
    },
  ],
  "multi-zone-event": [
    {
      title: "Multi-Zone Event",
      body: "Archive relay marked simultaneous integrity loss in Delta-4, coolant transit, and records access.",
      tone: "danger",
    },
    {
      title: "Comms Relay Degraded",
      body: "Foundation traffic collapsed into automated handoff tones after a clipped evacuation fragment.",
      tone: "warn",
    },
  ],
  "response-degraded": [
    {
      title: "Response Window Missed",
      body: "Containment team acknowledgement expired without replacement command authority.",
      tone: "danger",
    },
    {
      title: "Support Deferred",
      body: "Manual intervention request rerouted to fallback script and never reopened.",
      tone: "warn",
    },
  ],
  "archive-continuity-only": [
    {
      title: "Archive Continuity Only",
      body: "Live oversight absent. Recorder remained active under autonomous evidence retention protocol.",
      tone: "danger",
    },
    {
      title: "Sector Loss Unresolved",
      body: "Residual motion persisted in off-grid sectors after command traffic fully ceased.",
      tone: "danger",
    },
  ],
};

export const ARCHIVE_PRELUDE_EVENTS = [
  {
    title: "SESSION 14 PARTIAL RECOVERY",
    body: "Recovered corridor index resumed after a prior operator disconnect at 05:12. Some frames remain outside chain of custody.",
    tone: "info" as const,
  },
  {
    title: "PREVIOUS OPERATOR DISCONNECT",
    body: "Operator D-9341 response ended before manual handoff. Residual review notes are clipped and partially redacted.",
    tone: "warn" as const,
  },
  {
    title: "CAMERA FEED NOT RECORDED",
    body: "CAM-05 continuity request returned █████ for a span that should exist in the archive.",
    tone: "warn" as const,
  },
  {
    title: "SOURCE UNKNOWN",
    body: "A system note was appended to the ledger without matching command origin or signature block.",
    tone: "info" as const,
  },
  {
    title: "UNVERIFIED VISUAL LOOP",
    body: "Archive review flagged repeated hall motion at a timestamp already consumed by another sector event.",
    tone: "danger" as const,
  },
];

export const ARCHIVE_STRAY_NOTES = [
  "Do not leave feed on CAM-05.",
  "Review loop persists after reset.",
  "SITE-19 status remains outside scope.",
  "It learns from repetition.",
  "Previous note truncated / source unknown.",
  "Sector relay reopened without command.",
];

export const ENTITY_START_ROOMS: Record<EntityId, RoomId> = {
  scp173: "statueVault",
  scp096: "records",
  scp106: "boiler",
  scp457: "generator",
};
