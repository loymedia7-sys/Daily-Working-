import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Download,
  Eye,
  Plus,
  RotateCcw,
  Shield,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ActivityRecord,
  DailyReportRecord,
  DepartmentRecord,
  UserProfile,
  UserRole,
} from '../types';
import { generateDailyWorkPdf } from '../utils/generatePDF';
import { A4PreviewModal } from './A4PreviewModal';

interface ManagerReviewViewProps {
  currentUser: UserProfile;
  teamReports: DailyReportRecord[];
  teamActivities: ActivityRecord[];
  teamUsers: UserProfile[];
  onReviewReport: (
    reportId: string,
    newStatus: 'approved' | 'revision_requested',
    comment: string
  ) => Promise<void>;
}

export const ManagerReviewView: React.FC<ManagerReviewViewProps> = ({
  currentUser,
  teamReports,
  teamActivities,
  teamUsers,
  onReviewReport,
}) => {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<DailyReportRecord | null>(
    teamReports[0] || null
  );
  const [commentText, setCommentText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const filteredReports = teamReports.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const activeReport =
    selectedReport && teamReports.some((r) => r.id === selectedReport.id)
      ? teamReports.find((r) => r.id === selectedReport.id) || null
      : filteredReports[0] || null;

  const reportActivities = activeReport
    ? teamActivities
        .filter(
          (a) => a.userId === activeReport.userId && a.workDate === activeReport.workDate
        )
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
    : [];

  const reportEmployeeProfile: UserProfile = activeReport
    ? teamUsers.find((u) => u.uid === activeReport.userId) || {
        uid: activeReport.userId,
        fullName: activeReport.userName,
        photoURL: '',
        position: activeReport.userPosition,
        department: activeReport.userDepartment,
        role: 'employee',
        managerId: activeReport.managerId,
        managerName: activeReport.managerName,
        language: currentUser.language,
        companyName: currentUser.companyName,
      }
    : currentUser;

  const handleAction = async (decision: 'approved' | 'revision_requested') => {
    if (!activeReport) return;
    setSubmittingReview(true);
    try {
      await onReviewReport(
        activeReport.id,
        decision,
        commentText.trim() || activeReport.managerComment || ''
      );
      setCommentText('');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!activeReport) return;
    await generateDailyWorkPdf({
      profile: reportEmployeeProfile,
      workDate: activeReport.workDate,
      activities: reportActivities,
      report: activeReport,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-khmer">
            {t('manager.title')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('manager.subtitle')}
          </p>
        </div>

        {/* Interactive Segmented Filter Controls */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          {[
            { id: 'all', label: t('manager.allReports') },
            { id: 'submitted', label: t('manager.pendingReview') },
            { id: 'approved', label: t('manager.approved') },
            { id: 'revision_requested', label: t('manager.revisionRequested') },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Columns: Team Reports Queue */}
        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Employee Reports ({filteredReports.length})
          </h3>
          {filteredReports.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
              {t('manager.noReportsFound')}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredReports.map((rep) => (
                <button
                  key={rep.id}
                  type="button"
                  onClick={() => {
                    setSelectedReport(rep);
                    setCommentText(rep.managerComment || '');
                  }}
                  className={`w-full text-left p-3.5 rounded-xl transition-colors flex items-center justify-between gap-3 ${
                    activeReport?.id === rep.id
                      ? 'bg-blue-50/80 dark:bg-blue-950/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate font-khmer">
                      {rep.userName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {rep.userPosition} · {rep.userDepartment}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 mt-1">
                      {rep.workDate} · {rep.totalActivities} Acts · {rep.totalPhotos} Photos
                    </p>
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 shrink-0">
                    {t(`report.status.${rep.status}`)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right 7 Columns: Selected Report Details & Approval Actions */}
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
          {!activeReport ? (
            <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
              Select a report from the list to inspect activities, photos, and approve.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-khmer">
                    {activeReport.userName} — {activeReport.workDate}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {activeReport.userPosition} · {activeReport.userDepartment} ·{' '}
                    {activeReport.workingHours} hrs · Status:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {t(`report.status.${activeReport.status}`)}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]"
                  >
                    <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Preview A4</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 min-h-[40px]"
                  >
                    <Download className="w-4 h-4" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>

              {activeReport.summary && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    Employee Daily Summary
                  </p>
                  <p className="text-sm text-slate-800 dark:text-slate-200 mt-1 font-khmer">
                    {activeReport.summary}
                  </p>
                </div>
              )}

              {/* Activities & Photo Evidence */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Recorded Activities ({reportActivities.length})
                </h4>
                {reportActivities.map((act, idx) => (
                  <div
                    key={act.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white font-khmer">
                        {String(idx + 1).padStart(2, '0')}. {act.title}
                      </p>
                      <span className="text-xs font-mono tabular-nums text-slate-500">
                        {act.startTime}
                        {act.endTime ? ` – ${act.endTime}` : ''} · {act.category}
                      </span>
                    </div>
                    {act.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-khmer">
                        {act.description}
                      </p>
                    )}
                    {act.result && (
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 font-khmer">
                        Result: {act.result}
                      </p>
                    )}
                    {act.photos && act.photos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                        {act.photos.map((photo, pIdx) => (
                          <img
                            key={pIdx}
                            src={photo}
                            alt={`${act.title} evidence ${pIdx + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-full aspect-4/3 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Manager Approval / Revision Controls (Unlocked when not yet approved, or if Admin) */}
              {(activeReport.status !== 'approved' || currentUser.role === 'admin') && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('report.managerFeedback')}
                  </label>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={t('manager.commentPlaceholder')}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-khmer"
                  />
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={submittingReview}
                      onClick={() => handleAction('revision_requested')}
                      className="flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors min-h-[44px]"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>{t('manager.requestRevisionBtn')}</span>
                    </button>
                    <button
                      type="button"
                      disabled={submittingReview}
                      onClick={() => handleAction('approved')}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors min-h-[44px]"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t('manager.approveBtn')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {activeReport && (
        <A4PreviewModal
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          profile={reportEmployeeProfile}
          workDate={activeReport.workDate}
          activities={reportActivities}
          report={activeReport}
        />
      )}
    </div>
  );
};

interface AdminManagementViewProps {
  allUsers: UserProfile[];
  departments: DepartmentRecord[];
  onUpdateUserRoleAndManager: (
    targetUser: UserProfile,
    newRole: UserRole,
    managerId: string,
    managerName: string,
    department: string
  ) => Promise<void>;
  onCreateDepartment: (payload: {
    name: string;
    nameKm: string;
    managerId: string;
    managerName: string;
  }) => Promise<void>;
  onDeleteDepartment: (deptId: string) => Promise<void>;
}

export const AdminManagementView: React.FC<AdminManagementViewProps> = ({
  allUsers,
  departments,
  onUpdateUserRoleAndManager,
  onCreateDepartment,
  onDeleteDepartment,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'users' | 'departments'>('users');
  const [deptName, setDeptName] = useState('');
  const [deptNameKm, setDeptNameKm] = useState('');
  const [deptManagerId, setDeptManagerId] = useState('');
  const [creatingDept, setCreatingDept] = useState(false);

  const managers = allUsers.filter((u) => u.role === 'manager' || u.role === 'admin');

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) return;
    setCreatingDept(true);
    try {
      const mgr = allUsers.find((u) => u.uid === deptManagerId);
      await onCreateDepartment({
        name: deptName.trim(),
        nameKm: deptNameKm.trim() || deptName.trim(),
        managerId: mgr?.uid || '',
        managerName: mgr?.fullName || '',
      });
      setDeptName('');
      setDeptNameKm('');
      setDeptManagerId('');
    } finally {
      setCreatingDept(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-khmer">
            {t('admin.title')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('admin.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'users'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{t('admin.usersTab')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('departments')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'departments'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{t('admin.departmentsTab')}</span>
          </button>
        </div>
      </div>

      {activeTab === 'users' ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                  <th className="py-3.5 px-4">Employee</th>
                  <th className="py-3.5 px-4">Position & Department</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Assigned Manager</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {allUsers.map((user) => (
                  <tr
                    key={user.uid}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white font-khmer">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {user.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p>{user.fullName}</p>
                          <p className="text-[11px] font-mono text-slate-400">
                            {user.companyName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-khmer">
                      {user.position} · {user.department}
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          onUpdateUserRoleAndManager(
                            user,
                            e.target.value as UserRole,
                            user.managerId,
                            user.managerName,
                            user.department
                          )
                        }
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:text-white"
                      >
                        <option value="employee">{t('admin.roleEmployee')}</option>
                        <option value="manager">{t('admin.roleManager')}</option>
                        <option value="admin">{t('admin.roleAdmin')}</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={user.managerId}
                        onChange={(e) => {
                          const selectedMgr = allUsers.find((m) => m.uid === e.target.value);
                          onUpdateUserRoleAndManager(
                            user,
                            user.role,
                            selectedMgr?.uid || '',
                            selectedMgr?.fullName || '',
                            user.department
                          );
                        }}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="">— Unassigned —</option>
                        {managers.map((m) => (
                          <option key={m.uid} value={m.uid}>
                            {m.fullName} ({m.role})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" />
              <span>{t('admin.addDepartment')}</span>
            </h3>
            <form onSubmit={handleAddDept} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('admin.deptNameEn')} *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Marketing & Design"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('admin.deptNameKm')}
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={deptNameKm}
                  onChange={(e) => setDeptNameKm(e.target.value)}
                  placeholder="ឧ. ផ្នែកទីផ្សារ និងរចនា"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white font-khmer"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('admin.assignManager')}
                </label>
                <select
                  value={deptManagerId}
                  onChange={(e) => setDeptManagerId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="">— Optional Default Manager —</option>
                  {managers.map((m) => (
                    <option key={m.uid} value={m.uid}>
                      {m.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={creatingDept || !deptName.trim()}
                className="w-full rounded-xl bg-slate-900 dark:bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors min-h-[44px]"
              >
                {creatingDept ? 'Saving...' : t('admin.addDepartment')}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span>Active Departments ({departments.length})</span>
            </h3>
            {departments.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No custom departments created yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {departments.map((d) => (
                  <div
                    key={d.id}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white font-khmer">
                        {d.name} {d.nameKm && d.nameKm !== d.name ? `· ${d.nameKm}` : ''}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Default Manager: {d.managerName || 'None'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteDepartment(d.id)}
                      className="text-xs font-medium text-red-600 hover:underline px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
