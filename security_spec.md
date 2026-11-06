# DailyWork Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Catch-All**: All paths not explicitly matched are denied by `match /{document=**} { allow read, write: if false; }`.
2. **PII Split Isolation**: User email addresses are stored exclusively in `/userPrivate/{userId}` and can only be read or written by the document owner (`request.auth.uid == userId`) or an Admin (`isAdmin()`).
3. **Self-Assigned Role Prevention**: When a regular user registers their `/users/{userId}` document, `role` must be `'employee'` unless the user is the verified bootstrapped admin (`loymedia7@gmail.com` with `email_verified == true`). Regular users can never update `role` on their own profile.
4. **Relational Integrity**: Every `/activities/{activityId}` and `/dailyReports/{reportId}` creation requires that the author has an existing `/users/$(request.auth.uid)` profile (`exists()`) and that `incoming().userId == request.auth.uid`.
5. **Query Enforcer (No Blanket List)**:
   - `/activities`: `allow list` requires `resource.data.userId == request.auth.uid || resource.data.managerId == request.auth.uid || isAdmin()`.
   - `/dailyReports`: `allow list` requires `resource.data.userId == request.auth.uid || resource.data.managerId == request.auth.uid || isAdmin()`.
   - `/userPrivate`: `allow list` is strictly `isAdmin()` or `resource.data.uid == request.auth.uid`.
6. **Terminal State Locking**: Once a `/dailyReports/{reportId}` document reaches `status == 'approved'`, non-admin users (both employees and managers) are blocked from modifying it further.
7. **Temporal Integrity**: All `createdAt` fields must equal `request.time` on creation and remain immutable on update (`incoming().createdAt == existing().createdAt`). All `updatedAt` fields must equal `request.time`.

## 2. The "Dirty Dozen" Payloads
1. **Privilege Escalation on Signup**: Non-admin user creates `/users/{uid}` with `role: "admin"` -> `PERMISSION_DENIED`.
2. **Role Self-Promotion on Update**: Employee updates `/users/{uid}` changing `role: "manager"` -> `PERMISSION_DENIED`.
3. **Shadow Field Injection**: Employee creates `/activities/{id}` with extra field `isVerified: true` -> `PERMISSION_DENIED`.
4. **PII Leak via Cross-User Get**: Authenticated user `user_B` attempts `get` on `/userPrivate/user_A` -> `PERMISSION_DENIED`.
5. **Identity Spoofing on Activity**: Authenticated user `user_A` creates `/activities/{id}` with `userId: "user_B"` -> `PERMISSION_DENIED`.
6. **Orphaned Activity Creation**: Authenticated user without a `/users/{uid}` profile attempts to create `/activities/{id}` -> `PERMISSION_DENIED`.
7. **Unbounded Photo Array Exhaustion**: User creates `/activities/{id}` with 10 photos (`photos.size() > 5`) -> `PERMISSION_DENIED`.
8. **Terminal State Reversal**: Employee or manager attempts to update `/dailyReports/{id}` after `status == "approved"` -> `PERMISSION_DENIED`.
9. **Unauthorized Report Approval**: Employee attempts to update their own `/dailyReports/{id}` with `status: "approved"` -> `PERMISSION_DENIED`.
10. **Cross-Team Manager Snooping**: Manager `mgr_1` attempts to `list` or `get` `/dailyReports/{id}` where `managerId == "mgr_2"` -> `PERMISSION_DENIED`.
11. **Timestamp Forgery**: Client sends a past or future `createdAt` timestamp (`createdAt != request.time`) -> `PERMISSION_DENIED`.
12. **Unverified Email Spoofing**: User with `email == "loymedia7@gmail.com"` but `email_verified == false` attempts admin action -> `PERMISSION_DENIED`.
