import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..");

async function waitForConfig(port) {
  const url = `http://127.0.0.1:${port}/api/config`;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("server did not start");
}

test("server config uses Aug & Ach contact email and gates Meshy start", async () => {
  const port = 18995;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: appDir,
    env: {
      ...process.env,
      PORT: String(port),
      CONTACT_EMAIL: "",
      MESHY_ENABLE_LIVE_CALLS: "false",
      MESHY_DAILY_AUTOMATION_ENABLED: "false",
      SQUARESPACE_API_KEY: "",
    },
    stdio: "ignore",
  });

  try {
    const config = await waitForConfig(port);
    assert.equal(config.contactEmail, "augnach@gmail.com");
    assert.equal(config.paymentVerificationConfigured, false);

    const response = await fetch(`http://127.0.0.1:${port}/api/meshy/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "buyer@example.com", prompt: "A small desk organizer" }),
    });
    const payload = await response.json();
    assert.equal(response.status, 402);
    assert.equal(payload.ok, false);
    assert.match(payload.error, /Payment verification/);
  } finally {
    child.kill();
  }
});
