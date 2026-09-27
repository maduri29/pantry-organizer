# Firebase setup status

Project `pantry-organizer-fec7c` is on the Spark plan. The registered web app, Email/Password Auth, and Standard Cloud Firestore are configured. Firestore is in production mode in `nam5` (United States multi-region). `config.js` matches this project and the `our-pantry` household; Git ignores that local file.

Two Email/Password Auth users exist. The `households/our-pantry` document has their two distinct UIDs in `memberUids`. Published rules require exactly two distinct members, allow members to read the household and inventory, allow revision-checked inventory writes, and deny client changes to membership and deletion. Other paths are unmatched and denied.

## Verification performed

- The local app restored an existing Firebase Auth session and loaded the shared pantry from Firestore.
- An app write succeeded. A second open app tab, signed into the same browser-persisted Auth session, received the update live.
- The user signed into the app with the second Auth account. The owner-email Auth account is also an authorized household member, as explicitly approved by the user.
- Firebase Rules Playground simulated an authenticated read of `households/our-pantry/inventory/current` for each of the two member UIDs; both simulations allowed the read.
- Per-food deletion is implemented with confirmation. It removes that food's batches, activity history, and linked shopping entries in a revision-checked Firestore save.
- The temporary sync-check food was deleted through the app with the user's approval. Firestore Console shows `revision: 4` and empty `products`, `batches`, `movements`, and `shopping` arrays. The signed-in app tabs show an empty pantry.
- `npm test` passed 11/11 tests, `npm run check` passed, and the headless Edge UI suite passed 20 assertions. Firebase Emulator Suite tests were unavailable because the Firebase CLI and Java are not installed.

## Remaining verification

True cross-device sync has not been tested. Keep the project on Spark. No hosting deployment or billing upgrade has been made. Git commit/push status is recorded in the implementation checkpoint.

Local demo data stays separate from the cloud pantry and is never uploaded automatically. Never put a service-account key or user password in the app or repository.
