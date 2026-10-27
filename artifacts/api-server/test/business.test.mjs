// Business-rule tests for Batch 3: H5, H7, H8, H9, H10, H12, M1, M2, M8.
//
// Local API only (guardrails in helpers.mjs). Uses the seeded demo accounts,
// security-test-buyer@instaveg.test and security-test-seller@instaveg.test,
// and its own temporary products (slug "security-test-..."), so seeded stock
// and reviews are never touched. Orders have notes "security-test"; test
// products (and their reviews, by cascade) and addresses are deleted at the end.
//
// Run: pnpm --filter @workspace/api-server run test

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  TEST_SELLER, startApi, makeApi, loginDemoAccounts, loginOrRegister, cleanupTestProducts,
  createTestProduct, getStock, addAddress, deleteAddresses, setCart, checkout,
} from "./helpers.mjs";

const PORT = 8092;
let api;
let stopApi;
const s = {};
const createdAddresses = [];

async function advanceToDelivered(orderId, sellerToken) {
  for (const status of ["confirmed", "preparing", "dispatched", "delivered"]) {
    const res = await api("PATCH", `/orders/${orderId}`, sellerToken, { status });
    assert.equal(res.status, 200, `${status}: ${JSON.stringify(res.data)}`);
  }
}

async function categoryCount(categoryId) {
  const res = await api("GET", `/categories/${categoryId}`, null);
  assert.equal(res.status, 200);
  return res.data.productCount;
}

before(async () => {
  const started = await startApi(PORT);
  stopApi = started.stop;
  api = makeApi(started.base);
  Object.assign(s, await loginDemoAccounts(api));
  s.testSeller = await loginOrRegister(api, TEST_SELLER);
  const profile = await api("GET", "/sellers/profile", s.testSeller.token);
  assert.equal(profile.status, 200);
  s.testSeller.sellerId = profile.data.id;

  const leftovers = await cleanupTestProducts(api, s.admin.token);
  if (leftovers) console.log(`# removed ${leftovers} leftover security-test products`);
  s.p1 = await createTestProduct(api, s.ramesh.token, "Biz Ramesh A", { price: 10, mrp: 12, stock: 20 });
  s.p2 = await createTestProduct(api, s.arjun.token, "Biz Arjun B", { price: 25, mrp: 40, stock: 20 });
  s.p3 = await createTestProduct(api, s.ramesh.token, "Biz Ramesh C", { price: 7, mrp: 9, stock: 20 });
  assert.ok(s.p1.id < s.p2.id && s.p2.id < s.p3.id, "test products should have ascending ids");
  s.address = await addAddress(api, s.buyer2, createdAddresses);
});

after(async () => {
  if (api && s.admin) {
    await api("DELETE", "/cart", s.buyer2.token).catch(() => {});
    await deleteAddresses(api, createdAddresses);
    const removed = await cleanupTestProducts(api, s.admin.token);
    console.log(`# deleted ${createdAddresses.length} test addresses and ${removed} test products`);
  }
  if (stopApi) await stopApi();
});

// H9 (edit) + C4
test("H9: seller edits own product; slug never changes on rename", async () => {
  const res = await api("PATCH", `/products/${s.p1.id}`, s.ramesh.token, { name: "Security Test Biz Ramesh A Renamed", description: "edited" });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(res.data.name, "Security Test Biz Ramesh A Renamed");
  assert.equal(res.data.slug, s.p1.slug);
});
test("H9: seller cannot edit another seller's product (404)", async () => {
  assert.equal((await api("PATCH", `/products/${s.p1.id}`, s.arjun.token, { description: "hijack" })).status, 404);
});

