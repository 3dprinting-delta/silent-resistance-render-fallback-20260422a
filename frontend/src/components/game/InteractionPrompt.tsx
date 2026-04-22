"use client";

import type { InteractableDefinition, PhaseOneZone } from "@/game/core/types";
import { usePhaseOneStore } from "@/game/core/phaseOneStore";
import { describeZoneLegality } from "@/game/systems/phaseTwo/accessSystem";
import { distance2D } from "@/game/utils/math";

function severityTone(value: number) {
  if (value >= 70) return "danger";
  if (value >= 30) return "warn";
  return "calm";
}

function alertLabel(level: number) {
  if (level >= 3) return "lockdown";
  if (level >= 2) return "active search";
  if (level >= 1) return "heightened";
  return "stable";
}

function deriveFieldRead(params: {
  suspicion: number;
  accessState: string;
  watcherCount: number;
  alertLevel: number;
  targetWindowState: string;
  activeIncident: string | null;
}) {
  if (params.targetWindowState === "vulnerable" && params.alertLevel < 2) {
    return {
      eyebrow: "Opportunity",
      title: "Escort spacing is thin",
      copy: "This is the cleanest window to stage an authored move before the district hardens again.",
      tone: "status-opportunity",
    };
  }
  if (params.alertLevel >= 2 || params.suspicion >= 70 || params.watcherCount >= 2) {
    return {
      eyebrow: "Danger",
      title: "You are close to a visible compromise",
      copy: "Movement, posture, and interaction timing all need to tighten now or the floor will flip into search behavior.",
      tone: "status-danger",
    };
  }
  if (params.accessState !== "legal" || params.suspicion >= 30 || params.activeIncident) {
    return {
      eyebrow: "Exposure",
      title: "The room is reading you harder",
      copy: "Cover is still usable, but the space is beginning to resist casual mistakes.",
      tone: "status-warn",
    };
  }
  return {
    eyebrow: "Control",
    title: "Your cover still owns the tempo",
    copy: "This is a safe moment to probe routes, reposition, or prepare the next stealth beat.",
    tone: "status-calm",
  };
}

function actionRiskLabel(params: {
  interactable: InteractableDefinition | null;
  accessState: string;
  watcherCount: number;
  posture: string;
}) {
  const { interactable, accessState, watcherCount, posture } = params;
  if (!interactable) return { label: "movement only", tone: "status-muted" };
  if (accessState === "hard_restricted" || accessState === "enforcer_compromised") return { label: "illegal context", tone: "status-danger" };
  if (interactable.type === "sabotage" || interactable.type === "body") return { label: watcherCount ? "high risk action" : "risky action", tone: watcherCount ? "status-danger" : "status-warn" };
  if (watcherCount > 0 && posture !== "stand") return { label: "visible action", tone: "status-warn" };
  return { label: "low profile", tone: "status-calm" };
}

