import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import {
  getStorage,
  connectStorageEmulator,
} from 'firebase/storage';

const onLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname);

/* helpers */
const env = import.meta.env;
const missing = key => env[key] === undefined || env[key] === '';

/* decide per-field, not all-or-nothing */
const useEmulator =
  onLocalhost &&
  ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID'].some(missing);

const firebaseConfig = {
  apiKey:            useEmulator ? 'fake-api-key'            : env.VITE_FIREBASE_API_KEY,
  authDomain:        useEmulator ? 'localhost'               : env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         useEmulator ? 'demo-project'            : env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     useEmulator ? 'demo-project.appspot.com': env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, // optional for emu
  appId:             env.VITE_FIREBASE_APP_ID,               // optional for emu
};

const app      = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

if (useEmulator) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
}

setPersistence(auth, indexedDBLocalPersistence).catch(() => {});
