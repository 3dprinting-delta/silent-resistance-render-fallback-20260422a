import { CAMERA_NODES, ENTITY_START_ROOMS, RANDOM_EVENTS, ROOM_LABELS, SCP_LABELS } from "@/game/scpNightwatch/data/content";
import { EntityId, EntityState, FacilityEvent, GameState, RoomId } from "@/game/scpNightwatch/core/types";

const PATHS_173: Record<"left" | "right", RoomId[]> = {
  left: ["statueVault", "archive", "westHall", "leftDoor"],
  right: ["statueVault", "maintenance", "eastHall", "rightDoor"],
};

const PATHS_096: Record<"left" | "right", RoomId[]> = {
  left: ["records", "northHub", "westHall", "leftDoor"],
  right: ["surgery", "northHub", "eastHall", "rightDoor"],
};

const PATHS_457: Record<"left" | "right", RoomId[]> = {
  left: ["generator", "archive", "westHall", "leftDoor"],
  right: ["boiler", "maintenance", "eastHall", "rightDoor"],
};

const PHASE_ROOMS_106: RoomId[] = ["boiler", "generator", "archive", "maintenance", "westHall", "eastHall"];

export type RuntimeUpdate = {
  entities: Record<EntityId, EntityState>;
  events: FacilityEvent[];
  observedRooms: RoomId[];
  attack?: EntityId;
  attackReason?: string;
  forceCloseMonitor?: boolean;
  randomEventTimerMs: number;
  encounterFlags: Record<EntityId, boolean>;
  instabilityBoost: number;
  paranoiaBoost: number;
  monitorStallMs: number;
  controlLagMs: number;
  silenceMs: number;
  falseNegativeMs: number;
  timestampSkewMs: number;
  phantomGlitchMs: number;
  warningLagMs: number;
  powerMisreportMs: number;
  doorIndicatorLagMs: number;
};

type RuntimeContext = Pick<
  GameState,
  | "entities"
  | "selectedCamera"
  | "cameraMonitorOpen"
  | "lights"
  | "doors"
  | "lockdown"
  | "emergencyMode"
  | "power"
  | "randomEventTimerMs"
  | "encounterFlags"
  | "elapsedMs"
>;

function cloneEntities(entities: Record<EntityId, EntityState>) {
  return {
    scp173: { ...entities.scp173 },
    scp096: { ...entities.scp096 },
    scp106: { ...entities.scp106 },
    scp457: { ...entities.scp457 },
  };
}

function event(title: string, body: string, tone: FacilityEvent["tone"], elapsedMs: number): FacilityEvent {
  return {
    id: `${elapsedMs}-${title}`,
    title,
    body,
    tone,
    timestamp: elapsedMs,
    acknowledged: false,
  };
}

function roomObserved(ctx: RuntimeContext, roomId: RoomId) {
  const selectedRoom = CAMERA_NODES.find((camera) => camera.id === ctx.selectedCamera)?.roomId;
  const cameraObserved = ctx.cameraMonitorOpen && selectedRoom === roomId;
  const lightObserved = (roomId === "westHall" || roomId === "leftDoor") && ctx.lights.left;
  const rightLightObserved = (roomId === "eastHall" || roomId === "rightDoor") && ctx.lights.right;
  return cameraObserved || lightObserved || rightLightObserved;
}

function stepPath(entity: EntityState, path: RoomId[]) {
  const index = Math.max(path.indexOf(entity.roomId), 0);
  const nextIndex = Math.min(index + 1, path.length - 1);
  entity.roomId = path[nextIndex];
  entity.moveProgress = 0;
}

function retreatPath(entity: EntityState, path: RoomId[], fallbackIndex = 1) {
  entity.roomId = path[fallbackIndex] || path[0];
  entity.moveProgress = 0;
}

