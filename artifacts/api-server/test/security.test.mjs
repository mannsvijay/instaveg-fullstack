// Security regression tests for audit items C1-C7.
//
// Runs against a local API only. By default it starts the built server
// (dist/index.mjs) on port 8090 with the root .env; set API_URL to use an
// already-running local server instead. Uses the seeded demo accounts plus
// one dedicated test buyer. Every order it creates has notes "security-test";
// addresses it creates are deleted at the end. Seeded data is never deleted.
//
// Run: pnpm --filter @workspace/api-server run test:security

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.resolve(here, "../dist/index.mjs");
const rootEnv = path.resolve(here, "../../../.env");

const NOTE = "security-test";
const TEST_BUYER = { name: "Security Test Buyer", email: "security-test-buyer@instaveg.test", password: "security-test-buyer-pw", role: "buyer" };

// Guardrails: never against production, never against a remote host.
if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run security tests with NODE_ENV=production");
}
if (process.env.API_URL) {
  const host = new URL(process.env.API_URL).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(`Refusing to run security tests against non-local API_URL host "${host}"`);
  }
}

const PORT = 8090;
const BASE = process.env.API_URL ? process.env.API_URL.replace(/\/$/, "") : `http://127.0.0.1:${PORT}/api`;
let server = null;

function startServer(env) {
  return spawn(process.execPath, [`--env-file=${rootEnv}`, serverEntry], {
    env: { ...process.env, NODE_ENV: "test", ...env },
    stdio: ["ignore", "ignore", "pipe"],
  });
}

async function waitForHealth(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`API did not become healthy at ${BASE}`);
}

