import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerBackendBaseUrl } from "@/lib/backendUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBackendBaseUrl() {
  return getServerBackendBaseUrl();
}

function getLinkSecret() {
  return process.env.ACCOUNT_LINK_SECRET || process.env.NEXTAUTH_SECRET || "silent-resistance-account-link-secret";
}

async function fetchBackend(pathname: string, options?: RequestInit) {
  const response = await fetch(`${getBackendBaseUrl()}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-account-link-secret": getLinkSecret(),
      ...(options?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Backend request failed with status ${response.status}`);
  }

  return response.json();
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: true, profile: null });
  }

  try {
    const payload = await fetchBackend(`/api/cloud/profile/${session.user.id}`);
    const currentProfile = payload.profile || null;
    if (currentProfile) {
      const updated = await fetchBackend(`/api/cloud/profile/${session.user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          lastVisitedAt: Date.now(),
          visitCount: (currentProfile.visitCount || 0) + 1,
          stats: {
            ...(currentProfile.stats || {}),
            returningUsers: (currentProfile.visitCount || 0) > 0 ? (currentProfile.stats?.returningUsers || 0) + 1 : (currentProfile.stats?.returningUsers || 0),
          },
        }),
      });
      return NextResponse.json(updated);
    }
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cloud profile unavailable." },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();

  try {
    let nextIdentityToken = null;
    if (body.identityToken) {
      const linkPayload = await fetchBackend("/api/identity/link", {
        method: "POST",
        body: JSON.stringify({
          accountId: session.user.id,
          provider: "nextauth",
          identityToken: body.identityToken,
        }),
      });
      nextIdentityToken = linkPayload.identityToken || null;
    }

    const profilePayload = await fetchBackend(`/api/cloud/profile/${session.user.id}`, {
      method: "PUT",
      body: JSON.stringify({
        linkedPlayerIds: body.playerId ? [body.playerId] : [],
        recentHighlights: body.recentHighlights || [],
        legendMoments: body.legendMoments || [],
        lastChallengePayload: body.lastChallengePayload || null,
        progressionSummary: body.progressionSummary || null,
      }),
    });

    return NextResponse.json({
      ...profilePayload,
      identityToken: nextIdentityToken,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cloud profile update failed." },
      { status: 502 },
    );
  }
}
