import { PLAYER_ID, arrowTuning } from "@/game/ragdollArchers/core/constants";
import { useRagdollArchersStore } from "@/game/ragdollArchers/core/store";
import { getArenaConfig } from "@/game/ragdollArchers/arenas/arenaCatalog";
import type { ArenaConfig, ArrowSpawnPayload, ArrowType, DamageEvent, GameModeId, HitBodyPart, HitPayload, HitResolutionPayload, LimbName, MatchSettings } from "@/game/ragdollArchers/core/types";
import { createInjuryFromHit } from "@/game/ragdollArchers/systems/survival";

export interface ActorDescriptor {
  id: string;
  name: string;
  isPlayer: boolean;
  color: string;
  spawn: [number, number, number];
  team: "player" | "enemy";
  actorIndex: number;
}

export interface FoundationMatchDefinition {
  arenaConfig: ArenaConfig;
  descriptors: ActorDescriptor[];
}

export interface MatchRuntimeDefinition extends FoundationMatchDefinition {
  settings: MatchSettings;
}

export function createFoundationMatch(params: { arenaId: ArenaConfig["id"]; enemyCount?: number }): FoundationMatchDefinition {
  const arenaConfig = getArenaConfig(params.arenaId);
  const enemyCount = params.enemyCount ?? 1;
  const descriptors: ActorDescriptor[] = [
    {
      id: PLAYER_ID,
      name: "Field Archer",
      isPlayer: true,
      color: "#d07c53",
      spawn: arenaConfig.spawnPoints.player,
      team: "player",
      actorIndex: 0,
    },
  ];

  for (let index = 0; index < enemyCount; index += 1) {
    descriptors.push({
      id: `enemy-${index}`,
      name: enemyCount === 1 ? "Duelist" : `Raider ${index + 1}`,
      isPlayer: false,
      color: index % 2 === 0 ? "#6e8e9b" : "#a55b47",
      spawn: arenaConfig.spawnPoints.enemies[index],
      team: "enemy",
      actorIndex: index,
    });
  }

  return { arenaConfig, descriptors };
}

export function createMatchRuntime(params: { settings: MatchSettings; controllerFactory?: unknown; arenaConfig?: ArenaConfig }): MatchRuntimeDefinition {
  const arenaConfig = params.arenaConfig || getArenaConfig(params.settings.arenaId);
  const enemyCount: Record<GameModeId, number> = {
    duel: 1,
    firstperson: 4,
  };

  const foundation = createFoundationMatch({
    arenaId: arenaConfig.id,
    enemyCount: enemyCount[params.settings.mode],
  });

  return {
    settings: params.settings,
    arenaConfig,
    descriptors: foundation.descriptors,
  };
}

export function spawnArrow(payload: ArrowSpawnPayload) {
  return {
    id: `arrow-${payload.ownerId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ownerId: payload.ownerId,
    type: payload.type,
    origin: payload.origin,
    direction: payload.direction,
    power: payload.power,
    speed: arrowTuning[payload.type].speed * payload.power,
  };
}

export function applyHit(payload: HitResolutionPayload): DamageEvent {
  const bodyPart: HitBodyPart =
    payload.limb === "head"
      ? "head"
      : payload.limb === "torso"
        ? "chest"
        : payload.limb === "pelvis"
          ? "abdomen"
          : payload.limb.includes("Arm")
            ? "arm"
            : "leg";

  const hitPayload: HitPayload = {
    targetId: payload.actorId,
    bodyPart,
    force: payload.impulse,
    penetrationDepth: Math.min(1, payload.impulse / 20),
    arrowType: payload.arrowType,
  };

  const injuries = [
    createInjuryFromHit({
      actorId: payload.actorId,
      limb: payload.limb,
      arrowType: payload.arrowType,
      force: payload.impulse,
      impactAngle: Math.atan2(payload.impactPoint[1], payload.impactPoint[0] || 0.001),
      penetrationDepth: Math.min(1, payload.impulse / 20),
    }),
  ];
  useRagdollArchersStore.getState().applyInjury(hitPayload.targetId, injuries);

  return {
    actorId: payload.actorId,
    sourceActorId: payload.sourceActorId,
    limb: payload.limb,
    arrowType: payload.arrowType,
    damage: payload.limb === "head" ? 200 : arrowTuning[payload.arrowType].damage,
    impulse: payload.impulse,
    headshot: payload.limb === "head",
    position: payload.impactPoint,
  };
}

export function chooseLimbHit(params: { arrowType: ArrowType; distance: number; preferred?: LimbName }): LimbName {
  if (params.preferred) return params.preferred;
  if (params.distance < 0.32) return "head";
  if (params.arrowType === "heavy") return "torso";
  if (params.arrowType === "light") return "upperArmRight";
  return "upperLegLeft";
}
