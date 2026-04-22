import { redirect } from "next/navigation";
import { ImageResponse } from "next/og";
import { buildShareImageUrl, fetchStoredShare, resolveShareSiteBase } from "@/lib/shareApi";
import { buildChallengePrompt, buildShareHookLine } from "@/lib/sharePresentation";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

async function loadShare(shareId: string) {
  try {
    const payload = await fetchStoredShare(shareId, { next: { revalidate: 0 } });
    return payload.share;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const shareSiteBase = resolveShareSiteBase();
  if (shareSiteBase) {
    redirect(buildShareImageUrl(shareId));
  }
  const share = await loadShare(shareId);
  const hook = share ? buildShareHookLine(share) : "Shared Operation";
  const challenge = share ? buildChallengePrompt(share) : "Take the challenge.";
  const impact = share?.campaignImpact || share?.consequenceLine || "A resistance operation worth replaying.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(circle at top, rgba(177,31,31,0.22), transparent 28%), linear-gradient(180deg, #140909 0%, #251213 56%, #090909 100%)",
          color: "white",
          padding: "42px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 18, letterSpacing: 4, color: "#d1a1a1", textTransform: "uppercase" }}>The Silent Resistance</div>
          <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.02, maxWidth: 1000 }}>{hook}</div>
          <div style={{ fontSize: 28, color: "#e5e5e5", maxWidth: 1020 }}>{share?.headline || "Archive-worthy run"}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 26, color: "#d9d9d9", maxWidth: 1040 }}>{impact}</div>
          <div style={{ fontSize: 22, color: "#9f9f9f", maxWidth: 1040 }}>{challenge}</div>
          <div style={{ display: "flex", gap: 16, color: "#f4b6b6", fontSize: 18 }}>
            <div>{share?.exportPayload?.missionTitle || "Shared challenge"}</div>
            <div>•</div>
            <div>{share?.topMoments?.[0]?.highlightCategory || "Archive-Worthy Incident"}</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
