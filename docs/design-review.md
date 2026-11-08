# Pantry interface overhaul

Requested: complete app overhaul using Taste and Impeccable, retaining List on the left and Manage food on the right.

## Delivered

- Ink-blue desktop navigation rail and phone navigation, with cream work surfaces.
- Compact stock filters replace the duplicate shopping summary.
- Aligned inventory records with food illustration, quantity, storage, status and labeled actions.
- One Manage food header and persistent section navigation; stock, purchase and detail drafts stay mounted independently.
- Distinct shopping items and optional suggestions; responsive activity records.
- Consistent editor headers, readable fields, fixed save actions, and keyboard skip link.

## Validation

- `bun run ci`: formatting, lint, TypeScript and domain/API tests pass.
- `bun test tests/domain.bun.test.ts`: six tests pass.
- `bun run test:ui`: full inventory, shopping, form, sync-conflict, failure recovery and service-worker suite passes in Chromium.
- Visual review: inventory, stock, details, shopping, activity and add screens at 1440, 768, 390 and 320px.
- Independent Impeccable finish reviewer: **ship**, no material fixes. Review was code-led; no approved image comp or external quality boards.

## Skill tool limits

Impeccable's context launcher initially could not create its default cache. Its documented direct-context fallback was used. The direction helper ran from a temporary writable cache with seed reference `seed:5251457e6ebdd4df`; the remote catalog remained unavailable, so no external challengers/quality boards were claimed.

Impeccable's source detector returned one warning on a legacy `.manage-tabs` underline. That selector is not used by the current editor and explicitly has zero radius, so its rounded-border finding is not applicable.

Taste v2.5's browser gate ran and reported `GATE: FAIL 30`. Its current checker treats this working app as a marketing website, requiring a full-screen hero, one section per screen, visual effects, a closing CTA and symmetric page margins without a navigation rail. These checks were not waived or altered to claim a pass. Its body contrast check requested 7:1; the reported secondary text is 5.78:1, above WCAG AA's 4.5:1. The app was validated with task-focused browser checks and independent responsive review instead. Retained food illustrations follow the user's explicit request.

## Pantry workflow research

KitchenPal’s [kitchen FAQ](https://kitchenpalapp.com/en/faqs/kitchen.html) describes optional dates, previous-location defaults and adding multiple items; [Pantry Check’s guide](https://pantrycheck.com/user-guide/) describes manual lookup and quantity adjustment. These informed keeping the add form light and making low-stock suggestions easier to act on. Suggestions are still explicitly chosen by the user; “Add all to list” performs one update and avoids duplicates.

## Card and editor simplification

Location and date now share a consistent left-aligned storage block beneath stock amounts. The Manage food tab bar is removed: the default flow edits remaining stock, a contextual link switches to adding a purchase, and a secondary header link opens food details. Drafts remain mounted when changing tasks; deletion still requires confirmation.
