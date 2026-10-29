import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import WebSocket from "ws";

const baseUrl = process.env.E2E_BASE_URL;
let browser;
let profileDir;

after(async () => {
  await stopBrowser();
  if (profileDir) {
    await removeProfile();
  }
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function stopBrowser() {
  const child = browser;
  if (!child) return;
  browser = undefined;

  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }

    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(5_000),
    ]);

    if (child.exitCode === null && child.signalCode === null) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        delay(2_000),
      ]);
    }
  }
  await delay(250);
}

async function removeProfile() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await rm(profileDir, { recursive: true, force: true });
      profileDir = undefined;
      return;
    } catch (error) {
      if (!["ENOTEMPTY", "EBUSY", "EPERM"].includes(error.code) || attempt === 5) {
        throw error;
      }
      await delay(250);
    }
  }
}

async function findChromium() {
  const names = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/repl/tools/bin/chromium",
    ...process.env.PATH.split(path.delimiter).flatMap((directory) =>
      names.map((name) => path.join(directory, name)),
    ),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next standard browser path.
    }
  }
  throw new Error("Chromium is required for the UI smoke test; set CHROMIUM_PATH.");
}

async function waitForPageTarget(port, child, getBrowserLogs) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Chromium exited early: ${getBrowserLogs()}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find(
          (target) => target.type === "page" && target.url === "about:blank",
        );
        if (page) return page;
      }
    } catch {
      // The remote debugging endpoint is still starting.
    }
    await delay(100);
  }
  throw new Error(`Chromium did not expose an about:blank page target: ${getBrowserLogs()}`);
}

