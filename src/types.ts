import { Timestamp } from 'firebase/firestore';

export type UserRole = 'employee' | 'manager' | 'admin';
export type AppLanguage = 'en' | 'km';
export type ActivityStatus = 'in_progress' | 'completed';
export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'revision_requested';

export interface UserProfile {
  uid: string;
  fullName: string;
  photoURL: string;
  position: string;
  department: string;
  role: UserRole;
  managerId: string;
  managerName: string;
  language: AppLanguage;
  companyName: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ActivityRecord {
  id: string;
  userId: string;
  userName: string;
  userDepartment: string;
  managerId: string;
  title: string;
  category: string;
  description: string;
  result: string;
  startTime: string;
  endTime: string;
  status: ActivityStatus;
  photos: string[];
  workDate: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface DailyReportRecord {
  id: string;
  userId: string;
  userName: string;
  userPosition: string;
  userDepartment: string;
  managerId: string;
  managerName: string;
  workDate: string;
  activityIds: string[];
  totalActivities: number;
  totalPhotos: number;
  workingHours: number;
  summary: string;
  status: ReportStatus;
  managerComment: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface DepartmentRecord {
  id: string;
  name: string;
  nameKm: string;
  managerId: string;
  managerName: string;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ActivityTemplate {
  id: string;
  labelEn: string;
  labelKm: string;
  title: string;
  category: string;
  description: string;
  result: string;
}

export const ACTIVITY_CATEGORIES = [
  'Graphic Design',
  'Marketing',
  'Product Research',
  'Video Editing',
  'Social Media',
  'Meeting',
  'Field Work',
  'Other',
] as const;

export const DEFAULT_TEMPLATES: ActivityTemplate[] = [
  {
    id: 'poster-design',
    labelEn: 'Promotional Poster Design',
    labelKm: 'រចនាផ្ទាំងផ្សព្វផ្សាយផលិតផល',
    title: 'Design Agriculture Product Poster',
    category: 'Graphic Design',
    description:
      'Designed a promotional poster for an agriculture product. Prepared background layout, high-resolution product cutout, and bilingual Khmer/English promotional copy.',
    result: 'Completed first draft poster design ready for marketing review.',
  },
  {
    id: 'product-research',
    labelEn: 'Market & Product Research',
    labelKm: 'ស្រាវជ្រាវព័ត៌មានផលិតផល',
    title: 'Product Feature & Competitor Research',
    category: 'Product Research',
    description:
      'Researched technical specifications, customer benefits, and visual references to prepare content for the upcoming campaign.',
    result: 'Compiled key selling points and visual direction document.',
  },
  {
    id: 'social-content',
    labelEn: 'Social Media Content Pack',
    labelKm: 'រៀបចំមាតិកាបណ្តាញសង្គម',
    title: 'Social Media Visual & Caption Preparation',
    category: 'Social Media',
    description:
      'Created square and vertical social media graphics along with bilingual captions for Facebook and Telegram channels.',
    result: 'Published and scheduled 3 social media posts.',
  },
  {
    id: 'video-edit',
    labelEn: 'Short Video Editing',
    labelKm: 'កាត់តវីដេអូខ្លីផ្សព្វផ្សាយ',
    title: 'Product Highlight Reel Editing',
    category: 'Video Editing',
    description:
      'Edited product footage, added Khmer subtitles, color grading, and background audio for short-form video promotion.',
    result: 'Exported 1080p MP4 video ready for publishing.',
  },
];
