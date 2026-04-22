"use client";

import type {
  AftermathStorySummary,
  ChallengeSharePayload,
  DetectedMoment,
  DetectedMomentType,
  GeneratedMissionDefinition,
  MissionPressureState,
  MissionProgressState,
  MomentHighlightCategory,
  ReplaySeedPayload,
  RunHighlightBundle,
  ShareExportPayload,
  ShareMediaPayload,
  StoryStateSnapshot,
} from "@/game/core/types";
import { buildChallengePrompt, buildShareDescription, buildShareHookLine } from "@/lib/sharePresentation";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toBase64Url(value: string) {
  if (typeof window === "undefined" || typeof window.btoa !== "function") {
    return encodeURIComponent(value);
  }
  return window
    .btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodeChallengePayload(code: string) {
  try {
    if (typeof window === "undefined" || typeof window.atob !== "function") {
      return JSON.parse(decodeURIComponent(code)) as Omit<ChallengeSharePayload, "payloadCode">;
    }
    const padded = code.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = decodeURIComponent(escape(window.atob(padded)));
    return JSON.parse(decoded) as Omit<ChallengeSharePayload, "payloadCode">;
  } catch {
    return null;
  }
}

export function categoryForMomentType(type: DetectedMomentType): MomentHighlightCategory {
  switch (type) {
    case "clutch_recovery":
      return "Clutch Save";
    case "perfect_chain":
    case "ghost_sequence":
      return "Perfect Ghost Chain";
    case "chaos_spike":
    case "coop_recovery":
      return "Catastrophic Recovery";
    case "creative_objective":
    case "chain_reaction":
      return "Elegant Sabotage";
    case "last_second_extraction":
    case "high_risk_success":
      return "Impossible Escape";
    case "coop_save":
      return "Co-op Miracle";
    case "story_chaos_combo":
    case "rare_outcome_combo":
      return "Regime Breaker";
    default:
      return "Archive-Worthy Incident";
  }
}

export function createDetectedMoment(params: {
  id: string;
  type: DetectedMomentType;
  label: string;
  headline: string;
  summary: string;
  severity: DetectedMoment["severity"];
  tensionLevel: number;
  rarityScore: number;
  shareabilityScore: number;
  objectiveId?: string | null;
  tags: string[];
  mission: MissionProgressState;
  operation: GeneratedMissionDefinition | null;
  sequenceIndex: number;
}) {
  return {
    id: params.id,
    type: params.type,
    label: params.label,
    headline: params.headline,
    summary: params.summary,
    severity: params.severity,
    createdAt: Date.now(),
    sequenceIndex: params.sequenceIndex,
    missionId: params.operation?.missionId || "azure-meridian",
    operationId: params.operation?.id || null,
    objectiveId: params.objectiveId || null,
    sectorId: params.operation?.sectorId || "harbor-facility",
    tensionLevel: clamp(params.tensionLevel, 0, 100),
    rarityScore: clamp(params.rarityScore, 0, 100),
    shareabilityScore: clamp(params.shareabilityScore, 0, 100),
    highlightCategory: categoryForMomentType(params.type),
    tags: Array.from(new Set(params.tags)).slice(0, 8),
  } satisfies DetectedMoment;
}

function scoreMoment(moment: DetectedMoment, campaignImpactWeight: number) {
  const severityScore = moment.severity === "critical" ? 25 : moment.severity === "warning" ? 16 : 8;
  return moment.shareabilityScore * 0.35 + moment.rarityScore * 0.25 + moment.tensionLevel * 0.2 + campaignImpactWeight * 0.12 + severityScore;
}

function buildRestriction(operation: GeneratedMissionDefinition | null, mission: MissionProgressState, topMoment: DetectedMoment | null) {
  if (topMoment?.type === "perfect_chain" || topMoment?.type === "ghost_sequence") {
    return "No alarms, no disguise break, and keep the district guessing.";
  }
  if (topMoment?.type === "last_second_extraction" || mission.alarmsTriggered > 1) {
    return "Survive the extraction under live pressure and still make the finish look intentional.";
  }
  if (mission.solution === "poison") {
    return "Use the poison route and still keep the response chain from locking the district.";
  }
  return `${operation?.runtimeConfig.recommendedTeamSize || 1}-${operation?.runtimeConfig.maxTeamSize || 1} agent pressure profile with the same operation shell.`;
}

function buildHeadline(operation: GeneratedMissionDefinition | null, topMoment: DetectedMoment | null, resultRating: string | null) {
  if (topMoment) return `${topMoment.highlightCategory} / ${operation?.story.codename || "Operation"} / ${resultRating || "Resolved"}`;
  return `${operation?.story.codename || "Operation"} / ${resultRating || "Resolved"}`;
}

export function buildRunHighlightBundle(params: {
  mission: MissionProgressState;
  operation: GeneratedMissionDefinition | null;
  progressSummary: string;
  storyAftermath: AftermathStorySummary | null;
  storyState?: StoryStateSnapshot | null;
  teamSize: number;
}) {
  const topMoments = [...params.mission.notableMoments]
    .sort((left, right) => scoreMoment(right, params.storyAftermath ? 88 : 54) - scoreMoment(left, params.storyAftermath ? 88 : 54))
    .slice(0, 3);
  const topMoment = topMoments[0] || null;
  const restriction = buildRestriction(params.operation, params.mission, topMoment);
  const hook =
    topMoment?.headline ||
    params.storyAftermath?.headline ||
    `${params.operation?.story.codename || "Operation"} broke the district and left a challenge behind.`;
  const challengeBase = {
    version: 1 as const,
    operationId: params.operation?.id || null,
    missionId: params.operation?.missionId || "azure-meridian",
    variantId: params.operation?.variantId || null,
    codename: params.operation?.story.codename || "Operation",
    missionTitle: params.operation?.title || "Azure Meridian disruption",
    seedReference: params.operation ? `${params.operation.id}:${params.operation.variantId}` : "live-shell",
    hook,
    restriction,
    beatThisText: `${params.operation?.story.codename || "Operation"} / ${restriction} Beat this run and show a cleaner finish.`,
  };
  const payloadCode = toBase64Url(JSON.stringify(challengeBase));
  const challenge: ChallengeSharePayload = {
    ...challengeBase,
    payloadCode,
  };
  const replaySeed: ReplaySeedPayload = {
    version: 1,
    operationId: challenge.operationId,
    missionId: challenge.missionId,
    variantId: challenge.variantId,
    seedReference: challenge.seedReference,
    recommendedTeamSize: params.operation?.runtimeConfig.recommendedTeamSize || params.teamSize || 1,
    pressureProfile: params.operation?.story.pressureClass || null,
    worldStateHint: params.storyAftermath?.worldScar || params.storyAftermath?.impactLine || null,
    challengeRestriction: challenge.restriction,
    challengeHook: challenge.hook,
  };

  const headline = buildHeadline(params.operation, topMoment, params.mission.resultRating);
  const recap =
    topMoment?.summary ||
    params.storyAftermath?.reportLine ||
    `${params.operation?.title || "The operation"} resolved, but the archive is still waiting for a stronger spike.`;
  const campaignImpact =
    params.storyAftermath?.impactLine ||
    `${params.operation?.story.codename || "This operation"} shifted campaign pressure and opened a thinner command picture.`;
  const personalAchievement =
    topMoment
      ? `${topMoment.highlightCategory} registered at ${Math.round(topMoment.shareabilityScore)} shareability. ${params.progressSummary}`
      : params.progressSummary;
  const coopSummary = params.teamSize > 1 ? `Team of ${params.teamSize} agents produced ${topMoments.length || 1} archive-worthy beat${topMoments.length === 1 ? "" : "s"}.` : null;
  const consequenceLine =
    params.storyAftermath?.chainRisk ||
    params.storyState?.missionTimeline?.[0]?.unresolvedRisk ||
    `${params.operation?.story.codename || "This run"} leaves a follow-up hook worth chasing immediately.`;
  const exportPayload: ShareExportPayload = {
    version: 1,
    runId: `${params.operation?.id || "run"}-${params.mission.durationSeconds || Date.now()}`,
    missionTitle: params.operation?.title || "Azure Meridian disruption",
    codename: params.operation?.story.codename || "Operation",
    headline,
    summary: recap,
    operationId: params.operation?.id || null,
    variantId: params.operation?.variantId || null,
    sectorId: params.operation?.sectorId || "harbor-facility",
    challengeText: challenge.beatThisText,
    challengeCode: challenge.payloadCode,
    tags: Array.from(new Set((topMoments.flatMap((moment) => moment.tags)).slice(0, 10))),
  };
  const shareSummary = buildShareDescription({
    headline,
    recap,
    campaignImpact,
    consequenceLine,
    challenge,
    topMoments,
    exportPayload,
  });

  return {
    id: exportPayload.runId,
    missionId: challenge.missionId,
    operationId: challenge.operationId,
    variantId: challenge.variantId,
    sectorId: exportPayload.sectorId,
    generatedAt: Date.now(),
    headline,
    recap,
    campaignImpact,
    personalAchievement,
    consequenceLine,
    coopSummary,
    shareSummary,
    challenge,
    replaySeed,
    exportPayload,
    topMoments,
    tags: exportPayload.tags,
  } satisfies RunHighlightBundle;
}

export function buildShareCardSvg(bundle: RunHighlightBundle) {
  const safe = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const momentLines = bundle.topMoments.slice(0, 3).map((moment, index) => `
    <text x="48" y="${236 + index * 56}" fill="#f5f5f5" font-size="22" font-family="Arial, sans-serif">${safe(`${index + 1}. ${moment.label}`)}</text>
    <text x="48" y="${264 + index * 56}" fill="#b6b6b6" font-size="15" font-family="Arial, sans-serif">${safe(moment.summary.slice(0, 92))}</text>
  `);

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#140909" />
        <stop offset="55%" stop-color="#251213" />
        <stop offset="100%" stop-color="#090909" />
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)" />
    <rect x="36" y="36" width="1128" height="558" rx="28" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" />
    <text x="48" y="92" fill="#d1a1a1" font-size="18" font-family="Arial, sans-serif" letter-spacing="4">ARCHIVE-WORTHY RUN</text>
    <text x="48" y="148" fill="#ffffff" font-size="42" font-family="Arial, sans-serif">${safe(bundle.exportPayload.codename)}</text>
    <text x="48" y="184" fill="#cfcfcf" font-size="22" font-family="Arial, sans-serif">${safe(bundle.headline)}</text>
    <text x="48" y="522" fill="#d9d9d9" font-size="20" font-family="Arial, sans-serif">${safe(bundle.campaignImpact.slice(0, 112))}</text>
    <text x="48" y="560" fill="#9f9f9f" font-size="18" font-family="Arial, sans-serif">${safe(bundle.challenge.beatThisText.slice(0, 118))}</text>
    <text x="930" y="92" fill="#cf9b9b" font-size="16" font-family="Arial, sans-serif" text-anchor="end">${safe(bundle.exportPayload.missionTitle)}</text>
    ${momentLines.join("")}
  </svg>`;
}

export function downloadSvgCard(filename: string, svg: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const words = text.split(/\s+/);
  let line = "";
  let lineIndex = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, y + lineIndex * lineHeight);
      line = word;
      lineIndex += 1;
      if (lineIndex >= maxLines) return;
    } else {
      line = candidate;
    }
  }
  if (lineIndex < maxLines) {
    context.fillText(line, x, y + lineIndex * lineHeight);
  }
}

export async function renderShareCardImage(bundle: RunHighlightBundle) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#140909");
  gradient.addColorStop(0.55, "#251213");
  gradient.addColorStop(1, "#090909");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255,255,255,0.12)";
  context.lineWidth = 2;
  context.strokeRect(36, 36, 1128, 558);

  context.fillStyle = "#d1a1a1";
  context.font = "18px Arial";
  context.fillText("ARCHIVE-WORTHY RUN", 48, 88);
  context.fillStyle = "#ffffff";
  context.font = "bold 42px Arial";
  context.fillText(bundle.exportPayload.codename, 48, 148);
  context.font = "22px Arial";
  context.fillStyle = "#d4d4d4";
  drawWrappedText(context, bundle.headline, 48, 184, 760, 28, 2);
  context.font = "18px Arial";
  drawWrappedText(context, bundle.recap, 48, 252, 720, 26, 4);
  context.fillStyle = "#f5f5f5";
  context.font = "22px Arial";
  bundle.topMoments.slice(0, 3).forEach((moment, index) => {
    const offsetY = 388 + index * 66;
    context.fillText(`${index + 1}. ${moment.label}`, 48, offsetY);
    context.fillStyle = "#b6b6b6";
    context.font = "15px Arial";
    drawWrappedText(context, moment.summary, 48, offsetY + 24, 740, 20, 2);
    context.fillStyle = "#f5f5f5";
    context.font = "22px Arial";
  });
  context.fillStyle = "#d9d9d9";
  context.font = "20px Arial";
  drawWrappedText(context, bundle.campaignImpact, 48, 548, 760, 24, 2);
  context.fillStyle = "#9f9f9f";
  context.font = "18px Arial";
  drawWrappedText(context, bundle.challenge.beatThisText, 48, 592, 1000, 22, 1);

  return new Promise<string | null>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.readAsDataURL(blob);
    }, "image/png");
  });
}

export async function captureGameplaySnapshot() {
  if (typeof document === "undefined") return null;
  const sourceCanvas = document.querySelector("canvas");
  if (!(sourceCanvas instanceof HTMLCanvasElement)) return null;
  try {
    return sourceCanvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export async function captureShareMedia(bundle: RunHighlightBundle): Promise<ShareMediaPayload> {
  const [imageDataUrl, snapshotDataUrl] = await Promise.all([renderShareCardImage(bundle), captureGameplaySnapshot()]);
  return {
    imageDataUrl: snapshotDataUrl || imageDataUrl,
    thumbnailDataUrl: imageDataUrl || snapshotDataUrl,
    cardSvg: buildShareCardSvg(bundle),
    clipSupported:
      typeof window !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      typeof HTMLCanvasElement !== "undefined",
    clipFilename: `${bundle.exportPayload.codename.toLowerCase().replaceAll(" ", "-")}-highlight.webm`,
  };
}

export async function captureHighlightClipDataUrl(bundle: RunHighlightBundle): Promise<string | null> {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") {
    return null;
  }
  const sourceCanvas = document.querySelector("canvas");
  if (!(sourceCanvas instanceof HTMLCanvasElement) || typeof sourceCanvas.captureStream !== "function") {
    return null;
  }
  const stream = sourceCanvas.captureStream(24);
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
  const parts: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data?.size) parts.push(event.data);
  };
  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });
  recorder.start();
  await new Promise((resolve) => window.setTimeout(resolve, 2200));
  recorder.stop();
  await stopped;
  const blob = new Blob(parts, { type: "video/webm" });
  if (!blob.size) return null;
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(blob);
  });
}

export async function downloadPngCard(filename: string, dataUrl: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}

export async function exportHighlightClip(bundle: RunHighlightBundle) {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") {
    return { ok: false, error: "Clip capture is unavailable in this browser." };
  }
  const sourceCanvas = document.querySelector("canvas");
  if (!(sourceCanvas instanceof HTMLCanvasElement) || typeof sourceCanvas.captureStream !== "function") {
    return { ok: false, error: "Live canvas capture is unavailable. Use image export instead." };
  }
  const stream = sourceCanvas.captureStream(24);
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
  const parts: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data?.size) parts.push(event.data);
  };
  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });
  recorder.start();
  await new Promise((resolve) => window.setTimeout(resolve, 2500));
  recorder.stop();
  await stopped;
  const blob = new Blob(parts, { type: "video/webm" });
  if (!blob.size) {
    return { ok: false, error: "Clip capture produced no media." };
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${bundle.exportPayload.codename.toLowerCase().replaceAll(" ", "-")}-highlight.webm`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true };
}

export function formatMomentShareText(bundle: RunHighlightBundle) {
  return `${buildShareHookLine(bundle)}\n${buildShareDescription(bundle)}\nChallenge: ${buildChallengePrompt(bundle)}\nOperation: ${bundle.exportPayload.missionTitle}\nChallenge code: ${bundle.challenge.payloadCode}`;
}

export function describePressureTrail(pressure: MissionPressureState, storyAftermath: AftermathStorySummary | null) {
  const hotZones = [
    pressure.annexPressure ? "annex" : null,
    pressure.ballroomPressure ? "ballroom" : null,
    pressure.securityPressure ? "security" : null,
  ].filter(Boolean);
  if (storyAftermath) return `${storyAftermath.worldScar} ${storyAftermath.chainRisk}`;
  if (!hotZones.length) return "This run left a controlled footprint and no dominant pressure lane.";
  return `Pressure trail active in ${hotZones.join(", ")} with extraction risk ${pressure.extractionRisk}.`;
}
