# AGENTS.md - Agent Operating Manual for Pantry Organizer

This file guides autonomous agents, including OpenAI Codex, Antigravity, Cursor, and automated bots, on navigating, modifying, and verifying the Pantry Organizer repository.

---

## 1. Project Overview & Tech Stack

Pantry Organizer is a calm, resilient, offline-capable kitchen inventory and shared shopping list application.

- **Frontend**: React 19 (`react`, `react-dom`) with pure functional components and typed hooks.
- **Language**: TypeScript 7 (`typescript@7.0.2`), targeting ES modules.
- **Runtime & Bundler**: Bun (`bun`). Parallel multi-target bundler in `build.mjs`.
- **Functional Paradigm**: Effect (`effect` v3.22+). Used for tagged errors (`Data.TaggedError`), schema decoding (`Schema.Struct`), and functional composition (`pipe`, `Option`).
- **Linter & Formatter**: `oxlint` and `oxfmt` (high-performance Rust-based toolchain).
- **Search Tooling**: Microsoft `tgrep` (`bun run search <term>`).
- **Hosting**: Vercel Static Hosting (`outputDirectory: "public"`) with HTTP Edge caching headers.

---

## 2. Directory Structure & Key Files

| Path                       | Purpose                                                                                                                                               |
| :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain.ts`            | Pure inventory mathematics (batching, rough levels, expiry dates, atomic bulk restock, validation).                                                   |
| `src/types.ts`             | Effect Schemas (`PantryRecordSchema`, `ProductSchema`, `BatchSchema`, `MovementSchema`, `ShoppingItemSchema`).                                        |
| `src/storage.ts`           | `LocalDemoRepository` with `localStorage` serialization and `navigator.locks` concurrency.                                                            |
| `src/firebase.ts`          | `FirebaseRepository` for shared household pantries using Firestore transactions and real-time snapshots.                                              |
| `src/App.tsx`              | Main application shell, state management, modal state machine, keyboard shortcuts (`/`), and import/export.                                           |
| `src/components/`          | Modular React components (`Header`, `Hero`, `Stats`, `Nav`, `InventoryView`, `ShoppingView`, `HistoryView`, `DialogModal`, `ErrorBoundary`, `Toast`). |
| `build.mjs`                | Parallel in-memory bundler (`Bun.build`) and static site assembler for `public/`.                                                                     |
| `server.mjs`               | Dual HTTP server: zero-copy `Bun.serve` streaming with fallback to `node:http`.                                                                       |
| `tests/domain.test.mjs`    | Node.js & Bun unit tests for domain business logic.                                                                                                   |
| `tests/domain.bun.test.ts` | Native TypeScript Effect unit test suite.                                                                                                             |
| `tests/ui.mjs`             | 27-assertion Playwright Edge browser E2E test suite.                                                                                                  |
| `vercel.json`              | Vercel deployment configuration, security headers, and asset cache rules.                                                                             |
| `sw.js`                    | Progressive Web App Service Worker with Stale-While-Revalidate caching.                                                                               |

---

## 3. Essential Agent Commands

Always use `bun` to execute commands:

```bash
# 1. Search codebase
bun run search <pattern>

# 2. Check code quality (types, lint, formatting)
bun run check

# 3. Format code
bun run format

# 4. Run unit tests
bun run test

# 5. Run native TypeScript Effect tests
bun test tests/domain.bun.test.ts

# 6. Run full Playwright UI test suite
bun run test:ui

# 7. Comprehensive verification
bun run ci

# 8. Build production bundles
bun run build
```

---

## 4. Invariants & Rules for AI Agents

1. **Test Guardrails**:
   - Every commit must pass `bun run ci` and `bun run test:ui`.
   - Never remove or alter critical HTML IDs: `#search`, `#location`, `#category`, `#sort`, `#profile-button`, `#profile-menu`, `#editor`, `#toast`.
   - Never change ARIA attributes or button labels that are asserted in `tests/ui.mjs`.
2. **Data Consistency**:
   - The state contract is `PantryRecord = { state: PantryState, revision: number }`.
   - Every mutation must increment `revision` and guard against concurrent multi-tab edits via `StaleRevisionError` / `DomainConflictError`.
3. **No ESLint / Prettier**:
   - The repository uses `oxlint` and `oxfmt` exclusively. Do not add `.eslintrc` or `.prettierrc`.
4. **Bundle Performance**:
   - `src/main.tsx` must be bundled with `--minify` and `'process.env.NODE_ENV': '"production"'` so bundle size remains ~410 KB (~127 KB gzipped).
   - In `build.mjs`, externalize `*/firebase.js` so Playwright route mocks in `tests/ui.mjs` continue to function.

---

## 5. Agent Verification Checklist

Before finishing any task or proposing changes:

- [ ] `bun run format` has formatted all modified files.
- [ ] `bun run check` reports 0 warnings and 0 errors.
- [ ] `bun run test` passes 11/11 tests.
- [ ] `bun test tests/domain.bun.test.ts` passes 6/6 tests.
- [ ] `bun run test:ui` passes all 27 assertions.
- [ ] `bun run build` generates `src/app.js` and `public/` in <100ms.
