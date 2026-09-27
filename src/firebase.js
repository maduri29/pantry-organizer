import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  browserLocalPersistence,
  setPersistence,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDocFromServer,
  runTransaction,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { empty } from './domain.js';
export class FirebaseRepository {
  static async resume(config) {
    const app = getApps()[0] || initializeApp(config.firebase),
      auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);
    const user = await new Promise((resolve, reject) => {
      const stop = onAuthStateChanged(
        auth,
        (value) => {
          stop();
          resolve(value);
        },
        (error) => {
          stop();
          reject(error);
        }
      );
    });
    return user ? this.create(config, auth) : null;
  }
  static async connect(config, credentials) {
    const app = getApps()[0] || initializeApp(config.firebase),
      auth = getAuth(app);
    // Firebase stores a refreshable auth session on this device. The pantry itself
    // still lives in Firestore and is shared with the other household member.
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
    return this.create(config, auth);
  }
  static create(config, auth) {
    const repository = new FirebaseRepository();
    repository.auth = auth;
    repository.db = getFirestore(auth.app);
    repository.ref = doc(repository.db, 'households', config.householdId, 'inventory', 'current');
    return repository;
  }
  async load() {
    const snap = await getDocFromServer(this.ref);
    return snap.exists() ? decode(snap.data()) : { state: empty(), revision: 0 };
  }
  async save(state, revision) {
    if (!navigator.onLine)
      throw Error('You’re offline. Reconnect before saving your shared pantry.');
    const next = { state, revision: revision + 1 };
    const size = new TextEncoder().encode(JSON.stringify(next)).byteLength;
    if (size > 700_000)
      throw Error(
        'This pantry has grown too large for its current shared record. Export a backup before the history is reorganized.'
      );
    try {
      await runTransaction(this.db, async (tx) => {
        const snap = await tx.get(this.ref),
          current = snap.exists() ? decode(snap.data()).revision : 0;
        if (current !== revision)
          throw Error(
            'Your partner changed the pantry. Close this form and refresh before trying again.'
          );
        tx.set(this.ref, next);
      });
    } catch (error) {
      if (error.message?.includes('Your partner changed')) throw error;
      if (error.code === 'permission-denied')
        throw Error(
          'Firebase denied this pantry change. Check the household member setup and Firestore rules.'
        );
      if (error.code === 'unavailable' || !navigator.onLine)
        throw Error('Could not reach Firebase. Check the connection; this change was not saved.');
      throw error;
    }
    return next;
  }
  subscribe(callback, onError) {
    return onSnapshot(
      this.ref,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.exists() && !snap.metadata.hasPendingWrites && !snap.metadata.fromCache)
          callback(decode(snap.data()));
      },
      onError
    );
  }
  async signOut() {
    await signOut(this.auth);
  }
}
function decode(record) {
  const keys = ['products', 'batches', 'movements', 'shopping'];
  if (
    !Number.isSafeInteger(record?.revision) ||
    record.revision < 1 ||
    keys.some((key) => !Array.isArray(record.state?.[key]))
  )
    throw Error('The shared pantry record has an unsupported format. It was left unchanged.');
  return record;
}
