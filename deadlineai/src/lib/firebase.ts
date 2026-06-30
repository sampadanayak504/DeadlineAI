import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, Auth, UserCredential, signInAnonymously } from 'firebase/auth';
import { getFirestore, Firestore, collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { Task, UserProfile, Reminder, CalendarEvent } from '../types';
import appletConfig from '../../firebase-applet-config.json';

// In AI Studio, the firebase config can be loaded from standard env or a placeholder client setup
const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || appletConfig?.apiKey || "",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || appletConfig?.authDomain || "",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || appletConfig?.projectId || "",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || appletConfig?.storageBucket || "",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig?.messagingSenderId || "",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || appletConfig?.appId || ""
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function isFirebaseConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
  );
}

// Lazy initialization to completely avoid startup crashes or blocking if keys are absent
export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not fully configured. Please provide Firebase configurations in settings.");
  }
  if (!app) {
    if (getApps().length > 0) {
      app = getApp();
    } else {
      app = initializeApp(firebaseConfig);
    }
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  const firebaseApp = getFirebaseApp();
  if (!auth) {
    auth = getAuth(firebaseApp);
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  const firebaseApp = getFirebaseApp();
  if (!db) {
    const dbId = (import.meta as any).env?.VITE_FIREBASE_DATABASE_ID || (appletConfig as any)?.firestoreDatabaseId;
    if (dbId) {
      db = getFirestore(firebaseApp, dbId);
    } else {
      db = getFirestore(firebaseApp);
    }
  }
  return db;
}

// Memory cache for Google OAuth access token
let cachedAccessToken: string | null = null;

export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

export function setGoogleAccessToken(token: string | null): void {
  cachedAccessToken = token;
}

// Google Sign In integration with real Firebase Authentication only (no anonymous fallback)
export async function signInWithGoogle(): Promise<UserCredential | null> {
  if (!isFirebaseConfigured()) {
    const err = new Error("Google Sign-In is temporarily unavailable.");
    (err as any).code = 'auth/unavailable';
    throw err;
  }
  
  let firebaseAuth;
  try {
    firebaseAuth = getFirebaseAuth();
  } catch (initErr) {
    const err = new Error("Google Sign-In is temporarily unavailable.");
    (err as any).code = 'auth/unavailable';
    throw err;
  }

  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/calendar');

  try {
    const result = await signInWithPopup(firebaseAuth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    return result;
  } catch (error: any) {
    console.error("Firebase Google Auth error:", error);
    
    const code = error?.code || '';
    const message = error?.message || '';

    let friendlyError = new Error("Something went wrong. Please try again.");
    (friendlyError as any).code = code;

    if (
      code === 'auth/unauthorized-domain' || 
      code === 'auth/admin-restricted-operation' || 
      code === 'auth/operation-not-allowed' || 
      message.includes('unauthorized-domain') ||
      message.includes('admin-restricted-operation')
    ) {
      friendlyError.message = "Google Sign-In is temporarily unavailable.";
    } else if (
      code === 'auth/popup-blocked' || 
      code === 'auth/cancelled-popup-request' || 
      code === 'auth/popup-closed-by-user' ||
      message.includes('popup-blocked') ||
      message.includes('popup-closed')
    ) {
      friendlyError.message = "Sign in was cancelled.";
    } else if (
      code === 'auth/network-request-failed' || 
      message.includes('network') ||
      message.includes('fetch')
    ) {
      friendlyError.message = "Unable to connect. Check your internet connection.";
    } else if (
      code === 'auth/permission-denied' || 
      message.includes('permission')
    ) {
      friendlyError.message = "You don't have permission to access this data.";
    }

    throw friendlyError;
  }
}

// Absolute strict error handler required by system skills schema
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null): never {
  const firebaseAuth = isFirebaseConfigured() ? getFirebaseAuth() : null;
  const currentUser = firebaseAuth?.currentUser;
  
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid || null,
      email: currentUser?.email || null,
      emailVerified: currentUser?.emailVerified || null,
      isAnonymous: currentUser?.isAnonymous || null,
      tenantId: currentUser?.tenantId || null,
      providerInfo: currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Task storage CRUD operations
export async function saveTaskToFirestore(userId: string, task: Task): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const targetPath = `users/${userId}/tasks/${task.id}`;
  try {
    const firestoreDb = getFirebaseDb();
    
    // Sanitize any optional fields to prevent undefined error crashes in firestore client
    const sanitizedTask = JSON.parse(JSON.stringify(task));
    
    await setDoc(doc(firestoreDb, 'users', userId, 'tasks', task.id), sanitizedTask);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, targetPath);
  }
}

