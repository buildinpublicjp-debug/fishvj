// Captures the manual A/B set for FISHVJ_UI_VISUAL_CONTRACT.md §7 — one
// screenshot per control axis, driven through the real DOM controls with the
// normal (wall-clock) render loop running. These are eyeball references for
// zDOG, not a pixel gate: before T0-A the base commit seeds fish placement with
// Math.random(), so pixel comparison against it is meaningless by design
// (FISHVJ_DESIGN_V2.md §9.1).
//
// Usage: node capture/ab-shots.mjs --variant base --url http://127.0.0.1:3000
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { STATES } from "./lib/ab-states.mjs";
import { launchChrome } from "./lib/cdp.mjs";

const ROOT = new URL("..", import.meta.url).pathname;

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const variant = arg("variant");
if (!variant) {
  console.error("usage: node capture/ab-shots.mjs --variant <name> [--url <origin>] [--port <n>]");
  process.exit(2);
}
const origin = arg("url", "http://127.0.0.1:3000");
const port = Number(arg("port", "9334"));

const outDir = join(ROOT, "capture/ab", variant);
mkdirSync(outDir, { recursive: true });

const browser = await launchChrome({ port });
const { client } = browser;
try {
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });

  for (const state of STATES) {
    const loaded = client.once("Page.loadEventFired");
    await client.send("Page.navigate", { url: origin });
    await loaded;
    await sleep(2500); // font + atlas load

    for (const step of state.steps) {
      await client.evaluate(`(async () => { ${step}; })()`);
      await sleep(300);
    }
    await sleep(state.settleMs);

    const shot = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    writeFileSync(join(outDir, `${state.label}.png`), Buffer.from(shot.data, "base64"));
    process.stdout.write(`  ${variant} ${state.label}\n`);
  }
} finally {
  await browser.close();
}