export default function InteractionPrompt({
  zone,
  interactable,
  prompt,
}: {
  zone: PhaseOneZone | null;
  interactable: InteractableDefinition | null;
  prompt: string;
}) {
  const suspicion = usePhaseOneStore((state) => state.suspicion);
  const activeWatcherIds = usePhaseOneStore((state) => state.activeWatcherIds);
  const posture = usePhaseOneStore((state) => state.posture);
  const accessState = usePhaseOneStore((state) => state.accessState);
  const lastStealthEvents = usePhaseOneStore((state) => state.lastStealthEvents);
  const globalAlertLevel = usePhaseOneStore((state) => state.globalAlertLevel);
  const targetWindowState = usePhaseOneStore((state) => state.targetWindowState);
  const aiActors = usePhaseOneStore((state) => state.aiActors);
  const playerPosition = usePhaseOneStore((state) => state.playerPosition);
  const activeIncidents = usePhaseOneStore((state) => state.activeIncidents);
  const dangerZones = usePhaseOneStore((state) => state.dangerZones);

  const enforcerWarning = lastStealthEvents.find((event) => event.text.toLowerCase().includes("enforcer"));
  const challengers = aiActors.filter(
    (actor) =>
      (actor.role === "guard" || actor.role === "bodyguard") &&
      (actor.state === "investigating" || actor.state === "alerted" || actor.state === "searching") &&
      distance2D(actor.position, playerPosition) < 10,
  );
  const nearbyDanger = dangerZones.some((dangerZone) => distance2D(dangerZone.center, playerPosition) < dangerZone.radius + 1);
  const activeIncident = activeIncidents[0];
  const suspicionTone = severityTone(suspicion);
  const trespassTone = accessState === "legal" ? "calm" : accessState === "soft_restricted" ? "warn" : "danger";
  const alertTone = severityTone(globalAlertLevel * 30);
  const actionRisk = actionRiskLabel({ interactable, accessState, watcherCount: activeWatcherIds.length, posture });
  const fieldRead = deriveFieldRead({
    suspicion,
    accessState,
    watcherCount: activeWatcherIds.length,
    alertLevel: globalAlertLevel,
    targetWindowState,
    activeIncident: activeIncident?.category || null,
  });

  return (
    <>
      <div className="pointer-events-none absolute right-4 top-4 z-20 flex max-w-[320px] flex-wrap justify-end gap-2">
        <div className="rounded-full border border-white/10 bg-black/65 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-neutral-200">
          {zone?.label || "Transit Route"}
        </div>
        <div className={`rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.24em] ${trespassTone === "calm" ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200" : trespassTone === "warn" ? "border-amber-400/25 bg-amber-500/10 text-amber-200" : "border-red-400/25 bg-red-500/10 text-red-200"}`}>
          {describeZoneLegality(zone, accessState)}
        </div>
        <div className={`rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.24em] ${alertTone === "danger" ? "border-red-400/25 bg-red-500/10 text-red-200" : alertTone === "warn" ? "border-amber-400/25 bg-amber-500/10 text-amber-200" : "border-white/10 bg-black/55 text-neutral-200"}`}>
          Alert {alertLabel(globalAlertLevel)}
        </div>
        <div className={`rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.24em] ${suspicionTone === "danger" ? "border-red-400/25 bg-red-500/10 text-red-200" : suspicionTone === "warn" ? "border-amber-400/25 bg-amber-500/10 text-amber-200" : "border-white/10 bg-black/55 text-neutral-200"}`}>
          Suspicion {Math.round(suspicion)}
        </div>
        <div className={`rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.24em] ${fieldRead.tone === "status-danger" ? "border-red-400/25 bg-red-500/10 text-red-200" : fieldRead.tone === "status-warn" ? "border-amber-400/25 bg-amber-500/10 text-amber-200" : fieldRead.tone === "status-opportunity" ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-black/55 text-neutral-200"}`}>
          {fieldRead.eyebrow}
        </div>
        {targetWindowState === "vulnerable" ? (
          <div className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-emerald-200">
            Target Window Open
          </div>
        ) : null}
        {activeWatcherIds.length ? (
          <div className="rounded-full border border-red-400/25 bg-red-500/10 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-red-200">
            {activeWatcherIds.length} watcher{activeWatcherIds.length > 1 ? "s" : ""}
          </div>
        ) : null}
        {challengers.length ? (
          <div className="rounded-full border border-red-400/25 bg-red-500/10 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-red-200">
            responders close
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex justify-center">
        <div className="w-full max-w-[560px]">
          {interactable ? (
            <div className="mx-auto flex items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-black/72 px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.32)] backdrop-blur">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-500">Action</div>
                <div className="mt-1 truncate text-sm font-medium text-neutral-50">{interactable.label}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <span className={`status-chip ${actionRisk.tone}`}>{actionRisk.label}</span>
                  <span className="status-chip status-muted">{interactable.type.replaceAll("_", " ")}</span>
                  {enforcerWarning ? <span className="status-chip status-danger">enforcer</span> : null}
                  {activeIncident ? <span className="status-chip status-warn">{activeIncident.category}</span> : null}
                  {nearbyDanger ? <span className="status-chip status-warn">danger zone</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="keycap">E</span>
                {interactable.type === "body" ? <span className="keycap keycap-secondary">F</span> : null}
              </div>
            </div>
          ) : prompt ? (
            <div className="mx-auto max-w-[360px] rounded-full border border-white/10 bg-black/68 px-4 py-2 text-center text-[11px] uppercase tracking-[0.24em] text-neutral-300 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur">
              {prompt}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
