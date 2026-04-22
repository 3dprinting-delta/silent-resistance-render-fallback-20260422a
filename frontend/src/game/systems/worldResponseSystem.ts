import type { IncidentRecord, MissionPressureState } from "@/game/core/types";

export function summarizeWorldResponse(pressure: MissionPressureState, incidents: IncidentRecord[]) {
  if (!incidents.length) {
    return "No dominant incident owns the district. Local security is still relying on baseline posture.";
  }

  const leadIncident = incidents[0];
  const posture =
    pressure.targetProtection === "fallback"
      ? "The target detail is in fallback protection."
      : pressure.targetProtection === "tightened"
        ? "The target detail is tightening around live pressure."
        : "The target detail is still running the scheduled pattern.";

  return `${leadIncident.category} pressure is leading the response in ${leadIncident.zoneClusterId}. ${posture}`;
}
