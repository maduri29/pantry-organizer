// @ts-ignore
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  browserLocalPersistence,
  setPersistence,
  onAuthStateChanged
  // @ts-ignore
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDocFromServer,
  runTransaction,
  onSnapshot
  // @ts-ignore
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { Data, Effect, Schema } from 'effect';
import { empty } from './domain.ts';
import {
  PantryRecordSchema,
  type PantryConfig,
  type PantryRecord,
  type PantryRepository,
  type PantryState
} from './types.ts';

export class FirebaseError extends Data.TaggedError('FirebaseError')<{
  readonly message: string;
  readonly code?: string;
}> {}

export class FirebaseConflictError extends Data.TaggedError('FirebaseConflictError')<{
  readonly message: string;
}> {}

export class FirebaseRepository implements PantryRepository {
  auth: any;
  db: any;
  ref: any;

  static async resume(config: PantryConfig): Promise<FirebaseRepository | null> {
    if (!config?.firebase?.apiKey) return null;
    const app = getApps()[0] || initializeApp(config.firebase);
    const auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);
    const user = await new Promise((resolve, reject) => {
      const stop = onAuthStateChanged(
        auth,
        (value: any) => {
          stop();
          resolve(value);
        },
        (error: any) => {
          stop();
          reject(error);
        }
      );
    });
    return user ? this.create(config, auth) : null;
  }

  static async connect(
    config: PantryConfig,
    credentials: { email: string; password: string }
  ): Promise<FirebaseRepository> {
    const app = getApps()[0] || initializeApp(config.firebase);
    const auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
    return this.create(config, auth);
  }

  static create(config: PantryConfig, auth: any): FirebaseRepository {
    const repository = new FirebaseRepository();
    repository.auth = auth;
    repository.db = getFirestore(auth.app);
    repository.ref = doc(
      repository.db,
      'households',
      config.householdId || 'our-pantry',
      'inventory',
      'current'
    );
    return repository;
  }

  loadEffect(): Effect.Effect<PantryRecord, FirebaseError> {
    return Effect.tryPromise({
      try: async () => {
        const snap = await getDocFromServer(this.ref);
        return snap.exists() ? decode(snap.data()) : { state: empty(), revision: 0 };
      },
      catch: (e) => new FirebaseError({ message: (e as Error).message })
    });
  }

  async load(): Promise<PantryRecord> {
    const exit = await Effect.runPromiseExit(this.loadEffect());
    if (exit._tag === 'Failure') {
      const failure = exit.cause;
      if (failure._tag === 'Fail') throw new Error(failure.error.message);
      if (failure._tag === 'Die') throw failure.defect;
      throw new Error(String(failure));
    }
    return exit.value;
  }

  saveEffect(
    state: PantryState,
    revision: number
  ): Effect.Effect<PantryRecord, FirebaseError | FirebaseConflictError> {
    return Effect.gen(this, function* () {
      if (!navigator.onLine) {
        return yield* Effect.fail(
          new FirebaseError({
            message: 'You’re offline. Reconnect before saving your shared pantry.'
          })
        );
      }
      const next: PantryRecord = { state, revision: revision + 1 };
      const size = new TextEncoder().encode(JSON.stringify(next)).byteLength;
      if (size > 700_000) {
        return yield* Effect.fail(
          new FirebaseError({
            message:
              'This pantry has grown too large for its current shared record. Export a backup before the history is reorganized.'
          })
        );
      }

      yield* Effect.tryPromise({
        try: () =>
          runTransaction(this.db, async (tx: any) => {
            const snap = await tx.get(this.ref);
            const current = snap.exists() ? decode(snap.data()).revision : 0;
            if (current !== revision) {
              throw new Error(
                'Your partner changed the pantry. Close this form and refresh before trying again.'
              );
            }
            tx.set(this.ref, next);
          }),
        catch: (error: any) => {
          if (error.message?.includes('Your partner changed')) {
            return new FirebaseConflictError({ message: error.message });
          }
          if (error.code === 'permission-denied') {
            return new FirebaseError({
              message:
                'Firebase denied this pantry change. Check the household member setup and Firestore rules.'
            });
          }
          if (error.code === 'unavailable' || !navigator.onLine) {
            return new FirebaseError({
              message: 'Could not reach Firebase. Check the connection; this change was not saved.'
            });
          }
          return new FirebaseError({ message: error.message || String(error) });
        }
      });

      return next;
    });
  }

  async save(state: PantryState, revision: number): Promise<PantryRecord> {
    const exit = await Effect.runPromiseExit(this.saveEffect(state, revision));
    if (exit._tag === 'Failure') {
      const failure = exit.cause;
      if (failure._tag === 'Fail') throw new Error(failure.error.message);
      if (failure._tag === 'Die') throw failure.defect;
      throw new Error(String(failure));
    }
    return exit.value;
  }

  subscribe(callback: (record: PantryRecord) => void, onError?: (err: unknown) => void) {
    return onSnapshot(
      this.ref,
      { includeMetadataChanges: true },
      (snap: any) => {
        if (snap.exists() && !snap.metadata.hasPendingWrites && !snap.metadata.fromCache) {
          callback(decode(snap.data()));
        }
      },
      onError
    );
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }
}

function decode(record: any): PantryRecord {
  const keys = ['products', 'batches', 'movements', 'shopping'];
  if (
    !Number.isSafeInteger(record?.revision) ||
    record.revision < 1 ||
    keys.some((key) => !Array.isArray(record.state?.[key]))
  ) {
    throw new Error('The shared pantry record has an unsupported format. It was left unchanged.');
  }
  const decoded = Schema.decodeUnknownEither(PantryRecordSchema)(record);
  if (decoded._tag === 'Left') {
    throw new Error('The shared pantry record has an unsupported format. It was left unchanged.');
  }
  return decoded.right as PantryRecord;
}
