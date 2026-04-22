import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizeNextManifestPaths } from "./normalize-next-manifests.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");
const buildId = process.env.NEXT_BUILD_ID || "workspace-build";
const needsPathWorkaround = /\s/.test(workspaceRoot);

async function prepareBuildRoot() {
  if (!needsPathWorkaround) {
    return { buildRoot: workspaceRoot, cleanup: async () => {}, normalizedRoots: [] };
  }

  const tempRoot = path.join(os.tmpdir(), "codex-next-build");
  const buildRoot = path.join(tempRoot, "frontend-workspace");
  await mkdir(tempRoot, { recursive: true });
  if (existsSync(buildRoot)) {
    await rm(buildRoot, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
  }
  await symlink(workspaceRoot, buildRoot, "junction");
  return {
    buildRoot,
    normalizedRoots: [buildRoot],
    cleanup: async () => {
      if (existsSync(buildRoot)) {
        await rm(buildRoot, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
      }
    },
  };
}

await import(pathToFileURL(path.join(__dirname, "clean-next.mjs")).href);

const { buildRoot, cleanup, normalizedRoots } = await prepareBuildRoot();

try {
  await new Promise((resolve, reject) => {
    const nextBin = path.join(buildRoot, "node_modules", "next", "dist", "bin", "next");
    const child = spawn(process.execPath, [nextBin, "build"], {
      cwd: buildRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        NEXT_BUILD_ID: buildId,
      },
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`next build exited with code ${code ?? "unknown"}`));
    });
  });
} finally {
  await normalizeNextManifestPaths(workspaceRoot, normalizedRoots);
  await cleanup();
}
