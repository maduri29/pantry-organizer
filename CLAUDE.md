# CLAUDE.md - Pantry Organizer Guide

This document provides architecture context, coding rules, and development commands for Claude working with this repository.

## Commands

### Development & Preview

- `bun run dev` - Launch local preview server at `http://localhost:4173`
- `bun run search <pattern>` - Search codebase with `tgrep` (trigram-indexed)
- `bun run build` - Bundle and assemble production static assets in `public/` (runs in ~60ms)

### Testing & Verification

- `bun run check` - Comprehensive check: `oxlint` + `oxfmt --check` + `tsc --noEmit` + node syntax checks
- `bun run test` - Run unit tests (`node --test` + `bun test`)
- `bun test tests/domain.bun.test.ts` - Run native TypeScript Bun Effect suite
- `bun run test:ui` - Run full 27-assertion Playwright Edge E2E test suite (requires `msedge` channel)
- `bun run ci` - Run `bun run check && bun run test`

### Code Quality

- `bun run format` - Format files using `oxfmt` (~100ms)
- `bun run lint` - Lint files using `oxlint` (~15ms)
- `bun run typecheck` - Run TypeScript 7 typecheck (`tsc --noEmit`)

## Architecture & Code Structure

```
├── src/
│   ├── main.tsx             # React 19 entry point with ErrorBoundary & SW registration
│   ├── App.tsx              # Main state machine, repository mutation, global shortcuts (/)
│   ├── domain.ts            # Pure inventory domain logic (Effect Option, tagged errors, calculations)
│   ├── storage.ts           # LocalDemoRepository with localStorage & navigator.locks concurrency
│   ├── firebase.ts          # Shared pantry Firestore repository with transaction safety
│   ├── types.ts             # Effect Schema validators (ProductSchema, PantryStateSchema, etc.)
│   └── components/
│       ├── Header.tsx       # Brand, export JSON, import backup, and profile menu
│       ├── Hero.tsx         # Hero banner with "Add food" and "Restock several"
│       ├── Stats.tsx        # Summary counters (all, soon, low)
│       ├── Nav.tsx          # View tabs (Inventory, Shopping list, History)
│       ├── InventoryView.tsx# Memoized O(P) product cards with toolbar filter/sort
│       ├── ShoppingView.tsx # O(1) shopping list & low-stock suggestions
│       ├── HistoryView.tsx  # Activity log with 100 recent movements
│       ├── DialogModal.tsx  # Dynamic modal for add, use, restock, bulk, delete, connect
│       ├── ErrorBoundary.tsx# React 19 crash prevention and recovery card
│       └── Toast.tsx        # Ephemeral notification banner
├── tests/
│   ├── domain.test.mjs      # Node.js + Bun test suite for domain mutations
│   ├── domain.bun.test.ts   # Native TypeScript Bun test suite with Effect assertions
│   └── ui.mjs               # Playwright Edge browser E2E test suite (27 assertions)
├── build.mjs                # Parallel Bun.build script + static hosting preparation
├── server.mjs               # Dual HTTP server (native Bun.serve with zero-copy stream, node fallback)
├── vercel.json              # Vercel deployment config with HTTP edge caching headers
└── sw.js                    # Offline PWA service worker with stale-while-revalidate caching
```

## Critical Invariants & Rules

1. **Test Compatibility**:
   - Never remove or alter existing DOM IDs: `#search`, `#location`, `#category`, `#sort`, `#profile-button`, `#profile-menu`, `#editor`, `#toast`.
   - Never change button accessible names or ARIA labels verified by `tests/ui.mjs`.
2. **Tooling Stack**:
   - Use `bun` as runtime and package manager.
   - Use `oxlint` and `oxfmt`. Never install Prettier or ESLint.
   - Use `tgrep` for fast code search.
3. **Effect Integration**:
   - Use `effect` for tagged domain errors (`Data.TaggedError`), runtime validation (`Schema`), and functional options (`Option`).
   - Throw typed tagged errors or decode with `Schema.decodeUnknownEither`.
4. **Performance**:
   - Keep `InventoryView` memoization single-pass: precompute batch maps and stats in `useMemo` so filtering/sorting remains $O(P)$ without repeated batch lookups.
   - CSS: preserve `contain: content` on `.card` and 44px touch targets.
