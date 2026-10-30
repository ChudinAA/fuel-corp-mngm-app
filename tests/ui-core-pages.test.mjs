import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import pg from "pg";
import WebSocket from "ws";

const { Pool } = pg;
const baseUrl = process.env.E2E_BASE_URL;
const runId = randomUUID();
const fixtures = {
  baseName: `ui-smoke-base-${runId}`,
  supplierName: `ui-smoke-supplier-${runId}`,
  buyerName: `ui-smoke-buyer-${runId}`,
  warehouseName: `ui-smoke-warehouse-${runId}`,
  refuelingNote: `ui-smoke-refueling-${runId}`,
  movementNote: `ui-smoke-movement-${runId}`,
};
let browser;
let profileDir;
let pool;

after(async () => {
  await stopBrowser();
  try {
    if (pool) await cleanUiFixtures();
  } finally {
    if (pool) {
      await pool.end();
      pool = undefined;
    }
    if (profileDir) await removeProfile();
  }
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function seedUiFixtures() {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const base = await pool.query(
    `INSERT INTO bases (name, base_type)
     VALUES ($1, 'refueling')
     RETURNING id`,
    [fixtures.baseName],
  );
  const supplier = await pool.query(
    "INSERT INTO suppliers (name) VALUES ($1) RETURNING id",
    [fixtures.supplierName],
  );
  await pool.query(
    "INSERT INTO supplier_bases (supplier_id, base_id) VALUES ($1, $2)",
    [supplier.rows[0].id, base.rows[0].id],
  );
  await pool.query(
    "INSERT INTO customers (name, module) VALUES ($1, 'refueling')",
    [fixtures.buyerName],
  );
  await pool.query(
    `INSERT INTO warehouses
       (name, current_balance_tonnes, average_cost_per_tonne,
        pvkj_balance_tonnes, pvkj_average_cost_per_tonne)
     VALUES ($1, 0, 0, 0, 0)`,
    [fixtures.warehouseName],
  );
}

async function cleanUiFixtures() {
  const [refuelings, movements] = await Promise.all([
    pool.query("SELECT id FROM aircraft_refueling WHERE notes = $1", [
      fixtures.refuelingNote,
    ]),
    pool.query("SELECT id FROM movement WHERE notes = $1", [
      fixtures.movementNote,
    ]),
  ]);
  const entityIds = [
    ...refuelings.rows.map((row) => row.id),
    ...movements.rows.map((row) => row.id),
  ];
  if (entityIds.length) {
    await pool.query(
      "DELETE FROM audit_log WHERE entity_id::text = ANY($1::text[])",
      [entityIds],
    );
  }
  await pool.query("DELETE FROM movement WHERE notes = $1", [
    fixtures.movementNote,
  ]);
  if (movements.rows.length) {
    await pool.query(
      `DELETE FROM warehouse_transactions
       WHERE source_type = 'movement'
         AND source_id::text = ANY($1::text[])`,
      [movements.rows.map((row) => row.id)],
    );
  }
  await pool.query("DELETE FROM aircraft_refueling WHERE notes = $1", [
    fixtures.refuelingNote,
  ]);
  await pool.query("DELETE FROM warehouses WHERE name = $1", [
    fixtures.warehouseName,
  ]);
  await pool.query("DELETE FROM suppliers WHERE name = $1", [
    fixtures.supplierName,
  ]);
  await pool.query("DELETE FROM customers WHERE name = $1", [
    fixtures.buyerName,
  ]);
  await pool.query("DELETE FROM bases WHERE name = $1", [fixtures.baseName]);
}

async function waitForExpression(cdp, expression, label, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    try {
      lastValue = await cdp.evaluate(expression);
      if (lastValue) return lastValue;
    } catch {
      // React may replace the active document while a route is changing.
    }
    await delay(150);
  }
  throw new Error(`Timed out waiting for ${label}; last value: ${lastValue}`);
}

async function clickTestId(cdp, testId) {
  const clicked = await cdp.evaluate(`(() => {
    const element = document.querySelector(
      ${JSON.stringify(`[data-testid="${testId}"]`)},
    );
    if (!element) return false;
    element.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Expected [data-testid="${testId}"] to be clickable`);
}

async function fillInput(cdp, selector, value) {
  const filled = await cdp.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!(input instanceof HTMLInputElement)) return false;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set;
    setter.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  assert.equal(filled, true, `Expected input ${selector} to exist`);
}