// H5
test("H5: a non-approved seller cannot create products (403)", async () => {
  const res = await api("POST", "/products", s.testSeller.token, { name: "Security Test Biz Unapproved", price: 5, unit: "piece", stock: 5, categoryId: s.p1.categoryId });
  assert.equal(res.status, 403);
});
test("H5: products of a suspended seller are hidden from the public", async () => {
  assert.equal((await api("PATCH", `/admin/sellers/${s.testSeller.sellerId}/approve`, s.admin.token, { status: "approved" })).status, 200);
  const product = await createTestProduct(api, s.testSeller.token, "Biz Test Seller Item", { price: 5, mrp: 5, stock: 5 });
  assert.equal((await api("GET", `/products/${product.id}`, null)).status, 200);
  const countApproved = await categoryCount(product.categoryId);

  assert.equal((await api("PATCH", `/admin/sellers/${s.testSeller.sellerId}/approve`, s.admin.token, { status: "suspended" })).status, 200);
  assert.equal((await api("GET", `/products/${product.id}`, null)).status, 404, "public get");
  assert.equal((await api("GET", `/products/${product.id}`, s.buyer.token)).status, 404, "buyer get");
  const list = await api("GET", "/products?search=security%20test%20biz%20test%20seller&limit=50", null);
  assert.ok(!list.data.products.some((p) => p.id === product.id), "public list");
  for (const path of ["/products/trending?limit=100", "/products/fresh-picks?limit=100"]) {
    const res = await api("GET", path, null);
    assert.ok(!res.data.some((p) => p.id === product.id), path);
  }
  assert.equal(await categoryCount(product.categoryId), countApproved - 1, "category count");
  assert.equal((await api("POST", "/cart/items", s.buyer2.token, { productId: product.id, quantity: 1 })).status, 404, "add to cart");

  assert.equal((await api("GET", `/products/${product.id}`, s.admin.token)).status, 200, "admin still sees it");
  assert.equal((await api("GET", `/products/${product.id}`, s.testSeller.token)).status, 200, "owner still sees it");
  assert.equal((await api("PATCH", `/products/${product.id}`, s.testSeller.token, { stock: 1 })).status, 403, "suspended owner cannot update");
  assert.equal((await api("PATCH", `/products/${product.id}`, s.admin.token, { stock: 1 })).status, 200, "admin is exempt");
});

// M8
test("M8: role must be buyer/seller/admin", async () => {
  assert.equal((await api("PATCH", `/admin/users/${s.buyer2.id}`, s.admin.token, { role: "superuser" })).status, 400);
  assert.equal((await api("PATCH", `/admin/users/${s.buyer2.id}`, s.admin.token, { role: "buyer" })).status, 200);
});
test("M8: admin cannot change own role or deactivate themselves (400)", async () => {
  assert.equal((await api("PATCH", `/admin/users/${s.admin.id}`, s.admin.token, { role: "buyer" })).status, 400);
  assert.equal((await api("PATCH", `/admin/users/${s.admin.id}`, s.admin.token, { isActive: false })).status, 400);
  const me = await api("GET", "/auth/me", s.admin.token);
  assert.equal(me.data.role, "admin");
  assert.equal(me.data.isActive, true);
});

// H8: validation
test("H8: cart quantity must be a whole number >= 1 and within stock", async () => {
  for (const quantity of [-1, 0, 1.5]) {
    assert.equal((await api("POST", "/cart/items", s.buyer2.token, { productId: s.p1.id, quantity })).status, 400, `add ${quantity}`);
  }
  assert.equal((await api("POST", "/cart/items", s.buyer2.token, { productId: s.p1.id, quantity: 21 })).status, 400, "above stock");
  await setCart(api, s.buyer2, [[s.p1.id, 2]]);
  assert.equal((await api("POST", "/cart/items", s.buyer2.token, { productId: s.p1.id, quantity: 19 })).status, 400, "line total above stock");
  for (const quantity of [-1, 1.5, 21]) {
    assert.equal((await api("PATCH", `/cart/items/${s.p1.id}`, s.buyer2.token, { quantity })).status, 400, `update ${quantity}`);
  }
  const removed = await api("PATCH", `/cart/items/${s.p1.id}`, s.buyer2.token, { quantity: 0 });
  assert.equal(removed.status, 200);
  assert.equal(removed.data.items.length, 0, "quantity 0 removes the line");
});
test("H8: product price > 0, mrp >= price, stock whole number >= 0", async () => {
  const base = { name: "Security Test Biz Invalid", unit: "piece", categoryId: s.p1.categoryId };
  for (const [label, body] of [
    ["price 0", { price: 0, stock: 1 }],
    ["mrp < price", { price: 10, mrp: 5, stock: 1 }],
    ["stock -1", { price: 10, stock: -1 }],
    ["stock 2.5", { price: 10, stock: 2.5 }],
  ]) {
    assert.equal((await api("POST", "/products", s.ramesh.token, { ...base, ...body })).status, 400, label);
  }
  assert.equal((await api("PATCH", `/products/${s.p1.id}`, s.ramesh.token, { mrp: 5 })).status, 400, "update mrp below existing price");
  assert.equal((await api("PATCH", `/products/${s.p1.id}`, s.ramesh.token, { price: 0 })).status, 400, "update price 0");
});