async function api(method, url, token, body) {
  const res = await fetch(`${BASE}${url}`, {
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
}

async function login(email, password) {
  const res = await api("POST", "/auth/login", null, { email, password });
  assert.equal(res.status, 200, `login ${email}: ${JSON.stringify(res.data)}`);
  return { token: res.data.token, id: res.data.user.id };
}

async function loginOrRegisterTestBuyer() {
  const res = await api("POST", "/auth/login", null, { email: TEST_BUYER.email, password: TEST_BUYER.password });
  if (res.status === 200) {
    console.log("# test buyer: logged into existing account");
    return { token: res.data.token, id: res.data.user.id };
  }
  const reg = await api("POST", "/auth/register", null, TEST_BUYER);
  assert.equal(reg.status, 201, `register test buyer: ${JSON.stringify(reg.data)}`);
  console.log("# test buyer: registered new account");
  return { token: reg.data.token, id: reg.data.user.id };
}

// Shared state built in before()
const s = {};
const createdAddresses = [];

async function addAddress(who) {
  const res = await api("POST", "/users/addresses", who.token, {
    label: NOTE, street: "1 Test Street", city: "Pune", state: "Maharashtra", pincode: "411001",
  });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  createdAddresses.push({ token: who.token, id: res.data.id });
  return res.data.id;
}

async function firstProductOf(sellerId) {
  const res = await api("GET", `/products?sellerId=${sellerId}&limit=50`, null);
  assert.equal(res.status, 200);
  assert.ok(res.data.products.length > 0, `seller ${sellerId} has no products; run the seed`);
  return res.data.products[0];
}

async function fillCart(who, productId) {
  assert.equal((await api("DELETE", "/cart", who.token)).status < 300, true);
  const res = await api("POST", "/cart/items", who.token, { productId, quantity: 1 });
  assert.equal(res.status, 200, JSON.stringify(res.data));
}

before(async () => {
  if (!process.env.API_URL) {
    assert.ok(fs.existsSync(serverEntry), "dist/index.mjs missing; run the build first");
    server = startServer({ PORT: String(PORT) });
    let stderr = "";
    server.stderr.on("data", (chunk) => { stderr += chunk; });
    server.on("exit", (code) => { if (code) console.error(`# server exited with ${code}\n${stderr}`); });
  }
  await waitForHealth();

  s.admin = await login("admin@instaveg.com", "admin123");
  s.buyer = await login("buyer@instaveg.com", "buyer123");
  s.ramesh = await login("ramesh@instaveg.com", "seller123");
  s.priya = await login("priya@instaveg.com", "seller123");
  s.arjun = await login("arjun@instaveg.com", "seller123");
  s.buyer2 = await loginOrRegisterTestBuyer();

  for (const key of ["ramesh", "priya", "arjun"]) {
    const res = await api("GET", "/sellers/profile", s[key].token);
    assert.equal(res.status, 200);
    s[key].sellerId = res.data.id;
  }

  s.rameshProduct = await firstProductOf(s.ramesh.sellerId);
  s.arjunProduct = await firstProductOf(s.arjun.sellerId);
  s.buyerAddress = await addAddress(s.buyer);
  s.buyer2Address = await addAddress(s.buyer2);

  // Order A: demo buyer -> Ramesh. Order B: test buyer -> Arjun.
  await fillCart(s.buyer, s.rameshProduct.id);
  const a = await api("POST", "/orders", s.buyer.token, { addressId: s.buyerAddress, paymentMethod: "cod", notes: NOTE });
  assert.equal(a.status, 201, JSON.stringify(a.data));
  s.orderA = a.data;
  assert.equal(s.orderA.sellerId, s.ramesh.sellerId);

  await fillCart(s.buyer2, s.arjunProduct.id);
  const b = await api("POST", "/orders", s.buyer2.token, { addressId: s.buyer2Address, paymentMethod: "cod", notes: NOTE });
  assert.equal(b.status, 201, JSON.stringify(b.data));
  s.orderB = b.data;
  console.log(`# created orders ${s.orderA.id} and ${s.orderB.id} (notes "${NOTE}")`);
});

after(async () => {
  for (const { token, id } of createdAddresses) {
    await api("DELETE", `/users/addresses/${id}`, token).catch(() => {});
  }
  if (createdAddresses.length) console.log(`# deleted ${createdAddresses.length} test addresses`);
  if (server) server.kill();
});

// C1
test("C1: another buyer cannot read someone else's order (404)", async () => {
  assert.equal((await api("GET", `/orders/${s.orderA.id}`, s.buyer2.token)).status, 404);
});
test("C1: a seller cannot read another seller's order (404)", async () => {
  assert.equal((await api("GET", `/orders/${s.orderA.id}`, s.priya.token)).status, 404);
});
test("C1: owner buyer, order's seller and admin can read the order", async () => {
  for (const who of [s.buyer, s.ramesh, s.admin]) {
    assert.equal((await api("GET", `/orders/${s.orderA.id}`, who.token)).status, 200);
  }
});

// C3
test("C3: seller order list contains only their own orders", async () => {
  const ramesh = await api("GET", "/orders?limit=50", s.ramesh.token);
  assert.equal(ramesh.status, 200);
  assert.ok(ramesh.data.some((o) => o.id === s.orderA.id), "Ramesh should see order A");
  assert.ok(ramesh.data.every((o) => o.sellerId === s.ramesh.sellerId));
  const priya = await api("GET", "/orders?limit=50", s.priya.token);
  assert.equal(priya.status, 200);
  assert.ok(!priya.data.some((o) => o.id === s.orderA.id || o.id === s.orderB.id));
  assert.ok(priya.data.every((o) => o.sellerId === s.priya.sellerId));
});
test("C3: buyer order list contains only their own orders", async () => {
  const res = await api("GET", "/orders?limit=50", s.buyer2.token);
  assert.equal(res.status, 200);
  assert.ok(res.data.some((o) => o.id === s.orderB.id));
  assert.ok(res.data.every((o) => o.userId === s.buyer2.id));
});

// C2
test("C2: another buyer / another seller cannot patch the order (404)", async () => {
  assert.equal((await api("PATCH", `/orders/${s.orderA.id}`, s.buyer2.token, { status: "cancelled" })).status, 404);
  assert.equal((await api("PATCH", `/orders/${s.orderA.id}`, s.priya.token, { status: "confirmed" })).status, 404);
});
test("C2: buyer cannot advance their own order status (403)", async () => {
  assert.equal((await api("PATCH", `/orders/${s.orderA.id}`, s.buyer.token, { status: "confirmed" })).status, 403);
});
test("C2: skipping steps is rejected (400)", async () => {
  assert.equal((await api("PATCH", `/orders/${s.orderA.id}`, s.ramesh.token, { status: "delivered" })).status, 400);
});
test("C2: seller confirms, then buyer can no longer cancel (403)", async () => {
  const res = await api("PATCH", `/orders/${s.orderA.id}`, s.ramesh.token, { status: "confirmed" });
  assert.equal(res.status, 200);
  assert.equal(res.data.status, "confirmed");
  assert.equal((await api("PATCH", `/orders/${s.orderA.id}`, s.buyer.token, { status: "cancelled" })).status, 403);
});
test("C2: admin can advance the order", async () => {
  const res = await api("PATCH", `/orders/${s.orderA.id}`, s.admin.token, { status: "preparing" });
  assert.equal(res.status, 200);
  assert.equal(res.data.status, "preparing");
});
test("C2: backwards and late cancel are rejected (400)", async () => {
  assert.equal((await api("PATCH", `/orders/${s.orderA.id}`, s.ramesh.token, { status: "pending" })).status, 400);
  assert.equal((await api("PATCH", `/orders/${s.orderA.id}`, s.ramesh.token, { status: "cancelled" })).status, 400);
});
test("C2: delivered is final", async () => {
  assert.equal((await api("PATCH", `/orders/${s.orderA.id}`, s.ramesh.token, { status: "dispatched" })).status, 200);
  assert.equal((await api("PATCH", `/orders/${s.orderA.id}`, s.ramesh.token, { status: "delivered" })).status, 200);
  assert.equal((await api("PATCH", `/orders/${s.orderA.id}`, s.admin.token, { status: "cancelled" })).status, 400);
});
test("C2: buyer can cancel own pending order; cancelled is final", async () => {
  const res = await api("PATCH", `/orders/${s.orderB.id}`, s.buyer2.token, { status: "cancelled" });
  assert.equal(res.status, 200);
  assert.equal(res.data.status, "cancelled");
  assert.equal((await api("PATCH", `/orders/${s.orderB.id}`, s.admin.token, { status: "confirmed" })).status, 400);
});

// C4
test("C4: seller cannot edit or delete another seller's product (404), product unchanged", async () => {
  const p = s.rameshProduct;
  assert.equal((await api("PATCH", `/products/${p.id}`, s.priya.token, { stock: 0, price: 1 })).status, 404);
  assert.equal((await api("DELETE", `/products/${p.id}`, s.priya.token)).status, 404);
  const after = await api("GET", `/products/${p.id}`, null);
  assert.equal(after.status, 200);
  assert.equal(after.data.stock, p.stock);
  assert.equal(after.data.price, p.price);
  assert.equal(after.data.sellerId, s.ramesh.sellerId);
});
test("C4: owning seller and admin can edit the product (no-op write)", async () => {
  const p = s.rameshProduct;
  assert.equal((await api("PATCH", `/products/${p.id}`, s.ramesh.token, { stock: p.stock })).status, 200);
  assert.equal((await api("PATCH", `/products/${p.id}`, s.admin.token, { stock: p.stock })).status, 200);
});
test("C4: ?sellerId returns only that seller's products", async () => {
  const res = await api("GET", `/products?sellerId=${s.priya.sellerId}&limit=50`, null);
  assert.equal(res.status, 200);
  assert.ok(res.data.products.length > 0);
  assert.ok(res.data.products.every((p) => p.sellerId === s.priya.sellerId));
});

// C5
test("C5: razorpay orders are rejected while Razorpay is not configured (400)", async () => {
  const res = await api("POST", "/orders", s.buyer.token, { addressId: s.buyerAddress, paymentMethod: "razorpay", notes: NOTE });
  assert.equal(res.status, 400);
});
test("C5: payment create/verify return 503 while Razorpay is not configured", async () => {
  assert.equal((await api("POST", `/orders/${s.orderA.id}/payment/create`, s.buyer.token)).status, 503);
  const verify = await api("POST", `/orders/${s.orderA.id}/payment/verify`, s.buyer.token, {
    razorpayOrderId: "order_x", razorpayPaymentId: "pay_x", razorpaySignature: "0".repeat(64),
  });
  assert.equal(verify.status, 503);
});

// C6
test("C6: token signed with the old fallback secret is rejected (401)", async () => {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ id: s.admin.id, email: "admin@instaveg.com", role: "admin", iat: Math.floor(Date.now() / 1000) })}`;
  const sig = crypto.createHmac("sha256", "instaveg-secret-key").update(unsigned).digest("base64url");
  assert.equal((await api("GET", "/orders", `${unsigned}.${sig}`)).status, 401);
});
test("C6: server refuses to start with a short SESSION_SECRET", async () => {
  assert.ok(fs.existsSync(serverEntry), "dist/index.mjs missing; run the build first");
  const child = startServer({ SESSION_SECRET: "too-short", PORT: String(PORT + 1) });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill(); resolve("timeout"); }, 20_000);
    child.on("exit", (c) => { clearTimeout(timer); resolve(c); });
  });
  assert.notEqual(code, "timeout", "server kept running with a short secret");
  assert.notEqual(code, 0);
  assert.match(stderr, /SESSION_SECRET must be set and at least 32 characters/);
});

// C7
test("C7: checkout with another user's addressId is rejected (400)", async () => {
  await fillCart(s.buyer2, s.arjunProduct.id);
  const res = await api("POST", "/orders", s.buyer2.token, { addressId: s.buyerAddress, paymentMethod: "cod", notes: NOTE });
  assert.equal(res.status, 400);
  assert.equal((await api("DELETE", "/cart", s.buyer2.token)).status < 300, true);
});
