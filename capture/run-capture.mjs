// Drives one deterministic capture run of capture/manifest.json against a
// running FishVJ production server, through a headed Chrome over CDP.
//
// Headed (not headless) is required: the headless GPU path differs from the one
// the instrument actually runs on. The page is loaded with `?capture=1`, which
// is the only way the in-app capture bridge is installed.
//
// Usage:
//   node capture/run-capture.mjs --run run-1 [--url http://127.0.0.1:3000] [--port 9333]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { launchChrome } from "./lib/cdp.mjs";
import { hashSample } from "./lib/hash.mjs";

const ROOT = new URL("..", import.meta.url).pathname;

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const runId = arg("run");
if (!runId) {
  console.error("usage: node capture/run-capture.mjs --run <id> [--url <origin>] [--port <n>]");
  process.exit(2);
}
const origin = arg("url", "http://127.0.0.1:3000");
const port = Number(arg("port", "9333"));

const manifestPath = arg("manifest", join(ROOT, "capture/manifest.json"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const eventsByTick = {};
for (const entry of manifest.events) {
  (eventsByTick[entry.tick] ??= []).push(entry.input);
}

const frameDir = join(ROOT, "capture/frames", runId);
mkdirSync(frameDir, { recursive: true });
mkdirSync(join(ROOT, "capture/traces"), { recursive: true });
mkdirSync(join(ROOT, "capture/runs"), { recursive: true });

const browser = await launchChrome({ port });
const { client, version } = browser;
try {
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: manifest.viewport.width,
    height: manifest.viewport.height,
    deviceScaleFactor: manifest.viewport.deviceScaleFactor,
    mobile: false,
  });
  // The app already collapses animations and transitions under reduced motion,
  // which pins every DOM overlay to its settled state at capture time
  // (FISHVJ_UI_VISUAL_CONTRACT.md §7.1 step 5).
  await client.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });

  const loaded = client.once("Page.loadEventFired");
  await client.send("Page.navigate", { url: `${origin}/?capture=1` });
  await loaded;

  const deadline = Date.now() + 30000;
  for (;;) {
    const ready = await client.evaluate(
      "Boolean(window.__fishvjCapture && window.__fishvjCapture.isReady())",
    );
    if (ready) break;
    if (Date.now() > deadline) throw new Error("capture bridge never became ready");
    await sleep(100);
  }
  // Let the resize observer settle on the emulated viewport.
  await sleep(500);

  const canvasSize = await client.evaluate("window.__fishvjCapture.size()");
  const samples = [await client.evaluate("window.__fishvjCapture.sample()")];

  const shoot = async (tick, label) => {
    await client.paint();
    await sleep(120);
    await client.evaluate("window.__fishvjCapture.draw()");
    await client.paint();
    const shot = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    writeFileSync(
      join(frameDir, `tick-${String(tick).padStart(5, "0")}.png`),
      Buffer.from(shot.data, "base64"),
    );
    process.stdout.write(`  tick ${tick} ${label}\n`);
  };

  const eventsJson = JSON.stringify(eventsByTick);
  for (const point of manifest.captures) {
    const produced = await client.evaluate(
      `window.__fishvjCapture.runTo(${point.tick}, ${eventsJson}, ${manifest.hashSampleEvery})`,
    );
    samples.push(...produced);
    await shoot(point.tick, point.label);
  }
  const tail = await client.evaluate(
    `window.__fishvjCapture.runTo(${manifest.totalTicks}, ${eventsJson}, ${manifest.hashSampleEvery})`,
  );
  samples.push(...tail);

  const trace = samples.map((sample) => ({ tick: sample.tick, hash: hashSample(sample) }));

  writeFileSync(
    join(ROOT, "capture/traces", `${runId}.trace.json`),
    `${JSON.stringify(
      {
        runId,
        manifestVersion: manifest.version,
        seed: manifest.seed,
        simHz: manifest.simHz,
        hashSampleEvery: manifest.hashSampleEvery,
        totalTicks: manifest.totalTicks,
        viewport: manifest.viewport,
        canvas: canvasSize,
        browser: version.Browser,
        trace,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(ROOT, "capture/runs", `${runId}.samples.json`),
    `${JSON.stringify(samples)}\n`,
  );

  console.log(
    `run ${runId}: ${manifest.captures.length} frames, ${trace.length} hash samples, canvas ${canvasSize.width}x${canvasSize.height}`,
  );
} finally {
  await browser.close();
}
