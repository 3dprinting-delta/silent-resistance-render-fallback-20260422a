import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { loadCatalog, searchCatalog } from "./src/catalog.js";
import { createDraftProduct, runDailyMeshyDraftJob } from "./src/drafts.js";
import { createMeshyPreviewTask, getMeshyTask } from "./src/meshy.js";
import { verifySquarespaceStarterPayment } from "./src/squarespace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const PORT = Number(process.env.PORT || 8795);
const SHOP_BASE_URL = process.env.SHOP_BASE_URL || "https://www.augnach.com";
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "augnach@gmail.com";
const CUSTOM_STARTER_CHECKOUT_URL =
  process.env.CUSTOM_STARTER_CHECKOUT_URL || `${SHOP_BASE_URL}/shop/p/custom-design-starter`;
const CUSTOM_STARTER_PRODUCT_SLUG = process.env.CUSTOM_STARTER_PRODUCT_SLUG || "custom-design-starter";
const SQUARESPACE_ORDER_LOOKBACK_DAYS = Number(process.env.SQUARESPACE_ORDER_LOOKBACK_DAYS || 30);
const MESHY_DAILY_CREDIT_ALLOWANCE = Number(process.env.MESHY_DAILY_CREDIT_ALLOWANCE || process.env.MESHY_DAILY_CREDIT_BUDGET || 5);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || `${SHOP_BASE_URL},http://localhost:${PORT},http://127.0.0.1:${PORT}`)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const liveMeshyEnabled = () => process.env.AUGNACH_MESHY_LIVE_OVERRIDE === "true" || process.env.MESHY_ENABLE_LIVE_CALLS === "true";
const dailyMeshyAutomationEnabled = () =>
  process.env.AUGNACH_MESHY_DAILY_OVERRIDE === "true" || process.env.MESHY_DAILY_AUTOMATION_ENABLED === "true";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

let catalogPromise = loadCatalog({ rootDir: path.resolve(__dirname, ".."), shopBaseUrl: SHOP_BASE_URL });

function sendJson(res, status, body) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body, null, 2));
}

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.includes(origin);
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "Origin");
  }
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,x-automation-secret");
}

function badRequest(res, message, extra = {}) {
  sendJson(res, 400, { ok: false, error: message, ...extra });
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function safeId(prefix) {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, "")}_${crypto.randomBytes(4).toString("hex")}`;
}

async function appendJsonl(filePath, row) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(row)}\n`, { flag: "a" });
}

