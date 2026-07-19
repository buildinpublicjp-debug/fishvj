import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the FishVJ console shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>FishVJ/);
  assert.match(html, /FISH/);
  assert.match(html, /FISH DECK/);
  assert.match(html, /INFINITE DIVE/);
  assert.match(html, /MODE MORPH/);
  assert.match(html, /HOLD TO FADE/);
  assert.match(html, /CORE/);
  assert.match(html, />FX</);
  assert.match(html, /CUES/);
  assert.match(html, /SPACE\+1–8 FX/);
  assert.match(html, /F1–F8 CUE/);
  assert.match(html, /AUDIO INPUT/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
