// src/auth.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { auth } from "./firebase";

export function signUpWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOut() {
  return fbSignOut(auth);
}
