import type { MissionScoreBreakdown, MissionScoreResult, ScoreState, SolutionType } from "@/game/core/types";

function pushEntry(entries: MissionScoreBreakdown[], label: string, value: number, kind: "bonus" | "penalty" | "neutral") {
  entries.push({ label, value, kind });
}

function ratingForScore(score: number) {
  if (score >= 1125) return "Silent Phantom";
  if (score >= 900) return "Ghost";
  if (score >= 700) return "Shadow";
  if (score >= 475) return "Operative";
  return "Compromised";
}

export function computeMissionScore(score: ScoreState, solution: SolutionType | null): MissionScoreResult {
  const durationSeconds = score.finishTime ? Math.max(1, Math.floor((score.finishTime - score.startTime) / 1000)) : 1;
  const breakdown: MissionScoreBreakdown[] = [];
  let total = 1000;

  const stealthQuality = Math.max(0, 220 - Math.round(score.suspicionPeak * 1.9));
  total += stealthQuality;
  pushEntry(breakdown, "Stealth quality", stealthQuality, "bonus");

  const alarmPenalty = score.alarmsTriggered * -140;
  total += alarmPenalty;
  pushEntry(breakdown, "Alarms triggered", alarmPenalty, "penalty");

  const bodyPenalty = score.bodiesFound * -95;
  total += bodyPenalty;
  pushEntry(breakdown, "Bodies found", bodyPenalty, "penalty");

  const casualtyPenalty = score.nonTargetCasualties * -260;
  total += casualtyPenalty;
  pushEntry(breakdown, "Non-target casualties", casualtyPenalty, "penalty");

  const disguisePenalty = Math.max(0, score.disguisesUsed - 1) * -45;
  total += disguisePenalty;
  pushEntry(breakdown, "Disguises used", disguisePenalty, disguisePenalty < 0 ? "penalty" : "neutral");

  const disguiseBreakPenalty = score.disguiseBreaks * -95;
  total += disguiseBreakPenalty;
  pushEntry(breakdown, "Disguise breaks", disguiseBreakPenalty, "penalty");

  const evidencePenalty = score.evidenceLeftBehind * -70;
  total += evidencePenalty;
  pushEntry(breakdown, "Evidence left behind", evidencePenalty, "penalty");

  const timeBonus = Math.max(-120, 360 - Math.floor(durationSeconds * 0.9));
  total += timeBonus;
  pushEntry(breakdown, "Time", timeBonus, timeBonus >= 0 ? "bonus" : "penalty");

  const objectiveBonus = score.objectivesCompleted * 135;
  total += objectiveBonus;
  pushEntry(breakdown, "Objectives completed", objectiveBonus, "bonus");

  const witnessPenalty = score.witnessedActions * -85;
  total += witnessPenalty;
  pushEntry(breakdown, "Witnessed actions", witnessPenalty, "penalty");

  const solutionBonus = solution === "social" ? 60 : solution === "poison" ? 90 : solution === "environmental" ? 80 : 0;
  total += solutionBonus;
  pushEntry(breakdown, "Method bonus", solutionBonus, solutionBonus ? "bonus" : "neutral");

  const clamped = Math.max(0, Math.round(total));
  const challenges: string[] = [];

  if (score.alarmsTriggered === 0 && score.bodiesFound === 0 && score.evidenceLeftBehind === 0) challenges.push("Invisible Hand");
  if (score.nonTargetCasualties === 0) challenges.push("Clean Hands");
  if (score.disguisesUsed <= 1) challenges.push("Single Skin");
  if (solution === "poison" || solution === "environmental" || solution === "social") challenges.push(`Method: ${solution}`);
  if (score.objectivesCompleted >= 3) challenges.push("Full Sweep");
  if (durationSeconds <= 540) challenges.push("Swift Current");

  return {
    score: clamped,
    rating: ratingForScore(clamped),
    durationSeconds,
    breakdown,
    challenges,
  };
}
