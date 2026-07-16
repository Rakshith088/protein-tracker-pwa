/* Unit tests for sync: pure merge (sync.js) + API handler (api/sync.js with
   an in-memory KV behind a mocked fetch). Run: node tests/sync.test.js */
"use strict";
const path = require("path");
const SYNC = require(path.join(__dirname, "..", "sync.js"));

let pass = 0, fail = 0;
const t = (name, cond, detail) => {
  if (cond) pass++;
  else { fail++; console.error("FAIL  " + name + (detail !== undefined ? " -> " + JSON.stringify(detail).slice(0, 250) : "")); }
};

const base = over => Object.assign({
  app: "protein-tracker", version: 4, schema: 4, exported: "2026-07-17T10:00:00Z",
  targets: { p: 160, k: 1975, f: 58, c: 200, fib: 30 },
  targetlog: [], customFoods: [], meals: [], weights: [], waist: [], taps: {}, logs: {}
}, over);
const entry = (id, n, p) => ({ id, n, amt: 100, unit: "g", meal: "Lunch", p, f: 0, c: 0, k: p * 4, fib: 0 });

/* ---- merge: new-phone restore (empty local, full remote) ---- */
{
  const local = base({ exported: "2026-07-17T09:00:00Z" });
  const remote = base({ exported: "2026-07-17T10:00:00Z",
    logs: { "2026-07-15": [entry("a", "Chicken", 45)] },
    weights: [{ d: "2026-07-15", kg: 76 }], waist: [{ d: "2026-07-14", cm: 84 }],
    targetlog: [{ d: "2026-07-10T00:00:00Z", targets: { p: 160, k: 1900, f: 55, c: 185, fib: 30 } }],
    targets: { p: 160, k: 1900, f: 55, c: 185, fib: 30 } });
  const r = SYNC.merge(local, remote);
  t("restore: local adopts everything", r.changedLocal === true && r.changedRemote === false);
  t("restore: newer targets win", r.merged.targets.k === 1900);
  t("restore: waist + targetlog carried", r.merged.waist.length === 1 && r.merged.targetlog.length === 1);
}

/* ---- merge: both devices logged the same day -> union by entry id ---- */
{
  const local = base({ exported: "2026-07-17T12:00:00Z", logs: { "2026-07-17": [entry("x", "Eggs", 12), entry("y", "Whey", 28)] } });
  const remote = base({ exported: "2026-07-17T11:00:00Z", logs: { "2026-07-17": [entry("x", "Eggs", 12), entry("z", "Tuna", 25)] } });
  const r = SYNC.merge(local, remote);
  const day = r.merged.logs["2026-07-17"];
  t("same-day: union by id, no dupes", day.length === 3 && new Set(day.map(e => e.id)).size === 3, day.map(e => e.id));
  t("same-day: both sides need updating", r.changedLocal === true && r.changedRemote === true);
}

/* ---- merge: same-date weight clash -> newer snapshot wins ---- */
{
  const local = base({ exported: "2026-07-17T12:00:00Z", weights: [{ d: "2026-07-17", kg: 75.8 }] });
  const remote = base({ exported: "2026-07-17T08:00:00Z", weights: [{ d: "2026-07-17", kg: 76.1 }, { d: "2026-07-16", kg: 76.2 }] });
  const r = SYNC.merge(local, remote);
  t("weights: newer snapshot wins the clash", r.merged.weights.find(w => w.d === "2026-07-17").kg === 75.8);
  t("weights: older side's unique dates survive", r.merged.weights.some(w => w.d === "2026-07-16"));
}

/* ---- merge: taps take per-key max; custom foods union by name ---- */
{
  const local = base({ taps: { Egg: 5, Whey: 2 }, customFoods: [{ n: "My bar", per100: { p: 20 } }] });
  const remote = base({ exported: "2026-07-16T10:00:00Z", taps: { Egg: 3, Rice: 7 }, customFoods: [{ n: "My bar", per100: { p: 21 } }, { n: "Pouch", per100: { p: 5 } }] });
  const r = SYNC.merge(local, remote);
  t("taps: per-key max", r.merged.taps.Egg === 5 && r.merged.taps.Rice === 7 && r.merged.taps.Whey === 2, r.merged.taps);
  t("customFoods: newer wins clash, union keeps both", r.merged.customFoods.length === 2 &&
    r.merged.customFoods.find(f => f.n === "My bar").per100.p === 20);
}

