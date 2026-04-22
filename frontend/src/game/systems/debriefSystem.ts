import type { GeneratedMissionDefinition, MissionProgressState, SolutionType } from "@/game/core/types";
import { buildAftermathSummary } from "@/game/data/missionStoryFabric";
import { loadCareer, mergeCareer, persistCareer } from "@/game/systems/career";
import { computeMissionScore } from "@/game/systems/scoring";

export function finalizeMissionDebrief(params: {
  mission: MissionProgressState;
  suspicion: number;
  globalAlertLevel: number;
  accessState: string;
  missionStartTime: number;
  operation?: GeneratedMissionDefinition | null;
}) {
  const scoreState = {
    suspicionPeak: Math.max(Math.round(params.suspicion), Math.round(params.mission.suspicionPeak)),
    alarmsTriggered: params.mission.alarmsTriggered,
    bodiesFound: params.mission.bodiesFound,
    witnessedActions: params.globalAlertLevel >= 2 ? 1 : 0,
    nonTargetCasualties: params.mission.nonTargetCasualties,
    disguiseBreaks: params.accessState === "hard_restricted" ? 1 : 0,
    disguisesUsed: params.mission.disguisesUsed.length,
    evidenceLeftBehind: params.mission.evidenceLeftBehind + Math.max(0, params.mission.bodiesFound - params.mission.hiddenBodies),
    objectivesCompleted: (params.mission.targetEliminated ? 2 : 0) + (params.mission.secondaryObjectiveComplete ? 1 : 0),
    startTime: params.missionStartTime,
    finishTime: Date.now(),
  };

  const result = computeMissionScore(scoreState, params.mission.solution as SolutionType | null);
  const career = loadCareer();
  const mergedCareer = mergeCareer(career, {
    score: result.score,
    rating: result.rating,
    solution: params.mission.solution,
    challenges: Array.from(new Set([...result.challenges, ...(params.mission.secondaryObjectiveComplete ? ["ledger-thief"] : [])])),
    signatureMoments: params.mission.notableMoments.slice(0, 3).map((moment) => moment.label),
  });

  return {
    result,
    storyAftermath: params.operation
      ? buildAftermathSummary(params.operation, {
          rating: result.rating,
          alarmsTriggered: params.mission.alarmsTriggered,
          evidenceLeftBehind: scoreState.evidenceLeftBehind,
          targetEliminated: params.mission.targetEliminated,
          secondaryObjectiveComplete: params.mission.secondaryObjectiveComplete,
        })
      : null,
    persistCareer: () => persistCareer(mergedCareer),
  };
}
