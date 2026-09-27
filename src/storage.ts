import { Data, Effect, Schema } from 'effect';
import { empty } from './domain.ts';
import {
  PantryRecordSchema,
  type PantryRecord,
  type PantryRepository,
  type PantryState
} from './types.ts';

export const KEY = 'pantry-organizer.demo.v1';

export class StorageError extends Data.TaggedError('StorageError')<{
  readonly message: string;
}> {}

export class StaleRevisionError extends Data.TaggedError('StaleRevisionError')<{
  readonly message: string;
}> {}

export class LocalDemoRepository implements PantryRepository {
  loadEffect(): Effect.Effect<PantryRecord, StorageError> {
    return Effect.try({
      try: () => {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { state: empty(), revision: 0 };
        const data = JSON.parse(raw);
        const decoded = Schema.decodeUnknownEither(PantryRecordSchema)(data);
        if (decoded._tag === 'Left') {
          throw new Error('Saved demo could not be read. Export browser data before resetting.');
        }
        return decoded.right as PantryRecord;
      },
      catch: (e) => new StorageError({ message: (e as Error).message })
    });
  }

  saveEffect(
    state: PantryState,
    revision: number
  ): Effect.Effect<PantryRecord, StorageError | StaleRevisionError> {
    return Effect.gen(this, function* () {
      const commit = async (): Promise<PantryRecord> => {
        const current = await this.load();
        if (current.revision !== revision) {
          throw new Error(
            'Inventory changed in another tab. Close this form and refresh before trying again.'
          );
        }
        const next: PantryRecord = { state, revision: revision + 1 };
        localStorage.setItem(KEY, JSON.stringify(next));
        return next;
      };

      const result = yield* Effect.tryPromise({
        try: () =>
          globalThis.navigator?.locks
            ? (navigator.locks.request(KEY, commit) as Promise<PantryRecord>)
            : commit(),
        catch: (e) => {
          const err = e as Error;
          if (err.message?.includes('another tab')) {
            return new StaleRevisionError({ message: err.message });
          }
          return new StorageError({ message: err.message });
        }
      });
      return result;
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
}
