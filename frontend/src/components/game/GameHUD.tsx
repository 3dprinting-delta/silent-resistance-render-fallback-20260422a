// Legacy HUD for the sandbox prototype path. The active HUD is InteractionPrompt.tsx + GameShell.tsx.
"use client";

import { missionMeta } from "@/game/data/mission";
import { useSandboxStore } from "@/game/core/store";

export default function GameHUD() {
  const cameraMode = useSandboxStore((state) => state.cameraMode);
  const setCameraMode = useSandboxStore((state) => state.setCameraMode);
  const disguise = useSandboxStore((state) => state.disguise);
  const inventory = useSandboxStore((state) => state.inventory);
  const activePrompt = useSandboxStore((state) => state.activePrompt);
  const opportunities = useSandboxStore((state) => state.opportunities);
  const missionPhase = useSandboxStore((state) => state.missionPhase);
  const useCoin = useSandboxStore((state) => state.useCoin);
  const playerPosition = useSandboxStore((state) => state.playerPosition);
  const score = useSandboxStore((state) => state.score);
  const activeZoneId = useSandboxStore((state) => state.activeZoneId);

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 p-4">
      <div className="panel-surface mx-auto grid max-w-6xl gap-4 rounded-3xl p-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <select className="rounded-2xl border border-neutral-800 bg-black/50 px-4 py-3 text-sm text-neutral-100" value={cameraMode} onChange={(event) => setCameraMode(event.target.value as "third_person" | "first_person")}>
              <option value="third_person">Third-person stealth</option>
              <option value="first_person">First-person immersion</option>
            </select>
            <div className="rounded-2xl border border-neutral-800 bg-black/50 px-4 py-3 text-sm text-neutral-100">
              Current disguise: {disguise}
            </div>
            <button
              className="rounded-2xl border border-neutral-800 bg-neutral-950/80 px-4 py-3 text-sm text-neutral-100 disabled:text-neutral-500"
              disabled={inventory.coins <= 0}
              onClick={() => useCoin([playerPosition[0] + 4, 1, playerPosition[2] - 4])}
            >
              Toss coin ({inventory.coins})
            </button>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4 text-sm leading-6 text-neutral-300">{activePrompt}</div>
          <div className="rounded-2xl border border-neutral-800 bg-black/30 p-4 text-xs uppercase tracking-[0.22em] text-neutral-400">
            E interacts with the nearest context object. Q throws a coin distraction. Active zone: {activeZoneId}.
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">Objective</div>
            <div className="mt-2 text-sm text-neutral-100">{missionMeta.targetName}</div>
            <div className="mt-2 text-xs text-neutral-400">{missionPhase}</div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">Routes</div>
            <div className="mt-2 text-xs leading-6 text-neutral-300">
              Social {opportunities.solution === "social" ? "complete" : "live"} · Poison {opportunities.poisonPrepared ? "primed" : "available"} · Environmental {opportunities.transformerSabotaged ? "primed" : "available"}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4">
            <div className="text-[11px] uppercase tracking-[0.25em] text-neutral-500">Score State</div>
            <div className="mt-2 text-xs leading-6 text-neutral-300">
              Peak suspicion {score.suspicionPeak} · Witnesses {score.witnessedActions} · Bodies {score.bodiesFound}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
