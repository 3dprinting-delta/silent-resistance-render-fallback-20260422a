"use client";

import { trackShareEvent } from "@/lib/shareApi";

function getVisitorId() {
  if (typeof window === "undefined") return "server";
  const key = "silent-resistance-share-visitor";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `visitor-${Date.now()}`;
  window.localStorage.setItem(key, created);
  return created;
}

export default function ShareLaunchButtons(params: {
  shareId: string;
  challengeCode?: string | null;
  accountId?: string | null;
}) {
  const directHref = `/?share=${params.shareId}${params.challengeCode ? `&challenge=${encodeURIComponent(params.challengeCode)}` : ""}`;

  function trackLaunch() {
    void trackShareEvent(params.shareId, {
      type: "launch",
      visitorId: getVisitorId(),
      accountId: params.accountId || null,
    }).catch(() => undefined);
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <a
        href="#launch-shell"
        onClick={trackLaunch}
        className="rounded-full border border-red-300/30 bg-red-400/10 px-5 py-3 text-sm font-medium text-red-100 transition hover:border-red-200/50 hover:bg-red-400/15"
      >
        Launch This Challenge
      </a>
      <a
        href={directHref}
        onClick={trackLaunch}
        className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-neutral-200 transition hover:border-white/20 hover:bg-white/10"
      >
        Open Directly In Game
      </a>
    </div>
  );
}
