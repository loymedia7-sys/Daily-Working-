import React, { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  FileText,
  Globe,
  Home,
  LogOut,
  Moon,
  Plus,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './i18n';
import {
  auth,
  BLUEPRINT_LIMITS,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  sanitizeString,
} from './services/firebase';
import {
  ActivityRecord,
  ActivityStatus,
  AppLanguage,
  DailyReportRecord,
  DepartmentRecord,
  ReportStatus,
  UserProfile,
  UserRole,
} from './types';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AddActivityView } from './components/AddActivityView';
import { DailyReportsView } from './components/DailyReportsView';
import { AdminManagementView, ManagerReviewView } from './components/ManagerAdminView';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { A4PreviewModal } from './components/A4PreviewModal';
import { generateDailyWorkPdf } from './utils/generatePDF';
import { uploadActivityPhoto } from './services/cloudinaryService';

type NavView =
  | 'dashboard'
  | 'add_activity'
  | 'timeline'
  | 'reports'
  | 'manager'
  | 'admin'
  | 'settings';

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generates a clean illustrative work poster image on a canvas for sample activities
 */
function createSampleWorkGraphic(title: string, subtitle: string, accentHex: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 420;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, 640, 420);

  ctx.fillStyle = accentHex;
  ctx.fillRect(36, 36, 568, 12);

  ctx.fillStyle = '#1E293B';
  ctx.fillRect(36, 68, 568, 316);

  ctx.fillStyle = '#93C5FD';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('DAILYWORK PHOTO EVIDENCE', 64, 120);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(title.slice(0, 34), 64, 175);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '18px sans-serif';
  ctx.fillText(subtitle.slice(0, 46), 64, 220);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 3;
  ctx.strokeRect(64, 260, 220, 80);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('VERIFIED WORK OUTPUT', 82, 306);

  return canvas.toDataURL('image/jpeg', 0.82);
}

