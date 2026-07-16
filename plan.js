/* Protein Tracker — structured meal plan (v2)
   Extracted from docs/MEAL_PLAN.md (plan last updated 2026-07-14; reconciled
   2026-07-16: whey note, Breakfast B includes its ½ scoop, Dinner A counts a
   separate tsp of oil for the eggs).

   Ingredients link to food-DB entries by exact name; `amt` is always grams
   (or ml for liquids) — the app computes every meal's macros live from the
   DB at render time. The `claimed` blocks are the plan document's stated
   numbers — kept only for the drift audit, never rendered as truth.

   Items the DB can't log yet carry {name, est:{...}, unlinked:true} — their
   values are estimates pending Phase 2 sourcing.

   Nothing in this file may reference absolute daily targets (1,975 kcal etc.);
   targets live in pt:targets and are externally derived. */
window.MEAL_PLAN = {
  version: 2,
  source: "docs/MEAL_PLAN.md",
  updated: "2026-07-16",

  /* fixed pre-gym fuel, counted in every day's totals */
  pregym: {
    label: "Pre-gym fuel",
    time: "~7:15am",
    fixed: true,
    items: [
      { food: "Banana – Robusta/Cavendish", amt: 120, note: "1 banana" }
    ],
    extras: ["Black coffee (0 kcal)"]
  },

  /* breakfast note that applies regardless of option */
  breakfastNote: "Take creatine 5 g and 1 tbsp chia/flax in the breakfast — stir in after cooking, never into boiling oats.",

  slots: [
    {
      slot: "Breakfast", logSlot: "Breakfast", time: "~10:30am",
      role: "Post-workout anchor — big protein + carbs land here.",
      options: [
        {
          id: "breakfast-a", tag: "A", name: "Oats + whey shake",
          items: [
            { food: "Rolled oats (plain)", amt: 50 },
            { food: "Milk – Nandini toned", amt: 200 },
            { food: "TruNativ Raw Concentrate", amt: 52.5, note: "1.5 scoop" },
            { food: "Chia seeds", amt: 12, note: "1 tbsp" }
          ],
          extras: ["Creatine 5 g (no macros)"],
          method: "Cook oats in the milk (or soak overnight). Cool slightly, then stir in whey + chia + creatine. Never add whey to boiling oats.",
          claimed: { k: 550, p: 51, f: 15, c: 53 }
        },
        {
          id: "breakfast-b", tag: "B", name: "Egg bhurji + toast",
          items: [
            { food: "Whole egg", amt: 150, note: "3 eggs" },
            { food: "Egg white", amt: 90, note: "3 whites" },
            { food: "Brown bread", amt: 60, note: "2 slices" },
            { name: "Bhurji veg (onion/tomato/capsicum)", unlinked: true, est: { p: 1, f: 0, c: 5, k: 25, fib: 1.5 } },
            { food: "Ghee / oil", amt: 5, note: "1 tsp" },
            { food: "TruNativ Raw Concentrate", amt: 17.5, note: "½ scoop in water — matches Option A's protein" }
          ],
          extras: ["Black coffee (0 kcal)"],
          method: "Scramble eggs + whites with veg in 1 tsp oil on a non-stick pan. Toast bread dry. Shake the ½ scoop whey in water.",
          claimed: { k: 560, p: 52, f: 22, c: 36 }
        }
      ]
    },
    {
      slot: "Lunch", logSlot: "Lunch", time: "~1:30pm",
      role: "Meal-prep friendly, rice-based.",
      options: [
        {
          id: "lunch-a", tag: "A", name: "Chicken + rice + rajma",
          items: [
            { food: "Chicken breast (cooked)", amt: 150 },
            { food: "Rice (cooked)", amt: 150 },
            { food: "Dal / rajma (cooked)", amt: 150, note: "1 katori" },
            { food: "Green salad (dressed)", amt: 150, note: "big salad — half the plate" },
            { food: "Ghee / oil", amt: 5, note: "1 tsp" }
          ],
          method: "Batch-grill chicken, boil rice, pressure-cook rajma for 2–3 days. Assemble; load half the plate with salad.",
          claimed: { k: 615, p: 57, f: 13, c: 65 }
        },
        {
          id: "lunch-b", tag: "B", name: "Fish + rice + dal + curd",
          items: [
            { food: "Fish – rohu/surmai (cooked)", amt: 175 },
            { food: "Rice (cooked)", amt: 150 },
            { food: "Dal / rajma (cooked)", amt: 75, note: "½ katori" },
            { food: "Curd (regular)", amt: 100 },
            { food: "Green salad (dressed)", amt: 150, note: "1 katori" },
            { food: "Ghee / oil", amt: 5, note: "1 tsp" }
          ],
          method: "Pan-sear or bake the fish with masala. Serve with rice, dal, a curd side, and salad.",
          claimed: { k: 610, p: 49, f: 19, c: 60 }
        }
      ]
    },
    {
      slot: "Snack", logSlot: "Snack", time: "~5:00pm", optional: true,
      role: "Optional — include it or fold into meals (see day shapes).",
      options: [
        {
          id: "snack-a", tag: "A", name: "Greek yogurt bowl",
          items: [
            { food: "Greek yogurt / hung curd", amt: 150 },
            { food: "TruNativ Raw Concentrate", amt: 17.5, note: "½ scoop" },
            { food: "Apple", amt: 180, note: "1 apple, with skin" }
          ],
          method: "Whisk whey into the yogurt until smooth. Chop apple in.",
          claimed: { k: 270, p: 27, f: 5, c: 28 }
        },
        {
          id: "snack-b", tag: "B", name: "Evening whey + fruit",
          items: [
            { food: "TruNativ Raw Concentrate", amt: 35, note: "1 scoop in water" },
            { food: "Guava", amt: 100, note: "1 guava" },
            { food: "Almonds", amt: 10 }
          ],
          method: "Shake whey with cold water. Eat guava + almonds alongside.",
          claimed: { k: 240, p: 27, f: 7, c: 19 }
        }
      ]
    },
    {
      slot: "Dinner", logSlot: "Dinner", time: "~8:30pm",
      role: "Lighter — protein + veg.",
      options: [
        {
          id: "dinner-a", tag: "A", name: "Eggs + sweet potato",
          hint: "convenient, higher fat",
          items: [
            { food: "Whole egg", amt: 150, note: "3 eggs" },
            { food: "Sweet potato / shakarkandi", amt: 150 },
            { food: "Mixed veg sabzi (1 tsp oil)", amt: 150, note: "1 katori, its own oil" },
            { food: "Ghee / oil", amt: 5, note: "1 tsp — the eggs' oil, on top of the veg's" }
          ],
          method: "Boil or roast sweet potato (batch a tray). Fry eggs / make bhurji in 1 tsp oil, veg cooked separately.",
          claimed: { k: 465, p: 22, f: 24, c: 39 }
        },
        {
          id: "dinner-b", tag: "B", name: "Chicken/fish + veg",
          hint: "leaner, higher protein — best when earlier meals ran low",
          items: [
            { food: "Chicken breast (cooked)", amt: 150, note: "or fish" },
            { food: "Mixed veg sabzi (1 tsp oil)", amt: 150, note: "big stir-fry; its oil is the meal's 1 tsp" },
            { food: "Sweet potato / shakarkandi", amt: 100, note: "or ½ cup rice" }
          ],
          method: "Stir-fry veg + protein in 1 tsp oil. Small carb on the side.",
          claimed: { k: 420, p: 50, f: 10, c: 28 }
        }
      ]
    },
    {
      slot: "Meal 4", logSlot: "Snack", time: "flexible", optional: true,
      role: "Only on 4-meal days.",
      options: [
        {
          id: "meal4-a", tag: "A", name: "Moong dal chilla + curd",
          items: [
            { name: "Moong dal chilla ×2 (from ~50 g dry dal)", unlinked: true, est: { p: 12, f: 0.6, c: 31, k: 175, fib: 8 } },
            { food: "Curd (regular)", amt: 100 }
          ],
          method: "Blend soaked dal to batter, cook 2 thin chilla on non-stick. Serve with curd.",
          claimed: { k: 260, p: 19, f: 7, c: 32 }
        },
        {
          id: "meal4-b", tag: "B", name: "Tuna/egg-white salad",
          items: [
            { food: "Tuna (drained)", amt: 100, note: "1 tin — or 6 egg whites" },
            { food: "Green salad (dressed)", amt: 150, note: "1 katori + lemon" },
            { food: "Ghee / oil", amt: 5, note: "1 tsp olive oil" }
          ],
          method: "Flake tuna over veg, dress with lemon + oil. Zero cooking (or quick-boil whites).",
          claimed: { k: 160, p: 25, f: 6, c: 4 }
        }
      ]
    }
  ],

  /* the three ways to run a day — all land on the same daily total */
  shapes: [
    {
      id: "3+snack", name: "3 meals + snack", base: true,
      sequence: ["pregym", "Breakfast", "Lunch", "Snack", "Dinner"],
      text: "The base plan: banana + breakfast + lunch + snack + dinner."
    },
    {
      id: "3", name: "3 meals, no snack",
      sequence: ["pregym", "Breakfast", "Lunch", "Dinner"],
      adjustment: {
        items: [
          { food: "TruNativ Raw Concentrate", amt: 35, note: "1 scoop, in milk or water" },
          { food: "Apple", amt: 180, note: "or any fruit" }
        ],
        text: "Skip the snack and add its protein back: fold 1 scoop whey + a fruit into breakfast or dinner. Nothing else changes."
      }
    },
    {
      id: "4", name: "4 meals",
      sequence: ["pregym", "Breakfast", "Lunch", "Meal 4", "Dinner"],
      text: "Easiest: drop the snack and use Meal 4 instead. Or keep the snack and trim 150 g of rice across lunch + dinner. Either way the day lands on the same total."
    }
  ],

  /* full no-cook / assembly-only fallback day */
  nocook: {
    name: "Time-crunch fallback — no-cook day",
    text: "Same targets, zero real cooking. Keep stocked: whey, Greek yogurt/curd, tuna tins, pre-boiled eggs, roasted chana, ready dal pouch, pre-cooked rice, brown bread, fruit, chia.",
    prep: "One-time prep: boil a full tray of eggs (lasts 5 days), keep 3–4 tuna tins and 2 dal pouches in the cupboard, soak overnight oats before bed.",
    meals: [
      {
        slot: "Breakfast", name: "Overnight oats",
        items: [
          { food: "Rolled oats (plain)", amt: 50 },
          { food: "Curd (regular)", amt: 150 },
          { food: "TruNativ Raw Concentrate", amt: 35, note: "1 scoop" },
          { food: "Apple", amt: 180, note: "or any fruit" },
          { food: "Chia seeds", amt: 12, note: "1 tbsp — soak overnight" }
        ],
        claimed: { k: 570, p: 45 }
      },
      {
        slot: "Lunch", name: "Tuna + egg sandwich plate",
        items: [
          { food: "Brown bread", amt: 60, note: "2 slices" },
          { food: "Tuna (drained)", amt: 100, note: "1 tin" },
          { food: "Whole egg", amt: 100, note: "2 eggs, pre-boiled" },
          { food: "Green salad (dressed)", amt: 150, note: "1 katori + lemon" }
        ],
        claimed: { k: 440, p: 46 }
      },
      {
        slot: "Snack", name: "Whey + milk + banana",
        items: [
          { food: "TruNativ Raw Concentrate", amt: 35, note: "1 scoop" },
          { food: "Milk – Nandini toned", amt: 200 },
          { food: "Banana – Robusta/Cavendish", amt: 120, note: "1 banana" }
        ],
        claimed: { k: 345, p: 31 }
      },
      {
        slot: "Dinner", name: "Dal pouch + rice + eggs",
        items: [
          { name: "Ready dal pouch (MTR/Tasty Bite)", unlinked: true, est: { p: 13, f: 8, c: 28, k: 240, fib: 6 } },
          { name: "Pre-cooked rice (½ pack ≈ 125 g)", unlinked: true, est: { p: 3.4, f: 0.4, c: 35, k: 163, fib: 0.5 } },
          { food: "Whole egg", amt: 150, note: "3 eggs, pre-boiled" },
          { food: "Green salad (dressed)", amt: 150, note: "1 katori" }
        ],
        claimed: { k: 605, p: 31 }
      }
    ],
    claimedTotal: { k: 1960, p: 153 },
    safety: "Short on protein? Add ½–1 scoop whey anywhere to top up."
  },

  /* quick swaps — macros stay ~same within a group */
  swaps: [
    { group: "Lunch/dinner protein (~150 g cooked)", options: ["chicken", "fish (rohu/surmai/tuna)", "3 eggs", "100 g paneer", "50 g dry soya chunks", "rajma/chana/dal"] },
    { group: "Carb base", options: ["plain rice", "curd rice", "veg pulao", "jeera/lemon rice", "sweet potato", "ragi/jowar rice"] },
    { group: "Fruit (1–2/day)", options: ["banana (pre-gym)", "apple", "papaya", "guava (most fibre)", "orange"] },
    { group: "Fat/fibre add-on", options: ["1 tbsp chia/flax in the shake", "10–15 g almonds/walnuts with the snack"] },
    { group: "Veg (half every plate)", options: ["any leafy/cruciferous/gourd — fresh or frozen, both fine"] }
  ],

  /* hard rules — protein band is relative to the live target, never absolute */
  nonNegotiables: {
    proteinBand: 5,      /* hit protein within ±5 g of the current target */
    caloriesFixed: true, /* hit calories every day */
    flex: "Fat/carb split can flex.",
    safetyNet: "Short on protein? A whey scoop is always the safety net."
  }
};
