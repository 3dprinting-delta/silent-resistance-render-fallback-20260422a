import type { DisguiseDefinition, DisguiseId } from "@/game/core/types";
import { disguiseDefinitions } from "@/game/data/disguises";

export function getDisguiseById(id: DisguiseId): DisguiseDefinition {
  return disguiseDefinitions.find((disguise) => disguise.id === id) || disguiseDefinitions[0];
}
