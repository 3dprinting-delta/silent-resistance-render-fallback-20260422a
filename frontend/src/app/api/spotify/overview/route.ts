import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

type SpotifyTopTracksResponse = {
  items: Array<{
    id: string;
    name: string;
    external_urls?: { spotify?: string };
    preview_url?: string | null;
    album?: {
      images?: Array<{ url: string }>;
      name?: string;
    };
    artists?: Array<{ id: string; name: string }>;
  }>;
};

type SpotifyRecentResponse = {
  items: Array<{
    played_at: string;
    track: {
      id: string;
      name: string;
      external_urls?: { spotify?: string };
      album?: {
        images?: Array<{ url: string }>;
      };
      artists?: Array<{ id: string; name: string }>;
    };
  }>;
};

type SpotifyProfileResponse = {
  display_name?: string;
  email?: string;
  country?: string;
  product?: string;
  followers?: { total?: number };
  images?: Array<{ url: string }>;
};

type SpotifyCurrentTrackResponse = {
  is_playing?: boolean;
  item?: {
    id: string;
    name: string;
    external_urls?: { spotify?: string };
    duration_ms?: number;
    album?: {
      images?: Array<{ url: string }>;
    };
    artists?: Array<{ id: string; name: string }>;
  };
  progress_ms?: number;
};

function formatArtists(artists?: Array<{ name: string }>) {
  return (artists || []).map((artist) => artist.name).join(", ");
}

async function spotifyFetch<T>(accessToken: string, path: string) {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Spotify request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function GET(request: Request) {
  const token = await getToken({
    req: {
      headers: Object.fromEntries(new Headers(request.headers).entries()),
      cookies: Object.fromEntries(
        (request.headers.get("cookie") || "")
          .split(/; */)
          .filter(Boolean)
          .map((item) => {
            const index = item.indexOf("=");
            const key = index >= 0 ? item.slice(0, index) : item;
            const value = index >= 0 ? item.slice(index + 1) : "";
            return [key, value];
          }),
      ),
    } as never,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const accessToken = token?.spotifyAccessToken;
  const tokenName = typeof token?.name === "string" ? token.name : null;
  const tokenEmail = typeof token?.email === "string" ? token.email : null;
  const tokenPicture = typeof token?.picture === "string" ? token.picture : null;

  if (!(typeof accessToken === "string" && accessToken.length > 0)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [profile, topTracks, recentPlays, currentTrack] = await Promise.all([
      spotifyFetch<SpotifyProfileResponse>(accessToken, "/me"),
      spotifyFetch<SpotifyTopTracksResponse>(accessToken, "/me/top/tracks?limit=6&time_range=short_term"),
      spotifyFetch<SpotifyRecentResponse>(accessToken, "/me/player/recently-played?limit=8"),
      spotifyFetch<SpotifyCurrentTrackResponse>(accessToken, "/me/player/currently-playing"),
    ]);

    return NextResponse.json({
      profile: {
        displayName: profile?.display_name || tokenName || "Spotify listener",
        email: profile?.email || tokenEmail || null,
        country: profile?.country || null,
        product: profile?.product || null,
        followers: profile?.followers?.total || 0,
        image: profile?.images?.[0]?.url || tokenPicture,
      },
      currentTrack: currentTrack?.item
        ? {
            title: currentTrack.item.name,
            artists: formatArtists(currentTrack.item.artists),
            image: currentTrack.item.album?.images?.[0]?.url || null,
            href: currentTrack.item.external_urls?.spotify || null,
            isPlaying: currentTrack.is_playing === true,
            progressMs: currentTrack.progress_ms || 0,
            durationMs: currentTrack.item.duration_ms || 0,
          }
        : null,
      topTracks: (topTracks?.items || []).map((track) => ({
        id: track.id,
        title: track.name,
        artists: formatArtists(track.artists),
        image: track.album?.images?.[0]?.url || null,
        href: track.external_urls?.spotify || null,
        previewUrl: track.preview_url || null,
        album: track.album?.name || null,
      })),
      recentPlays: (recentPlays?.items || []).map((item) => ({
        id: `${item.track.id}-${item.played_at}`,
        title: item.track.name,
        artists: formatArtists(item.track.artists),
        image: item.track.album?.images?.[0]?.url || null,
        href: item.track.external_urls?.spotify || null,
        playedAt: item.played_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Spotify overview failed.",
      },
      { status: 500 },
    );
  }
}
