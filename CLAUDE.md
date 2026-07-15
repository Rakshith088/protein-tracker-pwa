# Protein Tracker

Personal nutrition tracker PWA. Single user (Rakshith). Static, no backend, no accounts.

## Read before doing anything
- `docs/CONTEXT.md` — full project history, design system, food DB, product decisions
- `docs/MEAL_PLAN.md` — the user's actual meal plan; this is the nutritional source of truth
- `docs/CONTEXT.md` §10 lists **explicitly rejected approaches**. Do not re-propose them.
- `docs/CONTEXT.md` §12 lists **bugs already fixed**. Do not reintroduce them.

## Hard constraints
- Static PWA: no build step, no backend, no accounts, no dependencies. Vanilla HTML/CSS/JS.
- Storage: `localStorage` only. Existing keys must keep working (see CONTEXT §6).
- Design system "Ledger" (CONTEXT §5). Two non-negotiable rules:
  1. Lime is only ever a surface, with ink text on top. Never lime text.
  2. Solid blue surfaces always carry white text.
- Bump the service worker cache version on every change.
- Test in a real browser (Playwright) before declaring done. Four of the four bugs in
  §12 were found by browser testing, not code review.
- Mobile-only: iPhone home-screen PWA, portrait, 375px. No desktop layout.
- Targets are externally derived (weekly coaching project) and change over time.
  Never hardcode or assume 1,975 kcal anywhere. The JSON export is an interface,
  not a backup — full history, versioned schema.
