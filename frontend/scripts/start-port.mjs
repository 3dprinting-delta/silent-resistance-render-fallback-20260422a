import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const port = process.env.PORT || "3000";
const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const command = existsSync(nextCli) ? process.execPath : process.platform === "win32" ? "npx.cmd" : "npx";
const args = existsSync(nextCli) ? [nextCli, "start", "-p", port] : ["next", "start", "-p", port];

const child = spawn(command, args, {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("Failed to launch Next.js production server.", error);
  process.exit(1);
});
