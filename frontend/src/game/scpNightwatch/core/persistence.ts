import { DEFAULT_CUSTOM_NIGHT, SAVE_VERSION } from "@/game/scpNightwatch/data/content";
import { SaveState } from "@/game/scpNightwatch/core/types";

const STORAGE_KEY = "scp-nightwatch-save";
const VALID_ENDING_IDS: SaveState["endingsSeen"] = ["night-clear", "termination-postponed", "archivist", "breach", "apollyon", "casualty"];

function buildArchiveTag() {
  const value = Math.floor(1000 + Math.random() * 9000);
  return `ARC-${value}`;
}

function buildSessionId(serial: number) {
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `S17-${String(serial).padStart(3, "0")}-${suffix}`;
}

function normalizeStringList(values: unknown, maxLength: number) {
  return Array.isArray(values)
    ? [...new Set(values.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0))].slice(0, maxLength)
    : [];
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function sanitizeSaveState(parsed: SaveState): SaveState {
  const unlockedNights = Array.isArray(parsed.unlockedNights)
    ? [...new Set(parsed.unlockedNights.filter((night): night is number => Number.isInteger(night) && night >= 1 && night <= 5))].sort((a, b) => a - b)
    : [];
  const unlockedLogs = Array.isArray(parsed.unlockedLogs)
    ? [...new Set(parsed.unlockedLogs.filter((entry): entry is string => typeof entry === "string"))]
    : [];
  const endingsSeen = Array.isArray(parsed.endingsSeen)
    ? [...new Set(parsed.endingsSeen.filter((ending): ending is SaveState["endingsSeen"][number] => VALID_ENDING_IDS.includes(ending as SaveState["endingsSeen"][number])))]
    : [];
  const bestClearRecords = Object.fromEntries(
    Object.entries(parsed.bestClearRecords ?? {}).flatMap(([key, value]) => {
      if (!value || typeof value !== "object") return [];
      const powerRemaining = clampNumber(value.powerRemaining, 0, 100, Number.NaN);
      const completionMs = clampNumber(value.completionMs, 0, 10_000_000, Number.NaN);
      if (!Number.isFinite(powerRemaining) || !Number.isFinite(completionMs)) return [];
      return [[key, { powerRemaining, completionMs }]];
    }),
  );

  return {
    ...defaultSaveState(),
    version: SAVE_VERSION,
    unlockedNights: unlockedNights.length ? unlockedNights : [1],
    unlockedLogs,
    endingsSeen,
    bestClearRecords,
    failures: Math.max(0, Math.floor(clampNumber(parsed.failures, 0, 9999, 0))),
    customNightUnlocked: Boolean(parsed.customNightUnlocked),
    customNightConfig: {
      scp173: Math.round(clampNumber(parsed.customNightConfig?.scp173, 0, 20, DEFAULT_CUSTOM_NIGHT.scp173)),
      scp096: Math.round(clampNumber(parsed.customNightConfig?.scp096, 0, 20, DEFAULT_CUSTOM_NIGHT.scp096)),
      scp106: Math.round(clampNumber(parsed.customNightConfig?.scp106, 0, 20, DEFAULT_CUSTOM_NIGHT.scp106)),
      scp457: Math.round(clampNumber(parsed.customNightConfig?.scp457, 0, 20, DEFAULT_CUSTOM_NIGHT.scp457)),
    },
    archiveTag: typeof parsed.archiveTag === "string" && parsed.archiveTag.trim() ? parsed.archiveTag : buildArchiveTag(),
    sessionSerial: Math.max(1, Math.floor(clampNumber(parsed.sessionSerial, 1, 9999, 1))),
    lastSessionId: typeof parsed.lastSessionId === "string" && parsed.lastSessionId.trim() ? parsed.lastSessionId : buildSessionId(1),
    priorOperators: normalizeStringList(parsed.priorOperators, 5),
    archiveNotes: normalizeStringList(parsed.archiveNotes, 12),
    carryoverTitles: normalizeStringList(parsed.carryoverTitles, 8),
  };
}

export const defaultSaveState = (): SaveState => ({
  version: SAVE_VERSION,
  unlockedNights: [1],
  unlockedLogs: [],
  endingsSeen: [],
  bestClearRecords: {},
  failures: 0,
  customNightUnlocked: false,
  customNightConfig: { ...DEFAULT_CUSTOM_NIGHT },
  archiveTag: buildArchiveTag(),
  sessionSerial: 1,
  lastSessionId: buildSessionId(1),
  priorOperators: ["D-9341"],
  archiveNotes: ["SESSION 14 PARTIAL RECOVERY"],
  carryoverTitles: ["PREVIOUS OPERATOR DISCONNECT"],
});

export function loadSaveState(): SaveState {
  if (typeof window === "undefined") {
    return defaultSaveState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSaveState();
    const parsed = JSON.parse(raw) as SaveState;
    if (!parsed || parsed.version !== SAVE_VERSION) return defaultSaveState();
    return sanitizeSaveState(parsed);
  } catch (error) {
    console.error("Failed to load SCP Nightwatch save", error);
    return defaultSaveState();
  }
}

export function saveSaveState(save: SaveState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch (error) {
    console.error("Failed to persist SCP Nightwatch save", error);
  }
}
