/* Unit tests for recommend.js — run: node tests/recommend.test.js
   Zero dependencies. Loads the real food DB and the real plan, so tests
   exercise production data, not fixtures. */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const appSrc = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const FOODS = eval(appSrc.match(/const BASE_FOODS=(\[[\s\S]*?\n {2}\]);/)[1]);
global.window = {};
require(path.join(ROOT, "plan.js"));
const PLAN = global.window.MEAL_PLAN;
const { recommend, _internals } = require(path.join(ROOT, "recommend.js"));

let pass = 0, fail = 0;
function t(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL  " + name + (detail !== undefined ? "  -> " + JSON.stringify(detail) : "")); }
}
function entry(meal, p, f, c, k, fib) { return { meal, p, f, c, k, fib: fib || 0 }; }
const T = { p: 160, k: 1975, f: 58, c: 200, fib: 30 };          // arbitrary example — engine must not care
const TIME = (h) => ({ h, dateKey: "2026-07-16" });
const find = n => FOODS.find(f => f.n === n);
const mac = (n, g) => { const f = find(n), h = f.per100; return { p: h.p*g/100, f: h.f*g/100, c: h.c*g/100, k: h.k*g/100, fib: (h.fib||0)*g/100 }; };
const planOpt = (slot, tag) => PLAN.slots.find(s => s.slot === slot).options.find(o => o.tag === tag);
const optTotal = (slot, tag) => planOpt(slot, tag).items.reduce((a, it) => {
  const m = it.est ? it.est : mac(it.food, it.amt);
  a.p += m.p; a.k += m.k; return a;
}, { p: 0, k: 0 });

/* ---- remaining math ---- */
{
  const r = _internals.remaining([entry("Lunch", 40, 10, 50, 500, 5)], T);
  t("remaining: protein", Math.abs(r.p - 120) < 1e-9, r.p);
  t("remaining: kcal", Math.abs(r.k - 1475) < 1e-9, r.k);
  t("remaining: fibre", Math.abs(r.fib - 25) < 1e-9, r.fib);
}

/* ---- day-shape detection ---- */
{
  t("shape: snack logged -> 3+snack", _internals.detectShape([entry("Snack", 20, 2, 20, 200)], 18) === "3+snack");
  t("shape: evening, no snack -> 3", _internals.detectShape([entry("Lunch", 50, 10, 60, 600)], 20) === "3");
  t("shape: morning default -> 3+snack", _internals.detectShape([], 9) === "3+snack");
}

/* ---- next slot ---- */
{
  t("nextSlot: morning empty -> Breakfast", _internals.nextSlot([], 10) === "Breakfast");
  t("nextSlot: evening -> Dinner", _internals.nextSlot([entry("Breakfast",1,1,1,1), entry("Lunch",1,1,1,1), entry("Snack",1,1,1,1)], 20) === "Dinner");
  t("nextSlot: all logged -> null", _internals.nextSlot(["Breakfast","Lunch","Snack","Dinner"].map(m=>entry(m,1,1,1,1)), 21) === null);
}

/* ---- nothing logged: suggests day shape + a first meal ---- */
{
  const r = recommend([], T, PLAN, FOODS, TIME(9));
  t("empty: kind meal", r.kind === "meal", r.kind);
  t("empty: slot Breakfast", r.slot === "Breakfast", r.slot);
  t("empty: names the day shape", /3\+snack/.test(r.reasoning), r.reasoning);
  t("empty: has reasoning with numbers", /g P short/.test(r.reasoning), r.reasoning);
}

/* ---- A/B pick: balanced day -> Dinner A; protein-starved day -> Dinner B ---- */
{
  // balanced: ate ~pregym+BrA+LuA+SnA -> little protein left
  const logBal = [entry("Breakfast", 58, 14, 79, 663), entry("Lunch", 57, 14, 64, 628), entry("Snack", 30, 5, 32, 290)];
  const rBal = recommend(logBal, T, PLAN, FOODS, TIME(19.6));
  t("A/B: balanced day picks Dinner A", rBal.kind === "meal" && rBal.slot === "Dinner" && rBal.meal.tag === "A", rBal.meal && rBal.meal.tag);

  // protein-starved: lots of kcal, little protein
  const logLow = [entry("Breakfast", 15, 20, 90, 700), entry("Lunch", 20, 15, 80, 550)];
  const rLow = recommend(logLow, T, PLAN, FOODS, TIME(19.6));
  t("A/B: low-protein day picks Dinner B", rLow.kind === "meal" && rLow.meal.tag === "B", rLow.meal && rLow.meal.tag);
}