export function simulateAI(ctx: RuntimeContext, deltaMs: number): RuntimeUpdate {
  const entities = cloneEntities(ctx.entities);
  const events: FacilityEvent[] = [];
  const observedRooms: RoomId[] = [];
  const encounterFlags = { ...ctx.encounterFlags };
  let attack: EntityId | undefined;
  let attackReason = "";
  let forceCloseMonitor = false;
  let randomEventTimerMs = ctx.randomEventTimerMs - deltaMs;
  let instabilityBoost = 0;
  let paranoiaBoost = 0;
  let monitorStallMs = 0;
  let controlLagMs = 0;
  let silenceMs = 0;
  let falseNegativeMs = 0;
  let timestampSkewMs = 0;
  let phantomGlitchMs = 0;
  let warningLagMs = 0;
  let powerMisreportMs = 0;
  let doorIndicatorLagMs = 0;
  const nightPressure = Math.min(1, ctx.elapsedMs / 280000);
  const endgamePressure = nightPressure > 0.5 ? (nightPressure - 0.5) * 2 : 0;

  for (const entity of Object.values(entities)) {
    if (roomObserved(ctx, entity.roomId)) {
      observedRooms.push(entity.roomId);
    }
  }

  const e173 = entities.scp173;
  const observed173 = roomObserved(ctx, e173.roomId);
  if (observed173) {
    encounterFlags.scp173 = true;
    e173.cooldownMs = 0;
  } else {
    e173.cooldownMs += deltaMs;
    const moveInterval = Math.max(2200, (7600 - e173.aggression * 220) * (1 - endgamePressure * 0.18));
    if (e173.cooldownMs >= moveInterval * 0.62 && Math.random() < 0.0018 + endgamePressure * 0.003) {
      falseNegativeMs = Math.max(falseNegativeMs, 360 + endgamePressure * 220);
      phantomGlitchMs = Math.max(phantomGlitchMs, 280);
      instabilityBoost = Math.max(instabilityBoost, 0.46);
      paranoiaBoost = Math.max(paranoiaBoost, 0.18);
      if (Math.random() < 0.38) {
        e173.cooldownMs += moveInterval * 0.26;
      }
      events.push(event("Visual Gap", "Frame parity stuttered around the statue track for less than a second.", "warn", ctx.elapsedMs));
    }
    if (e173.cooldownMs >= moveInterval) {
      e173.pathVariant = e173.pathVariant === "left" ? "right" : "left";
      stepPath(e173, PATHS_173[e173.pathVariant]);
      events.push(event("Motion Alert", `${SCP_LABELS.scp173} advanced into ${ROOM_LABELS[e173.roomId]}.`, "warn", ctx.elapsedMs));
      e173.cooldownMs = 0;
    }
  }
  if (e173.roomId === "leftDoor") {
    if (ctx.doors.left) {
      retreatPath(e173, PATHS_173.left, 2);
      events.push(event("Impact", "Left blast door absorbed a violent concrete strike.", "info", ctx.elapsedMs));
    } else {
      attack = "scp173";
      attackReason = "Direct line-of-sight failure at the left doorway.";
    }
  }
  if (e173.roomId === "rightDoor") {
    if (ctx.doors.right) {
      retreatPath(e173, PATHS_173.right, 2);
      events.push(event("Impact", "Right blast door shook under a containment breach attempt.", "info", ctx.elapsedMs));
    } else {
      attack = "scp173";
      attackReason = "Direct line-of-sight failure at the right doorway.";
    }
  }

  const e096 = entities.scp096;
  const observed096 = ctx.cameraMonitorOpen && CAMERA_NODES.find((camera) => camera.id === ctx.selectedCamera)?.roomId === e096.roomId;
  e096.seenFace = observed096;
  if (observed096) {
    encounterFlags.scp096 = true;
    e096.rage = Math.min(100, e096.rage + deltaMs * 0.012 + e096.aggression * 0.02);
    if (e096.rage > 40 && Math.random() < 0.016) {
      events.push(event("Facial Acquisition", `${SCP_LABELS.scp096} registered on active surveillance.`, "danger", ctx.elapsedMs));
    }
  } else {
    e096.rage = Math.max(0, e096.rage - deltaMs * 0.006);
  }
  if (e096.rage > 18 && Math.random() < 0.0016 + endgamePressure * 0.0026) {
    silenceMs = Math.max(silenceMs, 600 + e096.rage * 6);
    controlLagMs = Math.max(controlLagMs, 70 + e096.rage * 1.2);
    instabilityBoost = Math.max(instabilityBoost, 0.42);
    paranoiaBoost = Math.max(paranoiaBoost, 0.22);
    events.push(event("Respiration Detected", "Open microphone registered breathing without a visible source.", e096.rage > 42 ? "danger" : "warn", ctx.elapsedMs));
  }
  e096.cooldownMs += deltaMs;
  const rageModifier = Math.max(0, 1800 - e096.rage * 12);
  const moveInterval096 = Math.max(800, (6800 - e096.aggression * 180 - rageModifier) * (1 - endgamePressure * 0.16));
  if (e096.cooldownMs >= moveInterval096) {
    const path = e096.rage > 50 ? PATHS_096.left : PATHS_096.right;
    stepPath(e096, path);
    e096.cooldownMs = 0;
    events.push(event("Auditory Disturbance", `${SCP_LABELS.scp096} has shifted into ${ROOM_LABELS[e096.roomId]}.`, e096.rage > 50 ? "danger" : "warn", ctx.elapsedMs));
  }
  if (e096.roomId === "leftDoor") {
    if (!ctx.doors.left || (e096.rage > 72 && !ctx.lockdown.active)) {
      attack = "scp096";
      attackReason = "Visual trigger cascaded into a frontal breach.";
    } else {
      retreatPath(e096, PATHS_096.left, 1);
      e096.rage = Math.max(20, e096.rage - 15);
    }
  }
  if (e096.roomId === "rightDoor") {
    if (!ctx.doors.right || (e096.rage > 72 && !ctx.lockdown.active)) {
      attack = "scp096";
      attackReason = "A rage surge forced the right-side barrier.";
    } else {
      retreatPath(e096, PATHS_096.right, 1);
      e096.rage = Math.max(20, e096.rage - 15);
    }
  }

  const e106 = entities.scp106;
  e106.cooldownMs += deltaMs;
  const phaseInterval = ctx.lockdown.active ? 9600 : Math.max(1800, (7000 - e106.aggression * 200) * (1 - endgamePressure * 0.22));
  if (e106.cooldownMs >= phaseInterval * 0.56 && Math.random() < 0.0024 + endgamePressure * 0.0036) {
    monitorStallMs = Math.max(monitorStallMs, 520 + e106.aggression * 10);
    falseNegativeMs = Math.max(falseNegativeMs, 420);
    phantomGlitchMs = Math.max(phantomGlitchMs, 420 + e106.aggression * 6);
    timestampSkewMs = Math.max(timestampSkewMs, 360);
    instabilityBoost = Math.max(instabilityBoost, 0.6);
    paranoiaBoost = Math.max(paranoiaBoost, 0.3);
    warningLagMs = Math.max(warningLagMs, 820);
    doorIndicatorLagMs = Math.max(doorIndicatorLagMs, 260);
    events.push(event("Signal Rot", "Compression smear spread across adjacent feeds before contact was confirmed.", "warn", ctx.elapsedMs));
  }
  if (ctx.lockdown.active && (e106.roomId === "westHall" || e106.roomId === "eastHall")) {
    e106.roomId = Math.random() > 0.5 ? "boiler" : "generator";
    e106.cooldownMs = 0;
    events.push(event("Lockdown Hold", `${SCP_LABELS.scp106} recoiled from emergency lockdown geometry.`, "info", ctx.elapsedMs));
  } else if (e106.cooldownMs >= phaseInterval) {
    const targetIndex = Math.floor(Math.random() * PHASE_ROOMS_106.length);
    e106.roomId = PHASE_ROOMS_106[targetIndex];
    e106.cooldownMs = 0;
    encounterFlags.scp106 = true;
    events.push(event("Corrosion Trace", `${SCP_LABELS.scp106} surfaced in ${ROOM_LABELS[e106.roomId]}.`, e106.roomId.includes("Hall") ? "danger" : "warn", ctx.elapsedMs));
    monitorStallMs = Math.max(monitorStallMs, 460);
    phantomGlitchMs = Math.max(phantomGlitchMs, 380);
    warningLagMs = Math.max(warningLagMs, 540);
    if (Math.random() < 0.5) {
      forceCloseMonitor = true;
    }
  }
  if ((e106.roomId === "westHall" || e106.roomId === "eastHall") && !ctx.lockdown.active) {
    e106.breachCountdownMs += deltaMs;
    if (e106.breachCountdownMs > Math.max(1800, 4200 - e106.aggression * 110)) {
      attack = "scp106";
      attackReason = "Corrosion breached the room geometry before lockdown engaged.";
    }
  } else {
    e106.breachCountdownMs = 0;
  }

  const e457 = entities.scp457;
  const activationThreshold = Math.max(18, 40 - e457.aggression);
  e457.manifesting = ctx.power <= activationThreshold || ctx.emergencyMode;
  if (e457.manifesting) {
    encounterFlags.scp457 = true;
    e457.heat = Math.min(100, e457.heat + deltaMs * 0.012 + e457.aggression * 0.02);
    e457.cooldownMs += deltaMs;
    const moveInterval457 = Math.max(850, (6200 - e457.aggression * 190 - e457.heat * 10) * (1 - endgamePressure * 0.2));
    if (Math.random() < 0.002 + endgamePressure * 0.0032) {
      silenceMs = Math.max(silenceMs, 360);
      controlLagMs = Math.max(controlLagMs, 120 + e457.heat * 0.8);
      instabilityBoost = Math.max(instabilityBoost, 0.54);
      paranoiaBoost = Math.max(paranoiaBoost, 0.24);
      powerMisreportMs = Math.max(powerMisreportMs, 700);
      events.push(event("Voltage Sag", "The room darkened unevenly, then corrected before instrumentation agreed.", e457.heat > 55 ? "danger" : "warn", ctx.elapsedMs));
    }
    if (e457.cooldownMs >= moveInterval457) {
      const path = e457.heat > 45 ? PATHS_457.right : PATHS_457.left;
      stepPath(e457, path);
      e457.cooldownMs = 0;
      events.push(event("Thermal Bloom", `${SCP_LABELS.scp457} ignited near ${ROOM_LABELS[e457.roomId]}.`, e457.heat > 60 ? "danger" : "warn", ctx.elapsedMs));
    }
  } else {
    e457.roomId = ENTITY_START_ROOMS.scp457;
    e457.heat = Math.max(0, e457.heat - deltaMs * 0.008);
    e457.cooldownMs = 0;
  }
  if (e457.roomId === "leftDoor") {
    if (!ctx.doors.left || (ctx.emergencyMode && e457.heat > 70)) {
      attack = "scp457";
      attackReason = "The left threshold flashed into open flame.";
    } else {
      retreatPath(e457, PATHS_457.left, 1);
    }
  }
  if (e457.roomId === "rightDoor") {
    if (!ctx.doors.right || (ctx.emergencyMode && e457.heat > 70)) {
      attack = "scp457";
      attackReason = "The right threshold became a furnace in emergency darkness.";
    } else {
      retreatPath(e457, PATHS_457.right, 1);
    }
  }

  if (randomEventTimerMs <= 0) {
    const random = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
    events.push(event(random.title, random.body, random.tone, ctx.elapsedMs));
    if (Math.random() < 0.18 + endgamePressure * 0.22) {
      silenceMs = Math.max(silenceMs, 520);
      instabilityBoost = Math.max(instabilityBoost, 0.32);
      paranoiaBoost = Math.max(paranoiaBoost, 0.12);
      events.push(event("Dead Air", "For a moment every channel dropped into perfect silence.", "warn", ctx.elapsedMs));
    }
    randomEventTimerMs = (9000 + Math.random() * 22000) * (1 - endgamePressure * 0.22);
  }

  return {
    entities,
    events,
    observedRooms,
    attack,
    attackReason,
    forceCloseMonitor,
    randomEventTimerMs,
    encounterFlags,
    instabilityBoost,
    paranoiaBoost,
    monitorStallMs,
    controlLagMs,
    silenceMs,
    falseNegativeMs,
    timestampSkewMs,
    phantomGlitchMs,
    warningLagMs,
    powerMisreportMs,
    doorIndicatorLagMs,
  };
}
