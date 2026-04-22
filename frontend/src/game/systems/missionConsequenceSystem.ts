import type { AiActorRuntime, IncidentRecord, MissionPressureState, MissionProgressState, ResponsePressureProfile, Vec3 } from "@/game/core/types";
import { foundationMissionLogic } from "@/game/data/foundationShell";
import { distance2D } from "@/game/utils/math";

function incidentMatchesProfile(incident: IncidentRecord, profile: ResponsePressureProfile) {
  if (incident.zoneClusterId !== profile.zoneClusterId) return false;
  if (!profile.categories.includes(incident.category)) return false;
  if (profile.confirmedOnly && !incident.confirmed) return false;
  if (incident.confirmed) return true;
  return incident.severity >= profile.minimumSeverity;
}

export function deriveMissionPressure(params: {
  incidents: IncidentRecord[];
  globalAlertLevel: number;
  mission: MissionProgressState;
}): MissionPressureState {
  const annexPressure = params.incidents.some((incident) =>
    incidentMatchesProfile(incident, foundationMissionLogic.pressureProfiles[0] as ResponsePressureProfile),
  );
  const ballroomPressure = params.incidents.some((incident) =>
    incidentMatchesProfile(incident, foundationMissionLogic.pressureProfiles[1] as ResponsePressureProfile) ||
    incidentMatchesProfile(incident, foundationMissionLogic.pressureProfiles[2] as ResponsePressureProfile),
  );
  const securityPressure = params.incidents.some((incident) =>
    incidentMatchesProfile(incident, foundationMissionLogic.pressureProfiles[3] as ResponsePressureProfile),
  );

  return {
    annexPressure,
    ballroomPressure,
    securityPressure,
    targetProtection:
      params.globalAlertLevel >= 2.7 || params.mission.activeDetour === "vip_fallback"
        ? "fallback"
        : params.globalAlertLevel >= 1.8 || annexPressure || ballroomPressure || securityPressure
          ? "tightened"
          : "routine",
    extractionRisk:
      params.globalAlertLevel >= 3 || params.mission.evidenceLeftBehind >= 5
        ? "severe"
        : params.globalAlertLevel >= 1.8 || params.mission.evidenceLeftBehind >= 2
          ? "elevated"
          : "low",
    activeLeadIncidentId: params.incidents[0]?.id || null,
  };
}

export function getNewBodyIncidentIds(incidents: IncidentRecord[], seenIds: string[]) {
  return incidents.filter((incident) => incident.category === "body" && !seenIds.includes(incident.id)).map((incident) => incident.id);
}

export function getAlarmIncidentKey(incidents: IncidentRecord[], globalAlertLevel: number) {
  const leadAlarmIncident = incidents.find(
    (incident) => incident.confirmed && (incident.category === "body" || incident.category === "trespass" || incident.category === "sabotage"),
  );
  if (!leadAlarmIncident || globalAlertLevel < 2) return null;
  return `${leadAlarmIncident.id}-${Math.floor(globalAlertLevel)}`;
}

export function resolveWorldStateShift(params: {
  now: number;
  mission: MissionProgressState;
  missionPressure: MissionPressureState;
  globalAlertLevel: number;
  lastWorldStateShiftAt: number;
}) {
  if (params.mission.targetEliminated || params.now - params.lastWorldStateShiftAt <= 5500) {
    return null;
  }

  if (params.globalAlertLevel >= 2.7 && params.mission.activeDetour !== "vip_fallback") {
    return {
      detour: "vip_fallback" as const,
      escort: "security" as const,
      eventText: "Security pressure forces the target into a guarded VIP fallback route.",
      logText: "Security response intensifies. The target abandons the public cycle for the VIP fallback route.",
      severity: "critical" as const,
      eventKey: "world-vip-fallback",
    };
  }

  if (params.missionPressure.annexPressure && params.mission.unlockedRoutes.annex && params.mission.activeDetour === "none") {
    return {
      detour: "annex_inspection" as const,
      escort: params.mission.escortSplit === "none" ? ("annex" as const) : params.mission.escortSplit,
      eventText: "Annex pressure is pulling the target detail toward a private inspection detour.",
      logText: null,
      severity: "warning" as const,
      eventKey: "world-annex-detour",
    };
  }

  if (params.missionPressure.ballroomPressure && params.mission.activeDetour === "none") {
    return {
      detour: "ballroom_recovery" as const,
      escort: params.mission.escortSplit === "none" ? ("service" as const) : params.mission.escortSplit,
      eventText: "Hotel disruptions are forcing a ballroom recovery detour through thinner service circulation.",
      logText: null,
      severity: "warning" as const,
      eventKey: "world-ballroom-detour",
    };
  }

  if (params.globalAlertLevel < 1.05 && params.mission.activeDetour === "vip_fallback") {
    return {
      detour: "none" as const,
      escort: "none" as const,
      eventText: "The VIP panic cycle is cooling off. The target is resuming the summit schedule.",
      logText: null,
      severity: "info" as const,
      eventKey: "world-detour-clear",
    };
  }

  return null;
}

export function shouldHintAlternateLedgerRoute(params: {
  now: number;
  lastSecurityHintAt: number;
  mission: MissionProgressState;
  missionPressure: MissionPressureState;
}) {
  return !params.mission.secondaryObjectiveComplete &&
    params.mission.unlockedRoutes.annex &&
    params.missionPressure.securityPressure &&
    params.now - params.lastSecurityHintAt > 7000;
}

export function resolveTargetEliminationFromWorld(params: {
  mission: MissionProgressState;
  actors: AiActorRuntime[];
  currentZoneId: string;
}) {
  const target = params.actors.find((actor) => actor.id === "target-voss");
  if (!target || params.mission.targetEliminated) return null;

  const poisonStation =
    params.mission.activeDetour === "annex_inspection"
      ? ([62, 1, -34] as Vec3)
      : ([28, 6, -46] as Vec3);
  if (params.mission.poisonPrepared && distance2D(target.position, poisonStation) < 4.8) {
    return {
      solution: "poison" as const,
      evidence: params.mission.activeDetour === "annex_inspection" ? 1 : 0,
      nonTargetCasualties: 0,
      logText: params.mission.activeDetour === "annex_inspection" ? "The private annex tasting turns fatal." : "The rooftop toast turns fatal. The poisoned reserve completes the kill.",
      eventText:
        params.mission.activeDetour === "annex_inspection"
          ? foundationMissionLogic.eliminationProfiles.poison.annexText
          : foundationMissionLogic.eliminationProfiles.poison.defaultText,
      eventKey: "poison-kill",
    };
  }

  const accidentPocket = params.mission.activeDetour === "annex_inspection" ? ([62, 1, -37] as Vec3) : ([0, 1, -1] as Vec3);
  if (params.mission.accidentArmed && distance2D(target.position, accidentPocket) < 5.1) {
    return {
      solution: "environmental" as const,
      evidence: 0,
      nonTargetCasualties: 1,
      logText:
        params.mission.activeDetour === "annex_inspection"
          ? "The annex tasting overlook fails and sends the target over the rail."
          : "The ballroom chandelier crashes onto the gala dais.",
      eventText:
        params.mission.activeDetour === "annex_inspection"
          ? foundationMissionLogic.eliminationProfiles.environmental.annexText
          : foundationMissionLogic.eliminationProfiles.environmental.defaultText,
      eventKey: "accident-kill",
    };
  }

  return null;
}
