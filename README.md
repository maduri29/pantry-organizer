# Pantry Organizer

A phone-first shared pantry for two people. The main job is checking what is left before a grocery trip, without logging each use.

## Current foundation

- Rough stock levels are the default: Full, Half, Low, Out. Exact quantities are optional.
- Inventory is grouped by category, with search, category/location filters and sorting. Categories are editable and custom categories are supported.
- Out-of-stock foods remain visible and are easy to restock.
- Stock check-ins set the remaining quantity or level. Only an explicit edit updates the batch's checked timestamp.
- Optional package dates, separate exact-quantity batches and pantry/fridge/freezer locations.
- Visible low-stock and use-soon summaries. There are no usage forecasts or external notifications.
- A secondary shopping list requires explicit acceptance. Restocking a listed food updates stock and completes that item in one save.
- **Restock several** lets you select purchased foods, adjust every level/amount and location, then confirm them together. Unselected foods are untouched. Rough levels require an explicit choice.
- Foods can be removed from the pantry after a confirmation step. Removing one also clears its batches, activity history, and linked shopping entries while preserving other foods.
- Local demo data is durable within this browser and clearly labeled. Export downloads JSON.
- Firebase project `pantry-organizer-fec7c` is configured on Spark with Email/Password Auth, a production-mode Firestore database in nam5, and published two-member household rules. Two Auth users and the `households/our-pantry` membership record are configured. Local development reads the ignored `config.js`; production hosting builds it from public `PANTRY_FIREBASE_*` environment values. See [SETUP.md](SETUP.md) for deployment setup.

## Modern Stack & Tooling

- **TypeScript**: TypeScript 7 (`typescript@7.0.2`) with strict typing, `tsconfig.json`, and typed domain schemas/models.
- **UI**: Modern React (`react@19.3.0`, `react-dom@19.3.0`) with accessible components, keyboard navigation, and native dialog modals.
- **Effect**: Powered by `effect@3.22.2`:
  - Runtime validation and schema decoding via `Schema` (`PantryRecordSchema`, `ProductSchema`, `BatchSchema`, etc.).
  - Functional error handling with `Data.TaggedError` (`DomainValidationError`, `StorageError`, etc.).
  - Option and functional pipelines with `Option` and `pipe`.
  - Transactional mutation pipelines and service tags (`Context.GenericTag`).
- **Linting & Formatting**: Powered by **oxlint** (high-speed linting with React and JSX a11y rules) and **oxfmt** (formatting).
- **Runtime & Bundler**: Powered by Bun (`v1.4.2`):
  - Native zero-copy HTTP server (`Bun.serve`) in `server.mjs` with Node fallback.
  - Project configuration via `bunfig.toml`.
  - Native TypeScript test suite in `tests/domain.bun.test.ts` via `bun:test`.
  - Fast native browser bundling via `bun build`.

## Run

You can run with Bun or Node:

```sh
# Start development server
bun start
# or: npm start
```

Open http://localhost:4173. Choose **Try sample pantry** or **Add food**. The server binds only to this computer.

To run checks and tests:

```sh
# Typecheck & syntax checks
bun run check
# or: npm run check

# Domain unit tests
bun test
# or: npm test

# End-to-end UI assertions (requires installed Microsoft Edge or Chromium):
bun run test:ui
# or: node tests/ui.mjs
```

## Shared data and access

The local browser demo and Firebase pantry are separate. Connect signs in with an Email/Password user already added in Firebase Authentication. Firebase Auth restores its browser-local session. The Firestore document is revisioned; writes use transactions and reject stale edits. Published rules restrict reads and writes to exactly the two provisioned member UIDs; clients cannot change membership or delete the inventory document. Firebase web configuration is public app configuration, but `config.js` is ignored by Git. Never place a service-account key or password in the client.
