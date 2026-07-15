import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MESHY_API = "https://api.meshy.ai/openapi/v2/text-to-3d";

function liveMeshyEnabled() {
  return Boolean(process.env.MESHY_API_KEY);
}

async function saveTask(dataDir, task) {
  await mkdir(path.join(dataDir, "meshy_tasks"), { recursive: true });
  await writeFile(path.join(dataDir, "meshy_tasks", `${task.id}.json`), JSON.stringify(task, null, 2));
}

export async function createMeshyPreviewTask({ prompt, customerEmail, paymentConfirmation, referenceImageName, dataDir }) {
  const live = liveMeshyEnabled();
  const apiKey = process.env.MESHY_API_KEY;
  if (!live || !apiKey) {
    const task = {
      id: `dryrun_${Date.now()}`,
      live: false,
      status: "DRY_RUN",
      prompt,
      customerEmail,
      paymentConfirmation,
      referenceImageName,
      message: "Dry run saved. Set MESHY_ENABLE_LIVE_CALLS=true and MESHY_API_KEY to spend credits.",
      createdAt: new Date().toISOString(),
    };
    await saveTask(dataDir, task);
    return task;
  }

  const response = await fetch(MESHY_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "preview",
      prompt,
      ai_model: "latest",
      target_formats: ["glb", "stl"],
      moderation: true,
      auto_size: true,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const task = {
      id: `failed_${Date.now()}`,
      live: true,
      status: "FAILED_TO_START",
      prompt,
      customerEmail,
      paymentConfirmation,
      referenceImageName,
      error: payload.message || payload.error || `Meshy returned HTTP ${response.status}`,
      createdAt: new Date().toISOString(),
    };
    await saveTask(dataDir, task);
    return task;
  }

  const task = {
    id: payload.result,
    live: true,
    status: "SUBMITTED",
    prompt,
    customerEmail,
    paymentConfirmation,
    referenceImageName,
    createdAt: new Date().toISOString(),
  };
  await saveTask(dataDir, task);
  return task;
}

export async function getMeshyTask({ id, dataDir }) {
  if (id.startsWith("dryrun_") || id.startsWith("failed_")) {
    const filePath = path.join(dataDir, "meshy_tasks", `${id}.json`);
    return JSON.parse(await readFile(filePath, "utf8"));
  }
  if (!liveMeshyEnabled() || !process.env.MESHY_API_KEY) {
    return {
      id,
      live: false,
      status: "UNKNOWN_LOCAL_ONLY",
      message: "Live Meshy calls are disabled, so remote status was not fetched.",
    };
  }
  const response = await fetch(`${MESHY_API}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${process.env.MESHY_API_KEY}` },
  });
  const payload = await response.json().catch(() => ({}));
  return { id, live: true, remoteStatus: response.status, task: payload };
}
