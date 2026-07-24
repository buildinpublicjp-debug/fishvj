// Generates the stack bank for the instrument: N visually distinct 120-frame
// loops (960×540 WebP, 30fps) rendered from the fish engine itself via the
// ?capture=1 bridge. Each stack is a different scene/mode/swarm/macro world, so
// the decks have real, contrasting material to mix.
//
// Usage: node capture/gen-stacks.mjs   (server on :3000 with the console route)
import { setTimeout as sleep } from "node:timers/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import { launchChrome } from "./lib/cdp.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const FRAMES = 120;
const SETTLE_TICKS = 360; // 6s — lets scene/dive/swarm transitions converge

const ui = (type, payload) => ({ v: 1, producerId: "ui", type, payload });
const param = (id, value) => ui("param", { id, update: "absolute", value });

// Six worlds. Each entry: id, display name, events applied at tick 1.
const STACKS = [
  { id: "mystic-mandala", name: "MYSTIC", events: [] }, // default look
  { id: "acid-euphoric", name: "ACID 12", events: [
    ui("mode", { update: "absolute", value: "EUPHORIC" }),
    ui("macro", { update: "absolute", value: "ACID" }),
    param("colorDrive", 0.9),
  ] },
  { id: "deep-swim", name: "OCEAN", events: [
    ui("scene", { update: "absolute", value: "FREE_SWIM" }),
    ui("macro", { update: "absolute", value: "DEEP" }),
    param("fishCount", 1600),
  ] },
  { id: "infinite-dive", name: "DIVE", events: [
    param("dive", true),
    param("speed", 1.1),
  ] },
  { id: "sensual-vortex", name: "VORTEX", events: [
    ui("mode", { update: "absolute", value: "SENSUAL" }),
    param("swarm", "VORTEX"),
    ui("macro", { update: "absolute", value: "CLEAN" }),
  ] },
  { id: "school-rush", name: "RUSH", events: [
    ui("scene", { update: "absolute", value: "FREE_SWIM" }),
    param("dive", true),
    param("fishCount", 2000),
    param("speed", 1.4),
  ] },
];

const b = await launchChrome({ port: 9366 });
try {
  const { client } = b;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

  for (const stack of STACKS) {
    const dir = `${ROOT}public/stacks/${stack.id}`;
    mkdirSync(dir, { recursive: true });
    const loaded = client.once("Page.loadEventFired");
    await client.send("Page.navigate", { url: "http://127.0.0.1:3000/?capture=1" });
    await loaded;
    const deadline = Date.now() + 30000;
    for (;;) {
      if (await client.evaluate("Boolean(window.__fishvjCapture && window.__fishvjCapture.isReady())")) break;
      if (Date.now() > deadline) throw new Error("bridge not ready");
      await sleep(150);
    }
    await sleep(500);
    const events = JSON.stringify({ 1: stack.events });
    await client.evaluate(`window.__fishvjCapture.runTo(${SETTLE_TICKS}, ${events}, 0)`);

    let tick = SETTLE_TICKS;
    for (let i = 0; i < FRAMES; i += 1) {
      tick += 2; // 30fps at 60Hz
      // advance + draw + downscale + WebP encode in ONE task so the WebGL
      // drawing buffer is still valid for drawImage.
      const b64 = await client.evaluate(`(async () => {
        window.__fishvjCapture.runTo(${tick}, {}, 0);
        window.__fishvjCapture.draw();
        const src = document.querySelector('.fish-canvas');
        const c = window.__stackC || (window.__stackC = Object.assign(document.createElement('canvas'), { width: 960, height: 540 }));
        const ctx = c.getContext('2d');
        ctx.drawImage(src, 0, 0, 960, 540);
        const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.85));
        const u8 = new Uint8Array(await blob.arrayBuffer());
        let s = '';
        for (let o = 0; o < u8.length; o += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(o, o + 0x8000));
        return btoa(s);
      })()`);
      writeFileSync(`${dir}/frame-${String(i).padStart(3, "0")}.webp`, Buffer.from(b64, "base64"));
    }
    console.log(`stack ${stack.id} (${stack.name}): ${FRAMES} frames`);
  }
  console.log("all stacks generated");
} finally {
  await b.close();
}
