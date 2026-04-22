import {
  DEFAULT_CUSTOM_NIGHT,
  ENDINGS,
  INCIDENT_STAGE_LABELS,
  LOG_ENTRIES,
  NIGHT_PRESETS,
  RANDOM_EVENTS,
  REMOTE_INCIDENT_EVENTS,
  SCP_DESCRIPTIONS,
  SCP_LABELS,
} from "@/game/scpNightwatch/data/content";
import { CustomNightConfig, EndingDefinition, EndingId, EntityId, LogEntry, NightPreset } from "@/game/scpNightwatch/core/types";

export {
  DEFAULT_CUSTOM_NIGHT,
  ENDINGS,
  INCIDENT_STAGE_LABELS,
  LOG_ENTRIES,
  NIGHT_PRESETS,
  RANDOM_EVENTS,
  REMOTE_INCIDENT_EVENTS,
  SCP_DESCRIPTIONS,
  SCP_LABELS,
};

export function getNightPreset(nightId: number): NightPreset | null {
  return NIGHT_PRESETS.find((preset) => preset.id === nightId) ?? null;
}

export function isMaxHostilityCustomNight(config: CustomNightConfig): boolean {
  return Object.values(config).every((value) => value >= 20);
}

export function getEndingDefinition(endingId: EndingId): EndingDefinition {
  return ENDINGS[endingId];
}

export function getUnlockableLogs(night: number, encounterFlags: Record<EntityId, boolean>): LogEntry[] {
  return LOG_ENTRIES.filter((entry) => night >= entry.unlockNight && (!entry.unlockByEntity || encounterFlags[entry.unlockByEntity]));
}
