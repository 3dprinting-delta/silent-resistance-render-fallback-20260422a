// Legacy operations console for the sandbox prototype path. The active mission shell is GameShell.tsx.
"use client";

import { challenges, missionMeta, opportunities, zones } from "@/game/data/mission";
import { useSandboxStore } from "@/game/core/store";
import StatBar from "@/components/ui/StatBar";

export default function OperationsConsole() {
  const world = useSandboxStore((state) => state.world);
  const suspicion = useSandboxStore((state) => state.suspicion);
  const alertTier = useSandboxStore((state) => state.alertTier);
  const missionPhase = useSandboxStore((state) => state.missionPhase);
  const disguise = useSandboxStore((state) => state.disguise);
  const activeZoneId = useSandboxStore((state) => state.activeZoneId);
  const activePrompt = useSandboxStore((state) => state.activePrompt);
  const inventory = useSandboxStore((state) => state.inventory);
  const opportunitiesState = useSandboxStore((state) => state.opportunities);
  const score = useSandboxStore((state) => state.score);
  const career = useSandboxStore((state) => state.career);
  const actors = useSandboxStore((state) => state.actors);
  const eventLog = useSandboxStore((state) => state.eventLog);
  const activeZone = zones.find((zone) => zone.id === activeZoneId);
  const target = world?.highCommand.find((entry) => entry.id === missionMeta.targetId) || world?.highCommand[0];
  const activeSearchers = actors.filter((actor) => actor.state === "investigating" || actor.state === "searching" || actor.state === "alert").length;

  return (
    <section className="flex h-full flex-col gap-4">
      <div className="panel-surface rounded-3xl p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-red-500">Mission Command</p>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="max-w-xl text-4xl font-semibold leading-none text-neutral-50">{missionMeta.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-400">{missionMeta.summary}</p>
          </div>
          <div className="rounded-full border border-neutral-800 bg-neutral-950/70 px-4 py-2 text-xs uppercase tracking-[0.25em] text-neutral-400">
            {world?.gameTime || "Syncing"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-surface rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-red-500">Priority Dossier</p>
              <h2 className="mt-2 text-2xl font-semibold text-neutral-100">{target?.name || missionMeta.targetName}</h2>
              <p className="mt-1 text-sm text-neutral-400">{target?.rank || "Industrial Discipline Chief"} | {target?.region || "Kronstadt District"}</p>
            </div>
            <div className="rounded-2xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-right text-xs uppercase tracking-[0.25em] text-neutral-300">
              <div>Phase</div>
              <div className="mt-2 text-sm text-red-300">{missionPhase}</div>
            </div>
          </div>
          <div className="mt-6 grid gap-4">
            <StatBar label="Suspicion" value={suspicion} tone="bg-red-700" />
            <StatBar label="District Alert" value={alertTier === "lockdown" ? 95 : alertTier === "compromised" ? 78 : alertTier === "investigating" ? 54 : alertTier === "suspicious" ? 30 : 12} tone="bg-amber-600" />
            <StatBar label="Mission Cleanliness" value={Math.max(0, 100 - score.bodiesFound * 15 - score.witnessedActions * 10 - score.disguiseBreaks * 8)} tone="bg-emerald-600" />
          </div>
        </div>

        <div className="panel-surface rounded-3xl p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-red-500">Field State</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">Disguise</div>
              <div className="mt-2 text-sm text-neutral-200">{disguise}</div>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">Zone</div>
              <div className="mt-2 text-sm text-neutral-200">{activeZone?.label || "Transit"}</div>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">Inventory</div>
              <div className="mt-2 text-sm text-neutral-200">Poison {inventory.poison ? "ready" : "spent"} | Coins {inventory.coins} | {inventory.wrench ? "Wrench" : "No wrench"}</div>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">Prompt</div>
              <div className="mt-2 text-sm text-neutral-200">{activePrompt}</div>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 sm:col-span-2">
              <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">Reaction pressure</div>
              <div className="mt-2 text-sm text-neutral-200">{activeSearchers} guards or staff are currently investigating or searching.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="panel-surface hud-scroll rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-red-500">Opportunity Routes</p>
            <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">{opportunities.length} routes</span>
          </div>
          <div className="mt-4 grid gap-3">
            {opportunities.map((opportunity) => {
              const complete =
                (opportunity.solution === "poison" && opportunitiesState.solution === "poison") ||
                (opportunity.solution === "social" && opportunitiesState.solution === "social") ||
                (opportunity.solution === "environmental" && opportunitiesState.solution === "environmental");
              const primed =
                (opportunity.id === "poison-cup" && opportunitiesState.poisonPrepared) ||
                (opportunity.id === "transformer-sabotage" && opportunitiesState.transformerSabotaged);
              return (
                <article key={opportunity.id} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-medium text-neutral-100">{opportunity.label}</h3>
                      <p className="mt-2 text-sm leading-6 text-neutral-400">{opportunity.prompt}</p>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.25em] ${complete ? "bg-emerald-900/60 text-emerald-300" : primed ? "bg-amber-900/60 text-amber-300" : "bg-neutral-900 text-neutral-500"}`}>
                      {complete ? "completed" : primed ? "primed" : "locked"}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="panel-surface rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-red-500">Intercepted Traffic</p>
              <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">{world?.newsFeed.length || 0} entries</span>
            </div>
            <div className="mt-4 grid gap-3">
              {(world?.newsFeed || []).slice(0, 5).map((item) => (
                <article key={item.id} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.24em] text-neutral-500">
                    <span>{item.type}</span>
                    <span>{item.timestamp}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-neutral-300">{item.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel-surface rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-red-500">Career Record</p>
              <div className="mt-4 space-y-3 text-sm text-neutral-300">
                <div>Best rating: <span className="text-neutral-100">{career.bestRating}</span></div>
                <div>Best score: <span className="text-neutral-100">{career.bestScore}</span></div>
                <div>Total runs: <span className="text-neutral-100">{career.totalRuns}</span></div>
                <div>Solutions found: <span className="text-neutral-100">{career.discoveredSolutions.join(", ") || "None"}</span></div>
                <div>Completed challenges: <span className="text-neutral-100">{career.completedChallenges.length}</span></div>
              </div>
            </div>
            <div className="panel-surface rounded-3xl p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-red-500">Replay Challenges</p>
              <div className="mt-4 grid gap-3">
                {challenges.map((challenge) => (
                  <div key={challenge.id} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                    <div className="text-sm font-medium text-neutral-100">{challenge.label}</div>
                    <p className="mt-2 text-xs leading-5 text-neutral-400">{challenge.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel-surface rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-red-500">Mission Event Log</p>
              <span className="text-xs uppercase tracking-[0.2em] text-neutral-500">{eventLog.length} live events</span>
            </div>
            <div className="mt-4 grid gap-3">
              {eventLog.map((event) => (
                <article key={event.id} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.24em]">
                    <span className={event.severity === "critical" ? "text-red-400" : event.severity === "warning" ? "text-amber-300" : "text-neutral-500"}>
                      {event.severity}
                    </span>
                    <span className="text-neutral-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-neutral-300">{event.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
