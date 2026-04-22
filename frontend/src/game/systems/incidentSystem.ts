import type {
  AccessState,
  MissionConsequence,
  MissionProgressState,
  PlayerPosture,
  StealthState,
  StimulusEvent,
  Vec3,
} from "@/game/core/types";
import { foundationMissionLogic, foundationShell } from "@/game/data/foundationShell";
import { distance2D } from "@/game/utils/math";

function buildStimulusFromConsequence(consequence: MissionConsequence, position: Vec3, now: number): StimulusEvent {
  return {
    id: `${consequence.id}-${now}`,
    type:
      consequence.category === "sabotage"
        ? "sabotage"
        : consequence.category === "trespass"
          ? "trespass"
          : consequence.category === "body"
            ? "body_found"
            : "report",
    category: consequence.category,
    confirmed: consequence.confirmed,
    position,
    radius: consequence.radius,
    severity: consequence.severity,
    createdAt: now,
    expiresAt: now + consequence.ttlMs,
    zoneId: consequence.zoneId,
    zoneClusterId: consequence.zoneClusterId,
  };
}

export function getInteractionConsequences(interactableId: string) {
  const consequence = foundationMissionLogic.interactionConsequences[
    interactableId as keyof typeof foundationMissionLogic.interactionConsequences
  ];
  return consequence ? [consequence] : [];
}

export function emitInteractionStimuli(params: {
  interactableId: string;
  fallbackPosition: Vec3;
  fallbackZoneId: string;
  now: number;
}) {
  const consequences = getInteractionConsequences(params.interactableId);
  return consequences.map((consequence) =>
    buildStimulusFromConsequence(
      consequence,
      foundationShell.interactables.find((item) => item.id === params.interactableId)?.position || params.fallbackPosition,
      params.now,
    ),
  );
}

export function emitMovementSoundStimulus(params: {
  now: number;
  playerPosition: Vec3;
  currentZoneId: string;
  currentSpeed: number;
  lastSoundAt: number;
}) {
  if (params.currentSpeed <= 5.8 || params.now - params.lastSoundAt <= 950) {
    return { stimulus: null, lastSoundAt: params.lastSoundAt };
  }

  return {
    lastSoundAt: params.now,
    stimulus: {
      id: `sound-${params.now}`,
      type: "sound" as const,
      position: params.playerPosition,
      radius: params.currentSpeed > 7 ? 13 : 9,
      severity: params.currentSpeed > 7 ? 2.4 : 1.5,
      createdAt: params.now,
      expiresAt: params.now + 2600,
      zoneId: params.currentZoneId,
    },
  };
}

export function emitSuspicionStimulus(params: {
  now: number;
  playerPosition: Vec3;
  currentZoneId: string;
  nextStealthState: StealthState;
  accessState: AccessState;
  zoneFit: "native" | "acceptable" | "mismatched";
  activeWatcherIds: string[];
  lastSuspicionIncidentAt: number;
}) {
  if (
    params.activeWatcherIds.length === 0 ||
    params.nextStealthState === "clear" ||
    params.now - params.lastSuspicionIncidentAt <= (params.nextStealthState === "compromised" ? 1200 : 2200)
  ) {
    return { stimulus: null, lastSuspicionIncidentAt: params.lastSuspicionIncidentAt };
  }

  const trespassState = params.accessState === "hard_restricted" || params.accessState === "enforcer_compromised";
  return {
    lastSuspicionIncidentAt: params.now,
    stimulus: {
      id: `suspicion-${params.now}`,
      type: trespassState ? ("trespass" as const) : ("sighting" as const),
      category: trespassState ? ("trespass" as const) : ("crime" as const),
      confirmed: params.nextStealthState === "compromised" || params.accessState === "enforcer_compromised",
      position: params.playerPosition,
      radius: params.nextStealthState === "compromised" ? 12 : 8,
      severity:
        params.nextStealthState === "compromised"
          ? 3.5
          : params.nextStealthState === "investigating"
            ? 2.7
            : params.zoneFit === "mismatched"
              ? 2.1
              : 1.5,
      createdAt: params.now,
      expiresAt: params.now + (params.nextStealthState === "compromised" ? 8000 : 5200),
      zoneId: params.currentZoneId,
    },
  };
}

