import type { CareerRecord, SolutionType } from "@/game/core/types";

const CAREER_KEY = "silent-resistance-career";
const DEFAULT_CAREER: CareerRecord = {
  bestScore: 0,
  bestRating: "Unranked",
  completedChallenges: [],
  discoveredSolutions: [],
  totalRuns: 0,
  signatureMoments: [],
};

export function loadCareer(): CareerRecord {
  if (typeof window === "undefined") {
    return DEFAULT_CAREER;
  }

  try {
    const raw = window.localStorage.getItem(CAREER_KEY);
    if (!raw) {
      return DEFAULT_CAREER;
    }
    return { ...DEFAULT_CAREER, ...(JSON.parse(raw) as CareerRecord) };
  } catch {
    return DEFAULT_CAREER;
  }
}

export function persistCareer(career: CareerRecord) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CAREER_KEY, JSON.stringify(career));
}

export function mergeCareer(
  current: CareerRecord,
  update: { score: number; rating: string; solution?: SolutionType | null; challenges: string[]; signatureMoments?: string[] },
) {
  return {
    bestScore: Math.max(current.bestScore, update.score),
    bestRating: update.score >= current.bestScore ? update.rating : current.bestRating,
    completedChallenges: Array.from(new Set([...current.completedChallenges, ...update.challenges])),
    discoveredSolutions: Array.from(new Set([...current.discoveredSolutions, ...(update.solution ? [update.solution] : [])])),
    totalRuns: current.totalRuns + 1,
    signatureMoments: Array.from(new Set([...(current.signatureMoments || []), ...(update.signatureMoments || [])])).slice(0, 16),
  };
}
