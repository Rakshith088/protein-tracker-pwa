/* Protein Tracker — sync client (v3)
   Pure merge logic + payload helpers, UMD so node tests can load it.
   The runtime (scheduling, fetch, Settings UI) lives in app.js; this file
   has no DOM and no network so the merge stays provable.

   Merge rules (docs/SYNC.md): built for sequential single-user use —
   logs union by day then by entry id; dated series union by date with the
   newer snapshot winning clashes; taps take per-key max; scalars follow
   the newer `exported`. Known trade-off: no tombstones, so a cross-device
   same-day deletion can resurrect once. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.SYNC = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function newer(a, b) { return Date.parse(a.exported || 0) >= Date.parse(b.exported || 0); }

  function unionById(a, b, idOf) {
    const out = (a || []).slice(), seen = {};
    out.forEach(x => { seen[idOf(x)] = true; });
    (b || []).forEach(x => { if (!seen[idOf(x)]) { seen[idOf(x)] = true; out.push(x); } });
    return out;
  }

  /* dated series ([{d,...}]): union by date; same date -> `win` side's row */
  function unionByDate(win, lose) {
    const have = {};
    (win || []).forEach(x => { have[x.d] = true; });
    const out = (win || []).concat((lose || []).filter(x => !have[x.d]));
    out.sort((x, y) => (x.d < y.d ? -1 : 1));
    return out;
  }

  function unionByKey(win, lose, keyOf) {
    const have = {};
    (win || []).forEach(x => { have[keyOf(x)] = true; });
    return (win || []).concat((lose || []).filter(x => !have[keyOf(x)]));
  }

  /* merge(local, remote) -> { merged, changedLocal, changedRemote }
     changedLocal:  merged differs from local  -> apply to this device
     changedRemote: merged differs from remote -> push after applying */
  function merge(local, remote) {
    const newSide = newer(local, remote) ? local : remote;   // wins scalar clashes
    const oldSide = newSide === local ? remote : local;

    const logs = {};
    const days = {};
    Object.keys(local.logs || {}).forEach(d => { days[d] = true; });
    Object.keys(remote.logs || {}).forEach(d => { days[d] = true; });
    Object.keys(days).sort().forEach(d => {
      const l = (local.logs || {})[d], r = (remote.logs || {})[d];
      if (l && r) logs[d] = unionById(l, r, e => e.id || JSON.stringify(e));
      else logs[d] = l || r;
    });

    const taps = {};
    [local.taps || {}, remote.taps || {}].forEach(t =>
      Object.keys(t).forEach(k => { taps[k] = Math.max(taps[k] || 0, t[k] || 0); }));

    const merged = {
      app: "protein-tracker",
      version: Math.max(local.version || 4, remote.version || 4),
      schema: Math.max(local.schema || 4, remote.schema || 4),
      exported: newSide.exported,
      targets: newSide.targets || oldSide.targets,
      targetlog: unionByDate(newSide.targetlog, oldSide.targetlog),
      customFoods: unionByKey(newSide.customFoods, oldSide.customFoods, f => f.n),
      meals: unionByKey(newSide.meals, oldSide.meals, m => m.id || m.name),
      weights: unionByDate(newSide.weights, oldSide.weights),
      waist: unionByDate(newSide.waist, oldSide.waist),
      taps: taps,
      logs: logs
    };

    const strip = p => { const c = Object.assign({}, p); delete c.exported; return JSON.stringify(c); };
    return {
      merged: merged,
      changedLocal: strip(merged) !== strip(local),
      changedRemote: strip(merged) !== strip(remote)
    };
  }

  /* 24 random bytes -> 32-char base64url bearer token */
  function makeToken(getRandomValues) {
    const buf = new Uint8Array(24);
    getRandomValues(buf);
    let bin = "";
    buf.forEach(b => { bin += String.fromCharCode(b); });
    const b64 = (typeof btoa !== "undefined" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64"));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  const TOKEN_RE = /^[A-Za-z0-9_-]{20,128}$/;

  return { merge: merge, makeToken: makeToken, TOKEN_RE: TOKEN_RE };
});
