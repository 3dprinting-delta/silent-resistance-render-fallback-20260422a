"use client";

import { create } from "zustand";
import { simulateAI } from "@/game/scpNightwatch/core/ai";
import { getCameraRoom } from "@/game/scpNightwatch/core/cameras";
import {
  ARCHIVE_PRELUDE_EVENTS,
  ARCHIVE_STRAY_NOTES,
  CAMERA_NODES,
  ENTITY_START_ROOMS,
  INCIDENT_STAGE_LABELS,
  REMOTE_INCIDENT_EVENTS,
  SCP_LABELS,
} from "@/game/scpNightwatch/data/content";
import {
  ENDINGS,
  getEndingDefinition,
  getNightPreset,
  getUnlockableLogs,
  isMaxHostilityCustomNight,
  LOG_ENTRIES,
} from "@/game/scpNightwatch/core/progression";
import { defaultSaveState, loadSaveState, saveSaveState } from "@/game/scpNightwatch/core/persistence";
import { applyPowerTick, computePowerDrain } from "@/game/scpNightwatch/core/power";
import {
  CameraId,
  CustomNightConfig,
  DoorSide,
  EndingOutcome,
  EntityId,
  EntityState,
  FacilityEvent,
  GamePhase,
  GameState,
  IncidentStage,
  SaveState,
  ViewMode,
} from "@/game/scpNightwatch/core/types";

const NIGHT_DURATION_MS = 360000;
const LOCKDOWN_DURATION_MS = 9000;
const LOCKDOWN_COOLDOWN_MS = 26000;

function createCameraMetricMap(initialValue = 0): Record<CameraId, number> {
  return {
    "CAM-01": initialValue,
    "CAM-02": initialValue,
    "CAM-03": initialValue,
    "CAM-04": initialValue,
    "CAM-05": initialValue,
    "CAM-06": initialValue,
    "CAM-07": initialValue,
    "CAM-08": initialValue,
  };
}

function createEntityState(id: EntityId, aggression = 0): EntityState {
  return {
    id,
    roomId: ENTITY_START_ROOMS[id],
    moveProgress: 0,
    aggression,
    rage: 0,
    heat: 0,
    cooldownMs: 0,
    pathVariant: Math.random() > 0.5 ? "left" : "right",
    manifesting: false,
    seenFace: false,
    breachCountdownMs: 0,
  };
}

function createRuntimeGameState(): GameState {
  return {
    phase: "menu",
    viewMode: "menu",
    activeTab: "overview",
    selectedCamera: "CAM-01",
    cameraMonitorOpen: false,
    timeMinutes: 0,
    elapsedMs: 0,
    power: 100,
    emergencyMode: false,
    currentNight: null,
    currentNightLabel: "Site-17 Nightwatch",
    incidentStage: "nominal",
    jumpscareEntity: null,
    jumpscareTimerMs: 0,
    ending: null,
    callLines: [],
    doors: { left: false, right: false },
    lights: { left: false, right: false },
    lockdown: { active: false, timerMs: 0, cooldownMs: 0 },
    events: [],
    entities: {
      scp173: createEntityState("scp173"),
      scp096: createEntityState("scp096"),
      scp106: createEntityState("scp106"),
      scp457: createEntityState("scp457"),
    },
    randomEventTimerMs: 18000,
    observedRooms: [],
    encounterFlags: {
      scp173: false,
      scp096: false,
      scp106: false,
      scp457: false,
    },
    paranoiaPressure: 0,
    cameraSwitchBurst: 0,
    systemInstability: 0,
    monitorStallMs: 0,
    controlLagMs: 0,
    silenceMs: 0,
    falseNegativeMs: 0,
    timestampSkewMs: 0,
    phantomGlitchMs: 0,
    warningLagMs: 0,
    powerMisreportMs: 0,
    doorIndicatorLagMs: 0,
    unseenEventTimerMs: 14000,
    unseenHintMs: 0,
    unseenLogLagMs: 0,
    unseenCameraId: null,
    unseenSignalType: null,
    unseenSignalToken: 0,
    unseenDelayedTitle: null,
    unseenDelayedBody: null,
    behaviorCameraFocusMs: createCameraMetricMap(),
    behaviorCameraVisits: createCameraMetricMap(),
    behaviorHesitationMs: 0,
    behaviorPatternCameraId: null,
    neglectedCameraId: null,
    metaEventTimerMs: 22000,
    metaHintMs: 0,
    metaLogLagMs: 0,
    metaTargetCameraId: null,
    metaSignalType: null,
    metaSignalToken: 0,
    metaDelayedTitle: null,
    metaDelayedBody: null,
  };
}

function minuteLabel(timeMinutes: number) {
  const hour = Math.floor(timeMinutes / 60);
  const displayHour = ((hour + 12) % 12) || 12;
  return `${displayHour}:00 AM`;
}

