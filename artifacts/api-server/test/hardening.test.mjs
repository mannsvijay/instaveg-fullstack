// API hardening tests (M4): JSON 404, error handling, security headers,
// auth rate limits and CORS.
//
// Starts its own local API with a low auth rate limit and one allowed CORS
// origin, so it always runs against a fresh in-memory limiter. It never
// creates users: register attempts use invalid bodies. Guardrails as in
// helpers.mjs (no production, local API only).
//
// Run: pnpm --filter @workspace/api-server run test

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi, makeApi } from "./helpers.mjs";

const PORT = 8094;
const LIMIT = 3;
const ALLOWED_ORIGIN = "http://allowed.example";
const DISALLOWED_ORIGIN = "http://evil.example";

let api;
let base;
let stopApi;

before(async () => {
  if (process.env.API_URL) {
    throw new Error("hardening tests need their own server; unset API_URL");
  }
  const started = await startApi(PORT, { AUTH_RATE_LIMIT_MAX: String(LIMIT), CORS_ORIGINS: ALLOWED_ORIGIN });
  stopApi = started.stop;
  base = started.base;
  api = makeApi(base);
});

after(async () => {
  if (stopApi) await stopApi();
});

test("M4: unknown /api routes return a JSON 404", async () => {
  const res = await fetch(`${base}/no-such-route`);
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  assert.deepEqual(await res.json(), { error: "Not found" });
});

test("M4: malformed JSON returns a JSON 400 without a stack trace", async () => {
  const res = await fetch(`${base}/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json",
  });
  // The register limiter counts this attempt, which is fine: the register test below uses its own budget check.
  assert.equal(res.status, 400);
  const text = await res.text();
  assert.deepEqual(JSON.parse(text), { error: "Invalid JSON body" });
  assert.doesNotMatch(text, /\bat .+\.(m?js|ts):\d+/);
});

test("M4: security headers are set (helmet)", async () => {
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.ok(res.headers.get("content-security-policy"), "content-security-policy header");
  assert.equal(res.headers.get("x-powered-by"), null);
});

test("M4: successful logins never count toward the login limit", async () => {
  for (let i = 0; i < LIMIT + 3; i++) {
    const res = await api("POST", "/auth/login", null, { email: "buyer@instaveg.com", password: "buyer123" });
    assert.equal(res.status, 200, `successful login ${i + 1}`);
  }
});

test("M4: failed logins are rate limited (429) after the configured limit", async () => {
  for (let i = 0; i < LIMIT; i++) {
    const res = await api("POST", "/auth/login", null, { email: "buyer@instaveg.com", password: "wrong-password" });
    assert.equal(res.status, 401, `failed login ${i + 1}`);
  }
  const blocked = await api("POST", "/auth/login", null, { email: "buyer@instaveg.com", password: "wrong-password" });
  assert.equal(blocked.status, 429);
  assert.deepEqual(blocked.data, { error: "Too many attempts, please try again later" });
});

test("M15: without VERCEL, a spoofed X-Forwarded-For does not reset the login limit", async () => {
  // The previous test exhausted this client's failed-login budget.
  for (const ip of ["203.0.113.7", "198.51.100.23"]) {
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({ email: "buyer@instaveg.com", password: "wrong-password" }),
    });
    assert.equal(res.status, 429, `X-Forwarded-For ${ip} must not get a fresh budget`);
  }
});

test("M15: on Vercel (VERCEL=1) the limiter keys on the client IP Vercel puts in X-Forwarded-For", async () => {
  const vercelLike = await startApi(PORT + 2, { AUTH_RATE_LIMIT_MAX: "2", VERCEL: "1" });
  try {
    const failedLogin = (ip) => fetch(`${vercelLike.base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({ email: "buyer@instaveg.com", password: "wrong-password" }),
    });
    assert.equal((await failedLogin("203.0.113.7")).status, 401);
    assert.equal((await failedLogin("203.0.113.7")).status, 401);
    assert.equal((await failedLogin("203.0.113.7")).status, 429, "same client IP is limited");
    assert.equal((await failedLogin("198.51.100.23")).status, 401, "a different client IP has its own budget");
  } finally {
    await vercelLike.stop();
  }
});

test("M4: register counts every attempt and is rate limited", async () => {
  // One attempt was used by the malformed-JSON test above.
  let status = 0;
  for (let i = 0; i < LIMIT + 1 && status !== 429; i++) {
    status = (await api("POST", "/auth/register", null, { email: "not-an-email" })).status;
  }
  assert.equal(status, 429);
});

test("M4: CORS headers only for allowed origins", async () => {
  const allowed = await fetch(`${base}/healthz`, { headers: { Origin: ALLOWED_ORIGIN } });
  assert.equal(allowed.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN);

  const disallowed = await fetch(`${base}/healthz`, { headers: { Origin: DISALLOWED_ORIGIN } });
  assert.equal(disallowed.headers.get("access-control-allow-origin"), null);

  const preflight = await fetch(`${base}/auth/login`, {
    method: "OPTIONS",
    headers: { Origin: DISALLOWED_ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
  });
  assert.equal(preflight.headers.get("access-control-allow-origin"), null);
  assert.equal(preflight.headers.get("access-control-allow-methods"), null);
});