async function selectComboboxOption(cdp, testId, label) {
  await clickTestId(cdp, testId);
  const labelJson = JSON.stringify(label);
  await waitForExpression(
    cdp,
    `Array.from(document.querySelectorAll('[role="option"]'))
      .some((option) => option.innerText.includes(${labelJson}))`,
    `combobox option ${label}`,
  );
  const selected = await cdp.evaluate(`(() => {
    const option = Array.from(document.querySelectorAll('[role="option"]'))
      .find((item) => item.innerText.includes(${labelJson}));
    if (!option) return false;
    option.click();
    return true;
  })()`);
  assert.equal(selected, true, `Expected to select option "${label}"`);
}

async function clickButtonWithText(cdp, text) {
  const textJson = JSON.stringify(text);
  const clicked = await cdp.evaluate(`(() => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((item) => item.innerText.trim() === ${textJson});
    if (!button) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Expected button "${text}"`);
}

async function clickMenuItemWithText(cdp, text) {
  const textJson = JSON.stringify(text);
  const clicked = await cdp.evaluate(`(() => {
    const item = Array.from(document.querySelectorAll('[role="menuitem"]'))
      .find((element) => element.innerText.trim() === ${textJson});
    if (!item) return false;
    item.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Expected menu item "${text}"`);
}

async function openEditMenuForRow(cdp, rowText) {
  const rowTextJson = JSON.stringify(rowText);
  await waitForExpression(
    cdp,
    `Array.from(document.querySelectorAll("tbody tr"))
      .some((row) => row.innerText.includes(${rowTextJson}))`,
    `table row containing ${rowText}`,
  );
  const opened = await cdp.evaluate(`(() => {
    const row = Array.from(document.querySelectorAll("tbody tr"))
      .find((item) => item.innerText.includes(${rowTextJson}));
    const button = row?.querySelector("td:last-child button");
    if (!button) return false;
    button.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        button: 0,
        pointerType: "mouse",
        isPrimary: true,
      }),
    );
    button.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        pointerType: "mouse",
        isPrimary: true,
      }),
    );
    button.click();
    return true;
  })()`);
  assert.equal(opened, true, `Expected an action menu in row "${rowText}"`);
  await waitForExpression(
    cdp,
    `Array.from(document.querySelectorAll('[role="menuitem"]'))
      .some((item) => item.innerText.trim() === "Редактировать")`,
    "the edit action",
  );
  await clickMenuItemWithText(cdp, "Редактировать");
}

