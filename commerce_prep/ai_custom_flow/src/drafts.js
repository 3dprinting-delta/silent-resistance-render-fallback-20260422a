import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SAFE_PROMPTS = [
  "A compact modular desk cable organizer with rounded corners for 3D printing in PLA",
  "A cute customizable name plate for a bedroom shelf with simple raised lettering",
  "A small geometric planter sleeve with drainage tray for a desk succulent",
  "A playful fidget slider with smooth chunky shapes, no logos, no characters",
  "A minimalist headphone hook for a desk edge with soft rounded surfaces",
];

const BLOCKED_TERMS = [
  "disney",
  "pokemon",
  "marvel",
  "nintendo",
  "warhammer",
  "lego",
  "star wars",
  "fortnite",
  "minecraft",
  "anime",
  "logo",
  "gun",
  "weapon",
];

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

function assertSafePrompt(prompt) {
  const lower = prompt.toLowerCase();
  const blocked = BLOCKED_TERMS.find((term) => lower.includes(term));
  if (blocked) throw new Error(`Prompt contains blocked IP/safety term: ${blocked}`);
}

export async function createDraftProduct({ dataDir, prompt, source, meshyTaskId }) {
  if (!prompt) throw new Error("Draft prompt is required.");
  assertSafePrompt(prompt);
  const createdAt = new Date().toISOString();
  const shortTitle = prompt
    .replace(/^a\s+/i, "")
    .replace(/\s+for 3d printing.*$/i, "")
    .split(/\s+/)
    .slice(0, 8)
    .join(" ");
  const title = shortTitle.replace(/\b\w/g, (match) => match.toUpperCase());
  const slug = `${slugify(title)}-${Date.now().toString(36)}`;
  const draft = {
    id: `draft_${Date.now()}`,
    createdAt,
    status: "hidden-draft",
    title,
    slug,
    prompt,
    source,
    meshyTaskId,
    price: "14.99",
    category: "/custom-ai-drafts",
    tags: "AI draft, Custom, PLA, Needs review",
  };
  await mkdir(path.join(dataDir, "drafts"), { recursive: true });
  await writeFile(path.join(dataDir, "drafts", `${draft.id}.json`), JSON.stringify(draft, null, 2));
  const csvLine = [
    "",
    "",
    "PHYSICAL",
    "shop",
    draft.slug,
    draft.title,
    `<p>${draft.title} is a hidden AI-assisted draft for review. Prompt: ${draft.prompt}</p>`,
    `AI-${draft.id.slice(-8).toUpperCase()}`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    draft.price,
    draft.price,
    "No",
    "Unlimited",
    draft.category,
    draft.tags,
    "0.1",
    "0.0",
    "0.0",
    "0.0",
    "No",
    "",
  ]
    .map((value) => `"${String(value).replace(/"/g, '""')}"`)
    .join(",");
  await writeFile(path.join(dataDir, "drafts", "hidden_meshy_drafts.csv"), `${csvLine}\n`, { flag: "a" });
  return draft;
}

export async function runDailyMeshyDraftJob({ dataDir, maxCredits, force, dryRun, startMeshyTask }) {
  const prompt = SAFE_PROMPTS[new Date().getUTCDate() % SAFE_PROMPTS.length];
  const previewCost = 5;
  const canSpend = force || maxCredits >= previewCost;
  const result = {
    dryRun,
    checkedAt: new Date().toISOString(),
    maxCredits,
    estimatedCreditsNeeded: previewCost,
    generated: false,
    reason: "",
  };

  if (!canSpend) {
    result.reason = "Configured credit budget is below the preview-task cost.";
    return result;
  }

  if (dryRun) {
    result.reason = "Dry run only; no Meshy credits spent.";
    result.prompt = prompt;
    return result;
  }

  const meshyTask = startMeshyTask ? await startMeshyTask(prompt) : null;
  const draft = await createDraftProduct({
    dataDir,
    prompt,
    source: "daily-meshy-automation",
    meshyTaskId: meshyTask?.id || "",
  });
  result.generated = true;
  result.meshyTask = meshyTask;
  result.draft = draft;
  return result;
}