export function emitBehaviorStimulus(params: {
  now: number;
  playerPosition: Vec3;
  currentZoneId: string;
  lastBehaviorIncidentAt: number;
  activeWatcherIds: string[];
  posture: PlayerPosture;
  behavior: "idle" | "walk" | "run";
  zoneFit: "native" | "acceptable" | "mismatched";
  lingerExceeded: boolean;
  securityPressureZone: boolean;
  publicNoCrouch: boolean;
}) {
  const shouldEmit =
    (params.posture === "dragging" && params.activeWatcherIds.length > 0) ||
    (params.behavior === "run" && params.securityPressureZone) ||
    (params.posture === "crouch" && params.publicNoCrouch) ||
    (params.zoneFit === "mismatched" && params.lingerExceeded);

  if (!shouldEmit || params.now - params.lastBehaviorIncidentAt <= 2200) {
    return { stimulus: null, lastBehaviorIncidentAt: params.lastBehaviorIncidentAt };
  }

  return {
    lastBehaviorIncidentAt: params.now,
    stimulus: {
      id: `behavior-${params.now}`,
      type: "sighting" as const,
      category: "crime" as const,
      confirmed: params.posture === "dragging" || (params.behavior === "run" && params.securityPressureZone),
      position: params.playerPosition,
      radius: params.securityPressureZone ? 9 : 7,
      severity:
        params.posture === "dragging"
          ? 3.3
          : params.behavior === "run" && params.securityPressureZone
            ? 2.4
            : params.zoneFit === "mismatched"
              ? 1.7
              : 1.3,
      createdAt: params.now,
      expiresAt: params.now + 4500,
      zoneId: params.currentZoneId,
    },
  };
}

export function emitMissionDeltaStimuli(params: {
  now: number;
  mission: MissionProgressState;
  previousMission: MissionProgressState;
  playerPosition: Vec3;
  currentZoneId: string;
}) {
  const stimuli: StimulusEvent[] = [];
  const pushInteractionStimuli = (interactableId: string) => {
    stimuli.push(...emitInteractionStimuli({
      interactableId,
      fallbackPosition: params.playerPosition,
      fallbackZoneId: params.currentZoneId,
      now: params.now,
    }));
  };

  if (!params.previousMission.poisonPrepared && params.mission.poisonPrepared) {
    pushInteractionStimuli(params.mission.activeDetour === "annex_inspection" ? "annex-reserve" : "vip-reserve");
  }
  if (!params.previousMission.accidentArmed && params.mission.accidentArmed) {
    pushInteractionStimuli("chandelier-winch");
  }
  if (!params.previousMission.secondaryObjectiveComplete && params.mission.secondaryObjectiveComplete) {
    pushInteractionStimuli(params.mission.secondaryObjectiveSource === "annex_transfer" ? "annex-audit-case" : "security-ledger");
  }
  if (params.previousMission.escortSplit !== params.mission.escortSplit && params.mission.escortSplit !== "none") {
    pushInteractionStimuli(
      params.mission.escortSplit === "annex"
        ? "reserve-transfer-crate"
        : params.mission.escortSplit === "service"
          ? "catering-pass-stand"
          : "annex-av-booth",
    );
  }
  if (params.previousMission.activeDetour !== params.mission.activeDetour && params.mission.activeDetour !== "none") {
    pushInteractionStimuli(
      params.mission.activeDetour === "annex_inspection"
        ? "annex-breaker-panel"
        : params.mission.activeDetour === "ballroom_recovery"
          ? "chandelier-winch"
          : "annex-av-booth",
    );
  }

  return stimuli;
}

export function emitBodyDiscoveryStimulus(params: {
  now: number;
  aiActors: Array<{ state: string; perception: { bodyDetectionRange: number }; position: Vec3 }>;
  carriedBodyId: string | null;
  lastBodyEventAt: number;
}) {
  const trainingBody = foundationShell.interactables.find((item) => item.id === "training-body");
  if (!trainingBody || params.carriedBodyId || params.now - params.lastBodyEventAt <= 4500) {
    return { stimulus: null, lastBodyEventAt: params.lastBodyEventAt };
  }

  const witnessNearby = params.aiActors.some(
    (actor) => actor.state !== "down" && distance2D(actor.position, trainingBody.position) < actor.perception.bodyDetectionRange,
  );
  if (!witnessNearby) {
    return { stimulus: null, lastBodyEventAt: params.lastBodyEventAt };
  }

  return {
    lastBodyEventAt: params.now,
    stimulus: {
      id: `body-${params.now}`,
      type: "body_found" as const,
      position: trainingBody.position,
      radius: 10,
      severity: 3.2,
      createdAt: params.now,
      expiresAt: params.now + 12000,
      zoneId: trainingBody.zoneId,
      sourceId: trainingBody.id,
    },
  };
}

export function consequenceTextForSource(interactableId: string) {
  const consequence = getInteractionConsequences(interactableId)[0];
  return consequence?.text || null;
}