/* ---- scaling: targets above plan -> carbs scale up; protein held ---- */
{
  const big = { p: 160, k: 2500, f: 70, c: 280, fib: 30 };
  const r = recommend([], big, PLAN, FOODS, TIME(9));
  t("scale-up: kind meal", r.kind === "meal");
  const carb = r.meal.items.find(i => i.flex === "carb");
  const whey = r.meal.items.find(i => /Raw Concentrate/.test(i.food || ""));
  t("scale-up: chosen option has a flex carb", !!carb, r.meal.items.map(i=>i.food));
  if (carb) {
    const orig = planOpt("Breakfast", r.meal.tag).items.find(i => i.food === carb.food).amt;
    t("scale-up: carb grew", carb.amt > orig, { from: orig, to: carb.amt });
    t("scale-up: carb within 1.5x bound (snap tolerance)", carb.amt <= orig * 1.5 + (find(carb.food).step || 5) / 2, { to: carb.amt, cap: orig * 1.5 });
  }
  if (whey) {
    const orig = planOpt("Breakfast", r.meal.tag).items.find(i => /Raw Concentrate/.test(i.food)).amt;
    t("scale-up: whey held", whey.amt === orig, { from: orig, to: whey.amt });
  }
}

/* ---- scaling: targets below plan -> carbs scale down, never past 0.5x ---- */
{
  const small = { p: 160, k: 1500, f: 50, c: 130, fib: 30 };
  const r = recommend([], small, PLAN, FOODS, TIME(9));
  const opt = r.meal.tag;
  const carb = r.meal.items.find(i => i.flex === "carb");
  t("scale-down: a flex item exists", !!carb, r.meal.items.map(i=>i.food));
  if (carb) {
    const orig = planOpt("Breakfast", opt).items.find(i => i.food === carb.food).amt;
    t("scale-down: carb shrank or held", carb.amt <= orig, { from: orig, to: carb.amt });
    t("scale-down: not below 0.5x", carb.amt >= orig * 0.5 - 1e-9, { from: orig, to: carb.amt });
  }
  const prot = r.meal.items.find(i => /Raw Concentrate|Whole egg|Egg white/.test(i.food || ""));
  if (prot) {
    const orig = planOpt("Breakfast", opt).items.find(i => i.food === prot.food).amt;
    t("scale-down: protein held", prot.amt === orig, { food: prot.food, from: orig, to: prot.amt });
  }
}

/* ---- scaling clamp: absurd target -> clamped flag, bounds respected ---- */
{
  const sc = _internals.scaleOption(FOODS, planOpt("Lunch", "A"), 5000);
  t("clamp: factor capped at 1.5", sc.factor === 1.5, sc.factor);
  t("clamp: flag set", sc.clamped === true);
  const rice = sc.items.find(i => i.food === "Rice (cooked)");
  t("clamp: rice at most 1.5x snapped", rice.amt <= 225, rice.amt);
  const sc2 = _internals.scaleOption(FOODS, planOpt("Lunch", "A"), 100);
  const rice2 = sc2.items.find(i => i.food === "Rice (cooked)");
  t("clamp: floor at 0.5x", rice2.amt >= 75, rice2.amt);
}

/* ---- targets != plan totals (brief requirement, both directions) ---- */
{
  [{ p: 180, k: 2300, f: 65, c: 250, fib: 35 }, { p: 140, k: 1700, f: 50, c: 160, fib: 25 }].forEach((tg, i) => {
    const r = recommend([], tg, PLAN, FOODS, TIME(9));
    t("targets-drift[" + i + "]: engine runs on arbitrary targets", r.kind === "meal" && r.meal.totals.k > 0, r.kind);
    t("targets-drift[" + i + "]: reasoning reflects tg not 1975", r.reasoning.indexOf(String(tg.k)) >= 0, r.reasoning);
  });
}

/* ---- over-calories-but-under-protein: honest + lean-only ---- */
{
  const log = [entry("Breakfast", 30, 40, 150, 1200), entry("Lunch", 30, 40, 120, 950)];
  const r = recommend(log, T, PLAN, FOODS, TIME(17));
  t("over-under: kind", r.kind === "over-under", r.kind);
  t("over-under: honest wording", /over/.test(r.reasoning) && /protein/i.test(r.reasoning), r.reasoning);
  r.adhoc.forEach(a => {
    const f = find(a.food) || FOODS.find(x => x.n === a.food);
    const g = f.countBased ? f.perUnit : { p: f.per100.p / 100, k: f.per100.k / 100 };
    t("over-under: lean pick " + a.food, (g.p / g.k) >= 0.18, { food: a.food, density: g.p / g.k });
  });
}

/* ---- all targets hit ---- */
{
  const log = [entry("Dinner", 160, 58, 200, 1975, 30)];
  const r = recommend(log, T, PLAN, FOODS, TIME(21));
  t("done: kind", r.kind === "done", r.kind);
}

/* ---- protein done, fibre short -> fibre-mode add-ons ---- */
{
  const log = [entry("Lunch", 160, 30, 100, 1400, 8)];
  const r = recommend(log, T, PLAN, FOODS, TIME(17));
  t("fibre-mode: kind protein-done", r.kind === "protein-done", r.kind);
  t("fibre-mode: mentions fibre", /fibre/.test(r.reasoning), r.reasoning);
  t("fibre-mode: has suggestions", r.adhoc.length > 0, r.adhoc.length);
  r.adhoc.forEach(a => t("fibre-mode: " + a.food + " adds real fibre", a.adds.fib >= 2, a.adds.fib));
}

