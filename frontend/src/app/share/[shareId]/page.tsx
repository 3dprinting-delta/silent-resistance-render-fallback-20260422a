import dynamic from "next/dynamic";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicBackendBaseUrl } from "@/lib/backendUrl";
import { buildShareImageUrl, buildSharePageUrl, fetchStoredShare, resolveShareSiteBase } from "@/lib/shareApi";
import { buildChallengePrompt, buildReplayIntro, buildShareDescription, buildShareHookLine } from "@/lib/sharePresentation";
import ShareLaunchButtons from "@/components/game/ShareLaunchButtons";

const GameShell = dynamic(() => import("@/components/game/GameShell"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="rounded-[32px] border border-white/8 bg-black/20 p-6 text-sm text-neutral-500">
        Loading interactive challenge shell...
      </div>
    </div>
  ),
});

async function loadShare(shareId: string) {
  try {
    const payload = await fetchStoredShare(shareId, { next: { revalidate: 0 } });
    return payload.share;
  } catch {
    return null;
  }
}

function resolveMediaUrl(relativeUrl: string | null | undefined) {
  if (!relativeUrl) return null;
  if (relativeUrl.startsWith("http")) return relativeUrl;
  const base = getPublicBackendBaseUrl();
  return base ? `${base}${relativeUrl}` : relativeUrl;
}

export async function generateMetadata({ params }: { params: Promise<{ shareId: string }> }): Promise<Metadata> {
  const { shareId } = await params;
  const shareSiteBase = resolveShareSiteBase();
  if (shareSiteBase) {
    return {
      title: "Shared Operation | The Silent Resistance",
      description: "A shared challenge run from The Silent Resistance.",
      openGraph: {
        title: "Shared Operation | The Silent Resistance",
        description: "A shared challenge run from The Silent Resistance.",
        url: buildSharePageUrl(shareId),
        images: [buildShareImageUrl(shareId)],
      },
      twitter: {
        card: "summary_large_image",
        title: "Shared Operation | The Silent Resistance",
        description: "A shared challenge run from The Silent Resistance.",
        images: [buildShareImageUrl(shareId)],
      },
    };
  }
  const share = await loadShare(shareId);
  if (!share) {
    return {
      title: "Shared Operation | The Silent Resistance",
      description: "A shared challenge run from The Silent Resistance.",
    };
  }

  return {
    title: `${share.headline} | The Silent Resistance`,
    description: buildShareDescription(share),
    openGraph: {
      title: `${buildShareHookLine(share)} ${share.headline}`,
      description: buildShareDescription(share),
      images: [`/share/${shareId}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      title: `${buildShareHookLine(share)} ${share.headline}`,
      description: buildShareDescription(share),
      images: [`/share/${shareId}/opengraph-image`],
    },
  };
}

export default async function SharedRunPage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const shareSiteBase = resolveShareSiteBase();
  if (shareSiteBase) {
    redirect(buildSharePageUrl(shareId));
  }
  const share = await loadShare(shareId);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-[36px] border border-red-400/20 bg-[radial-gradient(circle_at_top,_rgba(177,31,31,0.16),_transparent_28%),linear-gradient(180deg,rgba(21,8,8,0.96),rgba(10,10,10,0.92))] p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.28em] text-red-200/70">Shared Challenge</p>
          <h1 className="mt-3 max-w-4xl text-3xl font-semibold text-neutral-50 md:text-5xl">
            {share ? `${buildShareHookLine(share)} ${share.headline}` : "Shared Operation"}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-300 md:text-base">
            {share ? buildShareDescription(share) : "A public challenge run from The Silent Resistance."}
          </p>
          {share ? (
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/8 bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-neutral-500">Why Click</div>
                <div className="mt-2 text-sm leading-6 text-neutral-200">{share.campaignImpact || share.consequenceLine}</div>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-neutral-500">Try This</div>
                <div className="mt-2 text-sm leading-6 text-neutral-200">{buildChallengePrompt(share)}</div>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-black/25 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-neutral-500">Replay Intro</div>
                <div className="mt-2 text-sm leading-6 text-neutral-200">{buildReplayIntro(share)}</div>
              </div>
            </div>
          ) : null}
          {share?.media?.imageUrl || share?.media?.clipUrl ? (
            <div className="mt-6 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
              {share.media?.imageUrl ? (
                <img
                  src={resolveMediaUrl(share.media.imageUrl) || undefined}
                  alt={share.headline}
                  className="w-full rounded-[28px] border border-white/10 object-cover shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
                />
              ) : (
                <div className="rounded-[28px] border border-white/8 bg-black/20 p-6 text-sm text-neutral-500">
                  Hosted share art will appear here when media capture completes.
                </div>
              )}
              <div className="rounded-[28px] border border-white/8 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-neutral-500">Replay As Content</div>
                <div className="mt-3 text-sm leading-6 text-neutral-200">{buildReplayIntro(share)}</div>
                {share.media?.clipUrl ? (
                  <video
                    className="mt-4 w-full rounded-[22px] border border-white/8"
                    src={resolveMediaUrl(share.media.clipUrl) || undefined}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="mt-4 rounded-[22px] border border-white/8 bg-black/25 p-4 text-sm text-neutral-500">
                    Hosted clip capture is best-effort. If the browser could not record one, the image card still carries the moment.
                  </div>
                )}
              </div>
            </div>
          ) : null}
          {share ? <ShareLaunchButtons shareId={shareId} challengeCode={share.challenge?.payloadCode || null} accountId={share.ownerAccountId} /> : null}
        </div>
      </section>
      <section id="launch-shell">
      <GameShell initialShareId={shareId} initialShareRecord={share} />
      </section>
    </main>
  );
}
