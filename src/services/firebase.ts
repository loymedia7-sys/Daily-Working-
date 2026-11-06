import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const BOOTSTRAPPED_ADMIN_EMAIL = 'loymedia7@gmail.com';

// Validate connection to Firestore on boot as required by firebase-integration skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

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
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validation constants synchronized verbatim with firebase-blueprint.json and firestore.rules
export const BLUEPRINT_LIMITS = {
  ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  MAX_ID_LEN: 128,
  MAX_NAME_LEN: 100,
  MAX_EMAIL_LEN: 150,
  MAX_PHOTO_URL_LEN: 1000,
  MAX_POSITION_LEN: 100,
  MAX_DEPARTMENT_LEN: 100,
  MAX_COMPANY_LEN: 120,
  MAX_TITLE_LEN: 200,
  MAX_CATEGORY_LEN: 80,
  MAX_DESC_LEN: 2000,
  MAX_RESULT_LEN: 1000,
  MAX_TIME_LEN: 40,
  MAX_DATE_LEN: 20,
  MAX_COMMENT_LEN: 1000,
  MAX_PHOTOS_COUNT: 5,
  MAX_PHOTO_DATA_LEN: 340000,
};

export function sanitizeString(val: string, maxLen: number, fallback = ''): string {
  const trimmed = (val ?? '').trim();
  if (!trimmed && fallback) return fallback.slice(0, maxLen);
  return trimmed.slice(0, maxLen);
}