// H10 + H7 + M2 + H8 (current price) + H12
test("H10/H7/M2: multi-seller checkout splits orders, totals match the cart, stock decrements", async () => {
  await setCart(api, s.buyer2, [[s.p1.id, 2], [s.p2.id, 1], [s.p3.id, 3]]);
  // Price change after adding to cart: checkout must use the current price (H8).
  assert.equal((await api("PATCH", `/products/${s.p2.id}`, s.arjun.token, { price: 30 })).status, 200);

  const cart = await api("GET", "/cart", s.buyer2.token);
  assert.equal(cart.status, 200);
  assert.equal(cart.data.subtotal, 2 * 10 + 30 + 3 * 7);
  assert.equal(cart.data.deliveryFee, 40);
  assert.equal(cart.data.platformFee, 5);
  assert.equal(cart.data.total, cart.data.subtotal + 40 + 5);

  const stockBefore = { p1: await getStock(api, s.admin.token, s.p1.id), p2: await getStock(api, s.admin.token, s.p2.id), p3: await getStock(api, s.admin.token, s.p3.id) };
  const rameshBefore = (await api("GET", "/sellers/profile", s.ramesh.token)).data.totalOrders;

  const res = await checkout(api, s.buyer2, s.address);
  assert.equal(res.status, 201, JSON.stringify(res.data));
  const orders = res.data;
  assert.equal(orders.length, 2, "one order per seller");
  const bySeller = Object.fromEntries(orders.map((o) => [o.sellerId, o]));
  const rameshOrder = bySeller[s.ramesh.sellerId];
  const arjunOrder = bySeller[s.arjun.sellerId];
  assert.ok(rameshOrder && arjunOrder);
  assert.deepEqual(rameshOrder.items.map((i) => i.productId).sort((a, b) => a - b), [s.p1.id, s.p3.id]);
  assert.deepEqual(arjunOrder.items.map((i) => i.productId), [s.p2.id]);
  assert.equal(arjunOrder.items[0].price, 30, "current price used");

  const sum = orders.reduce((acc, o) => acc + o.total, 0);
  assert.equal(sum, cart.data.total, "order totals === cart total");
  assert.equal(orders.filter((o) => o.deliveryFee === 40 && o.platformFee === 5).length, 1, "fees charged once");
  assert.equal(orders.filter((o) => o.deliveryFee === 0 && o.platformFee === 0).length, 1);

  assert.equal(await getStock(api, s.admin.token, s.p1.id), stockBefore.p1 - 2);
  assert.equal(await getStock(api, s.admin.token, s.p2.id), stockBefore.p2 - 1);
  assert.equal(await getStock(api, s.admin.token, s.p3.id), stockBefore.p3 - 3);
  assert.equal((await api("GET", "/sellers/profile", s.ramesh.token)).data.totalOrders, rameshBefore + 1);
  assert.equal((await api("GET", "/cart", s.buyer2.token)).data.items.length, 0, "cart cleared");
  s.multi = { rameshOrder, arjunOrder, stockBefore };
});
test("H12: cancelling an order restores exactly its items' stock", async () => {
  const { rameshOrder, stockBefore } = s.multi;
  const res = await api("PATCH", `/orders/${rameshOrder.id}`, s.buyer2.token, { status: "cancelled" });
  assert.equal(res.status, 200);
  assert.equal(await getStock(api, s.admin.token, s.p1.id), stockBefore.p1, "p1 restored");
  assert.equal(await getStock(api, s.admin.token, s.p3.id), stockBefore.p3, "p3 restored");
  assert.equal(await getStock(api, s.admin.token, s.p2.id), stockBefore.p2 - 1, "other seller's order untouched");
});
test("M2: checkout rolls back completely when a later item is out of stock", async () => {
  await setCart(api, s.buyer2, [[s.p1.id, 1], [s.p2.id, 2]]);
  // p2 (higher id, decremented after p1) drops below the cart quantity.
  assert.equal((await api("PATCH", `/products/${s.p2.id}`, s.arjun.token, { stock: 1 })).status, 200);
  const p1Before = await getStock(api, s.admin.token, s.p1.id);
  const latestOrderBefore = (await api("GET", "/orders?limit=1", s.buyer2.token)).data[0]?.id;
  const arjunBefore = (await api("GET", "/sellers/profile", s.arjun.token)).data.totalOrders;

  const res = await checkout(api, s.buyer2, s.address);
  assert.equal(res.status, 400, JSON.stringify(res.data));
  assert.equal(await getStock(api, s.admin.token, s.p1.id), p1Before, "p1 stock rolled back");
  assert.equal(await getStock(api, s.admin.token, s.p2.id), 1);
  assert.equal((await api("GET", "/orders?limit=1", s.buyer2.token)).data[0]?.id, latestOrderBefore, "no orders created");
  assert.equal((await api("GET", "/sellers/profile", s.arjun.token)).data.totalOrders, arjunBefore, "seller count rolled back");
  assert.equal((await api("GET", "/cart", s.buyer2.token)).data.items.length, 2, "cart kept");
  assert.equal((await api("PATCH", `/products/${s.p2.id}`, s.arjun.token, { stock: 20 })).status, 200);
});

