import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  applyEliminations,
  catchUpWorldState,
  createInitialWorldState,
  eliminateTarget,
  serializeWorldState,
} from "@/lib/simulation/worldState";
import { readEliminatedTargets, writeEliminatedTargets } from "@/lib/simulation/cookieState";
import { hasSharedStoreConfig, loadWorldState, saveWorldState } from "@/lib/simulation/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function shouldUseCookieFallback() {
  return Boolean(process.env.VERCEL) && !hasSharedStoreConfig();
}

export async function POST(_request, { params }) {
  const cookieStore = cookies();
  const eliminatedTargets = readEliminatedTargets(cookieStore);
  const useCookies = shouldUseCookieFallback();
  const baseState = useCookies
    ? applyEliminations(createInitialWorldState(), eliminatedTargets)
    : await loadWorldState();
  const worldState = catchUpWorldState(baseState);
  const updatedState = eliminateTarget(worldState, params.targetId);

  if (!updatedState) {
    return NextResponse.json({ error: "Target not found." }, { status: 404 });
  }

  const nextEliminatedTargets = Array.from(new Set([...eliminatedTargets, params.targetId]));
  if (!useCookies) {
    await saveWorldState(updatedState);
  }

  const response = NextResponse.json(serializeWorldState(updatedState), {
    headers: {
      "Cache-Control": "no-store",
    },
  });

  if (useCookies) {
    writeEliminatedTargets(response, nextEliminatedTargets);
  }

  return response;
}
