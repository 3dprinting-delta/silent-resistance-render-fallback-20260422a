import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeManifestPaths, normalizePathsInServerDir } from "./normalize-next-manifests.mjs";

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(fullPath);
      results.push(...(await walk(fullPath)));
    }
  }

  return results;
}

async function ensureCopiedFile(sourcePath, targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

async function copyDirectory(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      continue;
    }

    await ensureCopiedFile(sourcePath, targetPath);
  }
}

async function normalizeTextFile(filePath, workspaceRoot) {
  const original = await fs.readFile(filePath, "utf8");
  const normalized = normalizeManifestPaths(original, workspaceRoot);
  if (normalized !== original) {
    await fs.writeFile(filePath, normalized, "utf8");
  }
}

export async function patchVercelOutput(workspaceRoot) {
  const outputFunctionsDir = path.join(workspaceRoot, ".vercel", "output", "functions");
  const nextServerDir = path.join(workspaceRoot, ".next", "server");
  const nextAppDir = path.join(nextServerDir, "app");

  const allDirs = await walk(outputFunctionsDir);
  const functionDirs = allDirs.filter((entry) => entry.endsWith(".func"));

  const appManifestFiles = [];
  async function collectAppManifests(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await collectAppManifests(fullPath);
        continue;
      }

      if (entry.name.endsWith("client-reference-manifest.js")) {
        appManifestFiles.push(fullPath);
      }
    }
  }

  await collectAppManifests(nextAppDir);

  const serverManifestFiles = [
    path.join(nextServerDir, "server-reference-manifest.js"),
    path.join(nextServerDir, "server-reference-manifest.json"),
    path.join(nextServerDir, "app-paths-manifest.json"),
    path.join(nextServerDir, "pages-manifest.json"),
  ];

  for (const functionDir of functionDirs) {
    const functionServerDir = path.join(functionDir, ".next", "server");
    await fs.mkdir(functionServerDir, { recursive: true });

    await copyDirectory(nextAppDir, path.join(functionServerDir, "app"));

    for (const manifestPath of serverManifestFiles) {
      await ensureCopiedFile(manifestPath, path.join(functionServerDir, path.basename(manifestPath)));
    }

    for (const manifestPath of appManifestFiles) {
      const relativePath = path.relative(nextServerDir, manifestPath);
      await ensureCopiedFile(manifestPath, path.join(functionServerDir, relativePath));
    }

    await normalizePathsInServerDir(functionServerDir, workspaceRoot);

    const extraTextFiles = [
      path.join(functionDir, "___next_launcher.cjs"),
      path.join(functionDir, ".vc-config.json"),
      path.join(functionDir, ".next", "routes-manifest.json"),
    ];

    for (const filePath of extraTextFiles) {
      try {
        await normalizeTextFile(filePath, workspaceRoot);
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          continue;
        }
        throw error;
      }
    }
  }
}

const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const workspaceRoot = path.resolve(process.cwd());
  await patchVercelOutput(workspaceRoot);
}
