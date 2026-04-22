"use client";

import { useEffect, useRef } from "react";
import { useCampaignStore } from "@/game/core/campaignStore";
import { useMultiplayerStore } from "@/game/core/multiplayerStore";
import { usePhaseOneStore } from "@/game/core/phaseOneStore";
import { buildStoryContinuityStack } from "@/game/data/missionStoryFabric";
import { createDetectedMoment } from "@/game/systems/viralLoop";

export default function MomentSpikeController() {
  const selectedOperation = useCampaignStore((state) => state.getSelectedOperation());
  const world = useCampaignStore((state) => state.world);
  const progress = useCampaignStore((state) => state.progress);
  const suspicion = usePhaseOneStore((state) => state.suspicion);
  const globalAlertLevel = usePhaseOneStore((state) => state.globalAlertLevel);
  const activeIncidents = usePhaseOneStore((state) => state.activeIncidents);
  const targetWindowState = usePhaseOneStore((state) => state.targetWindowState);
  const mission = usePhaseOneStore((state) => state.mission);
  const missionPressure = usePhaseOneStore((state) => state.missionPressure);
  const sabotageFlags = usePhaseOneStore((state) => state.sabotageFlags);
  const pushStealthEvent = usePhaseOneStore((state) => state.pushStealthEvent);
  const pushLog = usePhaseOneStore((state) => state.pushLog);
  const noteMoment = usePhaseOneStore((state) => state.noteMoment);
  const players = useMultiplayerStore((state) => state.players);

  const nearFailAtRef = useRef<number | null>(null);
  const chaosSpikeRef = useRef<string | null>(null);
  const perfectChainRef = useRef(false);
  const rareWindowRef = useRef(false);
  const coopSaveRef = useRef(false);
  const highRiskSuccessRef = useRef(false);
  const creativeObjectiveRef = useRef(false);
  const chainReactionRef = useRef(false);
  const ghostSequenceRef = useRef(false);
  const lastSecondExtractionRef = useRef(false);
  const storyChaosRef = useRef(false);
  const continuity = buildStoryContinuityStack({ operation: selectedOperation, storyState: world?.storyState, progress });

  const buildMoment = (
    params: Omit<Parameters<typeof createDetectedMoment>[0], "mission" | "operation" | "sequenceIndex">,
  ) =>
    createDetectedMoment({
      ...params,
      mission,
      operation: selectedOperation,
      sequenceIndex: mission.notableMoments.length + 1,
    });

  useEffect(() => {
    if ((suspicion >= 74 || globalAlertLevel >= 1.8) && !mission.missionComplete) {
      nearFailAtRef.current = Date.now();
    }

    if (
      nearFailAtRef.current &&
      Date.now() - nearFailAtRef.current < 14_000 &&
      suspicion <= 28 &&
      globalAlertLevel < 1.4 &&
      !mission.missionComplete
    ) {
      const id = `clutch-recovery-${Math.floor(nearFailAtRef.current / 1000)}`;
      noteMoment(
        buildMoment({
          id,
          type: "clutch_recovery",
          label: "Clutch recovery",
          headline: `${selectedOperation?.story.codename || "Operation"} snapped back from the edge`,
          summary: "A near-compromise collapsed back into controlled stealth before the district fully hardened.",
          severity: "warning",
          tensionLevel: 88,
          rarityScore: 76,
          shareabilityScore: 84,
          tags: ["recovery", "stealth", continuity.primaryCallback?.callbackTag || "district-pressure"],
        }),
      );
      pushStealthEvent("Clutch recovery. The district almost saw the whole operation before control snapped back into your hands.", "warning", id);
      nearFailAtRef.current = null;
    }
  }, [buildMoment, continuity.primaryCallback?.callbackTag, globalAlertLevel, mission.missionComplete, noteMoment, pushStealthEvent, selectedOperation?.story.codename, suspicion]);

  useEffect(() => {
    const activeChaos = activeIncidents.length >= 3 && (targetWindowState === "vulnerable" || missionPressure.extractionRisk === "severe");
    if (!activeChaos) return;
    const id = `chaos-spike-${activeIncidents[0]?.id || activeIncidents.length}`;
    if (chaosSpikeRef.current === id) return;
    chaosSpikeRef.current = id;
    noteMoment(
      buildMoment({
        id,
        type: "chaos_spike",
        label: "Chaos spike",
        headline: "Everything broke at once and the run stayed alive",
        summary: "Overlapping incidents collided with a live target or extraction window and created a volatile opportunity.",
        severity: "critical",
        tensionLevel: 94,
        rarityScore: 80,
        shareabilityScore: 92,
        tags: ["chaos", "cascade", missionPressure.extractionRisk, selectedOperation?.story.identity.regimeSystem || "regime"],
      }),
    );
    pushStealthEvent("Chaos spike. Multiple pressures just collided and cracked the mission wide open.", "critical", id);
  }, [activeIncidents, buildMoment, missionPressure.extractionRisk, noteMoment, pushStealthEvent, selectedOperation?.story.identity.regimeSystem, targetWindowState]);

  useEffect(() => {
    if (rareWindowRef.current || targetWindowState !== "vulnerable" || activeIncidents.length > 1 || globalAlertLevel >= 2) return;
    rareWindowRef.current = true;
    const id = `rare-window-${Date.now()}`;
    noteMoment(
      buildMoment({
        id,
        type: "rare_window",
        label: "Rare opening",
        headline: "A clean target window appeared before the floor panicked",
        summary: "The target became exposed while the district was still readable enough to capitalize cleanly.",
        severity: "info",
        tensionLevel: 55,
        rarityScore: 82,
        shareabilityScore: 73,
        tags: ["target-window", "precision", selectedOperation?.sectorId || "harbor-facility"],
      }),
    );
    pushLog("Rare opening detected. The target is vulnerable before the floor has committed to panic.");
  }, [activeIncidents.length, buildMoment, globalAlertLevel, noteMoment, pushLog, selectedOperation?.sectorId, targetWindowState]);

  useEffect(() => {
    if (
      perfectChainRef.current ||
      !mission.targetEliminated ||
      !mission.secondaryObjectiveComplete ||
      mission.alarmsTriggered > 0 ||
      mission.evidenceLeftBehind > 1
    ) {
      return;
    }
    perfectChainRef.current = true;
    const id = `perfect-chain-${Date.now()}`;
    noteMoment(
      buildMoment({
        id,
        type: "perfect_chain",
        label: "Perfect chain",
        headline: "Target, objective, and route all folded into one clean sequence",
        summary: "Primary and secondary objectives resolved in one disciplined sequence without the district truly understanding what happened.",
        severity: "info",
        tensionLevel: 61,
        rarityScore: 91,
        shareabilityScore: 93,
        objectiveId: mission.secondaryObjectiveSource || "primary-and-secondary",
        tags: ["perfect", "ghost", mission.solution || "unknown-solution"],
      }),
    );
    pushStealthEvent("Perfect chain. The operation just threaded target, objective, and exit pressure into one clean sequence.", "info", id);
  }, [buildMoment, mission.alarmsTriggered, mission.evidenceLeftBehind, mission.secondaryObjectiveComplete, mission.secondaryObjectiveSource, mission.solution, mission.targetEliminated, noteMoment, pushStealthEvent]);

  useEffect(() => {
    const connectedTeammates = players.filter((player) => player.connected).length;
    if (coopSaveRef.current || connectedTeammates < 2 || !mission.secondaryObjectiveComplete || globalAlertLevel < 2 || !mission.targetEliminated) return;
    coopSaveRef.current = true;
    const id = `coop-save-${Date.now()}`;
    noteMoment(
      buildMoment({
        id,
        type: "coop_save",
        label: "Co-op save",
        headline: "Team interference turned collapse into a win",
        summary: "The team converted rising district pressure into a successful takedown and recovery instead of a collapse.",
        severity: "critical",
        tensionLevel: 92,
        rarityScore: 79,
        shareabilityScore: 94,
        tags: ["coop", "save", `${connectedTeammates}-agents`],
      }),
    );
    pushStealthEvent("Co-op save. Team interference turned a failing district picture into a win worth talking about.", "critical", id);
  }, [buildMoment, globalAlertLevel, mission.secondaryObjectiveComplete, mission.targetEliminated, noteMoment, players, pushStealthEvent]);

  useEffect(() => {
    if (
      highRiskSuccessRef.current ||
      !mission.targetEliminated ||
      (globalAlertLevel < 2.6 && missionPressure.extractionRisk !== "severe") ||
      mission.alarmsTriggered === 0
    ) {
      return;
    }
    highRiskSuccessRef.current = true;
    const id = `high-risk-success-${Date.now()}`;
    noteMoment(
      buildMoment({
        id,
        type: "high_risk_success",
        label: "High-risk success",
        headline: "The target fell after the district had already started closing its teeth",
        summary: "The operation still finished after pressure crossed into a visibly dangerous state.",
        severity: "critical",
        tensionLevel: 90,
        rarityScore: 72,
        shareabilityScore: 87,
        tags: ["high-risk", missionPressure.extractionRisk, "target-down"],
      }),
    );
  }, [buildMoment, globalAlertLevel, mission.alarmsTriggered, mission.targetEliminated, missionPressure.extractionRisk, noteMoment]);

  useEffect(() => {
    if (creativeObjectiveRef.current || !mission.secondaryObjectiveComplete || !mission.secondaryObjectiveSource) return;
    creativeObjectiveRef.current = true;
    const id = `creative-objective-${mission.secondaryObjectiveSource}-${Date.now()}`;
    noteMoment(
      buildMoment({
        id,
        type: "creative_objective",
        label: "Creative objective finish",
        headline: "The secondary objective landed through an unexpected route",
        summary: `Secondary leverage came through the ${mission.secondaryObjectiveSource.replaceAll("_", " ")} route instead of the obvious lane.`,
        severity: "info",
        tensionLevel: 52,
        rarityScore: 74,
        shareabilityScore: 69,
        objectiveId: mission.secondaryObjectiveSource,
        tags: ["objective", mission.secondaryObjectiveSource, continuity.sameArc?.callbackTag || "story-thread"],
      }),
    );
  }, [buildMoment, continuity.sameArc?.callbackTag, mission.secondaryObjectiveComplete, mission.secondaryObjectiveSource, noteMoment]);

  useEffect(() => {
    if (chainReactionRef.current || Object.keys(sabotageFlags).length < 2 || activeIncidents.length < 2 || !mission.targetEliminated) return;
    chainReactionRef.current = true;
    const id = `chain-reaction-${Date.now()}`;
    noteMoment(
      buildMoment({
        id,
        type: "chain_reaction",
        label: "Chain-reaction sabotage",
        headline: "Sabotage pressure folded back into a winning route",
        summary: "Multiple acts of disruption stacked into a clean mission swing instead of a dead end.",
        severity: "critical",
        tensionLevel: 86,
        rarityScore: 83,
        shareabilityScore: 91,
        tags: ["sabotage", "chain-reaction", `${activeIncidents.length}-incidents`],
      }),
    );
  }, [activeIncidents.length, buildMoment, mission.targetEliminated, noteMoment, sabotageFlags]);

  useEffect(() => {
    if (
      ghostSequenceRef.current ||
      !mission.targetEliminated ||
      !mission.secondaryObjectiveComplete ||
      mission.suspicionPeak > 26 ||
      mission.alarmsTriggered > 0 ||
      mission.bodiesFound > 0
    ) {
      return;
    }
    ghostSequenceRef.current = true;
    const id = `ghost-sequence-${Date.now()}`;
    noteMoment(
      buildMoment({
        id,
        type: "ghost_sequence",
        label: "Ghost sequence",
        headline: "The district never fully saw the run that cut it open",
        summary: "Objectives resolved under a low-profile sequence with almost no visible disturbance.",
        severity: "info",
        tensionLevel: 48,
        rarityScore: 93,
        shareabilityScore: 89,
        tags: ["ghost", "stealth", "clean-run"],
      }),
    );
  }, [buildMoment, mission.alarmsTriggered, mission.bodiesFound, mission.secondaryObjectiveComplete, mission.suspicionPeak, mission.targetEliminated, noteMoment]);

  useEffect(() => {
    if (
      lastSecondExtractionRef.current ||
      !mission.missionComplete ||
      (!mission.extractionReady && missionPressure.extractionRisk !== "severe") ||
      globalAlertLevel < 2.2
    ) {
      return;
    }
    lastSecondExtractionRef.current = true;
    const id = `last-second-extraction-${Date.now()}`;
    noteMoment(
      buildMoment({
        id,
        type: "last_second_extraction",
        label: "Last-second extraction",
        headline: "The run escaped while the district was already starting to lock down",
        summary: "Extraction still succeeded even after the floor crossed into openly dangerous pressure.",
        severity: "critical",
        tensionLevel: 96,
        rarityScore: 78,
        shareabilityScore: 95,
        tags: ["extraction", "escape", missionPressure.extractionRisk],
      }),
    );
  }, [buildMoment, globalAlertLevel, mission.extractionReady, mission.missionComplete, missionPressure.extractionRisk, noteMoment]);

  useEffect(() => {
    if (
      storyChaosRef.current ||
      activeIncidents.length < 3 ||
      !continuity.primaryCallback ||
      !mission.targetEliminated
    ) {
      return;
    }
    storyChaosRef.current = true;
    const id = `story-chaos-${Date.now()}`;
    noteMoment(
      buildMoment({
        id,
        type: "story_chaos_combo",
        label: "Archive-worthy incident",
        headline: "A prior campaign scar collided with this run and made the district break wider",
        summary: `${continuity.primaryCallback.codename} echoed into a live chaos spike and made the mission mean more than a single hit.`,
        severity: "critical",
        tensionLevel: 84,
        rarityScore: 88,
        shareabilityScore: 90,
        tags: ["campaign", "callback", continuity.primaryCallback.callbackTag],
      }),
    );
  }, [activeIncidents.length, buildMoment, continuity.primaryCallback, mission.targetEliminated, noteMoment]);

  return null;
}
