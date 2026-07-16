# Protein Tracker — Full Project Context

Handoff document for continuing this project in a new context/tool. Contains the user's personal nutrition profile, the app's current state, design system, food database, architecture, and every non-obvious decision made along the way so nothing has to be re-derived.

---

## 1. Who this is for

**Rakshith** — Senior Product Designer, AntStack Technologies. Based in the Hebri/Udupi area, coastal Karnataka. Works out ~5x/week, gym 8–10am. Building this as a personal tool for a body recomposition (fat loss, muscle retention) phase.

**Body profile:** 76 kg · 174 cm · 31 years old · male
**Activity:** ~6–7k daily steps (baseline), resting heart rate 58 bpm, ~588 kcal/day active burn from training (watch-measured average since starting training 5x/week)

## 2. Nutrition targets (the source of truth)

| Metric | Target | How it was derived |
|---|---|---|
| **Calories** | **1,975 kcal/day** | TDEE (~2,475 kcal) − 500 kcal deficit |
| **Protein** | **160 g/day** | ~2.1 g/kg — chosen over the naive 76×1.5=114g formula to protect muscle in a deficit |
| **Fat** | **58 g/day** | ~26% of calories, floor of 50g |
| **Carbs** | **200 g/day** | Fills the remainder — training fuel |
| **Fibre** | **30 g/day** | Added later; verified achievable — a real plan-style day lands at ~31g |

**TDEE derivation (cross-verified two ways, both agreed within ~30 kcal):**
1. Mifflin-St Jeor: BMR = (10×76)+(6.25×174)−(5×31)+5 = ~1,698 kcal → ×1.45 activity multiplier ≈ **2,460 kcal**
2. Watch data: Resting (~1,698) + active (588/day avg) + thermic effect of food (~200) ≈ **2,485 kcal**
Settled on **TDEE ≈ 2,475 kcal**.

**Weight-loss pace target:** 0.3–0.5 kg/week (via 7-day rolling average, not daily readings).
- Stalled 2–3 weeks → add ~1,500 steps/day first, before cutting food further.
- Losing >0.7 kg/week → add ~150 kcal back (faster costs muscle).

**Cardio guidance:** steps > structured cardio for a recomp. Cap extra cardio at 1–2 easy 25-min Zone-2 walks/week if wanted — not for fat loss, just heart health. Lifting + deficit + steps is the whole recipe.

## 3. The written meal plan (separate artifact, now embedded in-app)

A full markdown meal plan exists (`Rakshith_Meal_Plan.md`) with:
- Daily shape: pre-gym banana+coffee (fixed) → Breakfast (post-workout anchor, ~10:30am) → Lunch (~1:30pm) → optional Snack (~5pm) → Dinner (~8:30pm)
- Every meal/snack has **two rotatable options (A/B)** hitting the same macros
- An optional Meal 4 for 4-meal days
- Flex rules for running 3 meals+snack / 3 meals no snack / 4 meals — all landing on the same daily total
- A full no-cook "time-crunch fallback" day
- Quick-swap tables (protein sources, carb bases, fruit, fat/fibre add-ons)
- The plan's own verified default day totals ~158g protein (app target is 160g — a deliberate, documented 2g gap, both inside the plan's stated ±5% estimate tolerance)

This document is embedded verbatim inside the PWA (see §6, Plan tab) and renders natively — not a link, not a fetch, works fully offline.

## 4. Product decisions worth knowing (so they aren't re-litigated)

- **Protein target overridden from the naive formula.** User's own instruction was weight×1.5=114g; app uses 160g instead because muscle retention in a deficit needs ~1.6–2.2 g/kg. This was flagged explicitly and the user kept 160g.
- **"Close the gap" recommender** — not a simple sort by protein density. It: (a) requires a food to make a *real* dent (filters out suggesting 150g spinach for a 10g gap), (b) caps portions at 1.5× normal serving so it never suggests something absurd like 250g of prawns, (c) shows max one food per category, (d) rotates daily so it isn't the same three foods every time, (e) flags when a suggestion would blow the remaining calorie budget.
- **Weight trend copy is rule-based**, not vague: it compares this week's 7-day average to last week's and returns a specific verdict against the 0.3–0.5 kg/week target (e.g. "On target", "Faster than ideal — risks muscle", "Flat, add steps before cutting food").
- **Meals are user-built, not hardcoded from the plan doc.** Early idea was to make the plan's own meals (Breakfast A, etc.) tap-to-log directly; user explicitly preferred building meals manually via a generic meal builder (name + slot + ingredients + amounts), because they wanted multiple variants (Breakfast 1, Breakfast 2...) under their own control, not fixed to the doc.
- **No barcode scanning, no water tracking, no gamified streaks** — deliberately scoped out as low-value or actively counterproductive (streak pressure encourages gaming the log).

