# GitHub Copilot Instructions for Pantry Organizer

You are assisting with development on the **Pantry Organizer** codebase—a calm, resilient kitchen inventory and shared shopping list application.

## Tech Stack & Architecture

- **Language**: TypeScript 7.0+ (`typescript@7.0.2`), targeting modern browser ECMAScript modules.
- **Runtime & Package Manager**: Bun 1.4+ (`bun`). Use Bun for executing scripts, tests, and parallel bundling.
- **Frontend Framework**: React 19 (`react@19.3.0`, `react-dom@19.3.0`) with standard hooks (`useMemo`, `useCallback`, `useRef`, `useState`).
- **Functional & Validation Library**: Effect 3.22+ (`effect`). Extensively used for:
  - Runtime Schema validation (`Schema.Struct`, `Schema.decodeUnknownEither` in `src/types.ts`).
  - Typed tagged error models (`Data.TaggedError('DomainValidationError')`, `DomainNotFoundError`, `DomainConflictError`).
  - Functional pipelines and nullable computations (`Option`, `pipe`).
  - Repository tags and dependency injection (`PantryRepositoryTag = Context.GenericTag<PantryRepository>`).
- **Code Hygiene**:
  - Linter: `oxlint` (10x faster Rust-based linter, configured in `.oxlintrc.json`).
  - Formatter: `oxfmt` (ultra-fast Rust formatter, configured in `.oxfmtrc.json`).
  - **Do NOT introduce ESLint or Prettier**—the project relies exclusively on `oxlint` and `oxfmt`.
- **Code Search**: Microsoft `tgrep` (`tgrep` or `bun run search <pattern>`).

## Non-Negotiables & Strict Invariants

1. **Never Break End-to-End Playwright Tests (`tests/ui.mjs`)**:
   - The test suite asserts 27 exact UI interactions, keyboard events, viewport sizes (390px mobile, 1280px desktop), and network mocks.
   - **Crucial DOM Identifiers**: Do NOT rename or remove IDs `#search`, `#location`, `#category`, `#sort`, `#profile-button`, `#profile-menu`, `#editor`, `#toast`.
   - **Accessible Roles & Names**: Keep exact aria-labels and button text (`Export pantry data`, `Profile`, `Try sample pantry`, `Restock [Food]`, `Edit settings for [Food]`, `Delete [Food]`, `Add [Food] to shopping list`).
   - **SVG Elements**: Action buttons must maintain `svg` icons with `aria-hidden="true"` and minimum 44px touch targets.
2. **Multi-Tab Storage Concurrency**:
   - `PantryRecord = { state: PantryState, revision: number }`.
   - Every save must increment `revision` by 1 and reject stale saves if another tab modified the record (`StaleRevisionError` / `DomainConflictError`).
   - Uses `navigator.locks` when available to prevent race conditions.
3. **Domain vs. UI Separation**:
   - Core inventory mathematics (rough levels, batch tracking, expiry countdown, deduplicated shopping acceptance) must reside in `src/domain.ts`.
   - Do not duplicate domain logic inside React components.

## Development & Verification Commands

- `bun run dev`: Start preview server on `http://localhost:4173`.
- `bun run search <term>`: Fast regex search with `tgrep`.
- `bun run format`: Format all files with `oxfmt`.
- `bun run lint`: Lint codebase with `oxlint`.
- `bun run check`: Full typecheck (`tsc --noEmit`), lint, format check, and node syntax checks.
- `bun run test`: Run unit tests via Node.js and Bun test runners.
- `bun test tests/domain.bun.test.ts`: Run native TypeScript Effect tests.
- `bun run test:ui`: Run full Playwright Edge UI test suite.
- `bun run ci`: Run comprehensive check + unit tests.
- `bun run build`: Execute parallel `Bun.build` bundler + static file generator for Vercel.