async function launchChromium() {
  const executable = await findChromium();
  profileDir = await mkdtemp(path.join(os.tmpdir(), "replit-ui-smoke-"));
  let logs = "";
  browser = spawn(
    executable,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"], detached: true },
  );
  browser.stderr.setEncoding("utf8");
  browser.stderr.on("data", (chunk) => {
    logs = (logs + chunk).slice(-4_000);
  });

  const activePortFile = path.join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;
  let port;
  while (Date.now() < deadline) {
    if (browser.exitCode !== null) {
      throw new Error(`Chromium exited before startup: ${logs}`);
    }
    try {
      port = Number((await readFile(activePortFile, "utf8")).split(/\r?\n/)[0]);
      if (Number.isInteger(port) && port > 0) break;
    } catch {
      // The browser has not written its debugging port yet.
    }
    await delay(100);
  }
  assert.ok(port, `Timed out waiting for Chromium DevToolsActivePort: ${logs}`);

  return {
    target: await waitForPageTarget(port, browser, () => logs),
    logs: () => logs,
  };
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const subscribers = new Set();
  let nextId = 0;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out connecting to Chromium DevTools.")), 10_000);
    socket.once("open", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(request.timer);
      if (message.error) {
        request.reject(new Error(message.error.message));
      } else {
        request.resolve(message.result);
      }
      return;
    }
    if (message.method) {
      for (const subscriber of subscribers) subscriber(message.method, message.params);
    }
  });

  return {
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timed out waiting for Chromium command ${method}.`));
        }, 15_000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    onEvent(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    async evaluate(expression) {
      const response = await this.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (response.exceptionDetails) {
        throw new Error(
          response.exceptionDetails.exception?.description ||
            response.exceptionDetails.text,
        );
      }
      return response.result?.value;
    },
    close() {
      socket.close();
    },
  };
}

async function waitFor(cdp, predicate, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    try {
      lastValue = await cdp.evaluate(`(() => {
        const main = document.querySelector("main");
        return {
          path: window.location.pathname,
          readyState: document.readyState,
          title: document.title,
          heading: document.querySelector("main h1, h1")?.innerText?.trim() || "",
          mainText: main?.innerText?.trim() || "",
          bodyText: document.body?.innerText?.trim()?.slice(0, 160) || "",
          rootLength: document.querySelector("#root")?.innerHTML?.length || 0,
          authForm: !!document.querySelector('[data-testid="button-login"]'),
        };
      })()`);
      if (predicate(lastValue)) return lastValue;
    } catch {
      // Navigation can briefly destroy the previous execution context.
    }
    await delay(200);
  }
  throw new Error(
    `Timed out waiting for ${label}; last page state: ${JSON.stringify(lastValue)}`,
  );
}

test("authenticated browser can load the core business pages", async () => {
  assert.ok(baseUrl, "E2E_BASE_URL is required");
  assert.ok(process.env.E2E_ADMIN_EMAIL, "E2E_ADMIN_EMAIL is required");
  assert.ok(process.env.E2E_ADMIN_PASSWORD, "E2E_ADMIN_PASSWORD is required");

  const { target, logs } = await launchChromium();
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  const failures = [];
  const diagnostics = [];
  const stopListening = cdp.onEvent((method, params) => {
    if (
      method === "Network.responseReceived" &&
      params.response?.url.includes("/api/") &&
      [401, 403, 500].includes(params.response.status)
    ) {
      failures.push(
        `${params.response.status} ${params.response.url}`,
      );
    }
    if (method === "Runtime.exceptionThrown") {
      const description =
        params.exceptionDetails?.exception?.description ||
        params.exceptionDetails?.text ||
        "Uncaught browser exception";
      failures.push(description);
      diagnostics.push(description);
    }
    if (
      method === "Runtime.consoleAPICalled" &&
      params.type === "error"
    ) {
      diagnostics.push(
        params.args?.map((arg) => arg.value || arg.description).join(" ") ||
          "Browser console error",
      );
    }
    if (method === "Network.loadingFailed") {
      diagnostics.push(
        `Resource failed: ${params.errorText || "unknown error"}`,
      );
    }
  });

  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Page.navigate", { url: new URL("/auth", baseUrl).toString() });
    await waitFor(
      cdp,
      (state) => state.authForm,
      "the visible login form",
      45_000,
    );

    const fillResult = await cdp.evaluate(`(() => {
      const email = document.querySelector('[data-testid="input-email"]');
      const password = document.querySelector('[data-testid="input-password"]');
      const submit = document.querySelector('[data-testid="button-login"]');
      if (!email || !password || !submit) return "login controls missing";
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      setValue.call(email, ${JSON.stringify(process.env.E2E_ADMIN_EMAIL)});
      email.dispatchEvent(new Event("input", { bubbles: true }));
      setValue.call(password, ${JSON.stringify(process.env.E2E_ADMIN_PASSWORD)});
      password.dispatchEvent(new Event("input", { bubbles: true }));
      submit.click();
      return "submitted";
    })()`);
    assert.equal(fillResult, "submitted");

    await waitFor(
      cdp,
      (state) =>
        state.path === "/" &&
        !state.authForm &&
        state.mainText.length > 0,
      "successful login and the authenticated app shell",
      20_000,
    );
    failures.length = 0;

    const pages = [
      "/warehouses",
      "/refueling",
      "/lik/equipment",
      "/lik/movement",
      "/planning",
      "/logistics-plan",
      "/exchange-deals",
      "/reports/management",
      "/storage-cards",
    ];

    for (const route of pages) {
      const failureStart = failures.length;
      await cdp.send("Page.navigate", {
        url: new URL(route, baseUrl).toString(),
      });
      const state = await waitFor(
        cdp,
        (page) =>
          page.path === route &&
          page.mainText.length > 20 &&
          !page.authForm,
        `authenticated content at ${route}`,
      );
      await delay(500);

      assert.notEqual(
        state.heading,
        "Страница не найдена",
        `${route} must resolve to an existing page`,
      );
      assert.deepEqual(
        failures.slice(failureStart),
        [],
        `${route} must not trigger authorization/server errors`,
      );
      console.log(`UI smoke passed: ${route} — ${state.heading || "content rendered"}`);
    }

    assert.deepEqual(failures, []);
  } finally {
    stopListening();
    cdp.close();
    await stopBrowser();
    if (failures.length || diagnostics.length) {
      console.log("Browser diagnostics:", JSON.stringify(diagnostics.slice(-20)));
    }
    if (logs()) console.log("Chromium diagnostics:", logs());
  }
});
