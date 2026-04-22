"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import styles from "./RagdollArchers.module.css";
import { useRagdollArchersStore } from "@/game/ragdollArchers/core/store";
import type { PersistedPlayerProfile } from "@/game/ragdollArchers/core/types";

export function AccountPanel() {
  const { data: session, status } = useSession();
  const setProfile = useRagdollArchersStore((state) => state.setProfile);
  const profile = useRagdollArchersStore((state) => state.profile);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      setProfile(null);
      return;
    }

    fetch("/api/account/profile")
      .then((response) => response.json())
      .then((payload: { profile: PersistedPlayerProfile | null }) => {
        setProfile(payload.profile);
      })
      .catch(() => {
        setError("Profile sync failed.");
      });
  }, [setProfile, status]);

  const handleAuth = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl: "/ragdoll-archers",
      });
      if (result?.error) {
        setError("Invalid email or password.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.accountCard}>
      <div className={styles.accountHeader}>
        <div>
          <p className={styles.eyebrow}>Account</p>
          <h3 className={styles.sectionTitle}>{session?.user?.name || profile?.displayName || "Guest Mode"}</h3>
        </div>
        {session?.user ? (
          <button type="button" className={styles.secondaryButton} onClick={() => signOut({ callbackUrl: "/ragdoll-archers" })}>
            Logout
          </button>
        ) : null}
      </div>

      {session?.user ? (
        <>
          <div className={styles.accountStats}>
            <div className={styles.briefStat}><span>Matches</span><strong>{profile?.stats.matchesPlayed ?? 0}</strong></div>
            <div className={styles.briefStat}><span>Wins</span><strong>{profile?.stats.wins ?? 0}</strong></div>
            <div className={styles.briefStat}><span>Best Survival</span><strong>{profile?.stats.bestSurvivalTimeSeconds ?? 0}s</strong></div>
            <div className={styles.briefStat}><span>Deaths</span><strong>{profile?.stats.deaths ?? 0}</strong></div>
            <div className={styles.briefStat}><span>Accuracy</span><strong>{Math.round((profile?.stats.accuracy ?? 0) * 100)}%</strong></div>
            <div className={styles.briefStat}><span>Stabilizations</span><strong>{profile?.stats.successfulStabilizations ?? 0}</strong></div>
            <div className={styles.briefStat}><span>2D Runs</span><strong>{profile?.stats.duelMatchesPlayed ?? 0}</strong></div>
            <div className={styles.briefStat}><span>FPS Runs</span><strong>{profile?.stats.firstPersonMatchesPlayed ?? 0}</strong></div>
          </div>
          <p className={styles.sectionCopy}>
            {profile?.recentMatches?.[0]
              ? `Last run: ${profile.recentMatches[0].success ? "survived" : profile.recentMatches[0].causeOfDeath || "died"} in ${Math.round(profile.recentMatches[0].survivalTimeMs / 1000)}s.`
              : "No run history yet. One clean duel is enough to start building a story."}
          </p>
          <p className={styles.sectionCopy}>
            {profile?.challengeCompletions?.length
              ? `${profile.challengeCompletions.length} challenge${profile.challengeCompletions.length === 1 ? "" : "s"} cleared.`
              : "No challenge clears yet. A short challenge run is the fastest way to get a clip-worthy story."}
          </p>
        </>
      ) : (
        <>
          <div className={styles.formGrid}>
            <input className={styles.textInput} placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <input className={styles.textInput} type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {error ? <p className={styles.errorText}>{error}</p> : null}
          <p className={styles.sectionCopy}>Public signup has been disabled. Request a provisioned account if you still need access.</p>
          <div className={styles.buttonRow}>
            <button type="button" className={styles.primaryButton} disabled={pending} onClick={handleAuth}>
              {pending ? "Please wait..." : "Login"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
