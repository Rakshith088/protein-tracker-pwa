/* Protein Tracker — multi-macro recommender (v2, Phase 3)

   Pure function: recommend(log, targets, plan, foodDb, time) -> result.
   No DOM, no Date.now(), no randomness — `time` is injected ({h: decimal
   hour, dateKey: "YYYY-MM-DD"}), so identical inputs give identical output.

   Priority order: protein -> calories -> fibre -> fat/carbs flex.
   It reads whatever is in targets today; it neither knows nor cares where
   the numbers came from (they drift with the weekly coaching review).

   First suggestion = next meal from the plan, adapted in preference order:
   (1) detect the day-shape being run, (2) pick the better A/B option for
   the remaining budget, (3) scale flex-tagged carb portions within bounds
   (0.5x–1.5x of the plan amount, snapped to the food's step; protein,
   dairy, fruit, veg and oil held; changes under 15% not worth making are
   skipped; if the clamp can't reach the budget the result says so).
   Swap groups are surfaced as alternates text, not silently applied.

   Log entries only need {meal, p, f, c, k, fib}. foodDb is the v2 model
   (per100 + sv, or countBased customs). */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.RECOMMEND = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ORDER = ["Breakfast", "Lunch", "Snack", "Dinner"];
  var WINDOW_END = { Breakfast: 12.5, Lunch: 16, Snack: 19.5, Dinner: 24 };
  var SCALE_MIN = 0.5, SCALE_MAX = 1.5, SCALE_DEADBAND = 0.15;

  function zero() { return { p: 0, f: 0, c: 0, k: 0, fib: 0 }; }
  function addM(a, b) { a.p += b.p || 0; a.f += b.f || 0; a.c += b.c || 0; a.k += b.k || 0; a.fib += b.fib || 0; return a; }
  function sumEntries(list) { return (list || []).reduce(function (a, e) { return addM(a, e); }, zero()); }
  function findFood(db, n) { for (var i = 0; i < db.length; i++) if (db[i].n === n) return db[i]; return null; }
  function perGram(f) {
    if (f.countBased) return f.perUnit;
    var h = f.per100;
    return { p: h.p / 100, f: h.f / 100, c: h.c / 100, k: h.k / 100, fib: (h.fib || 0) / 100 };
  }
  function macrosFor(f, amt) {
    var g = perGram(f);
    return { p: g.p * amt, f: g.f * amt, c: g.c * amt, k: g.k * amt, fib: (g.fib || 0) * amt };
  }
  function itemMacros(db, it) {
    if (it.est) return it.est;
    var f = findFood(db, it.food);
    return f ? macrosFor(f, it.amt) : null;
  }
  function itemsTotal(db, items) {
    var t = zero(); t.est = false;
    (items || []).forEach(function (it) { var m = itemMacros(db, it); if (m) { addM(t, m); t.est = t.est || !!it.est; } });
    return t;
  }
  function defServing(f) {
    if (f.countBased) return { l: f.def + " " + f.unit, g: f.def };
    var sv = f.sv || [];
    for (var i = 0; i < sv.length; i++) if (sv[i].d) return sv[i];
    return sv[0] || { l: "100 " + f.unit, g: 100 };
  }
  function snap(amt, step) { step = step || 5; return Math.max(step, Math.round(amt / step) * step); }
  function r0(n) { return Math.round(n); }

  function remaining(log, targets) {
    var c = sumEntries(log);
    return {
      p: (targets.p || 0) - c.p, k: (targets.k || 0) - c.k, f: (targets.f || 0) - c.f,
      c: (targets.c || 0) - c.c, fib: (targets.fib || 0) - c.fib, consumed: c
    };
  }
  function loggedSlots(log) {
    var s = {}; (log || []).forEach(function (e) { if (e.meal) s[e.meal] = true; }); return s;
  }
  function detectShape(log, h) {
    var s = loggedSlots(log);
    if (s.Snack) return "3+snack";
    if (h >= WINDOW_END.Snack && s.Lunch) return "3";   // snack window passed unused
    return "3+snack";
  }
  function nextSlot(log, h) {
    var s = loggedSlots(log), i, m;
    for (i = 0; i < ORDER.length; i++) { m = ORDER[i]; if (!s[m] && h < WINDOW_END[m]) return m; }
    for (i = 0; i < ORDER.length; i++) { m = ORDER[i]; if (!s[m]) return m; }
    return null;
  }

  /* this meal's share of the remaining day, proportional to plan meal sizes —
     this is what makes plan meals track a drifting calorie target */
  function mealBudget(db, plan, shape, slot, rem, log) {
    var s = loggedSlots(log);
    var shapeDef = null;
    for (var i = 0; i < plan.shapes.length; i++) {
      if (plan.shapes[i].id === shape) shapeDef = plan.shapes[i];
    }
    if (!shapeDef) for (i = 0; i < plan.shapes.length; i++) if (plan.shapes[i].base) shapeDef = plan.shapes[i];
    var seq = shapeDef.sequence.filter(function (x) { return x !== "pregym"; });
    var remSlots = seq.filter(function (m) { return !s[m]; });
    if (remSlots.indexOf(slot) < 0) remSlots.push(slot);
    var sizes = remSlots.map(function (m) {
      var sl = null;
      for (var j = 0; j < plan.slots.length; j++) if (plan.slots[j].slot === m) sl = plan.slots[j];
      return sl ? itemsTotal(db, sl.options[0].items).k : 300;
    });
    var tot = sizes.reduce(function (a, b) { return a + b; }, 0) || 1;
    var share = sizes[remSlots.indexOf(slot)] / tot;
    return { k: rem.k * share, p: rem.p * share, last: remSlots.length === 1 };
  }

  function scaleOption(db, opt, budgetK) {
    var fixedK = 0, flexK = 0;
    opt.items.forEach(function (it) {
      var m = itemMacros(db, it); if (!m) return;
      if (it.flex && !it.est) flexK += m.k; else fixedK += m.k;
    });
    var factor = 1;
    if (flexK > 0 && budgetK != null && budgetK > 0) {
      factor = Math.min(SCALE_MAX, Math.max(SCALE_MIN, (budgetK - fixedK) / flexK));
    }
    var apply = Math.abs(factor - 1) >= SCALE_DEADBAND;
    var changes = [];
    var items = opt.items.map(function (it) {
      if (!apply || !it.flex || it.est) return it;
      var f = findFood(db, it.food);
      var amt = snap(it.amt * factor, f ? f.step : 5);
      if (amt !== it.amt) changes.push({ food: it.food, from: it.amt, to: amt });
      var copy = {}; for (var k in it) copy[k] = it[k]; copy.amt = amt;
      return copy;
    });
    return {
      items: items, totals: itemsTotal(db, items), factor: apply ? factor : 1, changes: changes,
      clamped: apply && (factor === SCALE_MIN || factor === SCALE_MAX)
    };
  }

  function pickOption(db, slotDef, budget) {
    var scored = slotDef.options.map(function (o) {
      var sc = scaleOption(db, o, budget.k);
      var pGap = Math.abs(sc.totals.p - Math.max(budget.p, 0));
      var kGap = Math.abs(sc.totals.k - Math.max(budget.k, 0));
      return { opt: o, scaled: sc, score: pGap * 3 + kGap / 25 };  // protein first, calories second
    });
    scored.sort(function (a, b) { return a.score - b.score; });
    return scored[0];
  }

  /* ad-hoc add-ons: CONTEXT §4 guardrails extended to all macros —
     real dent, <=1.5x default serving, one per category, deterministic
     daily rotation, honest calorie flags, lean-only when the budget's gone.
     Foods flagged st (staples: easy to procure — chicken, eggs, whey, paneer,
     rice, sweet potato, dalia, isabgol) outrank equally-fitting exotics;
     fish/tofu etc. stay available, just behind. Modes by priority:
     protein gap -> fibre gap -> carb top-up when only calories remain. */
  function adhoc(db, rem, time, logLen) {
    var mode = rem.p > 5 ? "protein" : (rem.fib > 4 ? "fibre" : (rem.k > 150 ? "carb" : null));
    if (!mode) return [];
    var lean = rem.k < 60;
    var cands = db.filter(function (f) {
      var g = perGram(f);
      if (g.k <= 0) return false;
      if (mode === "protein") return g.p > 0 && (g.p / g.k) >= (lean ? 0.18 : 0.09);
      if (mode === "fibre") return (g.fib || 0) > 0 && (g.fib / g.k) >= 0.025;
      return g.c > 0 && (g.c * 4 / g.k) >= 0.55;   // carb mode: mostly-carb foods
    }).map(function (f) {
      var g = perGram(f), ds = defServing(f);
      var need = mode === "protein" ? rem.p / g.p
               : mode === "fibre" ? rem.fib / (g.fib || 1)
               : rem.k / g.k;
      var amt = Math.min(need, ds.g * 1.5);
      var rAmt = f.countBased ? Math.max(f.step || 1, Math.round(amt)) : snap(amt, f.step);
      var m = macrosFor(f, rAmt);
      var dent = mode === "protein" ? m.p >= Math.min(10, Math.max(4, rem.p * 0.3))
               : mode === "fibre" ? m.fib >= Math.min(5, Math.max(2, rem.fib * 0.4))
               : m.k >= Math.min(120, Math.max(60, rem.k * 0.25));
      return {
        f: f, amt: rAmt, m: m, dent: dent,
        partial: need > ds.g * 1.5, fits: m.k <= rem.k + 40,
        eff: mode === "protein" ? g.k / g.p : mode === "fibre" ? g.k / (g.fib || 1) : -(g.c * 4 / g.k)
      };
    }).filter(function (x) { return x.dent; });
    cands.sort(function (a, b) {
      if (a.fits !== b.fits) return a.fits ? -1 : 1;
      if (!!a.f.st !== !!b.f.st) return a.f.st ? -1 : 1;    // staples outrank
      return a.eff - b.eff;
    });
    var pool = cands.slice(0, 10);
    if (!pool.length) return [];
    var daySeed = parseInt(String(time.dateKey || "0").slice(-2).replace(/\D/g, ""), 10) || 0;
    var seed = (daySeed + (logLen || 0)) % pool.length;
    var rot = pool.slice(seed).concat(pool.slice(0, seed));
    var out = [], cats = {};
    // the best pick always leads (fit + staple + efficiency already sorted);
    // daily rotation only diversifies the remaining slots
    if (pool.length) { out.push(pool[0]); cats[pool[0].f.cat] = true; }
    rot.forEach(function (s) { if (out.length < 3 && out.indexOf(s) < 0 && !cats[s.f.cat]) { cats[s.f.cat] = true; out.push(s); } });
    rot.forEach(function (s) { if (out.length < 3 && out.indexOf(s) < 0) out.push(s); });
    out.sort(function (a, b) {
      if (a.fits !== b.fits) return a.fits ? -1 : 1;
      if (!!a.f.st !== !!b.f.st) return a.f.st ? -1 : 1;
      return a.eff - b.eff;
    });
    return out.map(function (s) {
      return {
        food: s.f.n, amt: s.amt, unit: s.f.unit, adds: s.m,
        partial: s.partial, fits: s.fits, overK: s.fits ? 0 : r0(s.m.k - rem.k), mode: mode
      };
    });
  }

  function recommend(log, targets, plan, foodDb, time) {
    time = time || {};
    var h = time.h != null ? time.h : 12;
    var rem = remaining(log, targets);
    var logLen = (log || []).length;

    // all targets effectively hit
    if (rem.p <= 2 && rem.k >= -40 && rem.k <= 150 && rem.fib <= 3) {
      return {
        kind: "done", rem: rem, headline: "All targets hit",
        reasoning: "Protein, calories and fibre are all where they should be. You're done for today.", adhoc: []
      };
    }

    // protein handled; calories/fibre may not be
    if (rem.p <= 2) {
      if (rem.k < -40) return {
        kind: "protein-done-over", rem: rem, headline: "Protein done — calories over",
        reasoning: "You're " + r0(-rem.k) + " kcal over with protein handled. Ease off for the rest of the day.", adhoc: []
      };
      return {
        kind: "protein-done", rem: rem, headline: "Protein done",
        reasoning: "About " + r0(rem.k) + " kcal of room left" +
          (rem.fib > 4 ? ", and " + r0(rem.fib) + " g fibre still to get — fibre-dense picks below."
           : (rem.k > 150 ? " — easy carb top-ups below." : ".")),
        adhoc: adhoc(foodDb, rem, time, logLen)
      };
    }

    // over calories but under protein — be honest, protein still wins
    if (rem.k < -40) {
      return {
        kind: "over-under", rem: rem, headline: "Calories over, protein short",
        reasoning: "Honestly: you're " + r0(-rem.k) + " kcal over and still " + r0(rem.p) +
          " g protein short. Protein wins — close it with the leanest options below and accept today runs over.",
        adhoc: adhoc(foodDb, rem, time, logLen)
      };
    }

    // late-evening deficit hole — whey safety net
    if (h >= 20.5 && rem.p > 25) {
      var whey = null;
      for (var i = 0; i < foodDb.length; i++) if (/whey|raw concentrate/i.test(foodDb[i].n)) { whey = foodDb[i]; break; }
      return {
        kind: "safety-net", rem: rem, headline: "Late, with a protein hole",
        reasoning: r0(rem.p) + " g protein left this late in the day — the plan's safety net is whey: 1–1.5 scoops in water closes most of it for ~130–190 kcal.",
        whey: whey ? whey.n : null,
        adhoc: adhoc(foodDb, rem, time, logLen)
      };
    }

    // normal path: next plan meal, adapted
    var slot = nextSlot(log, h);
    if (!slot) {
      return {
        kind: "adhoc-only", rem: rem, headline: r0(rem.p) + " g protein to go",
        reasoning: "Every meal slot is logged; close the rest with add-ons.",
        adhoc: adhoc(foodDb, rem, time, logLen)
      };
    }
    var shape = detectShape(log, h);
    var slotDef = null;
    for (i = 0; i < plan.slots.length; i++) if (plan.slots[i].slot === slot) slotDef = plan.slots[i];
    var budget = mealBudget(foodDb, plan, shape, slot, rem, log);
    var best = pickOption(foodDb, slotDef, budget);

    var reason = slot + " " + best.opt.tag + " — " + r0(rem.p) + " g P short, " + r0(rem.k) + " kcal left";
    if (!budget.last) reason += " (" + r0(budget.k) + " kcal budgeted for this meal)";
    if (best.scaled.changes.length) {
      reason += ". Scaled: " + best.scaled.changes.map(function (c) { return c.food.split("(")[0].trim() + " " + c.from + "→" + c.to + " g"; }).join(", ");
    }
    if (best.scaled.clamped) reason += ". Even at the scaling limit this meal can't fully match the budget — check the day total.";
    if (logLen === 0) reason = "Nothing logged yet — run the " + shape + " day. First up: " + reason;

    return {
      kind: "meal", rem: rem, shape: shape, slot: slot,
      headline: "Next: " + slot + " " + best.opt.tag + " — " + best.opt.name,
      reasoning: reason,
      meal: {
        slot: slot, logSlot: slotDef.logSlot || slot, tag: best.opt.tag, name: best.opt.name,
        items: best.scaled.items, totals: best.scaled.totals,
        changes: best.scaled.changes, clamped: best.scaled.clamped, factor: best.scaled.factor
      },
      adhoc: adhoc(foodDb, rem, time, logLen)
    };
  }

  return {
    recommend: recommend,
    _internals: { remaining: remaining, detectShape: detectShape, nextSlot: nextSlot, scaleOption: scaleOption, mealBudget: mealBudget, adhoc: adhoc }
  };
});
