import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  applyEliminations,
  catchUpWorldState,
  createInitialWorldState,
  resolveMissionOutcome,
  serializeWorldState,
} from "@/lib/simulation/worldState";
import { readEliminatedTargets, writeEliminatedTargets } from "@/lib/simulation/cookieState";
import { hasSharedStoreConfig, loadWorldState, saveWorldState } from "@/lib/simulation/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function shouldUseCookieFallback() {
  return Boolean(process.env.VERCEL) && !hasSharedStoreConfig();
}

export async function POST(request) {
  const payload = await request.json();
  const cookieStore = cookies();
  const eliminatedTargets = readEliminatedTargets(cookieStore);
  const useCookies = shouldUseCookieFallback();
  const baseState = useCookies
    ? applyEliminations(createInitialWorldState(), eliminatedTargets)
    : await loadWorldState();
  const worldState = catchUpWorldState(baseState);
  const updatedState = resolveMissionOutcome(worldState, payload);

  if (!updatedState) {
    return NextResponse.json({ error: "Mission outcome could not be resolved." }, { status: 404 });
  }

  if (!useCookies) {
    await saveWorldState(updatedState);
  }

  const nextEliminatedTargets = Array.from(new Set([...eliminatedTargets, payload.targetId]));
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
