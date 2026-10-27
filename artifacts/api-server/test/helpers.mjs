// Shared helpers for the API test suites (node:test + fetch, no dependencies).
//
// Guardrails: refuse NODE_ENV=production and any non-local API_URL. By default
// each suite starts the built server (dist/index.mjs) with the root .env on its
// own port. Test products always get a slug starting with "security-test-", and
// cleanup only ever deletes products whose slug has that prefix.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const serverEntry = path.resolve(here, "../dist/index.mjs");
const rootEnv = path.resolve(here, "../../../.env");

export const NOTE = "security-test";
export const TEST_SLUG_PREFIX = "security-test-";
export const TEST_BUYER = { name: "Security Test Buyer", email: "security-test-buyer@instaveg.test", password: "security-test-buyer-pw", role: "buyer" };
export const TEST_SELLER = { name: "Security Test Seller", email: "security-test-seller@instaveg.test", password: "security-test-seller-pw", role: "seller" };

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run API tests with NODE_ENV=production");
}
if (process.env.API_URL) {
  const host = new URL(process.env.API_URL).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`Refusing to run API tests against non-local API_URL host "${host}"`);
  }
}

export function startServer(env) {
  return spawn(process.execPath, [`--env-file=${rootEnv}`, serverEntry], {
    // Suites log in many times; a high auth limit keeps M4 rate limiting out of the way.
    env: { ...process.env, NODE_ENV: "test", AUTH_RATE_LIMIT_MAX: "1000", ...env },
    stdio: ["ignore", "ignore", "pipe"],
  });
}

// Starts a local server on `port` unless API_URL is set. Returns { base, stop }.
export async function startApi(port, env = {}) {
  let server = null;
  const base = process.env.API_URL ? process.env.API_URL.replace(/\/$/, "") : `http://127.0.0.1:${port}/api`;
  if (!process.env.API_URL) {
    assert.ok(fs.existsSync(serverEntry), "dist/index.mjs missing; run the build first");
    server = startServer({ PORT: String(port), ...env });
    let stderr = "";
    server.stderr.on("data", (chunk) => { stderr += chunk; });
    server.on("exit", (code) => { if (code) console.error(`# server exited with ${code}\n${stderr}`); });
  }
  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      if ((await fetch(`${base}/healthz`)).ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`API did not become healthy at ${base}`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  const stop = () => new Promise((resolve) => {
    if (!server || server.exitCode !== null) return resolve();
    server.once("exit", () => resolve());
    server.kill();
  });
  return { base, stop };
}

export function makeApi(base) {
  return async function api(method, url, token, body) {
    const res = await fetch(`${base}${url}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };
}

export async function login(api, email, password) {
  const res = await api("POST", "/auth/login", null, { email, password });
  assert.equal(res.status, 200, `login ${email}: ${JSON.stringify(res.data)}`);
  return { token: res.data.token, id: res.data.user.id };
}

export async function loginOrRegister(api, account) {
  const res = await api("POST", "/auth/login", null, { email: account.email, password: account.password });
  if (res.status === 200) {
    console.log(`# ${account.email}: logged into existing account`);
    return { token: res.data.token, id: res.data.user.id };
  }
  const reg = await api("POST", "/auth/register", null, account);
  assert.equal(reg.status, 201, `register ${account.email}: ${JSON.stringify(reg.data)}`);
  console.log(`# ${account.email}: registered new account`);
  return { token: reg.data.token, id: reg.data.user.id };
}

export async function loginDemoAccounts(api) {
  const accounts = {
    admin: await login(api, "admin@instaveg.com", "admin123"),
    buyer: await login(api, "buyer@instaveg.com", "buyer123"),
    ramesh: await login(api, "ramesh@instaveg.com", "seller123"),
    priya: await login(api, "priya@instaveg.com", "seller123"),
    arjun: await login(api, "arjun@instaveg.com", "seller123"),
    buyer2: await loginOrRegister(api, TEST_BUYER),
  };
  for (const key of ["ramesh", "priya", "arjun"]) {
    const res = await api("GET", "/sellers/profile", accounts[key].token);
    assert.equal(res.status, 200);
    accounts[key].sellerId = res.data.id;
  }
  return accounts;
}

// Deletes ONLY products whose slug starts with "security-test-" (never by name).
export async function cleanupTestProducts(api, adminToken) {
  const res = await api("GET", "/products?search=security%20test&limit=100", adminToken);
  assert.equal(res.status, 200);
  const leftovers = res.data.products.filter((p) => typeof p.slug === "string" && p.slug.startsWith(TEST_SLUG_PREFIX));
  for (const p of leftovers) {
    const del = await api("DELETE", `/products/${p.id}`, adminToken);
    assert.equal(del.status, 204, `cleanup ${p.slug}`);
  }
  return leftovers.length;
}

// Creates a product whose name starts with "Security Test", so its slug starts
// with "security-test-". Asserts the prefix before returning.
export async function createTestProduct(api, sellerToken, label, overrides = {}) {
  const categories = await api("GET", "/categories", null);
  const res = await api("POST", "/products", sellerToken, {
    name: `Security Test ${label}`,
    description: "Temporary product created by the API test suite",
    price: 10,
    mrp: 12,
    unit: "piece",
    stock: 20,
    categoryId: categories.data[0].id,
    ...overrides,
  });
  assert.equal(res.status, 201, `create test product ${label}: ${JSON.stringify(res.data)}`);
  assert.ok(res.data.slug.startsWith(TEST_SLUG_PREFIX), `unexpected test slug ${res.data.slug}`);
  return res.data;
}

export async function getStock(api, adminToken, productId) {
  const res = await api("GET", `/products/${productId}`, adminToken);
  assert.equal(res.status, 200);
  return res.data.stock;
}

export async function addAddress(api, who, created) {
  const res = await api("POST", "/users/addresses", who.token, {
    label: NOTE, street: "1 Test Street", city: "Pune", state: "Maharashtra", pincode: "411001",
  });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  created.push({ token: who.token, id: res.data.id });
  return res.data.id;
}

export async function deleteAddresses(api, created) {
  for (const { token, id } of created) {
    await api("DELETE", `/users/addresses/${id}`, token).catch(() => {});
  }
}

export async function setCart(api, who, lines) {
  assert.ok((await api("DELETE", "/cart", who.token)).status < 300);
  for (const [productId, quantity] of lines) {
    const res = await api("POST", "/cart/items", who.token, { productId, quantity });
    assert.equal(res.status, 200, JSON.stringify(res.data));
  }
}

export async function checkout(api, who, addressId) {
  return api("POST", "/orders", who.token, { addressId, paymentMethod: "cod", notes: NOTE });
}
