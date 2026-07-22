// Minimal Chrome DevTools Protocol client for the capture harness.
// Dependency-free: Node 22 ships a global WebSocket and fetch.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

export const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener("message", (message) => {
      const payload = JSON.parse(message.data);
      if (payload.id && this.pending.has(payload.id)) {
        const { resolve, reject } = this.pending.get(payload.id);
        this.pending.delete(payload.id);
        if (payload.error) reject(new Error(`${payload.error.message} (${payload.error.code})`));
        else resolve(payload.result);
        return;
      }
      const handlers = this.listeners.get(payload.method);
      if (handlers) for (const handler of handlers.splice(0)) handler(payload.params);
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new Cdp(socket);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method) {
    return new Promise((resolve) => {
      const handlers = this.listeners.get(method) ?? [];
      handlers.push(resolve);
      this.listeners.set(method, handlers);
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? "evaluate failed");
    }
    return result.result.value;
  }

  /** Waits for two animation frames so a React commit has been painted. */
  paint() {
    return this.evaluate(
      "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))",
    );
  }

  close() {
    this.socket.close();
  }
}

export async function waitForEndpoint(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {
      // Chrome is not listening yet.
    }
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${url}`);
    await sleep(150);
  }
}

/**
 * Launches a headed Chrome on a throwaway profile and attaches to its page
 * target. Headless is deliberately avoided: its GPU path is not the one the
 * instrument runs on.
 */
export async function launchChrome({ port, windowSize = "1280,800" }) {
  const profileDir = mkdtempSync(join(tmpdir(), "fishvj-capture-"));
  const chrome = spawn(
    CHROME,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--force-device-scale-factor=1",
      `--window-size=${windowSize}`,
      "--window-position=0,0",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const version = await waitForEndpoint(`http://127.0.0.1:${port}/json/version`);
  const targets = await waitForEndpoint(`http://127.0.0.1:${port}/json/list`);
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error("no page target");
  const client = await Cdp.connect(page.webSocketDebuggerUrl);

  return {
    client,
    version,
    async close() {
      client.close();
      chrome.kill();
      await sleep(400);
      rmSync(profileDir, { recursive: true, force: true });
    },
  };
}
