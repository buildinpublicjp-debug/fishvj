// S1a verification helper — renders the SSR shell through the built worker and
// hashes the markup with <script> and <link> tags removed, so that bundle-hash
// churn does not mask a DOM contract change.
//
// Usage: node capture/ssr-markup.mjs <path to dist/server/index.js>
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target) {
  console.error("usage: node capture/ssr-markup.mjs <dist/server/index.js>");
  process.exit(2);
}

const workerUrl = pathToFileURL(target);
workerUrl.searchParams.set("test", `${process.pid}`);
const { default: worker } = await import(workerUrl.href);

const response = await worker.fetch(
  new Request("http://localhost/", { headers: { accept: "text/html" } }),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);

if (response.status !== 200) {
  console.error(`unexpected status ${response.status}`);
  process.exit(1);
}

const raw = await response.text();
const stripped = raw
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(/<script\b[^>]*\/>/gi, "")
  .replace(/<link\b[^>]*>/gi, "");

const sha256 = createHash("sha256").update(stripped, "utf8").digest("hex");

console.log(
  JSON.stringify(
    {
      source: target,
      rawBytes: Buffer.byteLength(raw, "utf8"),
      strippedBytes: Buffer.byteLength(stripped, "utf8"),
      sha256,
    },
    null,
    2,
  ),
);
