import type { LaunchAnalyticsEvent } from "@/game/ragdollArchers/analytics/analyticsTypes";

export function trackAnalyticsEvent(event: LaunchAnalyticsEvent) {
  if (process.env.NODE_ENV !== "production") {
    console.debug("[ragdoll-archers analytics]", event.type, event.payload || {});
  }
}
