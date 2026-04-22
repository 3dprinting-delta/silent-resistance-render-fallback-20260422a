import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";

const workspaceRoot = process.cwd();

const pathsToRemove = [
  path.join(workspaceRoot, ".next"),
  path.join(workspaceRoot, "node_modules", ".cache", "next"),
  path.join(workspaceRoot, "node_modules", ".cache", "webpack"),
];

for (const target of pathsToRemove) {
  if (!existsSync(target)) continue;
  await rm(target, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
}