## 5. Design system — "Ledger"

Seven base colors, remapped to semantic tokens per theme, with two **hard, non-negotiable rules**:
1. **Lime is only ever a surface, with ink text on top — never lime text on anything.**
2. **Solid blue surfaces always carry white text.**

```
Base palette:
  #2563e8  blue
  #1c4fc4  blue-deep
  #dcf65e  lime
  #fafaf8  cream
  #f0f0ec  cream-soft
  #14130e  ink
  #1d1c15  ink-soft
```

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#f0f0ec` | `#14130e` |
| `--surface` | `#fafaf8` | `#1d1c15` |
| `--text` | `#14130e` | `#fafaf8` |
| `--muted` | `#5f5e55` (6.2:1) | `#a3a193` (7.2:1) |
| `--accent-text` | `#1c53c9` (6.4:1) | `#86abff` (8.2:1) |
| `--accent-surface` | `#2563e8` (blue) | `#dcf65e` (lime) |
| `--accent-on` (text on accent-surface) | `#ffffff` | `#14130e` |
| `--danger` | `#a8341c` (6.3:1) | `#f0a58a` (9.3:1) |

All pairings verified against WCAG contrast math (script-checked, not eyeballed). Dark mode nav accent swaps blue→lime automatically per the rules above.

**Three-state appearance toggle** (header icon, cycles Auto → Light → Dark): Auto follows the phone's system setting live; Light/Dark are explicit overrides that persist (`localStorage: pt:theme`) and survive even if the phone is set to the opposite scheme.

## 6. App architecture

**Type:** Static PWA (no build step, no backend, no accounts). Deployed via GitHub → Vercel (auto-deploy on push). Installable to phone home screen, works offline via service worker.

**Files:**
```
index.html      markup — 3 views (Today/Meals/Plan) + tab bar + sheets
styles.css      Ledger design system, light+dark, ~490 lines
app.js          all logic — food DB, storage, recommender, sheets, ~900+ lines
sw.js           offline cache (cache-first for assets, network-first for navigation)
manifest.json   PWA install metadata
vercel.json     cache headers for sw.js/manifest
icons/          app icons (blue Ledger ring mark, 4 sizes + favicon)
README.md       deploy instructions, feature list, changelog-style notes
```

**Storage:** `localStorage`, per-device, offline, no accounts. Keys:
| Key | Contents |
|---|---|
| `pt:log:YYYY-MM-DD` | that day's logged entries (each: name, amount, unit, meal slot, p/f/c/k/fib) |
| `pt:customfoods` | user-added permanent foods |
| `pt:meals` | user-built meals (name, slot, ingredient list) |
| `pt:targets` | daily targets (editable in-app, defaults above) |
| `pt:weights` | weigh-in history `[{d, kg}]` |
| `pt:taps` | tap-count per food/meal, drives the favourites row |
| `pt:theme` | auto / light / dark |
| `pt:accordions` | which food-category sections are expanded |

**Current service worker cache version: `protein-tracker-v7`** — bump this on every deploy or phones keep serving stale cached JS/CSS.

## 7. Features (current state, all tested)

### Today tab
- Hero ring: protein progress, turns to accent color at target
- Fat / Carbs / **Fibre** stat row (Items was replaced with Fibre)
- **"Close the gap" recommender** (logic detailed in §4)
- Favourites row (top 5 most-tapped foods *and* meals, scrollable)
- Searchable, **accordion** food list (5 categories, collapse to save scrolling — cuts page height ~54%; remembers open/closed state; auto-expands on search)
- Quantity sheet: tap food → stepper or type exact amount → live macro preview (P/F/C/Fibre) → pick meal slot (auto-guessed by time of day) → add
- Add-a-food-permanently form (label macros + serving amount, saved forever, marked with a dot)
- Log grouped by meal (Breakfast/Lunch/Snack/Dinner) with per-meal subtotals
- Weight log: daily entry, 7-day rolling average, 14-day sparkline, rule-based week-over-week trend verdict
- 7-day protein strip, tappable bars open History for that day
- Settings sheet: editable targets (P/K/F/C/Fibre), Export backup (JSON), Export CSV, Import backup, live stats (days logged / custom foods / meals / weigh-ins)

