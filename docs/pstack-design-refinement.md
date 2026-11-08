# pstack design refinement

Official [Cursor pstack](https://github.com/cursor/plugins/tree/main/pstack) is installed for Codex in `.agents/skills`. `skills-lock.json` records all 58 installed skills. The project copy includes the upstream MIT license. No global model configuration changed.

## Principles used

- Experience First kept the compact system font, 14px fields, right-side quantity/location, priority stock markers, and profile backup menu.
- Fix Root Causes traced inconsistent spacing to conflicting breakpoint rules and disclosure treatments.
- Subtract Before You Add removed 82 unused CSS rules and 95 obsolete selector references.
- Prove It Works required real browser comparisons and a reproducible layout test.

## Changes

Editor headings, fields, and footers share a single gutter value: 16px up to 600px, then 20px. At 560px, the previous details form and footer used 24px while the header used 16px.

Package, batch, optional-location/date, and Add food disclosures use a trailing chevron. Phone cards explicitly use automatic row placement rather than inheriting a desktop row span.

Copied third-party skill files are excluded from the project's format/lint tools so their source and installed hashes stay intact.

## Evidence

The source-only removal was checked against 45 baseline screenshots. All 45 PNG files were byte-identical after the removal, before applying visual refinements.

The final design was captured in 54 views covering inventory, profile, stock, details, packages, package fields, purchase, shopping, and Add food at 320, 390, 430, 560, 768, and 1440px. No page overflow was measured. Details heading, body, and footer gutters matched at every width.

`tests/design-layout.mjs` checks gutters, chevrons, phone card placement and overflow at all six widths. Running it against the original stylesheet fails at 560px with actual gutters `[16, 16, 24, 24]` instead of `[16, 16, 16, 16]`. The final stylesheet passes. The check is included in `bun run test:ui` and can also be run with `bun run test:design`.

The existing browser suite, `bun run ci`, and the native domain tests remain the required release checks.
