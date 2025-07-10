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

const useEmulator = ['localhost', '127.0.0.1'].includes(
  window?.location?.hostname,
);

const firebaseConfig = {
  apiKey:             useEmulator ? 'fake-api-key' : import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:         useEmulator ? 'localhost'     : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:          useEmulator ? 'demo-project'  : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:      useEmulator ? 'demo-project.appspot.com' : import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:  import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:              import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

if (useEmulator) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
}

setPersistence(auth, indexedDBLocalPersistence).catch(() => {});
