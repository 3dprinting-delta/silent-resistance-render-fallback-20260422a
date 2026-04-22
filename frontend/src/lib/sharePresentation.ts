import type { RunHighlightBundle, StoredShareRecord } from "@/game/core/types";

type ShareLike = Pick<StoredShareRecord, "headline" | "recap" | "campaignImpact" | "consequenceLine" | "challenge" | "topMoments" | "exportPayload">;

const HOOK_PREFIXES = [
  "You won't survive this run.",
  "I almost lost everything here.",
  "This district nearly collapsed on me.",
  "Try this before the window closes.",
  "This one turns clean plans into panic fast.",
];

export function buildShareHookLine(share: ShareLike) {
  const topCategory = share.topMoments?.[0]?.highlightCategory || "";
  if (topCategory === "Impossible Escape") return "You won't survive this run.";
  if (topCategory === "Clutch Save") return "I almost lost everything here.";
  if (topCategory === "Catastrophic Recovery") return "This one goes bad before it gets brilliant.";
  if (topCategory === "Perfect Ghost Chain") return "Try matching this without breaking cover.";
  return HOOK_PREFIXES[Math.abs((share.headline || "").length) % HOOK_PREFIXES.length];
}

export function buildShareDescription(share: ShareLike) {
  const hook = buildShareHookLine(share);
  const recap = share.recap || share.headline;
  const impact = share.campaignImpact || share.consequenceLine || "The campaign shifted after this run.";
  return `${hook} ${recap} ${impact}`.trim();
}

export function buildChallengePrompt(share: ShareLike) {
  return share.challenge?.beatThisText || `Try ${share.exportPayload?.missionTitle || "this operation"} and beat the archive.`;
}

export function buildReplayIntro(share: StoredShareRecord | RunHighlightBundle) {
  const topMoment = share.topMoments?.[0];
  if (!topMoment) {
    return "Replay the same mission shell, feel the pressure profile, and see if you can leave a cleaner story behind.";
  }
  return `${topMoment.highlightCategory}: ${topMoment.headline}. Replay the same setup and see if you can create a better ending.`;
}
