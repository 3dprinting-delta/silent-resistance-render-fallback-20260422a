import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { applyEliminations, catchUpWorldState, createInitialWorldState, serializeWorldState } from "@/lib/simulation/worldState";
import { readEliminatedTargets, writeEliminatedTargets } from "@/lib/simulation/cookieState";
import { hasSharedStoreConfig, loadWorldState, saveWorldState } from "@/lib/simulation/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function shouldUseCookieFallback() {
  return Boolean(process.env.VERCEL) && !hasSharedStoreConfig();
}

export async function GET() {
  const cookieStore = cookies();
  const eliminatedTargets = readEliminatedTargets(cookieStore);
  const useCookies = shouldUseCookieFallback();

  const worldState = useCookies
    ? applyEliminations(createInitialWorldState(), eliminatedTargets)
    : await loadWorldState();

  const nextState = catchUpWorldState(worldState);
  if (!useCookies) {
    await saveWorldState(nextState);
  }

  const response = NextResponse.json(serializeWorldState(nextState), {
    headers: {
      "Cache-Control": "no-store",
    },
  });

  if (useCookies) {
    writeEliminatedTargets(response, eliminatedTargets);
  }

  return response;
}