async function readJsonl(filePath) {
  if (!existsSync(filePath)) return [];
  const raw = await readFile(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function hasVerifiedPaymentToken({ token, email }) {
  if (!token) return false;
  const rows = await readJsonl(path.join(DATA_DIR, "payment_verifications.jsonl"));
  const wantedEmail = String(email || "").trim().toLowerCase();
  return rows.some((row) => row.token === token && (!wantedEmail || String(row.email || "").toLowerCase() === wantedEmail));
}

async function dailyMeshyCreditsRemaining({ estimatedSpend = 5 }) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await readJsonl(path.join(DATA_DIR, "meshy_credit_usage.jsonl"));
  const spentToday = rows
    .filter((row) => String(row.date || "").slice(0, 10) === today)
    .reduce((sum, row) => sum + Number(row.credits || 0), 0);
  const allowance = MESHY_DAILY_CREDIT_ALLOWANCE;
  return {
    date: today,
    allowance,
    spentToday,
    remaining: Math.max(0, allowance - spentToday),
    canSpend: allowance - spentToday >= estimatedSpend,
  };
}

async function serveStatic(req, res, pathname) {
  const clean = pathname === "/" ? "/index.html" : pathname;
  const fullPath = path.normalize(path.join(PUBLIC_DIR, clean));
  if (!fullPath.startsWith(PUBLIC_DIR)) return badRequest(res, "Invalid path");
  const fallbackCustom = pathname === "/custom" ? path.join(PUBLIC_DIR, "custom.html") : fullPath;
  const target = existsSync(fallbackCustom) ? fallbackCustom : fullPath;
  if (!existsSync(target)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const ext = path.extname(target).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };
  res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
  createReadStream(target).pipe(res);
}

async function handleApi(req, res, url) {
  if (!isAllowedOrigin(req.headers.origin)) {
    return sendJson(res, 403, { ok: false, error: "Origin is not allowed." });
  }
  applyCors(req, res);
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  if (req.method === "GET" && url.pathname === "/api/config") {
    return sendJson(res, 200, {
      ok: true,
      shopBaseUrl: SHOP_BASE_URL,
      contactEmail: CONTACT_EMAIL,
      starterCheckoutUrl: CUSTOM_STARTER_CHECKOUT_URL,
      starterCheckoutConfigured: Boolean(CUSTOM_STARTER_CHECKOUT_URL),
      customStarterProductSlug: CUSTOM_STARTER_PRODUCT_SLUG,
      paymentVerificationConfigured: Boolean(process.env.SQUARESPACE_API_KEY),
      orderLookbackDays: SQUARESPACE_ORDER_LOOKBACK_DAYS,
      allowedOrigins: ALLOWED_ORIGINS,
      liveMeshyEnabled: liveMeshyEnabled(),
      dailyMeshyAutomationEnabled: dailyMeshyAutomationEnabled(),
      dailyMeshyCreditAllowance: MESHY_DAILY_CREDIT_ALLOWANCE,
    });
  }

  if (req.method === "GET" && url.pathname === "/api/catalog/search") {
    const q = url.searchParams.get("q") || "";
    const limit = Math.min(Number(url.searchParams.get("limit") || 8), 20);
    const catalog = await catalogPromise;
    const results = searchCatalog(catalog.products, q, { limit });
    return sendJson(res, 200, {
      ok: true,
      query: q,
      count: results.length,
      shouldRedirectToCustom: q.trim().length > 0 && results.length === 0,
      catalogGeneratedAt: catalog.generatedAt,
      results,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/catalog/reload") {
    catalogPromise = loadCatalog({ rootDir: path.resolve(__dirname, ".."), shopBaseUrl: SHOP_BASE_URL });
    const catalog = await catalogPromise;
    return sendJson(res, 200, { ok: true, count: catalog.products.length, generatedAt: catalog.generatedAt });
  }

  if (req.method === "POST" && url.pathname === "/api/custom-requests") {
    const body = await readJson(req);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const idea = String(body.idea || "").trim();
    if (!name || !email || !idea) return badRequest(res, "Name, email, and idea are required.");
    const request = {
      id: safeId("custom"),
      name,
      email,
      phone: String(body.phone || "").trim(),
      budget: String(body.budget || "").trim(),
      color: String(body.color || "").trim(),
      size: String(body.size || "").trim(),
      idea,
      source: String(body.source || "website").trim(),
      createdAt: new Date().toISOString(),
      status: "new",
    };
    await appendJsonl(path.join(DATA_DIR, "custom_requests.jsonl"), request);
    return sendJson(res, 201, { ok: true, requestId: request.id, contactEmail: CONTACT_EMAIL });
  }

  if (req.method === "POST" && url.pathname === "/api/custom-payment/verify") {
    const body = await readJson(req);
    const email = String(body.email || "").trim();
    const orderNumber = String(body.orderNumber || body.orderId || body.paymentConfirmation || "").trim();
    if (!email || !orderNumber) return badRequest(res, "Email and order number are required.");
    try {
      const result = await verifySquarespaceStarterPayment({
        email,
        orderNumber,
        starterSlug: CUSTOM_STARTER_PRODUCT_SLUG,
        lookbackDays: SQUARESPACE_ORDER_LOOKBACK_DAYS,
      });
      if (!result.verified) {
        return sendJson(res, 404, {
          ok: false,
          verified: false,
          code: result.code,
          error: "We could not find a recent matching Custom Design Starter order for that email and order number.",
          contactEmail: CONTACT_EMAIL,
        });
      }
      const verification = {
        token: safeId("pay"),
        email,
        orderNumber: result.orderNumber || orderNumber,
        orderId: result.orderId || "",
        starterSlug: CUSTOM_STARTER_PRODUCT_SLUG,
        verifiedAt: new Date().toISOString(),
      };
      await appendJsonl(path.join(DATA_DIR, "payment_verifications.jsonl"), verification);
      return sendJson(res, 200, { ok: true, verified: true, verificationToken: verification.token, ...verification });
    } catch (error) {
      const status = error.code === "SQUARESPACE_API_KEY_MISSING" ? 503 : 502;
      return sendJson(res, status, {
        ok: false,
        verified: false,
        code: error.code || "PAYMENT_VERIFICATION_FAILED",
        error: error.message || "Payment verification failed.",
        contactEmail: CONTACT_EMAIL,
      });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/meshy/start") {
    const body = await readJson(req);
    const prompt = String(body.prompt || body.idea || "").trim();
    const email = String(body.email || "").trim();
    const paymentVerificationToken = String(body.paymentVerificationToken || "").trim();
    const paymentConfirmation = String(body.paymentConfirmation || paymentVerificationToken).trim();
    if (!prompt) return badRequest(res, "A design prompt is required.");
    if (!(await hasVerifiedPaymentToken({ token: paymentVerificationToken, email }))) {
      return sendJson(res, 402, {
        ok: false,
        error: "Payment verification is required before starting a Meshy preview.",
        contactEmail: CONTACT_EMAIL,
      });
    }
    const task = await createMeshyPreviewTask({
      prompt,
      customerEmail: email,
      paymentConfirmation,
      referenceImageName: String(body.referenceImageName || "").trim(),
      dataDir: DATA_DIR,
    });
    return sendJson(res, task.live ? 201 : 202, { ok: true, ...task });
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/meshy/status/")) {
    const id = decodeURIComponent(url.pathname.split("/").pop() || "");
    if (!id) return badRequest(res, "Task id is required.");
    const task = await getMeshyTask({ id, dataDir: DATA_DIR });
    return sendJson(res, 200, { ok: true, ...task });
  }

  if (req.method === "POST" && url.pathname === "/api/automation/daily-meshy") {
    const secret = req.headers["x-automation-secret"];
    const expected = process.env.AUTOMATION_SECRET;
    if (expected && expected !== "change-this-before-hosting" && secret !== expected) {
      return sendJson(res, 401, { ok: false, error: "Unauthorized automation request." });
    }
    const body = await readJson(req);
    const estimatedCreditsNeeded = 5;
    const creditState = await dailyMeshyCreditsRemaining({ estimatedSpend: estimatedCreditsNeeded });
    const maxCredits = Number(body.maxCredits || creditState.remaining);
    const result = await runDailyMeshyDraftJob({
      dataDir: DATA_DIR,
      maxCredits,
      force: Boolean(body.force),
      dryRun:
        body.dryRun !== undefined
          ? Boolean(body.dryRun)
          : !dailyMeshyAutomationEnabled() || !creditState.canSpend,
      startMeshyTask: async (prompt) =>
        createMeshyPreviewTask({
          prompt,
          customerEmail: "daily-automation@augnach.local",
          paymentConfirmation: "daily-automation-credit-budget",
          dataDir: DATA_DIR,
        }),
    });
    result.creditState = creditState;
    if (result.generated) {
      await appendJsonl(path.join(DATA_DIR, "meshy_credit_usage.jsonl"), {
        date: creditState.date,
        credits: estimatedCreditsNeeded,
        source: "daily-meshy-automation",
        taskId: result.meshyTask?.id || "",
        createdAt: new Date().toISOString(),
      });
    }
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (req.method === "POST" && url.pathname === "/api/drafts") {
    const body = await readJson(req);
    const draft = await createDraftProduct({
      dataDir: DATA_DIR,
      prompt: String(body.prompt || "").trim(),
      source: String(body.source || "manual").trim(),
      meshyTaskId: String(body.meshyTaskId || "").trim(),
    });
    return sendJson(res, 201, { ok: true, draft });
  }

  return sendJson(res, 404, { ok: false, error: "Unknown API route." });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    return await serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { ok: false, error: error.message || "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Aug & Ach AI custom flow running at http://localhost:${PORT}`);
});