/* ---- late deficit hole -> whey safety net ---- */
{
  const log = [entry("Breakfast", 40, 15, 60, 550), entry("Lunch", 45, 15, 60, 600), entry("Dinner", 20, 10, 30, 350)];
  const r = recommend(log, T, PLAN, FOODS, TIME(21));
  t("safety-net: kind", r.kind === "safety-net", r.kind);
  t("safety-net: names whey", /whey/i.test(r.reasoning) && /Raw Concentrate/.test(r.whey || ""), r.whey);
}

/* ---- ad-hoc guardrails ---- */
{
  const log = [entry("Breakfast", 100, 30, 120, 1100, 15)];
  const r = recommend(log, T, PLAN, FOODS, TIME(14));
  t("adhoc: present on meal kind", r.adhoc.length >= 1 && r.adhoc.length <= 3, r.adhoc.length);
  // one-per-category is a preference: it can only hold if the qualifying pool
  // spans multiple categories (a protein-dense pool may be all Protein & dairy)
  const cats = r.adhoc.map(a => (find(a.food) || {}).cat);
  t("adhoc: categories deduped or pool single-category",
    new Set(cats).size === cats.length || new Set(cats).size === 1, cats);
  r.adhoc.forEach(a => {
    const f = find(a.food);
    const ds = (f.sv || []).find(s => s.d) || (f.sv || [])[0];
    if (ds) t("adhoc: " + a.food + " <=1.5x default serving (snap tolerance)", a.amt <= ds.g * 1.5 + f.step / 2, { amt: a.amt, cap: ds.g * 1.5 });
    t("adhoc: " + a.food + " makes a dent", a.adds.p >= 4, a.adds.p);
  });
}

/* ---- staples outrank equally-fitting exotics ---- */
{
  const STAPLES = FOODS.filter(f => f.st).map(f => f.n);
  t("staples: flags present in DB", STAPLES.length >= 9, STAPLES.length);
  const log = [entry("Breakfast", 60, 20, 80, 800, 10)];
  const r = recommend(log, T, PLAN, FOODS, TIME(14));
  t("staples: first protein pick is a staple", STAPLES.indexOf(r.adhoc[0].food) >= 0, r.adhoc[0].food);
}

/* ---- fibre mode surfaces isabgol ---- */
{
  const log = [entry("Lunch", 160, 40, 150, 1700, 12)];   // protein done, fibre short, ~275 kcal room
  const r = recommend(log, T, PLAN, FOODS, TIME(17));
  t("isabgol: fibre mode active", r.adhoc.length > 0 && r.adhoc[0].mode === "fibre", r.adhoc[0] && r.adhoc[0].mode);
  t("isabgol: appears in fibre picks", r.adhoc.some(a => /Isabgol/.test(a.food)), r.adhoc.map(a => a.food));
}

/* ---- carb top-up when only calories remain ---- */
{
  const log = [entry("Lunch", 160, 45, 120, 1500, 29)];   // protein + fibre done, ~475 kcal room
  const r = recommend(log, T, PLAN, FOODS, TIME(17));
  t("carb mode: kind protein-done", r.kind === "protein-done", r.kind);
  t("carb mode: suggestions are carb mode", r.adhoc.length > 0 && r.adhoc[0].mode === "carb", r.adhoc[0] && r.adhoc[0].mode);
  const CARB_STAPLES = ["Rice (cooked)", "Sweet potato / shakarkandi", "Dalia / broken wheat (cooked)"];
  t("carb mode: a carb staple leads", CARB_STAPLES.indexOf(r.adhoc[0].food) >= 0, r.adhoc.map(a => a.food));
}

/* ---- determinism: same inputs -> same output ---- */
{
  const log = [entry("Breakfast", 50, 15, 60, 600, 8)];
  const a = recommend(log, T, PLAN, FOODS, TIME(13));
  const b = recommend(log, T, PLAN, FOODS, TIME(13));
  t("deterministic", JSON.stringify(a) === JSON.stringify(b));
}

/* ---- meal budget shrinks as slots fill ---- */
{
  const b1 = _internals.mealBudget(FOODS, PLAN, "3+snack", "Dinner", { k: 1975, p: 160 }, []);
  const b2 = _internals.mealBudget(FOODS, PLAN, "3+snack", "Dinner", { k: 500, p: 25 },
    [entry("Breakfast",1,1,1,1), entry("Lunch",1,1,1,1), entry("Snack",1,1,1,1)]);
  t("budget: dinner-only gets the whole remainder", b2.last === true && Math.abs(b2.k - 500) < 1e-9, b2);
  t("budget: early-day dinner share is partial", b1.k < 1975 * 0.5, b1.k);
}

console.log("\n" + pass + " passed, " + fail + " failed (" + (pass + fail) + " total)");
process.exit(fail ? 1 : 0);