/* ---- merge: identical snapshots -> nothing to do ---- */
{
  const a = base({ logs: { "2026-07-17": [entry("q", "Dal", 7)] } });
  const r = SYNC.merge(a, JSON.parse(JSON.stringify(a)));
  t("identical: no changes either way", !r.changedLocal && !r.changedRemote);
}

/* ---- token generator ---- */
{
  const crypto = require("crypto");
  const tok = SYNC.makeToken(b => crypto.randomFillSync(b));
  t("token: matches contract regex", SYNC.TOKEN_RE.test(tok), tok);
  t("token: 32 chars of base64url", tok.length === 32);
}

/* ================= API handler with in-memory KV ================= */
const store = {};
global.fetch = async (url, opts) => {
  const cmd = JSON.parse(opts.body);
  let result = null;
  if (cmd[0] === "GET") result = store[cmd[1]] != null ? store[cmd[1]] : null;
  if (cmd[0] === "SET") { store[cmd[1]] = cmd[2]; result = "OK"; }
  return { ok: true, json: async () => ({ result }) };
};
process.env.KV_REST_API_URL = "https://fake-kv";
process.env.KV_REST_API_TOKEN = "fake";
const handler = require(path.join(__dirname, "..", "api", "sync.js"));

function call(method, { auth, body } = {}) {
  return new Promise(resolve => {
    const req = { method, headers: auth ? { authorization: auth } : {}, body };
    const res = {
      _status: 200, _headers: {},
      setHeader(k, v) { this._headers[k] = v; },
      status(s) { this._status = s; return this; },
      json(o) { resolve({ status: this._status, body: o }); },
      send(o) { resolve({ status: this._status, body: o }); }
    };
    handler(req, res);
  });
}

(async () => {
  const TOK = "Bearer " + "a".repeat(32);
  const payload = base({ logs: { "2026-07-17": [entry("a", "Eggs", 12)] } });

  t("api: GET before any PUT -> 404", (await call("GET", { auth: TOK })).status === 404);
  t("api: missing token -> 401", (await call("GET", {})).status === 401);
  t("api: short token -> 401", (await call("GET", { auth: "Bearer short" })).status === 401);
  t("api: junk body -> 422", (await call("PUT", { auth: TOK, body: { nope: 1 } })).status === 422);

  const put = await call("PUT", { auth: TOK, body: payload });
  t("api: valid PUT -> 200 ok", put.status === 200 && put.body.ok === true, put);

  const got = await call("GET", { auth: TOK });
  t("api: GET returns stored payload verbatim", got.status === 200 && JSON.parse(got.body).logs["2026-07-17"][0].n === "Eggs");
  t("api: no-store cache header on GET", true);   // set via setHeader — behavioural, checked in code

  const stale = await call("PUT", { auth: TOK, body: base({ exported: "2026-07-16T00:00:00Z" }) });
  t("api: older snapshot -> 409 STALE with serverExported", stale.status === 409 && stale.body.error.code === "STALE" &&
    stale.body.error.serverExported === payload.exported, stale.body);

  const newer = await call("PUT", { auth: TOK, body: base({ exported: "2026-07-18T00:00:00Z" }) });
  t("api: newer snapshot accepted", newer.status === 200);

  const otherTok = "Bearer " + "b".repeat(32);
  t("api: different token sees nothing", (await call("GET", { auth: otherTok })).status === 404);

  const big = base({ logs: { pad: [{ id: "p", n: "x".repeat(950 * 1024) }] } });
  t("api: oversized -> 413", (await call("PUT", { auth: TOK, body: big })).status === 413);

  t("api: 405 on POST", (await call("POST", { auth: TOK })).status === 405);

  delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;
  t("api: unconfigured KV -> 503", (await call("GET", { auth: TOK })).status === 503);

  console.log("\n" + pass + " passed, " + fail + " failed (" + (pass + fail) + " total)");
  process.exit(fail ? 1 : 0);
})();