async function waitForDatabaseRow(
  query,
  params,
  label,
  predicate = () => true,
  timeoutMs = 12_000,
) {
  const deadline = Date.now() + timeoutMs;
  let row;
  while (Date.now() < deadline) {
    const result = await pool.query(query, params);
    row = result.rows[0];
    if (row && predicate(row)) return row;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}; last row: ${JSON.stringify(row)}`);
}

async function waitForAuditOperations(entityId, expectedOperations) {
  const deadline = Date.now() + 12_000;
  let operations = [];
  while (Date.now() < deadline) {
    const result = await pool.query(
      "SELECT operation FROM audit_log WHERE entity_id = $1",
      [entityId],
    );
    operations = result.rows.map((row) => row.operation);
    if (expectedOperations.every((operation) => operations.includes(operation))) {
      return;
    }
    await delay(100);
  }
  assert.fail(
    `Audit for ${entityId} did not contain ${expectedOperations.join(", ")}; ` +
      `found ${operations.join(", ")}`,
  );
}

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

  await seedUiFixtures();
  const { target, logs } = await launchChromium();
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  const failures = [];
  const diagnostics = [];
  const stopListening = cdp.onEvent((method, params) => {
    if (
      method === "Network.requestWillBeSent" &&
      params.request?.method === "POST" &&
      params.request.url.endsWith("/api/refueling") &&
      params.request.postData
    ) {
      try {
        const payload = JSON.parse(params.request.postData);
        const uuidFields = [
          "nomenclatureId",
          "supplierId",
          "buyerId",
          "basisId",
          "customerBasisId",
          "equipmentId",
          "warehouseId",
        ];
        diagnostics.push(
          `Refueling POST UUID candidates: ${JSON.stringify(
            Object.fromEntries(
              uuidFields.map((field) => [field, payload[field] ?? null]),
            ),
          )}`,
        );
      } catch {
        diagnostics.push("Refueling POST payload could not be parsed");
      }
    }
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
      "/dashboard",
      "/opt",
      "/exchange",
      "/exchange-advances",
      "/exchange-directories",
      "/movement",
      "/warehouses",
      "/prices",
      "/delivery",
      "/counterparties",
      "/directories",
      "/abroad",
      "/refueling",
      "/storage-cards",
      "/finance/cashflow",
      "/finance/payment-calendar",
      "/finance/price-calculation",
      "/reports/current",
      "/reports/analytics",
      "/reports/registries",
      "/planning",
      "/reports/gov-contracts",
      "/reports/budget",
      "/admin/users",
      "/admin/roles",
      "/admin/widgets",
      "/admin/settings",
      "/rent",
      "/transportation",
      "/lik/refueling",
      "/lik/movement",
      "/lik/equipment",
      "/lik",
      "/exchange-deals",
      "/reports/management",
      "/logistics-plan",
    ];

    for (const [index, route] of pages.entries()) {
      const failureStart = failures.length;
      if (index === 0) {
        await cdp.send("Page.navigate", {
          url: new URL(route, baseUrl).toString(),
        });
      } else {
        await cdp.evaluate(`(() => {
          window.history.pushState({}, "", ${JSON.stringify(route)});
          window.dispatchEvent(new PopStateEvent("popstate"));
          return window.location.pathname;
        })()`);
      }
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

    await cdp.evaluate(`(() => {
      window.history.pushState({}, "", "/refueling");
      window.dispatchEvent(new PopStateEvent("popstate"));
    })()`);
    await waitFor(
      cdp,
      (state) => state.path === "/refueling" && state.mainText.length > 20,
      "the refueling page before form interaction",
    );
    await clickTestId(cdp, "button-add-refueling");
    await waitForExpression(
      cdp,
      `!!document.querySelector('[data-testid="select-supplier"]') &&
       !!document.querySelector('[data-testid="select-buyer"]')`,
      "the new refueling form",
    );
    await selectComboboxOption(cdp, "select-supplier", fixtures.supplierName);
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="select-basis"]')
        ?.innerText.includes(${JSON.stringify(fixtures.baseName)})`,
      "automatic refueling basis selection",
    );
    await selectComboboxOption(cdp, "select-buyer", fixtures.buyerName);
    await clickTestId(cdp, "switch-input-mode");
    await waitForExpression(
      cdp,
      `!!document.querySelector('[data-testid="input-quantity-tonnes"]')`,
      "the refueling tonne input",
    );
    await fillInput(
      cdp,
      '[data-testid="input-quantity-tonnes"]',
      "0.12345",
    );
    await fillInput(
      cdp,
      '[data-testid="input-notes"]',
      fixtures.refuelingNote,
    );
    await clickButtonWithText(cdp, "Сохранить черновик");
    const createdRefueling = await waitForDatabaseRow(
      `SELECT id, quantity_tonnes, input_mode, is_draft
       FROM aircraft_refueling WHERE notes = $1`,
      [fixtures.refuelingNote],
      "the refueling draft created through the UI",
    );
    assert.equal(createdRefueling.input_mode, "tonnes");
    assert.equal(Number(createdRefueling.quantity_tonnes), 0.12345);
    assert.equal(createdRefueling.is_draft, true);
    await waitForAuditOperations(createdRefueling.id, ["CREATE"]);
    await waitForExpression(
      cdp,
      `!document.querySelector('[role="dialog"][data-state="open"]')`,
      "the refueling form to close after saving",
    );

    await fillInput(
      cdp,
      '[data-testid="input-search-refueling"]',
      fixtures.supplierName,
    );
    await openEditMenuForRow(cdp, fixtures.supplierName);
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="input-quantity-tonnes"]')
        ?.value === "0.12345"`,
      "the saved tonne value in the refueling edit form",
    );
    await fillInput(
      cdp,
      '[data-testid="input-quantity-tonnes"]',
      "0.23456",
    );
    await fillInput(
      cdp,
      '[data-testid="input-notes"]',
      fixtures.refuelingNote,
    );
    await clickButtonWithText(cdp, "Сохранить черновик");
    const editedRefueling = await waitForDatabaseRow(
      `SELECT id, quantity_tonnes, input_mode, is_draft
       FROM aircraft_refueling WHERE notes = $1`,
      [fixtures.refuelingNote],
      "the refueling draft updated through the UI",
      (row) => Number(row.quantity_tonnes) === 0.23456,
    );
    assert.equal(editedRefueling.id, createdRefueling.id);
    assert.equal(editedRefueling.input_mode, "tonnes");
    assert.equal(editedRefueling.is_draft, true);
    await waitForAuditOperations(editedRefueling.id, ["CREATE", "UPDATE"]);
    await waitForExpression(
      cdp,
      `!document.querySelector('[role="dialog"][data-state="open"]')`,
      "the refueling edit form to close after saving",
    );
    console.log("UI flow passed: refueling draft created and edited in tonnes");

    await cdp.evaluate(`(() => {
      window.history.pushState({}, "", "/movement");
      window.dispatchEvent(new PopStateEvent("popstate"));
    })()`);
    await waitFor(
      cdp,
      (state) => state.path === "/movement" && state.mainText.length > 20,
      "the movement page before form interaction",
    );
    await clickTestId(cdp, "button-add-movement");
    await waitForExpression(
      cdp,
      `!!document.querySelector('[data-testid="input-quantity-tonnes"]') &&
       !!document.querySelector('[data-testid="select-movement-to"]')`,
      "the new movement form",
    );
    const movementMode = await cdp.evaluate(
      `document.querySelector('[data-testid="switch-input-mode"]')
        ?.getAttribute("aria-checked")`,
    );
    assert.equal(movementMode, "true", "movement forms start in tonne mode");
    await selectComboboxOption(
      cdp,
      "select-movement-to",
      fixtures.warehouseName,
    );
    await fillInput(
      cdp,
      '[data-testid="input-quantity-tonnes"]',
      "0.12345",
    );
    await fillInput(
      cdp,
      '[data-testid="input-movement-notes"]',
      fixtures.movementNote,
    );
    await clickTestId(cdp, "button-save-draft");
    const createdMovement = await waitForDatabaseRow(
      `SELECT id, quantity_tonnes, input_mode, is_draft, to_warehouse_id
       FROM movement WHERE notes = $1`,
      [fixtures.movementNote],
      "the movement draft created through the UI",
    );
    assert.equal(Number(createdMovement.quantity_tonnes), 0.12345);
    assert.equal(createdMovement.input_mode, "tonnes");
    assert.equal(createdMovement.is_draft, true);
    await waitForAuditOperations(createdMovement.id, ["CREATE"]);
    await waitForExpression(
      cdp,
      `!document.querySelector('[role="dialog"][data-state="open"]')`,
      "the movement form to close after saving",
    );

    await fillInput(
      cdp,
      'input[placeholder="Поиск..."]',
      fixtures.warehouseName,
    );
    await openEditMenuForRow(cdp, fixtures.warehouseName);
    await waitForExpression(
      cdp,
      `document.querySelector('[data-testid="input-quantity-tonnes"]')
        ?.value === "0.12345"`,
      "the saved tonne value in the movement edit form",
    );
    await fillInput(
      cdp,
      '[data-testid="input-quantity-tonnes"]',
      "0.23456",
    );
    await fillInput(
      cdp,
      '[data-testid="input-movement-notes"]',
      fixtures.movementNote,
    );
    await clickTestId(cdp, "button-save-draft");
    const editedMovement = await waitForDatabaseRow(
      `SELECT id, quantity_tonnes, input_mode, is_draft, to_warehouse_id
       FROM movement WHERE notes = $1`,
      [fixtures.movementNote],
      "the movement draft updated through the UI",
      (row) => Number(row.quantity_tonnes) === 0.23456,
    );
    assert.equal(editedMovement.id, createdMovement.id);
    assert.equal(editedMovement.input_mode, "tonnes");
    assert.equal(editedMovement.is_draft, true);
    await waitForAuditOperations(editedMovement.id, ["CREATE", "UPDATE"]);
    const warehouseBalance = await pool.query(
      `SELECT current_balance_tonnes
       FROM warehouses WHERE name = $1`,
      [fixtures.warehouseName],
    );
    assert.equal(Number(warehouseBalance.rows[0]?.current_balance_tonnes), 0);
    await waitForExpression(
      cdp,
      `!document.querySelector('[role="dialog"][data-state="open"]')`,
      "the movement edit form to close after saving",
    );
    console.log("UI flow passed: movement draft created and edited in tonnes");

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
