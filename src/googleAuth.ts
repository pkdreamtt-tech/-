import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User } from 'firebase/auth';
import config from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(config) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.setCustomParameters({
  prompt: 'consent',
});

let cachedAccessToken: string | null = null;

export async function signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('ไม่พบ Access Token จากการเข้าสู่ระบบ Google');
    }
    cachedAccessToken = credential.accessToken;
    sessionStorage.setItem('google_access_token', credential.accessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sign In Error:', error);
    throw error;
  }
}

export function getCachedToken(): string | null {
  if (cachedAccessToken) return cachedAccessToken;
  return sessionStorage.getItem('google_access_token');
}

export async function signOutGoogle(): Promise<void> {
  await fbSignOut(auth);
  cachedAccessToken = null;
  sessionStorage.removeItem('google_access_token');
}

export function subscribeAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
