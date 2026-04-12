// ============================================================
// SUPER RESERVATION PLATFORM — Firebase Client SDK
// Used for Phone Auth (OTP via Firebase) on the dashboard.
// ============================================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCaLBxtGkZGp62n2y9Jb67lmqA-yDirEPA',
  authDomain: 'hagez-9552a.firebaseapp.com',
  projectId: 'hagez-9552a',
  storageBucket: 'hagez-9552a.firebasestorage.app',
  messagingSenderId: '323829556168',
  appId: '1:323829556168:web:4ae978d0f9adb5ebbcd6fd',
  measurementId: 'G-XWHLXVLP25',
};

// Avoid re-initialising during Next.js hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const firebaseAuth = getAuth(app);