### Meals tab (new)
- Build a meal: name it (e.g. "Breakfast 1", "Breakfast 2"), assign a slot, search-add ingredients with exact amounts, live-updating totals
- Save → becomes a card with full macros + ingredient list + one-tap **Log** button
- Edit or delete anytime
- Frequently-logged meals surface in the Today tab's favourites row

### Plan tab (new)
- User's full markdown meal-plan doc, embedded in the HTML bundle (works fully offline, no fetch)
- Custom lightweight markdown renderer (tables, blockquotes, lists, headers, bold/italic/code) — no external library
- Overview card up top showing live targets (P/K/F/C/Fibre/deficit)
- Every `##` section becomes a collapsible accordion (first one open by default)
- Wide tables scroll sideways with a hint label

### Cross-cutting
- History: tap any day (past or present) to see full meal-grouped log
- Export/Import: full JSON round-trip tested (wipe→import restores everything exactly, including custom targets/foods/meals/weights)
- Appearance toggle (§5)
- Dark/light mode, reduced-motion support, reduced-transparency fallback
- Drag-to-dismiss on all sheets (velocity-aware, Apple-style)

## 8. Food database (53 items, all fields: protein/fat/carbs/fibre/kcal per stated unit)

Two labeled products carry **exact printed-label macros** (photographed by the user):
- **TruNativ Raw Concentrate**: 28.1g P, 0.5g F, 2.7g C, 128 kcal per 35g scoop (confirmed via label photo)
- **Alpino High-Protein Oats (Dark Chocolate)**: 27g protein per 100g (from product page)
- **TruNativ Pro Blend**: 26.4g P, 2.1g F, 4.0g C, 141 kcal per 36g scoop (from product page — **not yet confirmed via label photo**, unlike the Raw Concentrate)
- **Nandini Toned Milk**: ~3.1g protein per 100ml (standard spec)

Everything else uses standard reference nutrition values. All 53 were validated against the Atwater energy equation (4 kcal/g protein, 4 kcal/g carb, 9 kcal/g fat) as a sanity check — only spinach and broccoli "fail" this check, correctly, because their carbs are mostly fibre (not fully metabolised, so raw Atwater overestimates their energy).

**Banana note:** originally one generic entry; later split into three real varieties since the user is in coastal Karnataka where Yelakki is the everyday banana (much smaller than generic — old entry was crediting ~3x the real calories/carbs for a Yelakki).

Full list:

**Protein & dairy** (17)
- TruNativ Raw Concentrate — 28.1g P, 0.5g F, 2.7g C, 0.0g fib, 128 kcal per 35g  [1 scoop = 35 g · label: 28.1g P, 0.5g F, 2.7g C, 128 kcal]
- TruNativ Pro Blend — 26.4g P, 2.1g F, 4.0g C, 0.0g fib, 141 kcal per 36g  [1 scoop = 36 g · 26 g protein]
- Chicken breast (cooked) — 45.0g P, 5.4g F, 0.0g C, 0.0g fib, 248 kcal per 150g
- Fish – rohu/surmai (cooked) — 33.0g P, 7.5g F, 0.0g C, 0.0g fib, 203 kcal per 150g
- Tuna (drained) — 25.0g P, 0.8g F, 0.0g C, 0.0g fib, 116 kcal per 100g  [1 tin ≈ 100 g]
- Prawns (cooked) — 24.0g P, 0.3g F, 0.2g C, 0.0g fib, 99 kcal per 100g
- Whole egg — 12.0g P, 10.0g F, 1.0g C, 0.0g fib, 144 kcal per 2egg
- Egg white — 10.8g P, 0.2g F, 0.6g C, 0.0g fib, 51 kcal per 3white
- Paneer — 18.0g P, 20.0g F, 4.0g C, 0.0g fib, 265 kcal per 100g
- Tofu — 8.0g P, 4.8g F, 1.9g C, 0.9g fib, 76 kcal per 100g
- Soya chunks (dry) — 26.0g P, 0.3g F, 16.5g C, 6.5g fib, 173 kcal per 50g
- Moong sprouts (boiled) — 7.5g P, 0.5g F, 17.0g C, 2.0g fib, 100 kcal per 100g  [no-cook: steam/soak]
- Greek yogurt / hung curd — 15.0g P, 4.0g F, 6.0g C, 0.0g fib, 131 kcal per 150g
- Curd (regular) — 8.0g P, 4.5g F, 7.2g C, 0.0g fib, 90 kcal per 150g
- Buttermilk / chaas — 2.0g P, 1.0g F, 5.0g C, 0.0g fib, 40 kcal per 200ml  [no-cook]
- Cheese slice — 3.5g P, 4.5g F, 1.0g C, 0.0g fib, 60 kcal per 1slice
- Milk – Nandini toned — 6.2g P, 6.0g F, 9.6g C, 0.0g fib, 116 kcal per 200ml  [per 100 ml: 3.1 g protein]