export async function deleteTaskFromFirestore(userId: string, taskId: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const targetPath = `users/${userId}/tasks/${taskId}`;
  try {
    const firestoreDb = getFirebaseDb();
    await deleteDoc(doc(firestoreDb, 'users', userId, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, targetPath);
  }
}

export async function loadTasksFromFirestore(userId: string): Promise<Task[]> {
  if (!isFirebaseConfigured()) return [];
  const targetPath = `users/${userId}/tasks`;
  try {
    const firestoreDb = getFirebaseDb();
    const querySnapshot = await getDocs(collection(firestoreDb, 'users', userId, 'tasks'));
    const loadedTasks: Task[] = [];
    querySnapshot.forEach((docSnap) => {
      loadedTasks.push(docSnap.data() as Task);
    });
    return loadedTasks;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, targetPath);
  }
}

export async function saveProfileToFirestore(userId: string, profile: UserProfile): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const targetPath = `users/${userId}`;
  try {
    const firestoreDb = getFirebaseDb();
    const sanitizedProfile = JSON.parse(JSON.stringify(profile));
    await setDoc(doc(firestoreDb, 'users', userId), sanitizedProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, targetPath);
  }
}

export async function saveReminderToFirestore(userId: string, reminder: Reminder): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const targetPath = `users/${userId}/reminders/${reminder.id}`;
  try {
    const firestoreDb = getFirebaseDb();
    const sanitizedReminder = JSON.parse(JSON.stringify(reminder));
    await setDoc(doc(firestoreDb, 'users', userId, 'reminders', reminder.id), sanitizedReminder);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, targetPath);
  }
}

export async function deleteReminderFromFirestore(userId: string, reminderId: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const targetPath = `users/${userId}/reminders/${reminderId}`;
  try {
    const firestoreDb = getFirebaseDb();
    await deleteDoc(doc(firestoreDb, 'users', userId, 'reminders', reminderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, targetPath);
  }
}

export async function loadRemindersFromFirestore(userId: string): Promise<Reminder[]> {
  if (!isFirebaseConfigured()) return [];
  const targetPath = `users/${userId}/reminders`;
  try {
    const firestoreDb = getFirebaseDb();
    const querySnapshot = await getDocs(collection(firestoreDb, 'users', userId, 'reminders'));
    const loadedReminders: Reminder[] = [];
    querySnapshot.forEach((docSnap) => {
      loadedReminders.push(docSnap.data() as Reminder);
    });
    return loadedReminders;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, targetPath);
  }
}

export function subscribeTasksFromFirestore(
  userId: string,
  callback: (tasks: Task[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!isFirebaseConfigured()) return () => {};
  const targetPath = `users/${userId}/tasks`;
  try {
    const firestoreDb = getFirebaseDb();
    const q = query(collection(firestoreDb, 'users', userId, 'tasks'));
    return onSnapshot(q, (snapshot) => {
      const loadedTasks: Task[] = [];
      snapshot.forEach((docSnap) => {
        loadedTasks.push(docSnap.data() as Task);
      });
      callback(loadedTasks);
    }, (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, targetPath);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, targetPath);
  }
}

export function subscribeRemindersFromFirestore(
  userId: string,
  callback: (reminders: Reminder[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!isFirebaseConfigured()) return () => {};
  const targetPath = `users/${userId}/reminders`;
  try {
    const firestoreDb = getFirebaseDb();
    const q = query(collection(firestoreDb, 'users', userId, 'reminders'));
    return onSnapshot(q, (snapshot) => {
      const loadedReminders: Reminder[] = [];
      snapshot.forEach((docSnap) => {
        loadedReminders.push(docSnap.data() as Reminder);
      });
      callback(loadedReminders);
    }, (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, targetPath);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, targetPath);
  }
}

export async function saveEventToFirestore(userId: string, event: CalendarEvent): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const targetPath = `users/${userId}/events/${event.id}`;
  try {
    const firestoreDb = getFirebaseDb();
    const sanitizedEvent = JSON.parse(JSON.stringify(event));
    await setDoc(doc(firestoreDb, 'users', userId, 'events', event.id), sanitizedEvent);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, targetPath);
  }
}

export async function deleteEventFromFirestore(userId: string, eventId: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const targetPath = `users/${userId}/events/${eventId}`;
  try {
    const firestoreDb = getFirebaseDb();
    await deleteDoc(doc(firestoreDb, 'users', userId, 'events', eventId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, targetPath);
  }
}

export function subscribeEventsFromFirestore(
  userId: string,
  callback: (events: CalendarEvent[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!isFirebaseConfigured()) return () => {};
  const targetPath = `users/${userId}/events`;
  try {
    const firestoreDb = getFirebaseDb();
    const q = query(collection(firestoreDb, 'users', userId, 'events'));
    return onSnapshot(q, (snapshot) => {
      const loadedEvents: CalendarEvent[] = [];
      snapshot.forEach((docSnap) => {
        loadedEvents.push(docSnap.data() as CalendarEvent);
      });
      callback(loadedEvents);
    }, (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, targetPath);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, targetPath);
  }
}

