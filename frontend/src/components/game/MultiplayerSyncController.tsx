"use client";

import { useEffect, useRef } from "react";
import { useCampaignStore } from "@/game/core/campaignStore";
import { useMultiplayerStore } from "@/game/core/multiplayerStore";
import { usePhaseOneStore } from "@/game/core/phaseOneStore";
import type { IncidentRecord } from "@/game/core/types";

function mapSharedIncidents(remoteIncidents: NonNullable<ReturnType<typeof useMultiplayerStore.getState>["missionState"]>["activeIncidents"]): IncidentRecord[] {
  const now = Date.now();
  return remoteIncidents.map((incident) => ({
    id: incident.id,
    type: incident.category === "body" ? "body_found" : incident.category === "sabotage" ? "sabotage" : incident.category === "trespass" ? "trespass" : "report",
    category: incident.category,
    zoneId: "worker-square",
    zoneClusterId: incident.zoneClusterId,
    position: [0, 1, 0],
    severity: incident.severity,
    confirmed: true,
    createdAt: incident.createdAt,
    updatedAt: now,
    expiresAt: now + 6000,
    ownerActorId: incident.ownerPlayerId || null,
  }));
}

export default function MultiplayerSyncController() {
  const sessionId = useMultiplayerStore((state) => state.sessionId);
  const operationId = useMultiplayerStore((state) => state.operationId);
  const missionState = useMultiplayerStore((state) => state.missionState);
  const localPlayerId = useMultiplayerStore((state) => state.localPlayerId);
  const players = useMultiplayerStore((state) => state.players);
  const sendPlayerState = useMultiplayerStore((state) => state.sendPlayerState);
  const syncMissionState = useMultiplayerStore((state) => state.syncMissionState);
  const setSelectedOperationId = useCampaignStore((state) => state.setSelectedOperationId);

  const playerPosition = usePhaseOneStore((state) => state.playerPosition);
  const playerVelocity = usePhaseOneStore((state) => state.playerVelocity);
  const playerFacing = usePhaseOneStore((state) => state.playerFacing);
  const posture = usePhaseOneStore((state) => state.posture);
  const activeDisguiseId = usePhaseOneStore((state) => state.activeDisguiseId);
  const accessState = usePhaseOneStore((state) => state.accessState);
  const stealthState = usePhaseOneStore((state) => state.stealthState);
  const suspicion = usePhaseOneStore((state) => state.suspicion);
  const currentZoneId = usePhaseOneStore((state) => state.currentZoneId);
  const carriedBodyId = usePhaseOneStore((state) => state.carriedBodyId);
  const globalAlertLevel = usePhaseOneStore((state) => state.globalAlertLevel);
  const targetWindowState = usePhaseOneStore((state) => state.targetWindowState);
  const missionPressure = usePhaseOneStore((state) => state.missionPressure);
  const activeIncidents = usePhaseOneStore((state) => state.activeIncidents);
  const mission = usePhaseOneStore((state) => state.mission);
  const authorityRevisionRef = useRef(0);

  useEffect(() => {
    if (operationId) {
      setSelectedOperationId(operationId);
    }
  }, [operationId, setSelectedOperationId]);

  useEffect(() => {
    if (!sessionId) return;
    const interval = window.setInterval(() => {
      sendPlayerState({
        position: playerPosition,
        velocity: playerVelocity,
        facing: playerFacing,
        posture,
        disguiseId: activeDisguiseId,
        accessState,
        stealthState,
        suspicion,
        currentZoneId,
        carriedBodyId,
      });
    }, 120);
    return () => window.clearInterval(interval);
  }, [accessState, activeDisguiseId, carriedBodyId, currentZoneId, playerFacing, playerPosition, playerVelocity, posture, sendPlayerState, sessionId, stealthState, suspicion]);

  useEffect(() => {
    if (!sessionId) return;
    const interval = window.setInterval(() => {
      syncMissionState({
        operationId,
        observedTargetWindow: targetWindowState,
        candidateIncidents: activeIncidents.slice(0, 4).map((incident) => ({
          id: incident.id,
          category: incident.category,
          zoneClusterId: incident.zoneClusterId,
          severity: incident.severity,
          ownerPlayerId: localPlayerId,
          createdAt: incident.createdAt,
        })),
        teamObjectives: {
          primaryComplete: mission.targetEliminated,
          secondaryComplete: mission.secondaryObjectiveComplete,
          targetEliminated: mission.targetEliminated,
          extractionReady: mission.extractionReady,
          missionComplete: mission.missionComplete,
          sabotageFlags: usePhaseOneStore.getState().sabotageFlags,
          extractedPlayerIds: mission.missionComplete && localPlayerId ? [localPlayerId] : [],
          compromisedPlayerIds: [],
          assistCount: mission.secondaryObjectiveComplete ? 1 : 0,
          sharedFailure: mission.nonTargetCasualties > 1 || mission.alarmsTriggered > 2,
        },
        pings: missionState?.pings || [],
      });
    }, 280);
    return () => window.clearInterval(interval);
  }, [activeIncidents, localPlayerId, mission, missionState?.pings, operationId, sessionId, syncMissionState, targetWindowState]);

  useEffect(() => {
    if (!missionState) return;
    const nextRevision = missionState.authorityRevision || 0;
    if (nextRevision < authorityRevisionRef.current) return;
    authorityRevisionRef.current = nextRevision;
    const localPlayer = localPlayerId ? players.find((player) => player.playerId === localPlayerId) : null;
    usePhaseOneStore.setState((state) => ({
      playerPosition:
        localPlayer &&
        Math.hypot(localPlayer.position[0] - state.playerPosition[0], localPlayer.position[1] - state.playerPosition[1], localPlayer.position[2] - state.playerPosition[2]) > 2.5
          ? localPlayer.position
          : state.playerPosition,
      playerVelocity: localPlayer ? localPlayer.velocity : state.playerVelocity,
      playerFacing: localPlayer && Math.abs(localPlayer.facing - state.playerFacing) > 0.6 ? localPlayer.facing : state.playerFacing,
      globalAlertLevel: missionState.globalAlertLevel,
      targetWindowState: missionState.targetWindowState,
      missionPressure: missionState.missionPressure,
      activeIncidents: mapSharedIncidents(missionState.activeIncidents || []),
      mission: {
        ...state.mission,
        secondaryObjectiveComplete: missionState.teamObjectives.secondaryComplete,
        targetEliminated: missionState.teamObjectives.targetEliminated,
        extractionReady: missionState.teamObjectives.extractionReady,
        missionComplete: missionState.teamObjectives.missionComplete,
      },
    }));
  }, [localPlayerId, missionState, players]);

  useEffect(() => {
    if (!sessionId || !localPlayerId) return;
    const localPlayer = players.find((player) => player.playerId === localPlayerId);
    if (!localPlayer) return;
    useMultiplayerStore.setState({ teamSummary: `${players.filter((player) => player.connected).length} agents active / ${players.filter((player) => player.ready).length} ready` });
  }, [localPlayerId, players, sessionId]);

  return null;
}