**Grains & carbs** (12)
- Alpino High-Protein Oats (Choco) — 13.5g P, 4.8g F, 23.5g C, 4.5g fib, 190 kcal per 50g  [27 g protein / 100 g]
- Rolled oats (plain) — 6.5g P, 3.5g F, 33.0g C, 5.0g fib, 190 kcal per 50g
- Muesli — 4.0g P, 3.0g F, 26.8g C, 2.8g fib, 150 kcal per 40g  [no-cook: add milk/curd]
- Rice (cooked) — 4.0g P, 0.5g F, 42.0g C, 0.6g fib, 195 kcal per 150g
- Sweet potato / shakarkandi — 2.4g P, 0.1g F, 30.0g C, 4.5g fib, 129 kcal per 150g
- Chapati / roti — 6.0g P, 6.0g F, 40.0g C, 4.0g fib, 240 kcal per 2roti
- Idli — 4.8g P, 0.6g F, 24.0g C, 1.8g fib, 120 kcal per 3idli  [steam only]
- Dosa (plain) — 3.0g P, 4.0g F, 20.0g C, 1.2g fib, 130 kcal per 1dosa
- Poha (cooked) — 3.0g P, 5.0g F, 34.0g C, 1.5g fib, 200 kcal per 1katori  [quick cook]
- Brown bread — 8.0g P, 2.0g F, 28.0g C, 3.0g fib, 160 kcal per 2slice
- Roasted chana — 6.0g P, 1.6g F, 15.9g C, 4.5g fib, 110 kcal per 30g
- Dal / rajma (cooked) — 7.0g P, 3.0g F, 18.0g C, 5.0g fib, 120 kcal per 1katori  [1 katori ≈ 150 g]

**Vegetables** (6)
- Spinach / palak (cooked) — 2.9g P, 0.4g F, 3.6g C, 2.4g fib, 23 kcal per 100g
- Broccoli (cooked) — 2.8g P, 0.4g F, 7.0g C, 3.3g fib, 35 kcal per 100g
- Mixed veg sabzi (1 tsp oil) — 2.0g P, 4.0g F, 8.0g C, 3.0g fib, 75 kcal per 1katori
- Sambar — 4.0g P, 2.5g F, 12.0g C, 3.0g fib, 90 kcal per 1katori
- Kosambari (moong salad) — 5.0g P, 2.0g F, 12.0g C, 4.0g fib, 90 kcal per 1katori  [no-cook]
- Green salad (dressed) — 1.0g P, 0.2g F, 4.0g C, 1.5g fib, 20 kcal per 1katori

**Fruit** (9)
- Banana – Robusta/Cavendish — 1.3g P, 0.4g F, 27.4g C, 3.1g fib, 107 kcal per 1piece  [~120g edible, the common everyday banana]
- Banana – Nendran — 1.8g P, 0.5g F, 36.5g C, 4.2g fib, 142 kcal per 1piece  [~160g edible, larger Kerala/coastal variety]
- Banana – Yelakki (Elaichi) — 0.9g P, 0.2g F, 18.2g C, 2.1g fib, 71 kcal per 2piece  [~40g edible each, small — figures below are for 2]
- Apple — 0.5g P, 0.3g F, 25.0g C, 4.4g fib, 95 kcal per 1piece
- Guava — 2.6g P, 1.0g F, 14.0g C, 5.4g fib, 68 kcal per 1piece
- Papaya (cubes) — 0.7g P, 0.4g F, 15.0g C, 2.5g fib, 60 kcal per 1katori
- Orange — 1.2g P, 0.2g F, 15.0g C, 3.1g fib, 62 kcal per 1piece
- Dates — 0.4g P, 0.0g F, 10.6g C, 1.6g fib, 40 kcal per 2piece
- Coconut water — 1.4g P, 0.0g F, 9.0g C, 0.0g fib, 38 kcal per 200ml  [no-cook]

