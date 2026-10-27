// Security regression tests for audit items C1-C7.
//
// Runs against a local API only (see helpers.mjs for guardrails). Uses the
// seeded demo accounts plus security-test-buyer@instaveg.test, and its own
// temporary products (slug "security-test-..."), so seeded stock and reviews
// are never touched. Orders it creates have notes "security-test"; its
// addresses and products are deleted at the end.
//
// Run: pnpm --filter @workspace/api-server run test

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {
  NOTE, serverEntry, startServer, startApi, makeApi, loginDemoAccounts, cleanupTestProducts,
  createTestProduct, addAddress, deleteAddresses, setCart, checkout,
} from "./helpers.mjs";

const PORT = 8090;
let api;
let stopApi;
const s = {};
const createdAddresses = [];

before(async () => {
  const started = await startApi(PORT);
  stopApi = started.stop;
  api = makeApi(started.base);
  Object.assign(s, await loginDemoAccounts(api));

  const leftovers = await cleanupTestProducts(api, s.admin.token);
  if (leftovers) console.log(`# removed ${leftovers} leftover security-test products`);
  s.rameshProduct = await createTestProduct(api, s.ramesh.token, "Sec Ramesh");
  s.arjunProduct = await createTestProduct(api, s.arjun.token, "Sec Arjun");
  s.buyerAddress = await addAddress(api, s.buyer, createdAddresses);
  s.buyer2Address = await addAddress(api, s.buyer2, createdAddresses);

  // Order A: demo buyer -> Ramesh. Order B: test buyer -> Arjun.
  await setCart(api, s.buyer, [[s.rameshProduct.id, 1]]);
  const a = await checkout(api, s.buyer, s.buyerAddress);
  assert.equal(a.status, 201, JSON.stringify(a.data));
  s.orderA = a.data[0];
  assert.equal(s.orderA.sellerId, s.ramesh.sellerId);

  await setCart(api, s.buyer2, [[s.arjunProduct.id, 1]]);
  const b = await checkout(api, s.buyer2, s.buyer2Address);
  assert.equal(b.status, 201, JSON.stringify(b.data));
  s.orderB = b.data[0];
  console.log(`# created orders ${s.orderA.id} and ${s.orderB.id} (notes "${NOTE}")`);
});

after(async () => {
  if (api && s.admin) {
    await deleteAddresses(api, createdAddresses);
    const removed = await cleanupTestProducts(api, s.admin.token);
    console.log(`# deleted ${createdAddresses.length} test addresses and ${removed} test products`);
  }
  if (stopApi) await stopApi();
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
  const before = await api("GET", `/products/${s.rameshProduct.id}`, null);
  assert.equal((await api("PATCH", `/products/${s.rameshProduct.id}`, s.priya.token, { stock: 0, price: 1 })).status, 404);
  assert.equal((await api("DELETE", `/products/${s.rameshProduct.id}`, s.priya.token)).status, 404);
  const after = await api("GET", `/products/${s.rameshProduct.id}`, null);
  assert.equal(after.status, 200);
  assert.equal(after.data.stock, before.data.stock);
  assert.equal(after.data.price, before.data.price);
  assert.equal(after.data.sellerId, s.ramesh.sellerId);
});
test("C4: owning seller and admin can edit the product", async () => {
  assert.equal((await api("PATCH", `/products/${s.rameshProduct.id}`, s.ramesh.token, { stock: 25 })).status, 200);
  assert.equal((await api("PATCH", `/products/${s.rameshProduct.id}`, s.admin.token, { stock: 30 })).status, 200);
});
test("C4: ?sellerId returns only that seller's products", async () => {
  const res = await api("GET", `/products?sellerId=${s.priya.sellerId}&limit=50`, null);
  assert.equal(res.status, 200);
  assert.ok(res.data.products.length > 0);
  assert.ok(res.data.products.every((p) => p.sellerId === s.priya.sellerId));
});

// C5
test("C5/H4: razorpay orders are rejected, COD-only by design (400)", async () => {
  const res = await api("POST", "/orders", s.buyer.token, { addressId: s.buyerAddress, paymentMethod: "razorpay", notes: NOTE });
  assert.equal(res.status, 400);
});
test("H4: the removed payment create/verify routes return 404", async () => {
  assert.equal((await api("POST", `/orders/${s.orderA.id}/payment/create`, s.buyer.token)).status, 404);
  const verify = await api("POST", `/orders/${s.orderA.id}/payment/verify`, s.buyer.token, {
    razorpayOrderId: "order_x", razorpayPaymentId: "pay_x", razorpaySignature: "0".repeat(64),
  });
  assert.equal(verify.status, 404);
});
test("H4: order responses no longer expose razorpayOrderId", async () => {
  const res = await api("GET", `/orders/${s.orderA.id}`, s.buyer.token);
  assert.equal(res.status, 200);
  assert.equal("razorpayOrderId" in res.data, false);
  assert.equal(res.data.paymentMethod, "cod");
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
  await setCart(api, s.buyer2, [[s.arjunProduct.id, 1]]);
  const res = await checkout(api, s.buyer2, s.buyerAddress);
  assert.equal(res.status, 400);
  assert.ok((await api("DELETE", "/cart", s.buyer2.token)).status < 300);
});