export default function App() {
  const { t, i18n } = useTranslation();

  // Theme state (Light / Dark mode synced with <html class="dark">)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return typeof window !== 'undefined'
      ? localStorage.getItem('dailywork_theme') === 'dark'
      : false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('dailywork_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('dailywork_theme', 'light');
    }
  }, [darkMode]);

  // Auth & Profile state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Onboarding / Settings form fields
  const [formFullName, setFormFullName] = useState('');
  const [formPosition, setFormPosition] = useState('Graphic Designer');
  const [formDepartment, setFormDepartment] = useState('Marketing');
  const [formManagerId, setFormManagerId] = useState('');
  const [formManagerName, setFormManagerName] = useState('Mr. Dara');
  const [formCompanyName, setFormCompanyName] = useState('DailyWork Cambodia');
  const [savingProfile, setSavingProfile] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);

  // Navigation & Active Date
  const [activeView, setActiveView] = useState<NavView>('dashboard');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayIso());
  const [editingActivity, setEditingActivity] = useState<ActivityRecord | null>(null);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [dashboardPreviewOpen, setDashboardPreviewOpen] = useState(false);

  // Firestore Live Collections
  const [myActivities, setMyActivities] = useState<ActivityRecord[]>([]);
  const [myReports, setMyReports] = useState<DailyReportRecord[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [teamReports, setTeamReports] = useState<DailyReportRecord[]>([]);
  const [teamActivities, setTeamActivities] = useState<ActivityRecord[]>([]);

  const switchLanguage = (lang: AppLanguage) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('dailywork_lang', lang);
  };

  // 1. Listen to Firebase Authentication state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setNeedsOnboarding(false);
        setAuthReady(true);
        return;
      }

      setProfileLoading(true);
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setProfile(data);
          setFormFullName(data.fullName);
          setFormPosition(data.position);
          setFormDepartment(data.department);
          setFormManagerId(data.managerId);
          setFormManagerName(data.managerName);
          setFormCompanyName(data.companyName || 'DailyWork Cambodia');
          if (data.language) {
            switchLanguage(data.language);
          }
          setNeedsOnboarding(false);
        } else {
          // Prepare first-time onboarding
          setFormFullName(user.displayName || 'Loy Media');
          setNeedsOnboarding(true);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      } finally {
        setProfileLoading(false);
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  // 2. Attach real-time Firestore listeners once authenticated and profile exists
  useEffect(() => {
    if (!authReady || !firebaseUser || !profile) return;

    // A. Current user's own profile updates
    const unsubSelf = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`)
    );

    // B. Current user's activities
    const qMyActivities = query(
      collection(db, 'activities'),
      where('userId', '==', firebaseUser.uid)
    );
    const unsubMyActivities = onSnapshot(
      qMyActivities,
      (snap) => {
        const items: ActivityRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ActivityRecord, 'id'>),
        }));
        setMyActivities(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'activities')
    );

    // C. Current user's dailyReports
    const qMyReports = query(
      collection(db, 'dailyReports'),
      where('userId', '==', firebaseUser.uid)
    );
    const unsubMyReports = onSnapshot(
      qMyReports,
      (snap) => {
        const items: DailyReportRecord[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<DailyReportRecord, 'id'>),
          }))
          .sort((a, b) => b.workDate.localeCompare(a.workDate));
        setMyReports(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'dailyReports')
    );

    // D. Company directory users (PII-free work profiles)
    const qDirectory = query(
      collection(db, 'users'),
      where('role', 'in', ['employee', 'manager', 'admin'])
    );
    const unsubDirectory = onSnapshot(
      qDirectory,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as UserProfile);
        setDirectoryUsers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    // E. Departments list
    const unsubDepartments = onSnapshot(
      collection(db, 'departments'),
      (snap) => {
        const list: DepartmentRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DepartmentRecord, 'id'>),
        }));
        setDepartments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'departments')
    );

    // F. Manager or Admin team reports & activities
    let unsubTeamReports: (() => void) | null = null;
    let unsubTeamActivities: (() => void) | null = null;

    const isBootstrapped =
      firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

    if (profile.role === 'manager' || profile.role === 'admin') {
      const reportsQuery = isBootstrapped
        ? collection(db, 'dailyReports')
        : query(collection(db, 'dailyReports'), where('managerId', '==', firebaseUser.uid));

      unsubTeamReports = onSnapshot(
        reportsQuery,
        (snap) => {
          const items: DailyReportRecord[] = snap.docs
            .map((d) => ({
              id: d.id,
              ...(d.data() as Omit<DailyReportRecord, 'id'>),
            }))
            .sort((a, b) => b.workDate.localeCompare(a.workDate));
          setTeamReports(items);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'dailyReports')
      );

      const actsQuery = isBootstrapped
        ? collection(db, 'activities')
        : query(collection(db, 'activities'), where('managerId', '==', firebaseUser.uid));

      unsubTeamActivities = onSnapshot(
        actsQuery,
        (snap) => {
          const items: ActivityRecord[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ActivityRecord, 'id'>),
          }));
          setTeamActivities(items);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'activities')
      );
    }

    return () => {
      unsubSelf();
      unsubMyActivities();
      unsubMyReports();
      unsubDirectory();
      unsubDepartments();
      if (unsubTeamReports) unsubTeamReports();
      if (unsubTeamActivities) unsubTeamActivities();
    };
  }, [authReady, firebaseUser, profile?.uid, profile?.role]);

  // Sign in with Google Popup
  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in was cancelled.');
    } finally {
      setSigningIn(false);
    }
  };

  // Complete first-time profile setup or save profile settings
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSavingProfile(true);
    setSettingsSavedMsg(false);

    const isBootstrapped =
      firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

    const assignedRole: UserRole = profile
      ? profile.role
      : isBootstrapped
      ? 'admin'
      : 'employee';

    const cleanName = sanitizeString(
      formFullName,
      BLUEPRINT_LIMITS.MAX_NAME_LEN,
      firebaseUser.displayName || 'Employee'
    );
    const cleanPosition = sanitizeString(
      formPosition,
      BLUEPRINT_LIMITS.MAX_POSITION_LEN,
      'Staff'
    );
    const cleanDepartment = sanitizeString(
      formDepartment,
      BLUEPRINT_LIMITS.MAX_DEPARTMENT_LEN,
      'General'
    );
    const cleanCompany = sanitizeString(
      formCompanyName,
      BLUEPRINT_LIMITS.MAX_COMPANY_LEN,
      'DailyWork Cambodia'
    );
    const cleanPhoto = sanitizeString(
      firebaseUser.photoURL || '',
      BLUEPRINT_LIMITS.MAX_PHOTO_URL_LEN,
      ''
    );
    const selectedMgr = directoryUsers.find((u) => u.uid === formManagerId);
    const cleanManagerId = sanitizeString(
      selectedMgr ? selectedMgr.uid : formManagerId || firebaseUser.uid,
      BLUEPRINT_LIMITS.MAX_ID_LEN,
      firebaseUser.uid
    );
    const cleanManagerName = sanitizeString(
      selectedMgr ? selectedMgr.fullName : formManagerName || cleanName,
      BLUEPRINT_LIMITS.MAX_NAME_LEN,
      cleanName
    );
    const currentLang: AppLanguage = i18n.language === 'km' ? 'km' : 'en';

    try {
      if (!profile) {
        // Create /users/{uid} and isolated /userPrivate/{uid}
        const newProfilePayload = {
          uid: firebaseUser.uid,
          fullName: cleanName,
          photoURL: cleanPhoto,
          position: cleanPosition,
          department: cleanDepartment,
          role: assignedRole,
          managerId: cleanManagerId,
          managerName: cleanManagerName,
          language: currentLang,
          companyName: cleanCompany,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'users', firebaseUser.uid), newProfilePayload);

        if (firebaseUser.email) {
          await setDoc(doc(db, 'userPrivate', firebaseUser.uid), {
            uid: firebaseUser.uid,
            email: sanitizeString(firebaseUser.email, BLUEPRINT_LIMITS.MAX_EMAIL_LEN, 'user@example.com'),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        setProfile({
          ...newProfilePayload,
          createdAt: null,
          updatedAt: null,
        });
        setNeedsOnboarding(false);
      } else {
        // Update existing profile
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          fullName: cleanName,
          photoURL: cleanPhoto,
          position: cleanPosition,
          department: cleanDepartment,
          managerId: cleanManagerId,
          managerName: cleanManagerName,
          language: currentLang,
          companyName: cleanCompany,
          updatedAt: serverTimestamp(),
        });
        setSettingsSavedMsg(true);
      }
    } catch (error) {
      handleFirestoreError(
        error,
        profile ? OperationType.UPDATE : OperationType.CREATE,
        `users/${firebaseUser.uid}`
      );
    } finally {
      setSavingProfile(false);
    }
  };

  // Create or update a work activity
  const handleSaveActivity = async (payload: {
    title: string;
    category: string;
    workDate: string;
    startTime: string;
    endTime: string;
    status: ActivityStatus;
    description: string;
    result: string;
    photos: string[];
  }) => {
    if (!firebaseUser || !profile) return;

    const cleanPhotos = payload.photos
      .slice(0, BLUEPRINT_LIMITS.MAX_PHOTOS_COUNT)
      .map((p) => p.slice(0, BLUEPRINT_LIMITS.MAX_PHOTO_DATA_LEN));

    const recordData = {
      userId: firebaseUser.uid,
      userName: sanitizeString(profile.fullName, BLUEPRINT_LIMITS.MAX_NAME_LEN, 'Employee'),
      userDepartment: sanitizeString(profile.department, BLUEPRINT_LIMITS.MAX_DEPARTMENT_LEN, 'General'),
      managerId: sanitizeString(profile.managerId || firebaseUser.uid, BLUEPRINT_LIMITS.MAX_ID_LEN, firebaseUser.uid),
      title: sanitizeString(payload.title, BLUEPRINT_LIMITS.MAX_TITLE_LEN, 'Work Activity'),
      category: sanitizeString(payload.category, BLUEPRINT_LIMITS.MAX_CATEGORY_LEN, 'Other'),
      description: sanitizeString(payload.description, BLUEPRINT_LIMITS.MAX_DESC_LEN, ''),
      result: sanitizeString(payload.result, BLUEPRINT_LIMITS.MAX_RESULT_LEN, ''),
      startTime: sanitizeString(payload.startTime, BLUEPRINT_LIMITS.MAX_TIME_LEN, '08:00'),
      endTime: sanitizeString(payload.endTime, BLUEPRINT_LIMITS.MAX_TIME_LEN, ''),
      status: payload.status,
      photos: cleanPhotos,
      workDate: sanitizeString(payload.workDate, BLUEPRINT_LIMITS.MAX_DATE_LEN, selectedDate),
    };

    try {
      if (editingActivity) {
        await updateDoc(doc(db, 'activities', editingActivity.id), {
          ...recordData,
          updatedAt: serverTimestamp(),
        });
      } else {
        const actId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await setDoc(doc(db, 'activities', actId), {
          ...recordData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setSelectedDate(recordData.workDate);
      setEditingActivity(null);
      setActiveView('dashboard');
    } catch (error) {
      handleFirestoreError(
        error,
        editingActivity ? OperationType.UPDATE : OperationType.CREATE,
        'activities'
      );
    }
  };

  // Quick Capture save handler
  const handleSaveQuickActivity = async (data: {
    title: string;
    category: string;
    description: string;
    photos: string[];
  }) => {
    if (!firebaseUser || !profile) return;
    const now = new Date();
    const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const uploadedUrls: string[] = [];
    for (const rawPhoto of data.photos.slice(0, 5)) {
      const res = await uploadActivityPhoto(rawPhoto, firebaseUser.uid, selectedDate);
      uploadedUrls.push(res.url);
    }

    await handleSaveActivity({
      title: data.title,
      category: data.category,
      workDate: selectedDate,
      startTime,
      endTime: '',
      status: 'completed',
      description: data.description,
      result: 'Captured via Quick Photo Mode',
      photos: uploadedUrls,
    });
  };

  // Delete an activity
  const handleDeleteActivity = async (activityId: string) => {
    try {
      await deleteDoc(doc(db, 'activities', activityId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `activities/${activityId}`);
    }
  };

  // Seed 2 realistic sample activities on the selected date so the user can test PDF export right away
  const handleSeedSampleActivities = async () => {
    if (!firebaseUser || !profile) return;
    const sample1Photo = createSampleWorkGraphic(
      'Agriculture Tractor Poster',
      'Khmer Promotional Layout & Product Cutout',
      '#2563EB'
    );
    const sample2Photo = createSampleWorkGraphic(
      'Precision Farming Research',
      'Competitor Specs & Campaign Key Copy',
      '#059669'
    );

    const samples = [
      {
        id: `act_sample1_${Date.now()}`,
        title: 'Design Agriculture Product Poster',
        category: 'Graphic Design',
        startTime: '08:00',
        endTime: '09:30',
        description:
          'Designed a promotional poster for an agriculture tractor product. Prepared the background, product image, and Khmer promotional text.',
        result: 'Completed first poster design ready for print and social media.',
        photos: [sample1Photo],
      },
      {
        id: `act_sample2_${Date.now() + 1}`,
        title: 'Product Research & Content Preparation',
        category: 'Product Research',
        startTime: '09:30',
        endTime: '11:00',
        description:
          'Researched product specifications and prepared bilingual marketing copy for the next campaign design.',
        result: 'Prepared content brief and visual reference sheet.',
        photos: [sample2Photo],
      },
    ];

    try {
      for (const s of samples) {
        await setDoc(doc(db, 'activities', s.id), {
          userId: firebaseUser.uid,
          userName: sanitizeString(profile.fullName, BLUEPRINT_LIMITS.MAX_NAME_LEN, 'Employee'),
          userDepartment: sanitizeString(profile.department, BLUEPRINT_LIMITS.MAX_DEPARTMENT_LEN, 'Marketing'),
          managerId: sanitizeString(profile.managerId || firebaseUser.uid, BLUEPRINT_LIMITS.MAX_ID_LEN, firebaseUser.uid),
          title: s.title,
          category: s.category,
          description: s.description,
          result: s.result,
          startTime: s.startTime,
          endTime: s.endTime,
          status: 'completed',
          photos: s.photos,
          workDate: selectedDate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'activities');
    }
  };

  // Save or Submit Daily Report
  const handleSaveOrSubmitReport = async (payload: {
    workDate: string;
    summary: string;
    workingHours: number;
    status: ReportStatus;
    activityIds: string[];
    totalActivities: number;
    totalPhotos: number;
  }) => {
    if (!firebaseUser || !profile) return;
    const reportId = `rep_${firebaseUser.uid}_${payload.workDate}`;
    const existingReport = myReports.find((r) => r.id === reportId || r.workDate === payload.workDate);

    try {
      if (existingReport) {
        await updateDoc(doc(db, 'dailyReports', existingReport.id), {
          activityIds: payload.activityIds.slice(0, 50),
          totalActivities: Math.min(100, Math.max(0, payload.totalActivities)),
          totalPhotos: Math.min(500, Math.max(0, payload.totalPhotos)),
          workingHours: Math.min(24, Math.max(0, payload.workingHours)),
          summary: sanitizeString(payload.summary, BLUEPRINT_LIMITS.MAX_DESC_LEN, ''),
          status: payload.status === 'submitted' ? 'submitted' : 'draft',
          managerId: sanitizeString(profile.managerId || firebaseUser.uid, BLUEPRINT_LIMITS.MAX_ID_LEN, firebaseUser.uid),
          managerName: sanitizeString(profile.managerName || profile.fullName, BLUEPRINT_LIMITS.MAX_NAME_LEN, profile.fullName),
          userName: sanitizeString(profile.fullName, BLUEPRINT_LIMITS.MAX_NAME_LEN, 'Employee'),
          userPosition: sanitizeString(profile.position, BLUEPRINT_LIMITS.MAX_POSITION_LEN, 'Staff'),
          userDepartment: sanitizeString(profile.department, BLUEPRINT_LIMITS.MAX_DEPARTMENT_LEN, 'General'),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'dailyReports', reportId), {
          userId: firebaseUser.uid,
          userName: sanitizeString(profile.fullName, BLUEPRINT_LIMITS.MAX_NAME_LEN, 'Employee'),
          userPosition: sanitizeString(profile.position, BLUEPRINT_LIMITS.MAX_POSITION_LEN, 'Staff'),
          userDepartment: sanitizeString(profile.department, BLUEPRINT_LIMITS.MAX_DEPARTMENT_LEN, 'General'),
          managerId: sanitizeString(profile.managerId || firebaseUser.uid, BLUEPRINT_LIMITS.MAX_ID_LEN, firebaseUser.uid),
          managerName: sanitizeString(profile.managerName || profile.fullName, BLUEPRINT_LIMITS.MAX_NAME_LEN, profile.fullName),
          workDate: sanitizeString(payload.workDate, BLUEPRINT_LIMITS.MAX_DATE_LEN, selectedDate),
          activityIds: payload.activityIds.slice(0, 50),
          totalActivities: Math.min(100, Math.max(0, payload.totalActivities)),
          totalPhotos: Math.min(500, Math.max(0, payload.totalPhotos)),
          workingHours: Math.min(24, Math.max(0, payload.workingHours)),
          summary: sanitizeString(payload.summary, BLUEPRINT_LIMITS.MAX_DESC_LEN, ''),
          status: payload.status === 'submitted' ? 'submitted' : 'draft',
          managerComment: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(
        error,
        existingReport ? OperationType.UPDATE : OperationType.CREATE,
        `dailyReports/${reportId}`
      );
    }
  };

  // Manager review handler
  const handleReviewReport = async (
    reportId: string,
    newStatus: 'approved' | 'revision_requested',
    comment: string
  ) => {
    try {
      await updateDoc(doc(db, 'dailyReports', reportId), {
        status: newStatus,
        managerComment: sanitizeString(comment, BLUEPRINT_LIMITS.MAX_COMMENT_LEN, ''),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `dailyReports/${reportId}`);
    }
  };

  // Admin handlers
  const handleUpdateUserRoleAndManager = async (
    targetUser: UserProfile,
    newRole: UserRole,
    managerId: string,
    managerName: string,
    department: string
  ) => {
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        role: newRole,
        managerId: sanitizeString(managerId, BLUEPRINT_LIMITS.MAX_ID_LEN, ''),
        managerName: sanitizeString(managerName, BLUEPRINT_LIMITS.MAX_NAME_LEN, ''),
        department: sanitizeString(department, BLUEPRINT_LIMITS.MAX_DEPARTMENT_LEN, 'General'),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetUser.uid}`);
    }
  };

  const handleCreateDepartment = async (payload: {
    name: string;
    nameKm: string;
    managerId: string;
    managerName: string;
  }) => {
    if (!firebaseUser) return;
    const deptId = `dept_${Date.now()}`;
    try {
      await setDoc(doc(db, 'departments', deptId), {
        name: sanitizeString(payload.name, BLUEPRINT_LIMITS.MAX_DEPARTMENT_LEN, 'Department'),
        nameKm: sanitizeString(payload.nameKm, BLUEPRINT_LIMITS.MAX_DEPARTMENT_LEN, payload.name),
        managerId: sanitizeString(payload.managerId, BLUEPRINT_LIMITS.MAX_ID_LEN, ''),
        managerName: sanitizeString(payload.managerName, BLUEPRINT_LIMITS.MAX_NAME_LEN, ''),
        createdBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `departments/${deptId}`);
    }
  };

  const handleDeleteDepartment = async (deptId: string) => {
    try {
      await deleteDoc(doc(db, 'departments', deptId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `departments/${deptId}`);
    }
  };

  // Loading Skeleton
  if (!authReady || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="w-full max-w-md space-y-4">
          <div className="h-8 w-40 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-36 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-24 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  // Unauthenticated Landing & Google Sign-In Screen
  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
        {/* Strict 3-Zone Top Bar Contract */}
        <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
            DailyWork
          </span>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Photo Capture
            </a>
            <a href="#pdf-report" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              A4 PDF Reports
            </a>
            <a href="#team" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Manager Review
            </a>
            <button
              type="button"
              onClick={() => switchLanguage(i18n.language === 'km' ? 'en' : 'km')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {i18n.language === 'km' ? 'English' : 'ភាសាខ្មែរ'}
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 rounded-lg hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
            >
              {signingIn ? t('auth.signingIn') : t('auth.continueWithGoogle')}
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Bilingual Khmer & English PWA · Mobile & Desktop
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white font-khmer leading-tight">
              {t('auth.signInTitle')}
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 max-w-xl font-khmer leading-relaxed">
              {t('auth.signInSubtitle')}
            </p>

            {authError && (
              <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/50 dark:border-red-800 p-3.5 text-xs text-red-700 dark:text-red-300">
                {authError}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                className="flex items-center justify-center gap-3 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm min-h-[48px]"
              >
                <span>{signingIn ? t('auth.signingIn') : t('auth.continueWithGoogle')}</span>
              </button>

              <PWAInstallButton />
            </div>

            <div
              id="features"
              className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-slate-200 dark:border-slate-800 text-xs"
            >
              <div>
                <p className="font-bold text-slate-900 dark:text-white">01. Photo Evidence</p>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  Snap live work photos from your mobile camera or gallery with instant compression.
                </p>
              </div>
              <div id="pdf-report">
                <p className="font-bold text-slate-900 dark:text-white">02. Embedded A4 PDF</p>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  Export structured A4 PDF reports with embedded photographs and Khmer/English text.
                </p>
              </div>
              <div id="team">
                <p className="font-bold text-slate-900 dark:text-white">03. Manager Approval</p>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  Submit daily reports to your manager for one-click approval or revision feedback.
                </p>
              </div>
            </div>
          </div>

          {/* Right Preview Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-xs text-slate-500">TODAY&apos;S WORK REPORT</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                    {selectedDate}
                  </p>
                </div>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  A4 PDF Ready
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700">
                  <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    05
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Activities Logged
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700">
                  <p className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                    12
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Work Photos Attached
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    08:00 – 09:30 · Agriculture Poster Design
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Prepared product cutout, background, and Khmer promotional typography.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    09:30 – 11:00 · Product Research & Copy
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    Compiled specifications and campaign messaging for social media.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
        <OfflineIndicator />
      </div>
    );
  }

  // First-time User Work Profile Onboarding Screen
  if (needsOnboarding || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-khmer">
            {t('auth.setupProfileTitle')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-khmer">
            {t('auth.setupProfileSubtitle')}
          </p>

          <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('auth.fullName')} *
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-khmer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.position')} *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={formPosition}
                  onChange={(e) => setFormPosition(e.target.value)}
                  placeholder="e.g. Graphic Designer"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-khmer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.department')} *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  placeholder="e.g. Marketing"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-khmer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.manager')}
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={formManagerName}
                  onChange={(e) => setFormManagerName(e.target.value)}
                  placeholder="e.g. Mr. Dara"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-khmer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.companyName')}
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={formCompanyName}
                  onChange={(e) => setFormCompanyName(e.target.value)}
                  placeholder="e.g. DailyWork Enterprise"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-khmer"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile || !formFullName.trim()}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors mt-2 min-h-[48px]"
            >
              {savingProfile ? t('activity.saving') : t('auth.saveProfile')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Computed metrics for selectedDate
  const todaysActivities = myActivities
    .filter((a) => a.workDate === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const todaysPhotosCount = todaysActivities.reduce(
    (sum, a) => sum + (a.photos?.length || 0),
    0
  );
  const completedCount = todaysActivities.filter((a) => a.status === 'completed').length;
  const todaysReport = myReports.find((r) => r.workDate === selectedDate) || null;

  const canReviewTeam = profile.role === 'manager' || profile.role === 'admin';
  const canManageAdmin =
    profile.role === 'admin' ||
    firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

  const hourNow = new Date().getHours();
  const greeting =
    hourNow < 12
      ? t('dashboard.goodMorning')
      : hourNow < 17
      ? t('dashboard.goodAfternoon')
      : t('dashboard.goodEvening');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 lg:pb-10">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-4 sm:px-8 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => {
            setEditingActivity(null);
            setActiveView('dashboard');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          DailyWork
        </button>

        {/* Zone 2: 4–5 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => setActiveView('dashboard')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'dashboard'
                ? 'text-blue-600 dark:text-blue-400 font-semibold underline underline-offset-8'
                : ''
            }`}
          >
            {t('nav.dashboard')}
          </button>
          <button
            type="button"
            onClick={() => setActiveView('timeline')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'timeline'
                ? 'text-blue-600 dark:text-blue-400 font-semibold underline underline-offset-8'
                : ''
            }`}
          >
            {t('nav.timeline')}
          </button>
          <button
            type="button"
            onClick={() => setActiveView('reports')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'reports'
                ? 'text-blue-600 dark:text-blue-400 font-semibold underline underline-offset-8'
                : ''
            }`}
          >
            {t('nav.reports')}
          </button>
          {canReviewTeam && (
            <button
              type="button"
              onClick={() => setActiveView('manager')}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'manager'
                  ? 'text-blue-600 dark:text-blue-400 font-semibold underline underline-offset-8'
                  : ''
              }`}
            >
              {t('nav.manager')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveView('settings')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'settings' || activeView === 'admin'
                ? 'text-blue-600 dark:text-blue-400 font-semibold underline underline-offset-8'
                : ''
            }`}
          >
            {t('nav.settings')}
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditingActivity(null);
              setActiveView('add_activity');
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
          >
            + {t('nav.addActivity')}
          </button>
        </div>
      </header>

      {/* Secondary Workspace Context Bar (Language Switcher, Date Selector, Quick Capture, PWA Install, Admin Switch) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-5 pb-2 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-khmer">
            {greeting}, {profile.fullName}!
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-khmer">
            {profile.position} · {profile.department} · {profile.companyName} · Role:{' '}
            <span className="uppercase font-semibold text-slate-700 dark:text-slate-200">
              {profile.role}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 min-h-[40px]">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* Quick Photo Capture Trigger */}
          <button
            type="button"
            onClick={() => setQuickCaptureOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>{t('nav.quickCapture')}</span>
          </button>

          {/* Admin Console Button if authorized */}
          {canManageAdmin && (
            <button
              type="button"
              onClick={() => setActiveView('admin')}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
                activeView === 'admin'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>{t('nav.admin')}</span>
            </button>
          )}

          {/* Bilingual Khmer / English Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 min-h-[40px]">
            <button
              type="button"
              onClick={() => switchLanguage('en')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                i18n.language === 'en'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => switchLanguage('km')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold font-khmer transition-colors whitespace-nowrap ${
                i18n.language === 'km'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              ខ្មែរ
            </button>
          </div>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Toggle Light / Dark Theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* In-App PWA Install Button */}
          <PWAInstallButton />
        </div>
      </div>

      {/* Main Content Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-5">
        {activeView === 'dashboard' && (
          <div className="space-y-6">
            {/* 4-Column KPI Summary Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 font-khmer">
                  {t('dashboard.activitiesToday')}
                </p>
                <p className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1.5">
                  {String(todaysActivities.length).padStart(2, '0')}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-mono tabular-nums">
                  {selectedDate}
                </p>
              </div>

              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 font-khmer">
                  {t('dashboard.photosTaken')}
                </p>
                <p className="text-3xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1.5">
                  {String(todaysPhotosCount).padStart(2, '0')}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Embedded in PDF
                </p>
              </div>

              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 font-khmer">
                  {t('dashboard.completedTasks')}
                </p>
                <p className="text-3xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1.5">
                  {String(completedCount).padStart(2, '0')}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  of {todaysActivities.length} tasks
                </p>
              </div>

              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 font-khmer">
                  {t('dashboard.reportStatus')}
                </p>
                <p className="text-lg font-bold text-slate-900 dark:text-white mt-2 font-khmer">
                  {t(`report.status.${todaysReport?.status || 'not_started'}`)}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">
                  Manager: {profile.managerName || 'Assigned'}
                </p>
              </div>
            </div>

            {/* 2-Column Split: Left Action & Export Card + Right Today's Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 4 Columns: Record New Activity & Instant PDF Export */}
              <div className="lg:col-span-4 space-y-4">
                <div className="rounded-2xl bg-slate-900 text-white p-6 space-y-4">
                  <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold font-khmer">
                      {t('dashboard.recordNewActivity')}
                    </h2>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed font-khmer">
                      {t('dashboard.recordNewActivityDesc')}
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingActivity(null);
                        setActiveView('add_activity');
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-xs font-semibold text-white hover:bg-blue-500 transition-colors min-h-[46px]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t('dashboard.addNewActivityBtn')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setQuickCaptureOpen(true)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 border border-slate-700 py-3 text-xs font-semibold text-slate-100 hover:bg-slate-700 transition-colors min-h-[46px]"
                    >
                      <Camera className="w-4 h-4 text-blue-400" />
                      <span>{t('dashboard.quickCaptureBtn')}</span>
                    </button>
                  </div>
                </div>

                {/* Instant A4 PDF Card */}
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-khmer">
                      {t('report.title')} (A4 PDF)
                    </h3>
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Preview or download your formatted A4 PDF report with all embedded activity photographs.
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setDashboardPreviewOpen(true)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[42px]"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>Preview A4</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        generateDailyWorkPdf({
                          profile,
                          workDate: selectedDate,
                          activities: todaysActivities,
                          report: todaysReport,
                        })
                      }
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-blue-500 min-h-[42px]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export PDF</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveView('reports')}
                    className="w-full text-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline pt-1"
                  >
                    {t('dashboard.viewAllReports')} →
                  </button>
                </div>
              </div>

              {/* Right 8 Columns: Today's Activity Timeline */}
              <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white font-khmer">
                    {t('dashboard.recentActivities')} ({todaysActivities.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveView('timeline')}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t('nav.timeline')} →
                  </button>
                </div>

                {todaysActivities.length === 0 ? (
                  <div className="py-12 text-center space-y-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-khmer">
                      {t('dashboard.noActivitiesToday')}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingActivity(null);
                          setActiveView('add_activity');
                        }}
                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 min-h-[42px]"
                      >
                        + {t('dashboard.logFirstActivity')}
                      </button>
                      <button
                        type="button"
                        onClick={handleSeedSampleActivities}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 min-h-[42px]"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Load Sample Work Activities (With Photos)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {todaysActivities.map((act, idx) => (
                      <div key={act.id} className="py-5 first:pt-4 last:pb-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-mono font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                                #{String(idx + 1).padStart(2, '0')}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {act.startTime}
                                {act.endTime ? ` – ${act.endTime}` : ''}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{t(`activity.categories.${act.category}`, act.category)}</span>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
                                {act.status === 'completed' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                )}
                                {act.status === 'completed'
                                  ? t('activity.statusCompleted')
                                  : t('activity.statusInProgress')}
                              </span>
                            </div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1 font-khmer">
                              {act.title}
                            </h3>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingActivity(act);
                                setActiveView('add_activity');
                              }}
                              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
                              title={t('activity.edit')}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteActivity(act.id)}
                              className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 min-h-[40px] min-w-[40px] flex items-center justify-center"
                              title={t('activity.delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {act.description && (
                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed font-khmer">
                            {act.description}
                          </p>
                        )}

                        {act.result && (
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-1.5 font-khmer">
                            Result: {act.result}
                          </p>
                        )}

                        {act.photos && act.photos.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                            {act.photos.map((photoUrl, pIdx) => (
                              <div
                                key={pIdx}
                                className="aspect-4/3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                              >
                                <img
                                  src={photoUrl}
                                  alt={`${act.title} photo ${pIdx + 1}`}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeView === 'add_activity' && (
          <AddActivityView
            userId={firebaseUser.uid}
            selectedDate={selectedDate}
            editingActivity={editingActivity}
            onSave={handleSaveActivity}
            onCancel={() => {
              setEditingActivity(null);
              setActiveView('dashboard');
            }}
          />
        )}

        {activeView === 'timeline' && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-7 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-khmer">
                  {t('nav.timeline')} — {selectedDate}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Chronological record of your daily activities and uploaded photo evidence
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingActivity(null);
                  setActiveView('add_activity');
                }}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 min-h-[42px]"
              >
                + {t('nav.addActivity')}
              </button>
            </div>

            {todaysActivities.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                {t('dashboard.noActivitiesToday')}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {todaysActivities.map((act, idx) => (
                  <div key={act.id} className="py-5 flex flex-col sm:flex-row gap-4">
                    <div className="sm:w-36 shrink-0">
                      <p className="text-sm font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                        {act.startTime}
                        {act.endTime ? ` – ${act.endTime}` : ''}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Activity #{String(idx + 1).padStart(2, '0')}
                      </p>
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white font-khmer">
                            {act.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t(`activity.categories.${act.category}`, act.category)} ·{' '}
                            {act.status === 'completed'
                              ? t('activity.statusCompleted')
                              : t('activity.statusInProgress')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingActivity(act);
                              setActiveView('add_activity');
                            }}
                            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteActivity(act.id)}
                            className="p-2 rounded-lg text-slate-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {act.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 font-khmer">
                          {act.description}
                        </p>
                      )}
                      {act.result && (
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 font-khmer">
                          Result: {act.result}
                        </p>
                      )}
                      {act.photos && act.photos.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                          {act.photos.map((photo, pIdx) => (
                            <img
                              key={pIdx}
                              src={photo}
                              alt={`${act.title} ${pIdx + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full aspect-4/3 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'reports' && (
          <DailyReportsView
            profile={profile}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            allMyActivities={myActivities}
            allMyReports={myReports}
            onSaveOrSubmitReport={handleSaveOrSubmitReport}
          />
        )}

        {activeView === 'manager' && canReviewTeam && (
          <ManagerReviewView
            currentUser={profile}
            teamReports={teamReports}
            teamActivities={teamActivities}
            teamUsers={directoryUsers}
            onReviewReport={handleReviewReport}
          />
        )}

        {activeView === 'admin' && canManageAdmin && (
          <AdminManagementView
            allUsers={directoryUsers}
            departments={departments}
            onUpdateUserRoleAndManager={handleUpdateUserRoleAndManager}
            onCreateDepartment={handleCreateDepartment}
            onDeleteDepartment={handleDeleteDepartment}
          />
        )}

        {activeView === 'settings' && (
          <div className="max-w-2xl mx-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-khmer">
                  {t('settings.title')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {firebaseUser.email} · Role: {profile.role.toUpperCase()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-2 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 transition-colors min-h-[40px]"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('auth.signOut')}</span>
              </button>
            </div>

            {settingsSavedMsg && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-3.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                {t('settings.profileUpdated')}
              </div>
            )}

            {/* Cloudinary Integration Status */}
            <div className="rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    Cloudinary Photo Storage Active
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Cloud: <span className="font-mono font-medium">xivrejrq</span> · Signed backend uploads enabled
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Connected</span>
              </span>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('auth.fullName')}
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-khmer"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('auth.position')}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-khmer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('auth.department')}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-khmer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('auth.manager')}
                  </label>
                  <select
                    value={formManagerId}
                    onChange={(e) => {
                      setFormManagerId(e.target.value);
                      const mgr = directoryUsers.find((u) => u.uid === e.target.value);
                      if (mgr) setFormManagerName(mgr.fullName);
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white"
                  >
                    <option value={profile.managerId}>
                      {formManagerName || 'Current Manager'}
                    </option>
                    {directoryUsers
                      .filter((u) => u.role === 'manager' || u.role === 'admin')
                      .map((m) => (
                        <option key={m.uid} value={m.uid}>
                          {m.fullName} ({m.department})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('auth.companyName')} (PDF Header)
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={formCompanyName}
                    onChange={(e) => setFormCompanyName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-khmer"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>{t('settings.language')}:</span>
                  <button
                    type="button"
                    onClick={() => switchLanguage('en')}
                    className={`px-2.5 py-1 rounded-md font-semibold ${
                      i18n.language === 'en' ? 'bg-blue-600 text-white' : ''
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => switchLanguage('km')}
                    className={`px-2.5 py-1 rounded-md font-semibold font-khmer ${
                      i18n.language === 'km' ? 'bg-blue-600 text-white' : ''
                    }`}
                  >
                    ខ្មែរ
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="rounded-xl bg-slate-900 dark:bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors min-h-[44px]"
                >
                  {savingProfile ? t('activity.saving') : t('auth.saveProfile')}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Fixed Mobile Bottom Navigation Bar (Natural Thumb Zone, <= 15% viewport height) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center h-15 px-1">
        <button
          type="button"
          onClick={() => setActiveView('dashboard')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            activeView === 'dashboard'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5 truncate max-w-[64px]">
            {t('nav.dashboard')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('timeline')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            activeView === 'timeline'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5 truncate max-w-[64px]">
            {t('nav.timeline')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setEditingActivity(null);
            setActiveView('add_activity');
          }}
          className="flex flex-col items-center justify-center min-h-[44px] text-blue-600 dark:text-blue-400"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Plus className="w-5 h-5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('reports')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            activeView === 'reports'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5 truncate max-w-[64px]">
            {t('nav.reports')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView(canReviewTeam ? 'manager' : 'settings')}
          className={`flex flex-col items-center justify-center min-h-[44px] ${
            activeView === 'manager' || activeView === 'settings'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {canReviewTeam ? <Users className="w-5 h-5" /> : <SettingsIcon className="w-5 h-5" />}
          <span className="text-[10px] font-medium mt-0.5 truncate max-w-[64px]">
            {canReviewTeam ? t('nav.manager') : t('nav.settings')}
          </span>
        </button>
      </nav>

      {/* Modals & Offline Banner */}
      <QuickCaptureModal
        isOpen={quickCaptureOpen}
        onClose={() => setQuickCaptureOpen(false)}
        onSaveQuickActivity={handleSaveQuickActivity}
      />

      <A4PreviewModal
        isOpen={dashboardPreviewOpen}
        onClose={() => setDashboardPreviewOpen(false)}
        profile={profile}
        workDate={selectedDate}
        activities={todaysActivities}
        report={todaysReport}
      />

      <OfflineIndicator />
    </div>
  );
}
