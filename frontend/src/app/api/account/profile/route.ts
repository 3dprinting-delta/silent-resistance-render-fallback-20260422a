import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { MatchHistoryEntry, PersistedPlayerProfile, SupplyStack } from "@/game/ragdollArchers/core/types";

function mapProfile(profile: Awaited<ReturnType<typeof prisma.gameProfile.findUnique>>, email: string | null | undefined): PersistedPlayerProfile | null {
  if (!profile) return null;
  const inventory = JSON.parse(profile.inventoryJson || "[]") as SupplyStack[];
  const selectedLoadout = JSON.parse(profile.selectedLoadout || "[]") as string[];
  const unlockedCosmetics = JSON.parse(profile.unlockedCosmetics || "[]") as string[];
  const recentMatches = JSON.parse(profile.recentMatchesJson || "[]") as MatchHistoryEntry[];
  const challengeCompletions = JSON.parse(profile.challengeCompletionsJson || "[]") as string[];
  const banners = JSON.parse(profile.bannersJson || "[]") as string[];
  const titles = JSON.parse(profile.titlesJson || "[]") as string[];
  const cosmeticTags = JSON.parse(profile.cosmeticTagsJson || "[]") as string[];
  return {
    id: profile.id,
    email: email || "",
    displayName: profile.displayName,
    settingsJson: profile.settingsJson,
    inventory,
    recentMatches,
    challengeCompletions,
    banners,
    titles,
    cosmeticTags,
    stats: {
      matchesPlayed: profile.matchesPlayed,
      wins: profile.wins,
      losses: profile.losses,
      level: profile.level,
      xp: profile.xp,
      unlockedCosmetics,
      selectedLoadout,
      injuryCount: profile.injuryCount,
      deaths: profile.deaths,
      accuracy: profile.shotsFired ? profile.shotsHit / profile.shotsFired : 0,
      shotsFired: profile.shotsFired,
      shotsHit: profile.shotsHit,
      survivalTimeSeconds: profile.survivalTime,
      bestSurvivalTimeSeconds: profile.bestSurvivalTime,
      mostCommonCauseOfDeath: profile.mostCommonCauseOfDeath,
      treatmentsUsed: profile.treatmentsUsed,
      successfulStabilizations: profile.successfulStabilizations,
      criticalInjuriesSurvived: profile.criticalInjuriesSurvived,
      duelMatchesPlayed: recentMatches.filter((match) => match.gameMode === "duel").length,
      firstPersonMatchesPlayed: recentMatches.filter((match) => match.gameMode === "firstperson").length,
      duelWins: recentMatches.filter((match) => match.gameMode === "duel" && match.success).length,
      firstPersonWins: recentMatches.filter((match) => match.gameMode === "firstperson" && match.success).length,
    },
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ profile: null }, { status: 200 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { gameProfile: true },
  });

  return NextResponse.json({
    profile: mapProfile(user?.gameProfile || null, user?.email),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const profile = await prisma.gameProfile.update({
    where: { userId: session.user.id },
    data: {
      settingsJson: body.settingsJson,
      inventoryJson: JSON.stringify(body.inventory || []),
      selectedLoadout: JSON.stringify(body.selectedLoadout || []),
      unlockedCosmetics: JSON.stringify(body.unlockedCosmetics || []),
      recentMatchesJson: JSON.stringify(body.recentMatches || []),
      challengeCompletionsJson: JSON.stringify(body.challengeCompletions || []),
      bannersJson: JSON.stringify(body.banners || []),
      titlesJson: JSON.stringify(body.titles || []),
      cosmeticTagsJson: JSON.stringify(body.cosmeticTags || []),
      matchesPlayed: body.stats?.matchesPlayed,
      wins: body.stats?.wins,
      losses: body.stats?.losses,
      level: body.stats?.level,
      xp: body.stats?.xp,
      injuryCount: body.stats?.injuryCount,
      deaths: body.stats?.deaths,
      shotsFired: body.stats?.shotsFired ?? 0,
      shotsHit: body.stats?.shotsHit ?? 0,
      survivalTime: body.stats?.survivalTimeSeconds ?? 0,
      bestSurvivalTime: body.stats?.bestSurvivalTimeSeconds,
      mostCommonCauseOfDeath: body.stats?.mostCommonCauseOfDeath,
      treatmentsUsed: body.stats?.treatmentsUsed,
      successfulStabilizations: body.stats?.successfulStabilizations,
      criticalInjuriesSurvived: body.stats?.criticalInjuriesSurvived,
    },
  });

  return NextResponse.json({ ok: true, profile });
}