function capEvents(events: FacilityEvent[]) {
  return events.slice(0, 12);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildUnseenEvent(cameraId: CameraId) {
  const pool = [
    { title: "UNVERIFIED MOVEMENT", body: `${cameraId} motion flag expired before visual lock.`, tone: "warn" as const, signal: "movement" as const },
    { title: "VISUAL INTEGRITY WARNING", body: `${cameraId} frame continuity degraded without source confirmation.`, tone: "warn" as const, signal: "static" as const },
    { title: "SECTOR B SIGNAL FLUCTUATION", body: `${cameraId} relay drifted and corrected outside operator focus.`, tone: "info" as const, signal: "static" as const },
    { title: "CAM DESYNC", body: `${cameraId} returned a late frame from an unobserved corridor interval.`, tone: "warn" as const, signal: "metal" as const },
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildMetaEvent(cameraId: CameraId, mode: "fixation" | "avoidance" | "hesitation" | "panic") {
  const label = cameraId.replace("CAM-", "");
  const variants = {
    fixation: [
      {
        title: "FRAME HOLD",
        body: `${cameraId} returned a late corridor image after repeated operator revisits.`,
        signal: "hold" as const,
      },
      {
        title: "REVIEW ECHO",
        body: `${cameraId} continuity shifted after a familiar watch pattern was logged and closed.`,
        signal: "echo" as const,
      },
    ],
    avoidance: [
      {
        title: "CAM-" + label + " VARIANCE",
        body: `${cameraId} remained outside operator focus until the record changed without clean cause.`,
        signal: "watch" as const,
      },
      {
        title: "UNATTENDED FEED",
        body: `${cameraId} archived a brief discrepancy during an unobserved interval.`,
        signal: "echo" as const,
      },
    ],
    hesitation: [
      {
        title: "BUFFER HOLD",
        body: `${cameraId} stalled after a prolonged watch pause and resumed on a displaced frame.`,
        signal: "hold" as const,
      },
      {
        title: "LATE RESUME",
        body: `${cameraId} recovered after a quiet delay that was not reflected in operator timing.`,
        signal: "echo" as const,
      },
    ],
    panic: [
      {
        title: "SWITCH DESYNC",
        body: `${cameraId} returned out of order while rapid input bursts were still being indexed.`,
        signal: "hold" as const,
      },
      {
        title: "RELAY HESITATION",
        body: `${cameraId} paused slightly longer than the active command sequence predicted.`,
        signal: "watch" as const,
      },
    ],
  } satisfies Record<"fixation" | "avoidance" | "hesitation" | "panic", { title: string; body: string; signal: "watch" | "echo" | "hold" }[]>;

  const pool = variants[mode];
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildHourMarkerEvents(previousMinutes: number, nextMinutes: number, elapsedMs: number): FacilityEvent[] {
  const markers = [
    {
      minute: 12,
      id: "hour-intro-1",
      title: "Operator Advisory",
      body: "Use the monitor first. Confirm corridor silence before spending power on blast doors.",
      tone: "info" as const,
    },
    {
      minute: 34,
      id: "hour-intro-2",
      title: "Visual Discipline Reminder",
      body: "If a feed holds your attention too long, assume another sector is already moving.",
      tone: "warn" as const,
    },
    {
      minute: 60,
      id: "hour-1",
      title: "00:59 Relay Review",
      body: "Operator corridor remains active. Remote sectors continue reporting clipped anomalies without closure.",
      tone: "info" as const,
    },
    {
      minute: 180,
      id: "hour-3",
      title: "03:00 Incident Threshold",
      body: "Containment review now references parallel instability beyond assigned surveillance coverage.",
      tone: "warn" as const,
    },
    {
      minute: 240,
      id: "hour-4",
      title: "04:00 Continuity Strain",
      body: "Terminal integrity remains intact, but command relay timing no longer matches sector telemetry.",
      tone: "danger" as const,
    },
    {
      minute: 300,
      id: "hour-5",
      title: "05:00 Terminal Last-Window Advisory",
      body: "This console may represent the last coherent surveillance window still indexing the incident in real time.",
      tone: "danger" as const,
    },
  ];

  return markers
    .filter((marker) => previousMinutes < marker.minute && nextMinutes >= marker.minute)
    .map((marker) => ({
      id: `${marker.id}-${Math.floor(elapsedMs)}`,
      title: marker.title,
      body: marker.body,
      tone: marker.tone,
      timestamp: elapsedMs,
      acknowledged: false,
    }));
}

function buildEarlyNightOneBeat(previousMinutes: number, nextMinutes: number, elapsedMs: number, currentNight: number | "custom" | null): FacilityEvent | null {
  if (currentNight !== 1) return null;
  if (!(previousMinutes < 48 && nextMinutes >= 48)) return null;
  return {
    id: `night-one-beat-${Math.floor(elapsedMs)}`,
    title: "CAM-01 Motion Exception",
    body: "Statue Vault lost clean status for less than a second. Corridor review advised before the ledger updates again.",
    tone: "danger",
    timestamp: elapsedMs,
    acknowledged: false,
  };
}

function deriveIncidentStage(params: {
  timeMinutes: number;
  emergencyMode: boolean;
  paranoiaPressure: number;
  nearThreat: boolean;
  currentNight: number | "custom" | null;
}): IncidentStage {
  const pressure =
    (params.timeMinutes / 360) * 0.38 +
    (params.emergencyMode ? 0.28 : 0) +
    params.paranoiaPressure * 0.34 +
    (params.nearThreat ? 0.14 : 0) +
    (params.currentNight === 5 || params.currentNight === "custom" ? 0.08 : 0);
  if (pressure >= 0.92) return "archive-continuity-only";
  if (pressure >= 0.72) return "response-degraded";
  if (pressure >= 0.48) return "multi-zone-event";
  if (pressure >= 0.24) return "sector-instability";
  return "nominal";
}

function mergeLogUnlocks(save: SaveState, entityFlags: Record<EntityId, boolean>, night: number | "custom" | null) {
  const unlocked = new Set(save.unlockedLogs);
  if (night !== "custom" && typeof night === "number") {
    for (const log of getUnlockableLogs(night, entityFlags)) {
      unlocked.add(log.id);
    }
  }
  return [...unlocked];
}

function buildEnding(
  id: "night-clear" | "termination-postponed" | "archivist" | "apollyon" | "casualty",
  survived: boolean,
  nightLabel: string,
  extraBody?: string,
): EndingOutcome {
  const definition = getEndingDefinition(id);
  return {
    id: definition.id,
    title: definition.title,
    classification: definition.classification,
    body: extraBody ? `${definition.body} ${extraBody}` : definition.body,
    survived,
    nightLabel,
  };
}

function buildArchivePrelude(save: SaveState): FacilityEvent[] {
  const priorOperator = save.priorOperators[0] ?? "D-9341";
  const carryoverTitle = save.carryoverTitles[0] ?? "PREVIOUS OPERATOR DISCONNECT";
  const carryoverBody = save.archiveNotes[0] ?? "Recovered ledger reopened after a clipped disconnect outside current watch authority.";
  const notes = [
    {
      id: `archive-${save.sessionSerial}-carryover`,
      title: carryoverTitle,
      body: carryoverBody,
      tone: "warn" as const,
      timestamp: -720000,
      acknowledged: false,
    },
    {
      id: `archive-${save.sessionSerial}-operator`,
      title: "SESSION CHAIN",
      body: `Prior operator ${priorOperator} released this terminal without resolved corridor closure.`,
      tone: "info" as const,
      timestamp: -640000,
      acknowledged: false,
    },
  ];
  const selected = ARCHIVE_PRELUDE_EVENTS.slice(0, 2).map((entry, index) => ({
    id: `archive-${save.sessionSerial}-${index}`,
    title: entry.title,
    body: entry.body,
    tone: entry.tone,
    timestamp: -560000 + index * 60000,
    acknowledged: false,
  }));
  return [...notes, ...selected];
}

function buildNextArchiveSave(save: SaveState, summary: { title: string; note: string; operator: string }) {
  const nextSerial = save.sessionSerial + 1;
  return {
    ...save,
    sessionSerial: nextSerial,
    lastSessionId: `S17-${String(nextSerial).padStart(3, "0")}-${String(100000 + ((nextSerial * 7919) % 900000)).padStart(6, "0")}`,
    priorOperators: [summary.operator, ...save.priorOperators].slice(0, 5),
    archiveNotes: [summary.note, ...save.archiveNotes, ...ARCHIVE_STRAY_NOTES.filter((_, index) => index === nextSerial % ARCHIVE_STRAY_NOTES.length)].slice(0, 12),
    carryoverTitles: [summary.title, ...save.carryoverTitles].slice(0, 8),
  };
}

type SCPNightwatchStore = GameState & {
  save: SaveState;
  bootstrapped: boolean;
  hydrate: () => void;
  startNight: (nightId: number) => void;
  startCustomNight: (config: CustomNightConfig) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setActiveTab: (tab: GameState["activeTab"]) => void;
  toggleDoor: (side: DoorSide) => void;
  setLight: (side: DoorSide, active: boolean) => void;
  toggleCameraMonitor: () => void;
  selectCamera: (cameraId: CameraId) => void;
  triggerLockdown: () => void;
  acknowledgeEvent: (eventId: string) => void;
  updateCustomNightValue: (entityId: EntityId, value: number) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  tick: (deltaMs: number) => void;
  returnToMenu: () => void;
  resetProgress: () => void;
};

export const useSCPNightwatchStore = create<SCPNightwatchStore>((set, get) => ({
  ...createRuntimeGameState(),
  save: defaultSaveState(),
  bootstrapped: false,

  hydrate: () => {
    if (get().bootstrapped) return;
    const save = loadSaveState();
    saveSaveState(save);
    set({ save, bootstrapped: true });
  },

  startNight: (nightId) => {
    const currentState = get();
    if (currentState.phase === "running" || currentState.phase === "paused" || currentState.phase === "jumpscare") return;
    const preset = getNightPreset(nightId);
    if (!preset) return;
    const runtime = createRuntimeGameState();
    runtime.phase = "running";
    runtime.viewMode = "office";
    runtime.currentNight = nightId;
    runtime.currentNightLabel = preset.label;
    runtime.callLines = preset.call;
    runtime.entities = {
      scp173: createEntityState("scp173", preset.aggressions.scp173),
      scp096: createEntityState("scp096", preset.aggressions.scp096),
      scp106: createEntityState("scp106", preset.aggressions.scp106),
      scp457: createEntityState("scp457", preset.aggressions.scp457),
    };
    runtime.randomEventTimerMs = preset.randomEventRate;
    const nextSave = buildNextArchiveSave(currentState.save, {
      title: "SESSION CHAIN",
      note: `${preset.label} reopened under recovered playback authority without full archive repair.`,
      operator: `D-${String(4000 + currentState.save.failures + nightId * 17).padStart(4, "0")}`,
    });
    runtime.events = [
      ...buildArchivePrelude(nextSave),
      {
        id: "briefing",
        title: "Shift Begins",
        body: preset.summary,
        tone: "info",
        timestamp: 0,
        acknowledged: false,
      },
    ];
    saveSaveState(nextSave);
    set({ ...runtime, save: nextSave });
  },

  startCustomNight: (config) => {
    const currentState = get();
    if (currentState.phase === "running" || currentState.phase === "paused" || currentState.phase === "jumpscare") return;
    const runtime = createRuntimeGameState();
    runtime.phase = "running";
    runtime.viewMode = "office";
    runtime.currentNight = "custom";
    runtime.currentNightLabel = "Custom Night";
    runtime.callLines = [
      "CUSTOM NIGHT / UNAUTHORIZED",
      "All selected anomalies are active.",
      "No official debrief will be issued if you fail.",
    ];
    const sanitizedConfig = {
      scp173: Math.max(0, Math.min(20, Math.round(config.scp173))),
      scp096: Math.max(0, Math.min(20, Math.round(config.scp096))),
      scp106: Math.max(0, Math.min(20, Math.round(config.scp106))),
      scp457: Math.max(0, Math.min(20, Math.round(config.scp457))),
    };
    runtime.entities = {
      scp173: createEntityState("scp173", sanitizedConfig.scp173),
      scp096: createEntityState("scp096", sanitizedConfig.scp096),
      scp106: createEntityState("scp106", sanitizedConfig.scp106),
      scp457: createEntityState("scp457", sanitizedConfig.scp457),
    };
    runtime.randomEventTimerMs = 9000;
    set((state) => {
      const save = buildNextArchiveSave(
        {
          ...state.save,
          customNightConfig: sanitizedConfig,
        },
        {
          title: "UNAUTHORIZED SESSION",
          note: "Custom hostility profile appended to recovered archive without command signature.",
          operator: `D-${String(5000 + state.save.failures + 91).padStart(4, "0")}`,
        },
      );
      const persisted = {
        ...save,
        customNightConfig: sanitizedConfig,
      };
      runtime.events = [
        ...buildArchivePrelude(persisted),
        {
          id: "custom-briefing",
          title: "Archive Override",
          body: "Recovered terminal accepted a non-standard threat profile.",
          tone: "warn",
          timestamp: 0,
          acknowledged: false,
        },
      ];
      saveSaveState(persisted);
      return { ...runtime, save: persisted };
    });
  },

  setViewMode: (viewMode) => set({ viewMode }),
  setActiveTab: (activeTab) => set({ activeTab }),

  toggleDoor: (side) =>
    set((state) => {
      if (state.phase !== "running" || state.viewMode !== "office") return state;
      return { doors: { ...state.doors, [side]: !state.doors[side] } };
    }),

  setLight: (side, active) =>
    set((state) => {
      if (state.phase !== "running" || state.viewMode !== "office") return state;
      if (state.lights[side] === active) return state;
      if (state.emergencyMode && active && Math.random() > 0.45) {
        return {
          events: capEvents([
            {
              id: `${state.elapsedMs}-fuse-${side}`,
              title: "Fuse Failure",
              body: `${side === "left" ? "Left" : "Right"} hall floodlight sputtered out in emergency mode.`,
              tone: "warn",
              timestamp: state.elapsedMs,
              acknowledged: false,
            },
            ...state.events,
          ]),
        };
      }
      return { lights: { ...state.lights, [side]: active } };
    }),

  toggleCameraMonitor: () =>
    set((state) => {
      if (state.phase !== "running") return state;
      if (state.emergencyMode && !state.cameraMonitorOpen) return state;
      if (state.monitorStallMs > 0) return state;
      const nextOpen = !state.cameraMonitorOpen;
      return {
        cameraMonitorOpen: nextOpen,
        viewMode: nextOpen ? "camera" : "office",
      };
    }),

  selectCamera: (cameraId) =>
    set((state) => {
      if (state.phase !== "running" || !state.cameraMonitorOpen || state.viewMode !== "camera") return state;
      if (state.monitorStallMs > 0 || state.selectedCamera === cameraId) return state;
      return {
        selectedCamera: cameraId,
        cameraSwitchBurst: Math.min(1, state.cameraSwitchBurst + 0.17),
        behaviorCameraVisits: {
          ...state.behaviorCameraVisits,
          [cameraId]: state.behaviorCameraVisits[cameraId] + 1,
        },
        behaviorHesitationMs: 0,
      };
    }),

  triggerLockdown: () =>
    set((state) => {
      if (state.phase !== "running" || state.viewMode !== "office") return state;
      if (state.lockdown.active || state.lockdown.cooldownMs > 0 || state.power < 12) return state;
      return {
        lockdown: {
          active: true,
          timerMs: LOCKDOWN_DURATION_MS,
          cooldownMs: LOCKDOWN_COOLDOWN_MS,
        },
        events: capEvents([
          {
            id: `${state.elapsedMs}-lockdown`,
            title: "Emergency Lockdown",
            body: "Spatial anchors energized around the operator room.",
            tone: "warn",
            timestamp: state.elapsedMs,
            acknowledged: false,
          },
          ...state.events,
        ]),
      };
    }),

  acknowledgeEvent: (eventId) =>
    set((state) => {
      const target = state.events.find((entry) => entry.id === eventId);
      if (!target || target.acknowledged) return state;
      return {
        events: state.events.map((entry) => (entry.id === eventId ? { ...entry, acknowledged: true } : entry)),
      };
    }),

  updateCustomNightValue: (entityId, value) =>
    set((state) => {
      const clamped = Math.max(0, Math.min(20, Math.round(value)));
      const save = {
        ...state.save,
        customNightConfig: { ...state.save.customNightConfig, [entityId]: clamped },
      };
      saveSaveState(save);
      return { save };
    }),

  pauseGame: () => set((state) => (state.phase === "running" ? { phase: "paused" } : state)),
  resumeGame: () => set((state) => (state.phase === "paused" ? { phase: "running", viewMode: state.cameraMonitorOpen ? "camera" : "office" } : state)),

  tick: (deltaMs) => {
    const state = get();
    if (state.phase === "paused" || state.phase === "menu") return;
    if (state.phase === "jumpscare") {
      const timer = state.jumpscareTimerMs - deltaMs;
      if (timer <= 0) {
        set({ phase: "ending", viewMode: "ending", jumpscareTimerMs: 0, jumpscareEntity: null });
      } else {
        set({
          jumpscareTimerMs: timer,
          silenceMs: Math.max(0, state.silenceMs - deltaMs),
          systemInstability: clamp(state.systemInstability + deltaMs * 0.0003, 0, 1),
          warningLagMs: Math.max(0, state.warningLagMs - deltaMs),
          powerMisreportMs: Math.max(0, state.powerMisreportMs - deltaMs),
          doorIndicatorLagMs: Math.max(0, state.doorIndicatorLagMs - deltaMs),
        });
      }
      return;
    }
    if (state.phase !== "running") return;

    const nextElapsedMs = state.elapsedMs + deltaMs;
    const nextTimeMinutes = Math.min(360, state.timeMinutes + (deltaMs / NIGHT_DURATION_MS) * 360);
    const nightPressure = nextTimeMinutes / 360;
    const nextCameraSwitchBurst = Math.max(0, state.cameraSwitchBurst - deltaMs / 5200);
    const behaviorCameraFocusMs = { ...state.behaviorCameraFocusMs };
    if (state.cameraMonitorOpen && state.viewMode === "camera") {
      behaviorCameraFocusMs[state.selectedCamera] += deltaMs;
    }
    const focusEntries = Object.entries(behaviorCameraFocusMs) as [CameraId, number][];
    const visitEntries = Object.entries(state.behaviorCameraVisits) as [CameraId, number][];
    const fixationCamera = focusEntries.reduce(
      (best, entry) => (entry[1] > best[1] ? entry : best),
      ["CAM-01" as CameraId, -1],
    )[0];
    const fixationValue = behaviorCameraFocusMs[fixationCamera];
    const neglectedCameraId = focusEntries.reduce(
      (best, entry) => (entry[1] < best[1] ? entry : best),
      ["CAM-01" as CameraId, Number.POSITIVE_INFINITY],
    )[0];
    const repeatCamera = visitEntries.reduce(
      (best, entry) => (entry[1] > best[1] ? entry : best),
      ["CAM-01" as CameraId, -1],
    )[0];
    const repeatCount = state.behaviorCameraVisits[repeatCamera];
    const nextBehaviorPatternCameraId =
      repeatCount >= 4 || fixationValue >= 18000 ? (fixationValue >= behaviorCameraFocusMs[repeatCamera] ? fixationCamera : repeatCamera) : null;
    const nextBehaviorHesitationMs =
      state.cameraMonitorOpen && state.viewMode === "camera" && nextCameraSwitchBurst < 0.08
        ? Math.min(24000, state.behaviorHesitationMs + deltaMs)
        : Math.max(0, state.behaviorHesitationMs - deltaMs * 1.4);
    const activeUsage = computePowerDrain({
      cameraMonitorOpen: state.cameraMonitorOpen,
      doors: state.doors,
      lights: state.lights,
      lockdown: state.lockdown,
    });
    const powerTick = applyPowerTick(state.power, deltaMs, activeUsage);
    const nextPower = powerTick.power;
    const emergencyMode = powerTick.emergencyMode;
    const lockdown = {
      active: state.lockdown.active && state.lockdown.timerMs - deltaMs > 0,
      timerMs: Math.max(0, state.lockdown.timerMs - deltaMs),
      cooldownMs: Math.max(0, state.lockdown.cooldownMs - deltaMs),
    };
    const ai = simulateAI(
      {
        entities: state.entities,
        selectedCamera: state.selectedCamera,
        cameraMonitorOpen: emergencyMode ? false : state.cameraMonitorOpen,
        lights: state.lights,
        doors: state.doors,
        lockdown,
        emergencyMode,
        power: nextPower,
        randomEventTimerMs: state.randomEventTimerMs,
        encounterFlags: state.encounterFlags,
        elapsedMs: nextElapsedMs,
      },
      deltaMs,
    );
    const previousNearThreat = Object.values(state.entities).some((entity) => entity.roomId.includes("Hall") || entity.roomId.includes("Door"));
    const nearThreat = Object.values(ai.entities).some((entity) => entity.roomId.includes("Hall") || entity.roomId.includes("Door"));
    const firstApproachSpike = !previousNearThreat && nearThreat;
    const finalHourWindow = nextTimeMinutes >= 240;
    const baseInstability = clamp(
      nightPressure * 0.28 +
      (emergencyMode ? 0.34 : 0) +
      (nextPower < 35 ? 0.16 : 0) +
      (nearThreat ? 0.18 : 0) +
      (nextTimeMinutes >= 240 ? 0.09 : nextTimeMinutes >= 180 ? 0.04 : 0) +
      (nextTimeMinutes >= 300 ? 0.08 : 0) +
      ai.instabilityBoost,
      0,
      1,
    );
    const nextParanoiaPressure = clamp(
      state.paranoiaPressure * 0.985 +
      nightPressure * 0.0015 +
      (nextPower < 35 ? 0.0024 : 0.0002) +
      (emergencyMode ? 0.0032 : 0) +
      (nearThreat ? 0.0026 : 0) +
      nextCameraSwitchBurst * 0.0035 +
      (nextTimeMinutes >= 240 ? 0.0014 : nextTimeMinutes >= 180 ? 0.0007 : 0) +
      (nextTimeMinutes >= 300 ? 0.0012 : 0) +
      ai.paranoiaBoost * 0.018,
      0,
      1,
    );
    const nextIncidentStage = deriveIncidentStage({
      timeMinutes: nextTimeMinutes,
      emergencyMode,
      paranoiaPressure: nextParanoiaPressure,
      nearThreat,
      currentNight: state.currentNight,
    });
    const earlyNightOneBeat = buildEarlyNightOneBeat(state.timeMinutes, nextTimeMinutes, nextElapsedMs, state.currentNight);

    const stageTransitionEvent =
      state.incidentStage !== nextIncidentStage
        ? [{
            id: `${nextElapsedMs}-incident-stage`,
            title: INCIDENT_STAGE_LABELS[nextIncidentStage],
            body:
              nextIncidentStage === "sector-instability"
                ? "Remote sectors no longer report as isolated deviations."
                : nextIncidentStage === "multi-zone-event"
                  ? "Concurrent containment faults now exceed the assigned watch corridor."
                  : nextIncidentStage === "response-degraded"
                    ? "Human response acknowledgements have fallen behind automated directives."
                    : nextIncidentStage === "archive-continuity-only"
                      ? "Recorder retained continuity after command traffic degraded beyond recovery."
                      : "Operational telemetry returned to nominal review status.",
            tone: nextIncidentStage === "nominal" ? "info" : nextIncidentStage === "sector-instability" ? "warn" : "danger",
            timestamp: nextElapsedMs,
            acknowledged: false,
          } satisfies FacilityEvent]
        : [];
    const remoteStageEvent =
      nextIncidentStage !== "nominal" && Math.random() < 0.0024 + nextParanoiaPressure * 0.0028
        ? (() => {
            const pool = REMOTE_INCIDENT_EVENTS[nextIncidentStage];
            const selected = pool[Math.floor(Math.random() * pool.length)];
            return {
              id: `${nextElapsedMs}-remote-${selected.title}`,
              title: selected.title,
              body: selected.body,
              tone: selected.tone,
              timestamp: nextElapsedMs,
              acknowledged: false,
            } satisfies FacilityEvent;
          })()
        : null;
    const rareArchiveEvent =
      Math.random() < 0.0009 + nextParanoiaPressure * 0.0011
        ? (() => {
            const note = ARCHIVE_STRAY_NOTES[(state.save.sessionSerial + Math.floor(nextElapsedMs / 1000)) % ARCHIVE_STRAY_NOTES.length];
            const source = ARCHIVE_PRELUDE_EVENTS[(state.save.failures + Math.floor(nextElapsedMs / 6000)) % ARCHIVE_PRELUDE_EVENTS.length];
            return {
              id: `${nextElapsedMs}-archive-rare`,
              title: source.title,
              body: `${source.body} Note appended later: ${note}`,
              tone: source.tone,
              timestamp: nextElapsedMs - (Math.random() < 0.5 ? 1800 : 0),
              acknowledged: false,
            } satisfies FacilityEvent;
          })()
        : null;
    const hourMarkerEvents = buildHourMarkerEvents(state.timeMinutes, nextTimeMinutes, nextElapsedMs);
    const dangerSpike =
      firstApproachSpike ||
      Boolean(earlyNightOneBeat) ||
      stageTransitionEvent.some((entry) => entry.tone === "danger") ||
      hourMarkerEvents.some((entry) => entry.tone === "danger") ||
      Boolean(remoteStageEvent && remoteStageEvent.tone === "danger") ||
      ai.events.some((entry) => entry.tone === "danger");
    const monitorStallMs = Math.max(
      0,
      state.monitorStallMs - deltaMs,
      ai.monitorStallMs,
      dangerSpike ? (finalHourWindow ? 340 : state.currentNight === 1 ? 220 : 160) : 0,
    );
    const controlLagMs = Math.max(
      0,
      state.controlLagMs - deltaMs,
      ai.controlLagMs,
      nextParanoiaPressure > 0.72 ? 80 : 0,
      dangerSpike ? (finalHourWindow ? 120 : 68) : 0,
    );
    const silenceMs = Math.max(
      0,
      state.silenceMs - deltaMs,
      ai.silenceMs,
      dangerSpike ? (finalHourWindow ? 920 : state.currentNight === 1 ? 640 : 520) : 0,
    );
    const falseNegativeMs = Math.max(
      0,
      state.falseNegativeMs - deltaMs,
      ai.falseNegativeMs,
      dangerSpike ? (finalHourWindow ? 260 : 180) : 0,
      nextParanoiaPressure > 0.66 && Math.random() < 0.005 ? 180 : 0,
    );
    const timestampSkewMs = Math.max(0, state.timestampSkewMs - deltaMs, ai.timestampSkewMs, dangerSpike ? 180 : 0, nextParanoiaPressure > 0.7 ? 120 : 0);
    const phantomGlitchMs = Math.max(
      0,
      state.phantomGlitchMs - deltaMs,
      ai.phantomGlitchMs,
      dangerSpike ? (finalHourWindow ? 280 : 170) : 0,
      nextParanoiaPressure > 0.74 && Math.random() < 0.004 ? 140 : 0,
    );
    const warningLagMs = Math.max(0, state.warningLagMs - deltaMs, ai.warningLagMs, dangerSpike ? (state.currentNight === 1 ? 260 : 180) : 0);
    const powerMisreportMs = Math.max(0, state.powerMisreportMs - deltaMs, ai.powerMisreportMs, nextParanoiaPressure > 0.68 ? 120 : 0);
    const doorIndicatorLagMs = Math.max(0, state.doorIndicatorLagMs - deltaMs, ai.doorIndicatorLagMs, dangerSpike ? 120 : 0);
    let unseenEventTimerMs = Math.max(0, state.unseenEventTimerMs - deltaMs);
    let unseenHintMs = Math.max(0, state.unseenHintMs - deltaMs);
    let unseenLogLagMs = Math.max(0, state.unseenLogLagMs - deltaMs);
    let unseenCameraId = state.unseenCameraId;
    let unseenSignalType = state.unseenSignalType;
    let unseenSignalToken = state.unseenSignalToken;
    let unseenDelayedTitle = state.unseenDelayedTitle;
    let unseenDelayedBody = state.unseenDelayedBody;
    let unseenEvent: FacilityEvent | null = null;
    let metaEventTimerMs = Math.max(0, state.metaEventTimerMs - deltaMs);
    let metaHintMs = Math.max(0, state.metaHintMs - deltaMs);
    let metaLogLagMs = Math.max(0, state.metaLogLagMs - deltaMs);
    let metaTargetCameraId = state.metaTargetCameraId;
    let metaSignalType = state.metaSignalType;
    let metaSignalToken = state.metaSignalToken;
    let metaDelayedTitle = state.metaDelayedTitle;
    let metaDelayedBody = state.metaDelayedBody;
    let metaEvent: FacilityEvent | null = null;
    const unseenStress = nextParanoiaPressure + (finalHourWindow ? 0.12 : 0) + (emergencyMode ? 0.08 : 0) + (state.cameraMonitorOpen ? 0.04 : 0);
    const patternStress =
      (nextBehaviorPatternCameraId ? 0.12 : 0) +
      (nextBehaviorHesitationMs > 6500 ? 0.1 : 0) +
      (nextCameraSwitchBurst > 0.45 ? 0.1 : 0) +
      (fixationValue > 24000 ? 0.08 : 0);
    if (unseenEventTimerMs <= 0 && Math.random() < 0.0035 + unseenStress * 0.004) {
      const offscreenCameras = CAMERA_NODES.map((camera) => camera.id).filter((cameraId) => cameraId !== state.selectedCamera);
      const weightedTarget =
        nextBehaviorPatternCameraId && Math.random() < 0.48
          ? neglectedCameraId
          : state.cameraSwitchBurst > 0.38 && Math.random() < 0.42
            ? fixationCamera === state.selectedCamera
              ? neglectedCameraId
              : fixationCamera
            : null;
      const targetCamera =
        (weightedTarget && offscreenCameras.includes(weightedTarget) ? weightedTarget : null) ??
        offscreenCameras[Math.floor(Math.random() * offscreenCameras.length)] ??
        "CAM-02";
      const unseenPayload = buildUnseenEvent(targetCamera);
      unseenCameraId = targetCamera;
      unseenSignalType = unseenPayload.signal;
      unseenSignalToken = state.unseenSignalToken + 1;
      unseenHintMs = 1800 + Math.random() * 2400;
      unseenLogLagMs = 2600 + Math.random() * 5200;
      unseenDelayedTitle = unseenPayload.title;
      unseenDelayedBody = unseenPayload.body;
      unseenEventTimerMs = 18000 + Math.random() * 22000;
    }
    if (metaEventTimerMs <= 0 && Math.random() < 0.0022 + nextParanoiaPressure * 0.0026 + patternStress * 0.0044) {
      const mode =
        nextCameraSwitchBurst > 0.52 && Math.random() < 0.44
          ? "panic"
          : nextBehaviorHesitationMs > 7200 && Math.random() < 0.5
            ? "hesitation"
            : nextBehaviorPatternCameraId && neglectedCameraId !== nextBehaviorPatternCameraId && Math.random() < 0.58
              ? "fixation"
              : "avoidance";
      const targetCamera =
        mode === "panic"
          ? fixationCamera
          : mode === "avoidance"
            ? neglectedCameraId
            : mode === "hesitation"
              ? state.selectedCamera
              : neglectedCameraId === nextBehaviorPatternCameraId
                ? fixationCamera
                : neglectedCameraId;
      const metaPayload = buildMetaEvent(targetCamera, mode);
      metaTargetCameraId = targetCamera;
      metaSignalType = metaPayload.signal;
      metaSignalToken = state.metaSignalToken + 1;
      metaHintMs = 2200 + Math.random() * 2600;
      metaLogLagMs = 3400 + Math.random() * 4200;
      metaDelayedTitle = metaPayload.title;
      metaDelayedBody = metaPayload.body;
      metaEventTimerMs = 24000 + Math.random() * 28000;
      if (mode === "hesitation" || mode === "panic") {
        unseenHintMs = Math.max(unseenHintMs, 900 + Math.random() * 1200);
        unseenCameraId = targetCamera;
      }
    }
    if (unseenLogLagMs <= 0 && unseenDelayedTitle && unseenDelayedBody) {
      unseenEvent = {
        id: `${nextElapsedMs}-unseen-${unseenSignalToken}`,
        title: unseenDelayedTitle,
        body: unseenDelayedBody,
        tone: unseenSignalType === "movement" ? "warn" : unseenSignalType === "metal" ? "warn" : "info",
        timestamp: nextElapsedMs,
        acknowledged: false,
      };
      unseenDelayedTitle = null;
      unseenDelayedBody = null;
      if (Math.random() < 0.45) {
        unseenCameraId = null;
      }
    }
    if (metaLogLagMs <= 0 && metaDelayedTitle && metaDelayedBody) {
      metaEvent = {
        id: `${nextElapsedMs}-meta-${metaSignalToken}`,
        title: metaDelayedTitle,
        body: metaDelayedBody,
        tone: metaSignalType === "watch" ? "warn" : "info",
        timestamp: nextElapsedMs,
        acknowledged: false,
      };
      metaDelayedTitle = null;
      metaDelayedBody = null;
      if (Math.random() < 0.5) {
        metaTargetCameraId = null;
      }
    }
    if (unseenHintMs <= 0 && unseenLogLagMs <= 0 && Math.random() < 0.35) {
      unseenCameraId = null;
      unseenSignalType = null;
    }
    if (metaHintMs <= 0 && metaLogLagMs <= 0 && Math.random() < 0.45) {
      metaTargetCameraId = null;
      metaSignalType = null;
    }
    const events = capEvents([
      ...(metaEvent ? [metaEvent] : []),
      ...(unseenEvent ? [unseenEvent] : []),
      ...(rareArchiveEvent ? [rareArchiveEvent] : []),
      ...(earlyNightOneBeat ? [earlyNightOneBeat] : []),
      ...(remoteStageEvent ? [remoteStageEvent] : []),
      ...hourMarkerEvents,
      ...stageTransitionEvent,
      ...ai.events,
      ...state.events,
    ]);
    if (ai.attack) {
      const save = {
        ...state.save,
        failures: state.save.failures + 1,
        archiveNotes: [
          `Operator record terminated during ${state.currentNightLabel}. Recorder continuity persisted beyond visible contact.`,
          ...state.save.archiveNotes,
        ].slice(0, 12),
        carryoverTitles: ["POST-EVENT CONTINUITY", ...state.save.carryoverTitles].slice(0, 8),
      };
      saveSaveState(save);
      set({
        phase: "jumpscare",
        viewMode: "office",
        jumpscareEntity: ai.attack,
        jumpscareTimerMs: 3000,
        power: nextPower,
        emergencyMode,
        cameraMonitorOpen: false,
        timeMinutes: nextTimeMinutes,
        elapsedMs: nextElapsedMs,
        lockdown,
        entities: ai.entities,
        observedRooms: ai.observedRooms,
        randomEventTimerMs: ai.randomEventTimerMs,
        encounterFlags: ai.encounterFlags,
        incidentStage: nextIncidentStage,
        systemInstability: 1,
        paranoiaPressure: 1,
        cameraSwitchBurst: nextCameraSwitchBurst,
        monitorStallMs: 900,
        controlLagMs: 220,
        silenceMs: 1700,
        falseNegativeMs,
        timestampSkewMs: 800,
        phantomGlitchMs: 900,
        warningLagMs,
        powerMisreportMs,
        doorIndicatorLagMs,
        unseenEventTimerMs,
        unseenHintMs,
        unseenLogLagMs,
        unseenCameraId,
        unseenSignalType,
        unseenSignalToken,
        unseenDelayedTitle,
        unseenDelayedBody,
        behaviorCameraFocusMs,
        behaviorCameraVisits: state.behaviorCameraVisits,
        behaviorHesitationMs: nextBehaviorHesitationMs,
        behaviorPatternCameraId: nextBehaviorPatternCameraId,
        neglectedCameraId,
        metaEventTimerMs,
        metaHintMs,
        metaLogLagMs,
        metaTargetCameraId,
        metaSignalType,
        metaSignalToken,
        metaDelayedTitle,
        metaDelayedBody,
        save,
        events,
        ending: buildEnding("casualty", false, state.currentNightLabel, `${SCP_LABELS[ai.attack]} was the final contact. ${ai.attackReason || ""}`.trim()),
      });
      return;
    }

    if (nextTimeMinutes >= 360) {
      const isNightFive = state.currentNight === 5;
      const unlockedNights = new Set(state.save.unlockedNights);
      if (typeof state.currentNight === "number" && state.currentNight < 5) {
        unlockedNights.add(state.currentNight + 1);
      }
      const unlockedLogs = mergeLogUnlocks(state.save, ai.encounterFlags, state.currentNight);
      const customNightUnlocked = state.save.customNightUnlocked || isNightFive;
      const bestKey = String(state.currentNight ?? "unknown");
      const save = {
        ...state.save,
        unlockedNights: [...unlockedNights].sort((a, b) => a - b),
        unlockedLogs,
        customNightUnlocked,
        bestClearRecords: {
          ...state.save.bestClearRecords,
          [bestKey]: {
            powerRemaining: Number(nextPower.toFixed(1)),
            completionMs: nextElapsedMs,
          },
        },
        archiveNotes: [
          `${state.currentNightLabel} concluded at ${minuteLabel(360)}. Residual motion remained outside the operator corridor.`,
          ...state.save.archiveNotes,
        ].slice(0, 12),
        carryoverTitles: ["SHIFT RECORD PRESERVED", ...state.save.carryoverTitles].slice(0, 8),
      };
      const endingsSeen = new Set(save.endingsSeen);
      let endingId: "night-clear" | "termination-postponed" | "archivist" | "apollyon" = "night-clear";
      if (state.currentNight === "custom" && isMaxHostilityCustomNight(state.save.customNightConfig)) {
        endingId = "apollyon";
      } else if (isNightFive) {
        endingId = unlockedLogs.length === LOG_ENTRIES.length ? "archivist" : "termination-postponed";
      }
      endingsSeen.add(ENDINGS[endingId].id);
      save.endingsSeen = [...endingsSeen];
      saveSaveState(save);
      set({
        phase: "ending",
        viewMode: "ending",
        cameraMonitorOpen: false,
        timeMinutes: 360,
        elapsedMs: nextElapsedMs,
        power: nextPower,
        emergencyMode,
        lockdown,
        entities: ai.entities,
        observedRooms: ai.observedRooms,
        randomEventTimerMs: ai.randomEventTimerMs,
        encounterFlags: ai.encounterFlags,
        incidentStage: nextIncidentStage,
        paranoiaPressure: nextParanoiaPressure,
        cameraSwitchBurst: nextCameraSwitchBurst,
        systemInstability: clamp(baseInstability + 0.12, 0, 1),
        monitorStallMs,
        controlLagMs,
        silenceMs,
        falseNegativeMs,
        timestampSkewMs,
        phantomGlitchMs,
        warningLagMs,
        powerMisreportMs,
        doorIndicatorLagMs,
        unseenEventTimerMs,
        unseenHintMs,
        unseenLogLagMs,
        unseenCameraId,
        unseenSignalType,
        unseenSignalToken,
        unseenDelayedTitle,
        unseenDelayedBody,
        behaviorCameraFocusMs,
        behaviorCameraVisits: state.behaviorCameraVisits,
        behaviorHesitationMs: nextBehaviorHesitationMs,
        behaviorPatternCameraId: nextBehaviorPatternCameraId,
        neglectedCameraId,
        metaEventTimerMs,
        metaHintMs,
        metaLogLagMs,
        metaTargetCameraId,
        metaSignalType,
        metaSignalToken,
        metaDelayedTitle,
        metaDelayedBody,
        save,
        events,
        ending: buildEnding(endingId, true, state.currentNightLabel, `Time held: ${minuteLabel(360)}. Residual motion persisted after shift termination.`),
      });
      return;
    }

    const nextEvents = emergencyMode && !state.emergencyMode
      ? capEvents([
          {
            id: `${nextElapsedMs}-power-loss`,
            title: "Emergency Mode",
            body: "Primary power exhausted. Cameras disabled. Lighting unstable. Thermal threat active.",
            tone: "danger",
            timestamp: nextElapsedMs,
            acknowledged: false,
          },
          ...events,
        ])
      : events;

    set({
      phase: "running",
      viewMode: emergencyMode && state.viewMode === "camera" ? "office" : state.viewMode,
      cameraMonitorOpen: emergencyMode ? false : ai.forceCloseMonitor ? false : state.cameraMonitorOpen,
      timeMinutes: nextTimeMinutes,
      elapsedMs: nextElapsedMs,
      power: nextPower,
      emergencyMode,
      lockdown,
      entities: ai.entities,
      observedRooms: ai.observedRooms,
      events: nextEvents,
      randomEventTimerMs: ai.randomEventTimerMs,
      encounterFlags: ai.encounterFlags,
      incidentStage: nextIncidentStage,
      paranoiaPressure: nextParanoiaPressure,
      cameraSwitchBurst: nextCameraSwitchBurst,
      systemInstability: Math.max(baseInstability, state.systemInstability - deltaMs * (finalHourWindow ? 0.000035 : 0.00006)),
      monitorStallMs,
      controlLagMs,
      silenceMs,
      falseNegativeMs,
      timestampSkewMs,
      phantomGlitchMs,
      warningLagMs,
      powerMisreportMs,
      doorIndicatorLagMs,
      unseenEventTimerMs,
      unseenHintMs,
      unseenLogLagMs,
      unseenCameraId,
      unseenSignalType,
      unseenSignalToken,
      unseenDelayedTitle,
      unseenDelayedBody,
      behaviorCameraFocusMs,
      behaviorCameraVisits: state.behaviorCameraVisits,
      behaviorHesitationMs: nextBehaviorHesitationMs,
      behaviorPatternCameraId: nextBehaviorPatternCameraId,
      neglectedCameraId,
      metaEventTimerMs,
      metaHintMs,
      metaLogLagMs,
      metaTargetCameraId,
      metaSignalType,
      metaSignalToken,
      metaDelayedTitle,
      metaDelayedBody,
    });
  },

  returnToMenu: () =>
    set((state) => {
      if (state.phase === "menu" && state.viewMode === "menu" && !state.ending && !state.jumpscareEntity) return state;
      return {
        ...createRuntimeGameState(),
        save: state.save,
        bootstrapped: state.bootstrapped,
      };
    }),

  resetProgress: () => {
    const save = defaultSaveState();
    saveSaveState(save);
    set({
      ...createRuntimeGameState(),
      save,
      bootstrapped: true,
    });
  },
}));

export function useCurrentCameraRoom() {
  return useSCPNightwatchStore((state) => getCameraRoom(state.selectedCamera));
}
