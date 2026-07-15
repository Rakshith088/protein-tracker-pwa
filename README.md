# Protein Tracker — PWA

A protein-first daily macro tracker. Static, offline-capable, installable on your phone home screen. No build step, no backend, no accounts.

**Targets baked in:** 160 g protein · 1975 kcal · 58 g fat · 200 g carbs · 30 g fibre
(from 76 kg / 174 cm / 31 M, TDEE ≈ 2475 kcal − 500 deficit)

---

## Deploy to Vercel

**Option A — drag & drop (fastest)**
1. Go to [vercel.com/new](https://vercel.com/new)
2. Drag this whole folder onto the page
3. Deploy → you get a URL like `protein-tracker.vercel.app`

**Option B — CLI**
```bash
npm i -g vercel
cd protein-tracker-pwa
vercel --prod
```

**Option C — GitHub**
Push the folder to a repo → import it at vercel.com/new → deploy. Every push redeploys.

No configuration needed — it's static files. `vercel.json` just sets correct cache headers so the service worker updates properly.

---

## Install on your phone

**iOS (Safari — must be Safari, not Chrome):**
Open the URL → Share button → **Add to Home Screen**

**Android (Chrome):**
Open the URL → ⋮ menu → **Install app** / **Add to Home Screen**

It then launches fullscreen with no browser chrome, works offline, and keeps your data.

---

## How data is stored

Uses `localStorage` — **per-device, private, offline, permanent** until you clear browser data for the site.

| Key | Contents |
|---|---|
| `pt:log:YYYY-MM-DD` | that day's logged entries |
| `pt:customfoods` | foods you added permanently |
| `pt:targets` | your daily targets |
| `pt:meals` | your saved meals |
| `pt:theme` | auto / light / dark |
| `pt:accordions` | which food sections you keep open |
| `pt:weights` | weigh-in history |
| `pt:taps` | tap counts (drives favourites) |

**Not synced across devices.** Phone and laptop keep separate logs. If you later want sync, that's the point at which a backend (Supabase) earns its keep.

**Don't** "Clear browsing data" for this site — that wipes the log. Settings → **Export backup** guards against this; keep a copy somewhere safe.

---

## Three tabs

**Today** — the tracker. **Meals** — build and log your own meals. **Plan** — your full meal-plan document, embedded and offline.

## Features

- **Hero ring** — protein toward your target; turns bright green when hit
- **Close the gap** — recommends foods + exact amounts to hit remaining protein within remaining calories. Ranks by protein efficiency (kcal per gram of protein), only suggests foods that make a real dent, caps portions at 1.5× normal serving, one per category, and rotates daily so it doesn't repeat.
- **51 foods** across My foods / Protein & dairy / Grains & carbs / Vegetables / Fruit / Nuts & fats — each with protein, fat, carbs, **fibre** and calories
- **Fibre tracked** with a 30 g target (a plan-style day lands at ~31 g, so it's reachable without gaming it)
- **My meals** — build a meal once from any foods + amounts (Breakfast 1, Breakfast 2, …), tag it to a slot, then log the whole thing with one tap. Edit or delete anytime; frequently-tapped meals surface in favourites.
- **Plan tab** — your meal plan rendered natively in-app: an overview card of your targets, then every section as an accordion. Wide tables scroll sideways. Fully offline, no fetch.
- **Quantity sheet** — tap food → stepper (− / +) or type exact amount → live macro preview → add. Drag the sheet handle down to dismiss (velocity-aware).
- **My foods** — add any food permanently with label macros; marked with a jade dot; removable from its sheet
- **7-day strip** — bar per day, green when ≥155 g
- **Meal grouping** — each entry is tagged Breakfast / Lunch / Snack / Dinner (auto-picked from the time of day, changeable in the sheet). Today's log and history group by meal with per-meal protein subtotals.
- **Quick-add favourites** — a scrollable row of your 5 most-tapped foods, appears once you've used the app a bit
- **History** — tap any bar in the 7-day strip, or the clock icon, to browse any past day's full log with ‹ › navigation
- **Weight log** — daily weigh-in, 7-day rolling average, 14-day sparkline, and a week-on-week trend read against the 0.3–0.5 kg/week target
- **Editable targets** — change protein / calories / fat / carbs from the settings sheet; everything (ring, recommender, week strip) re-derives
- **Export / Import** — full JSON backup (logs, foods, weights, targets) and CSV export for spreadsheets
- **Accordion food list** — categories collapse; only Protein & dairy opens by default. Cuts the page from ~5.1 screens to ~2.4 (54% less scrolling). Open/closed state is remembered; searching auto-expands matches.
- **Appearance toggle** — the sun/moon/half-circle icon in the header cycles **Auto → Light → Dark**. Auto follows your phone (and updates live if the phone switches); Light and Dark override it and persist across sessions (`pt:theme`).
- **Reduced motion / reduced transparency** — respected

---

## Macro data — sourcing & accuracy

**From official product labels (accurate):**
- **TruNativ Pro Blend** — 26.39 g protein, 3.97 g carbs, 2.14 g fat, 140.70 kcal per 36 g scoop
- **TruNativ Raw Concentrate** — 28.1 g protein, 0.5 g fat, 2.7 g carbs, 128 kcal per 35 g scoop (full label)
- **Alpino High-Protein Oats (Dark Chocolate)** — 27 g protein per 100 g
- **Nandini Toned Milk** — ~3.1 g protein per 100 ml (standard toned milk spec)

**Standard reference values (accurate within a few %):**
All whole foods — chicken, fish, eggs, rice, dal, veg, fruit, nuts.

**Estimates — vary by preparation:**
Katori-based items (sambar, sabzi, dal, poha), dosa, idli, chapati. A "katori" is treated as ~150 g. If your portions differ a lot, add your own version under **My foods**.

Every food was validated against the Atwater equation (4 kcal/g protein, 4 kcal/g carb, 9 kcal/g fat). All reconcile within 18% except spinach and broccoli — correctly, since their carbs are largely fibre, which isn't fully metabolised.

---

## Changing your targets

In the app: **settings icon (top right) → Daily targets → Save**. No code needed.

The shipped defaults live in `app.js` (`DEFAULT_TARGETS`) and only apply before you've saved your own.

## Adding foods permanently

Two ways:
1. **In the app** — "Add a food to my list", enter label macros + the amount they're for. Saved forever, appears under ★ My foods.
2. **In code** — add an object to `BASE_FOODS` in `app.js`. Note `per` is macros **per single unit** (per 1 g, per 1 egg, etc.), so divide label values by the serving size.

## Updating the deployed app

After editing files, bump the cache version in `sw.js`:
```js
const CACHE = "protein-tracker-v2";  // was v1
```
Otherwise phones keep serving the old cached version.

---

## Design system — "Ledger"

Seven base colors remapped to semantic tokens per theme (`styles.css` `:root`):

| Token | Light | Dark |
|---|---|---|
| `--bg` / `--surface` | `#f0f0ec` / `#fafaf8` | `#14130e` / `#1d1c15` |
| `--text` | `#14130e` | `#fafaf8` |
| `--accent-text` | `#1c53c9` (6.4:1) | `#86abff` (8.2:1) |
| `--accent-surface` / `--accent-on` | `#2563e8` / white | `#dcf65e` / `#14130e` |
| `--accent-press` | `#1c4fc4` | `#c9e34b` |

Two hard rules, enforced and test-verified in both themes:
1. **Lime is only ever a surface, with ink text on top.** Never lime text on anything.
2. **Solid blue surfaces always carry white text.**

In dark mode the nav accent swaps blue → lime (ink text) and `--accent-text` shifts to `#86abff`. The hero ring "target hit" state uses `--accent-text`, never lime type.

## Files

```
index.html      markup
styles.css      design system, light + dark
app.js          food DB, storage, recommender, sheet
sw.js           offline cache
manifest.json   install metadata
vercel.json     cache headers
icons/          app icons
```
