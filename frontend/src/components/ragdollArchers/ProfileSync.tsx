"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRagdollArchersStore } from "@/game/ragdollArchers/core/store";
import type { MatchHistoryEntry, PersistedPlayerProfile } from "@/game/ragdollArchers/core/types";

export function ProfileSync() {
  const { status } = useSession();
  const profile = useRagdollArchersStore((state) => state.profile);
  const setProfile = useRagdollArchersStore((state) => state.setProfile);
  const phase = useRagdollArchersStore((state) => state.phase);
  const launchMode = useRagdollArchersStore((state) => state.launchMode);
  const settings = useRagdollArchersStore((state) => state.settings);
  const launchSettings = useRagdollArchersStore((state) => state.launchSettings);
  const realismMode = useRagdollArchersStore((state) => state.realismMode);
  const progression = useRagdollArchersStore((state) => state.progression);
  const supplies = useRagdollArchersStore((state) => state.supplies);
  const result = useRagdollArchersStore((state) => state.result);
  const deathReport = useRagdollArchersStore((state) => state.deathReport);
  const medicalSummary = useRagdollArchersStore((state) => state.medicalSummary);
  const lastSavedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !profile) return;

    const basePayload = {
      ...profile,
      inventory: supplies,
      settingsJson: JSON.stringify({
        launchSettings,
        preferredMode: settings.mode,
        realismMode,
        progression,
      }),
    };

    if (phase === "result" && result && medicalSummary) {
      const resultKey = `${result.title}-${result.score}-${result.kills}-${medicalSummary.survivalDurationMs}`;
      if (lastSavedKeyRef.current === resultKey) return;
      lastSavedKeyRef.current = resultKey;

      const recentMatch: MatchHistoryEntry = {
        id: `match-${Date.now()}`,
        playedAt: Date.now(),
        launchMode,
        gameMode: settings.mode,
        success: result.success,
        score: result.score,
        kills: result.kills,
        survivalTimeMs: medicalSummary.survivalDurationMs,
        causeOfDeath: deathReport?.causeOfDeath || null,
        notableTag: null,
      };

      const xpGain = result.success ? 140 : 70;
      const nextXp = profile.stats.xp + xpGain;
      const updatedProfile: PersistedPlayerProfile = {
        ...basePayload,
        recentMatches: [recentMatch, ...(profile?.recentMatches || [])].slice(0, 12),
        stats: {
          ...profile.stats,
          matchesPlayed: profile.stats.matchesPlayed + 1,
          wins: profile.stats.wins + (result.success ? 1 : 0),
          losses: profile.stats.losses + (result.success ? 0 : 1),
          level: Math.max(1, Math.floor(nextXp / 300) + 1),
          xp: nextXp,
          injuryCount: profile.stats.injuryCount + medicalSummary.totalInjuries,
          deaths: profile.stats.deaths + (result.success ? 0 : 1),
          shotsFired: profile.stats.shotsFired,
          shotsHit: profile.stats.shotsHit,
          survivalTimeSeconds: profile.stats.survivalTimeSeconds + Math.round(medicalSummary.survivalDurationMs / 1000),
          bestSurvivalTimeSeconds: Math.max(profile.stats.bestSurvivalTimeSeconds, Math.round(medicalSummary.survivalDurationMs / 1000)),
          mostCommonCauseOfDeath: result.success ? profile.stats.mostCommonCauseOfDeath : deathReport?.causeOfDeath || profile.stats.mostCommonCauseOfDeath,
          treatmentsUsed: profile.stats.treatmentsUsed + medicalSummary.treatmentAttempts,
          successfulStabilizations:
            profile.stats.successfulStabilizations + Math.round(medicalSummary.treatmentAttempts * medicalSummary.treatmentSuccessRate),
          criticalInjuriesSurvived:
            profile.stats.criticalInjuriesSurvived + (result.success && medicalSummary.criticalInjuries > 0 ? 1 : 0),
          duelMatchesPlayed: profile.stats.duelMatchesPlayed + (settings.mode === "duel" ? 1 : 0),
          firstPersonMatchesPlayed: profile.stats.firstPersonMatchesPlayed + (settings.mode === "firstperson" ? 1 : 0),
          duelWins: profile.stats.duelWins + (settings.mode === "duel" && result.success ? 1 : 0),
          firstPersonWins: profile.stats.firstPersonWins + (settings.mode === "firstperson" && result.success ? 1 : 0),
        },
      };

      try {
        void fetch("/api/account/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedProfile),
        })
          .then((response) => {
            if (response.ok) {
              setProfile(updatedProfile);
            }
          })
          .catch((error) => {
            console.error("Recovered error: profile-sync-result-save", error);
          });
      } catch (error) {
        console.error("Recovered error: profile-sync-result-save", error);
      }

      return;
    }

    const passiveKey = JSON.stringify({ id: profile.id, mode: settings.mode, launchSettings, supplies });
    if (lastSavedKeyRef.current === passiveKey) return;
    lastSavedKeyRef.current = passiveKey;

    try {
      void fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basePayload),
      }).catch((error) => {
        console.error("Recovered error: profile-sync-passive-save", error);
      });
    } catch (error) {
      console.error("Recovered error: profile-sync-passive-save", error);
    }
  }, [
    deathReport?.causeOfDeath,
    launchMode,
    launchSettings,
    medicalSummary,
    phase,
    profile,
    progression,
    realismMode,
    result,
    setProfile,
    settings.mode,
    status,
    supplies,
  ]);

  return null;
}
