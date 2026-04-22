import { promises as fs } from "fs";
import path from "path";
import { createInitialWorldState } from "@/lib/simulation/worldState";

const GLOBAL_KEY = "__silentResistanceWorldState";
const SHARED_WORLD_KEY = "silent-resistance-world-state";

function getStoragePath() {
  if (process.env.VERCEL) {
    return path.join("/tmp", "the-silent-resistance-world.json");
  }
  return path.join(process.cwd(), ".runtime", "the-silent-resistance-world.json");
}

function getRemoteConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }
  return { url, token };
}

export function hasSharedStoreConfig() {
  return Boolean(getRemoteConfig());
}

async function execRemote(command) {
  const config = getRemoteConfig();
  if (!config) {
    throw new Error("Shared store is not configured.");
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Shared store command failed with status ${response.status}`);
  }

  const payload = await response.json();
  return payload.result;
}

async function loadRemoteWorldState() {
  const raw = await execRemote(["GET", SHARED_WORLD_KEY]);
  if (!raw) {
    const initial = createInitialWorldState();
    await saveRemoteWorldState(initial);
    return initial;
  }

  if (typeof raw === "string") {
    return JSON.parse(raw);
  }

  return raw;
}

async function saveRemoteWorldState(worldState) {
  await execRemote(["SET", SHARED_WORLD_KEY, JSON.stringify(worldState)]);
}

async function ensureDirectory(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function loadFileWorldState() {
  if (globalThis[GLOBAL_KEY]) {
    return structuredClone(globalThis[GLOBAL_KEY]);
  }

  const filePath = getStoragePath();

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    globalThis[GLOBAL_KEY] = parsed;
    return structuredClone(parsed);
  } catch (_error) {
    const initial = createInitialWorldState();
    globalThis[GLOBAL_KEY] = initial;
    await saveFileWorldState(initial);
    return structuredClone(initial);
  }
}

async function saveFileWorldState(worldState) {
  const filePath = getStoragePath();
  await ensureDirectory(filePath);
  globalThis[GLOBAL_KEY] = structuredClone(worldState);
  await fs.writeFile(filePath, JSON.stringify(worldState, null, 2), "utf8");
}

export async function loadWorldState() {
  if (hasSharedStoreConfig()) {
    return loadRemoteWorldState();
  }

  return loadFileWorldState();
}

export async function saveWorldState(worldState) {
  if (hasSharedStoreConfig()) {
    await saveRemoteWorldState(worldState);
    return;
  }

  await saveFileWorldState(worldState);
}
