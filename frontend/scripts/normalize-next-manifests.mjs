import { promises as fs } from "node:fs";
import path from "node:path";

export function normalizeManifestPaths(content, workspaceRoots) {
  const pathToken = "__CODEX_VAR_TASK__";

  const roots = Array.isArray(workspaceRoots) ? workspaceRoots : [workspaceRoots];

  let normalized = content;
  for (const workspaceRoot of roots.filter(Boolean)) {
    const escapedWorkspaceRoot = workspaceRoot.replace(/\\/g, "\\\\");
    normalized = normalized.split(workspaceRoot).join(pathToken);
    normalized = normalized.split(escapedWorkspaceRoot).join(pathToken);
  }
  normalized = normalized.replace(
    /__CODEX_VAR_TASK__(?:(?:\\\\|\\|\/)[^"'`,\]} )\r\n\t]*)*/g,
    (match) =>
      match
        .replace(/__CODEX_VAR_TASK__/g, "/var/task")
        .replace(/\\\\/g, "/")
        .replace(/\\/g, "/")
        .replace(/\/{2,}/g, "/"),
  );

  return normalized;
}

async function collectManifestFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectManifestFiles(fullPath)));
      continue;
    }

    if (
      entry.name.endsWith(".js") ||
      entry.name.endsWith(".json") ||
      entry.name.endsWith(".cjs")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function normalizePathsInServerDir(serverDir, workspaceRoots) {
  const manifestFiles = await collectManifestFiles(serverDir);

  await Promise.all(
    manifestFiles.map(async (filePath) => {
      const original = await fs.readFile(filePath, "utf8");
      const normalized = normalizeManifestPaths(original, workspaceRoots);
      if (normalized !== original) {
        await fs.writeFile(filePath, normalized, "utf8");
      }
    }),
  );
}

export async function normalizeNextManifestPaths(workspaceRoot, additionalRoots = []) {
  const serverDir = path.join(workspaceRoot, ".next", "server");
  await normalizePathsInServerDir(serverDir, [workspaceRoot, ...additionalRoots]);
}
