import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog, searchCatalog } from "../src/catalog.js";
import { runDailyMeshyDraftJob } from "../src/drafts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");

test("catalog search ranks exact product names", async () => {
  const catalog = await loadCatalog({ rootDir, shopBaseUrl: "https://www.augnach.com" });
  const results = searchCatalog(catalog.products, "Articulated Dragon", { limit: 3 });
  assert.ok(results.length > 0);
  assert.match(results[0].title, /dragon/i);
  assert.equal(
    results[0].url,
    "https://www.augnach.com/shop/p/3d-printed-articulated-dragon-flexible-fidget-toy-desk-display",
  );
});

test("catalog search handles broad customer intent", async () => {
  const catalog = await loadCatalog({ rootDir, shopBaseUrl: "https://www.augnach.com" });
  const results = searchCatalog(catalog.products, "desk organizer", { limit: 5 });
  assert.ok(results.length > 0);
  assert.ok(results.some((item) => /organizer|holder|desk|storage|tray/i.test(`${item.title} ${item.description} ${item.categories}`)));
});

test("daily Meshy automation defaults to dry run", async () => {
  const result = await runDailyMeshyDraftJob({
    dataDir: path.resolve(__dirname, "../data"),
    maxCredits: 5,
    dryRun: true,
    force: false,
  });
  assert.equal(result.generated, false);
  assert.equal(result.dryRun, true);
  assert.match(result.reason, /Dry run/i);
});
