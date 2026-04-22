"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import styles from "./SpotifyShowcase.module.css";

type OverviewResponse = {
  profile: {
    displayName: string;
    email: string | null;
    country: string | null;
    product: string | null;
    followers: number;
    image: string | null;
  };
  currentTrack: {
    title: string;
    artists: string;
    image: string | null;
    href: string | null;
    isPlaying: boolean;
    progressMs: number;
    durationMs: number;
  } | null;
  topTracks: Array<{
    id: string;
    title: string;
    artists: string;
    image: string | null;
    href: string | null;
    previewUrl: string | null;
    album: string | null;
  }>;
  recentPlays: Array<{
    id: string;
    title: string;
    artists: string;
    image: string | null;
    href: string | null;
    playedAt: string;
  }>;
};

function formatPlayedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatProgress(progressMs: number, durationMs: number) {
  if (!durationMs) {
    return "Waiting for playback";
  }

  const percent = Math.max(0, Math.min(100, Math.round((progressMs / durationMs) * 100)));
  return `${percent}% through`;
}

export function SpotifyShowcase() {
  const { data: session, status } = useSession();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spotifyEnabled = process.env.NEXT_PUBLIC_SPOTIFY_AUTH_ENABLED === "true";

  useEffect(() => {
    if (status !== "authenticated" || !session?.spotifyConnected) {
      setOverview(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadOverview() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/spotify/overview", {
          cache: "no-store",
        });
        const data = (await response.json()) as OverviewResponse & { error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Unable to load Spotify data.");
        }

        if (!cancelled) {
          setOverview(data);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load Spotify data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOverview();
    const timer = window.setInterval(loadOverview, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session?.spotifyConnected, status]);

  const highlight = useMemo(() => {
    if (!overview?.topTracks.length) {
      return null;
    }

    return overview.topTracks[0];
  }, [overview?.topTracks]);

  const isConnected = status === "authenticated" && session?.spotifyConnected;

  return (
    <main className={styles.shell}>
      <div className={styles.aurora} aria-hidden="true" />
      <div className={styles.gridGlow} aria-hidden="true" />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Vercel-ready Spotify portal</p>
          <h1>Log in with Spotify and turn your listening history into a live personal dashboard.</h1>
          <p className={styles.lead}>
            This site is designed to deploy cleanly on Vercel, use Spotify OAuth through NextAuth, and show real
            account data once the session is active.
          </p>

          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={!spotifyEnabled}
              onClick={() => {
                if (spotifyEnabled) {
                  signIn("spotify");
                }
              }}
            >
              Continue with Spotify
            </button>
            {status === "authenticated" ? (
              <button className={styles.secondaryButton} type="button" onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </button>
            ) : null}
          </div>

          <div className={styles.quickStats}>
            <div>
              <span>Auth</span>
              <strong>
                {isConnected ? "Spotify live" : spotifyEnabled ? "Waiting for login" : "Spotify setup pending"}
              </strong>
            </div>
            <div>
              <span>Stack</span>
              <strong>Next.js + NextAuth + Vercel</strong>
            </div>
            <div>
              <span>Scopes</span>
              <strong>Profile, playback, recents, top tracks</strong>
            </div>
          </div>
        </div>

        <aside className={styles.heroPanel}>
          <p className={styles.panelLabel}>After login</p>
          <div className={styles.heroPanelContent}>
            <div className={styles.statusPill}>{loading ? "Refreshing data" : isConnected ? "Connected" : "Demo mode"}</div>
            <h2>{overview?.profile.displayName || session?.user?.name || "Your Spotify identity appears here"}</h2>
            <p>
              {overview
                ? `${overview.profile.followers.toLocaleString()} followers, ${overview.profile.product || "free"} tier, ${
                    overview.profile.country || "global"
                  } profile.`
                : "Once you sign in, the dashboard pulls your profile, current playback, top tracks, and recent listening."}
            </p>
            <div className={styles.miniBoard}>
              <div>
                <span>Now playing</span>
                <strong>{overview?.currentTrack?.title || "Waiting for playback"}</strong>
              </div>
              <div>
                <span>Top pick</span>
                <strong>{highlight?.title || "Connect Spotify"}</strong>
              </div>
              <div>
                <span>Recent pulse</span>
                <strong>{overview?.recentPlays[0]?.title || "No listen data yet"}</strong>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.dashboard}>
        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Connection</p>
              <h3>Session status</h3>
            </div>
            <span className={styles.badge}>{status}</span>
          </div>
          <p className={styles.copy}>
            {status === "authenticated"
              ? isConnected
                ? "Spotify OAuth is active and the server can read your account safely."
                : "You are signed in, but this session is not linked to Spotify yet."
              : spotifyEnabled
                ? "Use the Spotify button above to create a live session."
                : "This deployment is live, but Spotify developer credentials have not been connected yet."}
          </p>
          {session?.spotifyError ? <p className={styles.errorBox}>Spotify token refresh issue: {session.spotifyError}</p> : null}
          <div className={styles.identityCard}>
            <div className={styles.avatar}>
              {overview?.profile.image || session?.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={overview?.profile.image || session?.user?.image || ""} alt="Profile" />
              ) : (
                <span>{(overview?.profile.displayName || session?.user?.name || "S").slice(0, 1)}</span>
              )}
            </div>
            <div>
              <strong>{overview?.profile.displayName || session?.user?.name || "Spotify listener"}</strong>
              <span>{overview?.profile.email || session?.user?.email || "No email loaded yet"}</span>
            </div>
          </div>
          {error ? <p className={styles.errorBox}>{error}</p> : null}
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Playback</p>
              <h3>Now playing</h3>
            </div>
            <span className={styles.badge}>{overview?.currentTrack?.isPlaying ? "Live" : "Idle"}</span>
          </div>
          {overview?.currentTrack ? (
            <div className={styles.trackFeature}>
              <div className={styles.trackArtwork}>
                {overview.currentTrack.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={overview.currentTrack.image} alt={overview.currentTrack.title} />
                ) : null}
              </div>
              <div className={styles.trackMeta}>
                <strong>{overview.currentTrack.title}</strong>
                <span>{overview.currentTrack.artists}</span>
                <span>{formatProgress(overview.currentTrack.progressMs, overview.currentTrack.durationMs)}</span>
                {overview.currentTrack.href ? (
                  <a href={overview.currentTrack.href} target="_blank" rel="noreferrer">
                    Open in Spotify
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <p className={styles.emptyState}>Nothing is playing right now, but the connection is ready.</p>
          )}
        </article>
      </section>

      <section className={styles.librarySection}>
        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Top tracks</p>
              <h3>Short-term favorites</h3>
            </div>
            <span className={styles.badge}>{overview?.topTracks.length || 0} loaded</span>
          </div>
          <div className={styles.trackList}>
            {(overview?.topTracks || []).map((track, index) => (
              <a key={track.id} href={track.href || "#"} className={styles.trackRow} target="_blank" rel="noreferrer">
                <span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span>
                <div className={styles.trackRowBody}>
                  <strong>{track.title}</strong>
                  <span>
                    {track.artists}
                    {track.album ? ` • ${track.album}` : ""}
                  </span>
                </div>
                <span className={styles.previewTag}>{track.previewUrl ? "Preview" : "Track"}</span>
              </a>
            ))}
            {!overview?.topTracks.length && !loading ? (
              <p className={styles.emptyState}>Your top tracks will appear here after a successful Spotify login.</p>
            ) : null}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Recent plays</p>
              <h3>Listening timeline</h3>
            </div>
            <span className={styles.badge}>{overview?.recentPlays.length || 0} events</span>
          </div>
          <div className={styles.recentGrid}>
            {(overview?.recentPlays || []).map((play) => (
              <a key={play.id} href={play.href || "#"} className={styles.recentCard} target="_blank" rel="noreferrer">
                <strong>{play.title}</strong>
                <span>{play.artists}</span>
                <span>{formatPlayedAt(play.playedAt)}</span>
              </a>
            ))}
            {!overview?.recentPlays.length && !loading ? (
              <p className={styles.emptyState}>Recent listening activity shows up here once Spotify returns data.</p>
            ) : null}
          </div>
        </article>
      </section>
    </main>
  );
}
