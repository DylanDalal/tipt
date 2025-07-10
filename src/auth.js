// src/auth.js
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

export function signUpWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}
