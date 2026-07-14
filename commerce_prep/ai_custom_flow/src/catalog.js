import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const PREFERRED_CATALOGS = [
  "squarespace_category_visibility_update_realistic_prices.csv",
  "squarespace_category_visibility_update.csv",
  "baseline_before_internal_print_category_cleanup_20260713_192923.csv",
  "squarespace_527_visual_refresh.csv",
  "squarespace_500_makerworld_update.csv",
  "ai_custom_flow/data/catalog_seed.csv",
];

const PREFERRED_AUDITS = [
  "final_527_public_image_audit.csv",
  "public_500_product_verification.csv",
  "ai_custom_flow/data/audit_seed.csv",
];

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "for",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "or",
  "the",
  "to",
  "with",
  "want",
  "need",
  "find",
  "show",
  "shop",
  "buy",
]);

const SYNONYMS = {
  dragon: ["fantasy", "dice", "tower", "articulated", "wyvern"],
  gift: ["present", "holiday", "decor", "desk", "cute"],
  desk: ["organizer", "holder", "stand", "tray", "office"],
  organizer: ["holder", "storage", "tray", "caddy", "bin"],
  fidget: ["spinner", "flexi", "toy", "stress", "sensory"],
  dinosaur: ["dino", "rex", "brachio"],
  custom: ["name", "personalized", "parametric", "design"],
  keychain: ["key", "tag", "charm"],
  music: ["vinyl", "record", "adapter", "45rpm"],
  christmas: ["holiday", "ornament", "wreath", "tree", "reindeer"],
  vase: ["planter", "home", "decor"],
};

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [headers = [], ...data] = rows;
  return data
    .filter((cells) => cells.some((value) => String(value).trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function imageFrom(value) {
  const match = String(value || "").match(/https:\/\/images\.squarespace-cdn\.com\/[^\s"|]+/);
  return match ? match[0] : "";
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function expandTokens(tokens) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const synonym of SYNONYMS[token] || []) expanded.add(synonym);
  }
  return [...expanded];
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

async function readFirstExisting(rootDir, names) {
  for (const name of names) {
    const filePath = path.join(rootDir, name);
    if (existsSync(filePath)) return { filePath, text: await readFile(filePath, "utf8") };
  }
  return null;
}

export async function loadCatalog({ rootDir, shopBaseUrl }) {
  const catalogFile = await readFirstExisting(rootDir, PREFERRED_CATALOGS);
  const auditFile = await readFirstExisting(rootDir, PREFERRED_AUDITS);
  const sourceRows = catalogFile ? parseCsv(catalogFile.text) : [];
  const auditRows = auditFile ? parseCsv(auditFile.text) : [];
  const auditBySlug = new Map(auditRows.map((row) => [row.slug || row["Product URL"], row]));
  const seen = new Set();
  const products = [];

  for (const row of sourceRows) {
    const slug = row["Product URL"] || slugify(row.Title);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const audit = auditBySlug.get(slug) || {};
    const title = row.Title || audit.title || slug.replace(/-/g, " ");
    const categories = row.Categories || "";
    const tags = row.Tags || "";
    const description = stripHtml(row.Description);
    const image = imageFrom(row["Hosted Image URLs"]) || imageFrom(audit.sample_product_images);
    const url = audit.url || `${shopBaseUrl}/shop/p/${slug}`;
    const searchText = [title, description, categories, tags, slug].join(" ");
    products.push({
      slug,
      title,
      url,
      image,
      price: row["Sale Price"] || row.Price || "",
      categories,
      tags,
      description,
      visible: row.Visible || "",
      tokens: expandTokens(tokenize(searchText)),
    });
  }

  for (const row of auditRows) {
    if (!row.slug || seen.has(row.slug)) continue;
    seen.add(row.slug);
    const title = row.title || row.slug.replace(/-/g, " ");
    products.push({
      slug: row.slug,
      title,
      url: row.url || `${shopBaseUrl}/shop/p/${row.slug}`,
      image: imageFrom(row.sample_product_images),
      price: "",
      categories: "",
      tags: "",
      description: "",
      visible: "",
      tokens: expandTokens(tokenize([title, row.slug].join(" "))),
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceCatalog: catalogFile?.filePath || null,
    sourceAudit: auditFile?.filePath || null,
    products,
  };
  const cacheDir = path.join(rootDir, "ai_custom_flow", "data");
  await mkdir(cacheDir, { recursive: true });
  await writeFile(path.join(cacheDir, "catalog_cache.json"), JSON.stringify(payload, null, 2));
  return payload;
}

export function searchCatalog(products, query, { limit = 8 } = {}) {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) return [];
  const queryTokens = expandTokens(tokenize(cleanQuery));
  if (!queryTokens.length) return [];
  const phrase = cleanQuery.toLowerCase();

  return products
    .map((product) => {
      const haystack = `${product.title} ${product.description} ${product.categories} ${product.tags} ${product.slug}`.toLowerCase();
      let score = 0;
      if (product.title.toLowerCase() === phrase) score += 100;
      if (product.title.toLowerCase().includes(phrase)) score += 35;
      if (haystack.includes(phrase)) score += 20;
      for (const token of queryTokens) {
        if (product.tokens.includes(token)) score += 10;
        if (product.title.toLowerCase().includes(token)) score += 8;
        if (product.slug.includes(token)) score += 5;
        if (product.categories.toLowerCase().includes(token)) score += 4;
      }
      if (product.image) score += 2;
      return { ...product, score };
    })
    .filter((product) => product.score >= Math.max(10, queryTokens.length * 5))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
    .map(({ tokens, ...product }) => product);
}
