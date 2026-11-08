# Pantry state machines

This inventory describes state owners and the transitions that must stay safe. Persistent records retain their existing schema and revision contract.

| Flow                       | States and events                                                                                   | Invariant                                                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Startup and connection     | Loading → local; resume or connect → shared; failure → local/error                                  | A repository and its displayed record switch together. A pending local save settles before switching; old shared subscriptions cannot update the new session.              |
| Saving and synchronization | Idle → saving → saved or error; local storage events and shared snapshots arrive independently      | One save at a time; edits use the revision they opened with. Defer incoming changes while saving, then show the newest applicable revision. Failed edits keep their draft. |
| Navigation and feedback    | Inventory, shopping or activity; filters, profile menu and toast open/close independently           | Changing navigation or filters does not alter pantry data.                                                                                                                 |
| Food and trip editors      | Closed → add/manage/stock/restock/connect → submitting → closed or error; delete needs confirmation | Validate before committing; keep drafts on failure; do not dismiss during a pantry write.                                                                                  |
| Category suggestions       | Idle → requesting → result, error or cancellation; bulk results → review → apply                    | Ignore cancelled or stale responses; apply only the reviewed revision and selected entries.                                                                                |
| Inventory and shopping     | Exact or approximate stock; add, use, restock, move or delete; shopping open → purchased/removed    | Quantities cannot become negative through domain operations; bulk operations commit together; at most one open shopping entry per product.                                 |
| Offline assets             | Install → activate → serve network/cache/fallback                                                   | An update should preserve a usable offline application.                                                                                                                    |

## Remaining risks

- Local storage cannot provide atomic cross-tab compare-and-swap without Web Locks. Supporting browsers without them safely requires a transactional store and a recoverable migration; see `refactor-audit.md`.
- Historical movements do not store their unit, so a later unit change can make old quantities misleading. A migration must represent unknown historical units instead of guessing.
- Persisted and imported records are structurally decoded but some semantic invariants are not checked. Tightening validation requires a recovery path for existing data.