**Nuts & fats** (9)
- Almonds — 2.1g P, 4.9g F, 2.2g C, 1.3g fib, 58 kcal per 10g
- Walnuts — 1.5g P, 6.5g F, 1.4g C, 0.7g fib, 65 kcal per 10g
- Peanuts (roasted) — 5.2g P, 9.8g F, 3.2g C, 1.7g fib, 113 kcal per 20g
- Cashews — 2.7g P, 6.6g F, 4.5g C, 0.5g fib, 83 kcal per 15g
- Chia seeds — 2.0g P, 3.7g F, 5.0g C, 4.1g fib, 58 kcal per 12g
- Flax seeds — 1.8g P, 4.2g F, 2.9g C, 2.7g fib, 53 kcal per 10g
- Peanut butter — 3.8g P, 7.5g F, 3.0g C, 0.9g fib, 89 kcal per 15g
- Coconut (fresh grated) — 0.6g P, 6.6g F, 3.0g C, 1.8g fib, 71 kcal per 20g
- Ghee / oil — 0.0g P, 5.0g F, 0.0g C, 0.0g fib, 45 kcal per 1tsp

## 9. Known limitations / honest gaps

- **Per-device storage only** — phone and laptop keep separate logs, no cross-device sync (deliberate tradeoff to avoid running a backend; Supabase was discussed and explicitly rejected for this use case — see §10)
- **Katori-based Indian dishes** (sambar, sabzi, dal, poha, dosa, idli, chapati) use estimated reference values — will vary with actual preparation. Flagged in-app that these are approximations.
- **TruNativ Pro Blend** macros are sourced from the product page, not a physical label photo (unlike Raw Concentrate, which was verified)
- No barcode scanning, no cross-device sync, no notifications (all deliberately scoped out — see §4)

## 10. Explicitly rejected approaches (so they aren't re-suggested)

- **Supabase / any backend database** — rejected for this single-user daily tracker. Reasoning: published Claude artifacts run in a sandboxed iframe that can't reliably reach third-party services; even self-hosted, it adds auth/key-management complexity disproportionate to the value for one user. Only relevant if genuine multi-device sync becomes a real need later.
- **Tap-to-log the plan doc's own meals directly** — rejected in favor of a user-controlled meal builder (see §4).
- **Water tracking, barcode scanning, streak gamification, push notifications** — all considered and explicitly scoped out (see §4 and §7).

## 11. Deployment

Hosted on **Vercel**, connected to a **GitHub repo** (auto-deploys on push to the connected branch). No build step — static files pushed as-is. Files must be uploaded together (all 7 + `icons/`) to avoid version-mismatch bugs (see §12).

After any deploy: **fully close and reopen the app on the phone** (not just background it) so the new service worker takes over and clears the old cached version.

## 12. Bugs found and fixed during development (context for whoever continues this)

Worth knowing so regressions aren't reintroduced:
- **Grid overflow on narrow phones**: `grid-template-columns: 1fr 1fr` resolves to `minmax(auto,1fr)`, and `auto` floors at input min-content width — caused Settings/Add-food inputs to spill off-screen on iPhone. Fixed with `minmax(0,1fr)` + `min-width:0` globally, plus `overflow-x:hidden` on html/body as backstop.
- **Fragile init**: a single missing DOM element (from a partial/stale deploy) threw an uncaught error that blanked the entire app (no foods, `undefined` targets). Fixed with a `bind()` safe-wiring helper and a try/catch around init so a missing piece degrades gracefully instead of cascading.
- **Sheet stacking**: opening the food-picker sheet from inside the meal-builder sheet — both were the same z-index, so the builder's Save button intercepted taps meant for the picker. Fixed with a `.stacked` z-index tier for sheets opened from within another sheet.
- **Null-after-close bug**: `closeSheet()` nulls `sheetFood`, but a toast message on the next line still read `sheetFood.n` → threw every time. Fixed by capturing the name into a local variable before calling `closeSheet()`.

All four were caught by browser-automation testing (Playwright), not just code review — worth continuing that habit for any further changes.

---

*Document generated to hand off full project context. The actual application files (index.html, app.js, styles.css, sw.js, manifest.json, vercel.json, README.md, icons/) are the working PWA — this document is the "why" behind them.*
