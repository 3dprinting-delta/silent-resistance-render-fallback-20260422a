"use client";

import { useEffect, useRef } from "react";
import { useCampaignStore } from "@/game/core/campaignStore";
import { usePhaseOneStore } from "@/game/core/phaseOneStore";
import { buildStoryContinuityStack } from "@/game/data/missionStoryFabric";

export default function MissionStoryController() {
  const selectedOperation = useCampaignStore((state) => state.getSelectedOperation());
  const world = useCampaignStore((state) => state.world);
  const progress = useCampaignStore((state) => state.progress);
  const pushLog = usePhaseOneStore((state) => state.pushLog);
  const pushStealthEvent = usePhaseOneStore((state) => state.pushStealthEvent);
  const currentZoneId = usePhaseOneStore((state) => state.currentZoneId);
  const targetWindowState = usePhaseOneStore((state) => state.targetWindowState);
  const globalAlertLevel = usePhaseOneStore((state) => state.globalAlertLevel);
  const mission = usePhaseOneStore((state) => state.mission);
  const activeIncidents = usePhaseOneStore((state) => state.activeIncidents.length);

  const bootedOperationRef = useRef<string | null>(null);
  const clueIndexRef = useRef(0);
  const barkIndexRef = useRef(0);
  const turningPointRef = useRef<string | null>(null);
  const previousZoneRef = useRef<string | null>(null);
  const lastClueAtRef = useRef(0);
  const lastBarkAtRef = useRef(0);
  const lastAftermathEchoRef = useRef<string | null>(null);
  const continuity = buildStoryContinuityStack({ operation: selectedOperation, storyState: world?.storyState, progress });

  useEffect(() => {
    if (!selectedOperation || bootedOperationRef.current === selectedOperation.id) return;
    bootedOperationRef.current = selectedOperation.id;
    clueIndexRef.current = 0;
    barkIndexRef.current = 0;
    turningPointRef.current = null;
    previousZoneRef.current = null;
    lastClueAtRef.current = 0;
    lastBarkAtRef.current = 0;
    lastAftermathEchoRef.current = null;
    pushLog(`Story setup: ${selectedOperation.story.codename}. ${selectedOperation.story.delivery.briefingHook}`);
    pushStealthEvent(selectedOperation.story.delivery.preMissionIntel, "info", `${selectedOperation.id}-story-setup`);
    if (continuity.primaryCallback) {
      pushLog(`Continuity: ${continuity.primaryCallback.codename}. ${continuity.primaryCallback.impactSummary}`);
    }
  }, [continuity.primaryCallback, pushLog, pushStealthEvent, selectedOperation]);

  useEffect(() => {
    if (!selectedOperation) return;
    if (previousZoneRef.current === currentZoneId) return;
    const now = Date.now();
    const clueCooldown = selectedOperation.story.delivery.clueCadence === "dense" ? 2500 : selectedOperation.story.delivery.clueCadence === "steady" ? 4200 : 6500;
    if (now - lastClueAtRef.current < clueCooldown) return;
    previousZoneRef.current = currentZoneId;
    lastClueAtRef.current = now;

    const clue = selectedOperation.story.delivery.environmentalClues[clueIndexRef.current % selectedOperation.story.delivery.environmentalClues.length];
    clueIndexRef.current += 1;
    pushLog(`Field clue: ${clue}`);
    if (continuity.sameSector && clueIndexRef.current % 2 === 0) {
      pushStealthEvent(`Sector callback: ${continuity.sameSector.impactSummary}`, "info", `${selectedOperation.id}-callback-clue-${clueIndexRef.current}`);
    }
  }, [continuity.sameSector, currentZoneId, pushLog, pushStealthEvent, selectedOperation]);

  useEffect(() => {
    if (!selectedOperation) return;
    const now = Date.now();
    const barkCooldown = selectedOperation.story.delivery.clueCadence === "dense" ? 3200 : 5200;

    const barkPool = selectedOperation.story.delivery.overheardBarks;
    if (activeIncidents > 0 && barkPool.length && now - lastBarkAtRef.current >= barkCooldown) {
      lastBarkAtRef.current = now;
      const bark = barkPool[barkIndexRef.current % barkPool.length];
      barkIndexRef.current += 1;
      pushStealthEvent(bark, activeIncidents > 1 ? "warning" : "info", `${selectedOperation.id}-bark-${barkIndexRef.current}`);
    }
  }, [activeIncidents, pushStealthEvent, selectedOperation]);

  useEffect(() => {
    if (!selectedOperation || turningPointRef.current) return;
    const turningPoints = selectedOperation.story.turningPoints;
    if (targetWindowState === "vulnerable") {
      turningPointRef.current = "target_window";
      pushLog(`Turning point: ${turningPoints[1]?.summary || selectedOperation.story.pacing.turningPoint}`);
      pushStealthEvent(
        `${turningPoints[1]?.bark || selectedOperation.story.delivery.revealLine} ${selectedOperation.story.delivery.callbackHooks[0]}`,
        "warning",
        `${selectedOperation.id}-turning-point-window`,
      );
      return;
    }
    if (globalAlertLevel >= 2 || mission.secondaryObjectiveComplete) {
      turningPointRef.current = "pressure";
      pushLog(`Complication: ${turningPoints[2]?.summary || selectedOperation.story.pacing.complication}`);
      pushStealthEvent(
        `${turningPoints[2]?.bark || selectedOperation.story.delivery.revealLine} ${selectedOperation.story.delivery.callbackHooks[1]}`,
        globalAlertLevel >= 2 ? "critical" : "warning",
        `${selectedOperation.id}-turning-point-pressure`,
      );
    }
  }, [globalAlertLevel, mission.secondaryObjectiveComplete, pushLog, pushStealthEvent, selectedOperation, targetWindowState]);

  useEffect(() => {
    if (!selectedOperation || !mission.targetEliminated) return;
    pushStealthEvent(selectedOperation.story.delivery.revealLine, "critical", `${selectedOperation.id}-story-reveal`);
  }, [mission.targetEliminated, pushStealthEvent, selectedOperation]);

  useEffect(() => {
    if (!selectedOperation || !mission.targetEliminated || mission.missionComplete) return;
    if (lastAftermathEchoRef.current === selectedOperation.id) return;
    lastAftermathEchoRef.current = selectedOperation.id;
    pushLog(`Aftermath echo: ${selectedOperation.story.delivery.aftermathTemplate}`);
    if (continuity.primaryCallback) {
      pushStealthEvent(
        `Archive echo: ${continuity.primaryCallback.codename}. ${continuity.primaryCallback.unresolvedRisk}`,
        "warning",
        `${selectedOperation.id}-aftermath-echo`,
      );
    }
  }, [continuity.primaryCallback, mission.missionComplete, mission.targetEliminated, pushLog, pushStealthEvent, selectedOperation]);

  return null;
}
