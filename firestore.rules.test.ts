/**
 * Security Rules Verification Suite (Phase 0 & Phase 5 Dirty Dozen TDD)
 * Verifies that all 12 Dirty Dozen adversarial payloads are rejected by firestore.rules.
 */

export interface DirtyDozenScenario {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_SCENARIOS: DirtyDozenScenario[] = [
  { id: 1, name: 'Privilege Escalation on Signup (role: admin by regular user)', collection: 'users', operation: 'create', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 2, name: 'Role Self-Promotion on Update (employee changing role to manager)', collection: 'users', operation: 'update', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 3, name: 'Shadow Field Injection (extra ghost key isVerified: true)', collection: 'activities', operation: 'create', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 4, name: 'PII Leak via Cross-User Get on userPrivate', collection: 'userPrivate', operation: 'get', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 5, name: 'Identity Spoofing on Activity (userId != request.auth.uid)', collection: 'activities', operation: 'create', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 6, name: 'Orphaned Activity Creation (missing parent /users/{uid})', collection: 'activities', operation: 'create', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 7, name: 'Unbounded Photo Array Exhaustion (photos.size() > 5)', collection: 'activities', operation: 'create', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 8, name: 'Terminal State Reversal (updating dailyReport after status == approved)', collection: 'dailyReports', operation: 'update', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 9, name: 'Unauthorized Report Self-Approval by Employee', collection: 'dailyReports', operation: 'update', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 10, name: 'Cross-Team Manager Snooping on Unassigned Employee Reports', collection: 'dailyReports', operation: 'get', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 11, name: 'Timestamp Forgery (client timestamp != request.time)', collection: 'activities', operation: 'create', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 12, name: 'Unverified Email Spoofing of Bootstrapped Admin', collection: 'departments', operation: 'create', expectedOutcome: 'PERMISSION_DENIED' },
];
