import type { ChallengeDefinition, HighlightSummaryCard, MatchHistoryEntry, MatchResult, MedicalDeathReport, ReplayHighlightTag, ReplayPresentationStep, ResultPresentation } from "@/game/ragdollArchers/core/types";

function formatDuration(durationMs: number) {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildEmotionalLine(deathReport: MedicalDeathReport | null) {
  if (!deathReport) return undefined;
  if (deathReport.preventability === "high") return "This was preventable.";
  if ((deathReport.timeFromCriticalInjuryMs || 0) <= 9000) return "One mistake.";
  return "You almost made it.";
}

export function buildResultPresentation(params: {
  result: MatchResult;
  deathReport: MedicalDeathReport | null;
  highlightTag: ReplayHighlightTag | null;
  survivalTimeMs: number;
  launchModeLabel: string;
  challenge: ChallengeDefinition | null;
}): ResultPresentation {
  const survivalTimeLabel = formatDuration(params.survivalTimeMs);
  const emotionalLine = buildEmotionalLine(params.deathReport);
  const fixLabel = params.deathReport?.missingRequirements?.[0]
    ? `${params.deathReport.missingRequirements[0].supplyId.replaceAll("-", " ")} x${params.deathReport.missingRequirements[0].quantity}`
    : params.deathReport?.missingTools?.[0]
      ? params.deathReport.missingTools[0].replaceAll("-", " ")
      : params.deathReport?.lastSuccessfulTreatment || "one clean reset";
  const causeLabel = params.deathReport?.bodyRegion
    ? `${params.deathReport.bodyRegion}: ${params.deathReport.causeOfDeath}`
    : params.deathReport?.causeOfDeath;
  const primaryFailure = params.deathReport
    ? params.deathReport.failedTreatments[0] || params.deathReport.primaryFatalInjury
    : undefined;
  const mistakeLabel = params.deathReport
    ? params.deathReport.failedTreatments[0] || (params.deathReport.preventability === "high" ? "Treatment timing broke down" : params.deathReport.primaryFatalInjury)
    : undefined;
  const primaryClutchMoment = params.highlightTag
    ? params.highlightTag === "totem-save"
      ? "LAST SECOND SAVE turned the run around."
      : params.highlightTag === "critical-hit"
        ? "CLUTCH HIT defined the run."
        : params.highlightTag === "survived-critical-injury"
          ? "CRITICAL SURVIVAL carried the run."
          : params.highlightTag === "treatment-failed-near-death"
            ? "The run hinged on a failed treatment."
            : "A major moment defined the match."
    : params.result.success
      ? "You survived the pressure and closed the match cleanly."
      : undefined;
  const highlightCard: HighlightSummaryCard | undefined = params.highlightTag
    ? {
        title: "Highlight Moment",
        mode: params.launchModeLabel,
        survivalTimeLabel,
        notableTag: params.highlightTag,
        summary: primaryClutchMoment || params.deathReport?.causeExplanation || params.result.body,
      }
    : undefined;

  return {
    headline: params.deathReport ? params.deathReport.causeOfDeath : params.result.success ? "Run Completed" : params.result.title,
    subhead: params.challenge ? `${params.challenge.label} / ${params.launchModeLabel}` : params.launchModeLabel,
    emotionalLine,
    causeLabel,
    mistakeLabel,
    fixLabel,
    shareText: params.deathReport
      ? [
          `Cause of Death: ${params.deathReport.causeOfDeath}`,
          `Survived: ${survivalTimeLabel}`,
          `Could have survived with: ${fixLabel || "a cleaner recovery window"}`,
          `Challenge: ${params.challenge?.label || params.launchModeLabel}`,
        ].join("\n")
      : [
          `Outcome: ${params.result.title}`,
          `Survived: ${survivalTimeLabel}`,
          `Story Moment: ${primaryClutchMoment || "Held the line."}`,
          `Challenge: ${params.challenge?.label || params.launchModeLabel}`,
        ].join("\n"),
    primaryFailure,
    primaryClutchMoment,
    preventabilityLabel: params.deathReport?.preventability,
    highlightCard,
    deathCard: params.deathReport
      ? {
          title: "Forensic Death Summary",
          mode: params.launchModeLabel,
          causeOfDeath: params.deathReport.causeOfDeath,
          survivalTimeLabel,
          criticalInjuries: params.deathReport.contributingInjuries.length + 1,
          treatmentFailures: params.deathReport.failedTreatments,
          summary: primaryFailure || params.deathReport.causeExplanation || params.deathReport.primaryFatalInjury,
        }
      : undefined,
    challengeCard: params.challenge
      ? {
          title: "Challenge Summary",
          challengeLabel: params.challenge.label,
          outcomeLabel: params.result.success ? "Completed" : "Failed",
          summary: params.result.success
            ? `Cleared ${params.challenge.label} in ${survivalTimeLabel}. ${primaryClutchMoment || "A clean survival story."}`
            : `Failed ${params.challenge.label} after ${survivalTimeLabel}. ${primaryFailure || "The final chain broke the run."}`,
        }
      : undefined,
  };
}

export function buildReplayPresentationSteps(params: {
  deathReport: MedicalDeathReport | null;
  replayEvents: Array<{ eventType: string; summary: string }>;
}) {
  if (!params.replayEvents.length) return [] as ReplayPresentationStep[];
  const impact = params.replayEvents.find((event) => event.eventType.includes("hit") || event.summary.toLowerCase().includes("critical"));
  const escalation = params.replayEvents.find((event) => event.eventType.includes("injury") || event.summary.toLowerCase().includes("bleed") || event.summary.toLowerCase().includes("failure"));
  const treatment = params.replayEvents.find((event) => event.eventType.includes("treatment"));
  const cause = params.deathReport?.causeExplanation || params.deathReport?.causeOfDeath || "Final collapse reached terminal state.";

  return [
    impact
      ? {
          id: "impact",
          label: "Impact",
          detail: impact.summary,
          emphasis: "high",
        }
      : null,
    escalation
      ? {
          id: "escalation",
          label: "Injury Escalation",
          detail: escalation.summary,
          emphasis: "medium",
        }
      : null,
    treatment
      ? {
          id: "treatment",
          label: treatment.summary.toLowerCase().includes("interrupted") ? "Treatment Failed" : "Treatment Attempt",
          detail: treatment.summary,
          emphasis: "medium",
        }
      : null,
    {
      id: "cause",
      label: "Cause of Death",
      detail: cause,
      emphasis: "high",
    },
  ].filter(Boolean) as ReplayPresentationStep[];
}

export function buildMatchHistoryEntry(params: {
  id: string;
  playedAt: number;
  launchMode: MatchHistoryEntry["launchMode"];
  gameMode: MatchHistoryEntry["gameMode"];
  result: MatchResult;
  survivalTimeMs: number;
  causeOfDeath?: string | null;
  notableTag?: ReplayHighlightTag | null;
}): MatchHistoryEntry {
  return {
    id: params.id,
    playedAt: params.playedAt,
    launchMode: params.launchMode,
    gameMode: params.gameMode,
    success: params.result.success,
    score: params.result.score,
    kills: params.result.kills,
    survivalTimeMs: params.survivalTimeMs,
    causeOfDeath: params.causeOfDeath || null,
    notableTag: params.notableTag || null,
  };
}