// M1
test("M1: review id, product and rating validation", async () => {
  assert.equal((await api("GET", "/products/abc/reviews", null)).status, 400);
  assert.equal((await api("POST", "/products/12abc/reviews", s.buyer2.token, { rating: 5 })).status, 400);
  assert.equal((await api("POST", "/products/999999999/reviews", s.buyer2.token, { rating: 5 })).status, 404);
});
test("M1: only a buyer with a delivered order may review, once", async () => {
  assert.equal((await api("POST", `/products/${s.p3.id}/reviews`, s.buyer2.token, { rating: 5 })).status, 403, "no delivered order yet");

  await setCart(api, s.buyer2, [[s.p3.id, 1]]);
  const placed = await checkout(api, s.buyer2, s.address);
  assert.equal(placed.status, 201, JSON.stringify(placed.data));
  await advanceToDelivered(placed.data[0].id, s.ramesh.token);

  assert.equal((await api("POST", `/products/${s.p3.id}/reviews`, s.ramesh.token, { rating: 5 })).status, 403, "seller cannot review");
  for (const rating of [3.5, 6, 0]) {
    assert.equal((await api("POST", `/products/${s.p3.id}/reviews`, s.buyer2.token, { rating })).status, 400, `rating ${rating}`);
  }
  const first = await api("POST", `/products/${s.p3.id}/reviews`, s.buyer2.token, { rating: 4, comment: "security-test" });
  assert.equal(first.status, 201, JSON.stringify(first.data));
  assert.equal((await api("POST", `/products/${s.p3.id}/reviews`, s.buyer2.token, { rating: 5 })).status, 409, "second review");
  const product = await api("GET", `/products/${s.p3.id}`, null);
  assert.equal(product.data.reviewCount, 1);
  assert.equal(product.data.rating, 4);
});
