import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Send,
  AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ActivityRecord,
  DailyReportRecord,
  ReportStatus,
  UserProfile,
} from '../types';
import { generateDailyWorkPdf } from '../utils/generatePDF';
import { A4PreviewModal } from './A4PreviewModal';

interface DailyReportsViewProps {
  profile: UserProfile;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  allMyActivities: ActivityRecord[];
  allMyReports: DailyReportRecord[];
  onSaveOrSubmitReport: (payload: {
    workDate: string;
    summary: string;
    workingHours: number;
    status: ReportStatus;
    activityIds: string[];
    totalActivities: number;
    totalPhotos: number;
  }) => Promise<void>;
}

export const DailyReportsView: React.FC<DailyReportsViewProps> = ({
  profile,
  selectedDate,
  onSelectDate,
  allMyActivities,
  allMyReports,
  onSaveOrSubmitReport,
}) => {
  const { t } = useTranslation();

  const dateActivities = allMyActivities
    .filter((a) => a.workDate === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const currentReport = allMyReports.find((r) => r.workDate === selectedDate) || null;
  const totalPhotos = dateActivities.reduce((sum, a) => sum + (a.photos?.length || 0), 0);

  const [summary, setSummary] = useState(currentReport?.summary || '');
  const [workingHours, setWorkingHours] = useState<number>(
    currentReport?.workingHours ?? 8
  );
  const [savingStatus, setSavingStatus] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [monthFilter, setMonthFilter] = useState(selectedDate.slice(0, 7));

  useEffect(() => {
    setSummary(currentReport?.summary || '');
    setWorkingHours(currentReport?.workingHours ?? 8);
  }, [selectedDate, currentReport?.id, currentReport?.summary, currentReport?.workingHours]);

  const isLocked = currentReport?.status === 'approved';

  const handleSave = async (targetStatus: ReportStatus) => {
    setSavingStatus(true);
    try {
      await onSaveOrSubmitReport({
        workDate: selectedDate,
        summary: summary.trim(),
        workingHours: Math.min(24, Math.max(0, Number(workingHours) || 8)),
        status: targetStatus,
        activityIds: dateActivities.map((a) => a.id),
        totalActivities: dateActivities.length,
        totalPhotos,
      });
    } finally {
      setSavingStatus(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await generateDailyWorkPdf({
        profile,
        workDate: selectedDate,
        activities: dateActivities,
        report: currentReport,
        summaryText: summary,
        workingHours,
      });
    } finally {
      setExportingPdf(false);
    }
  };

  // Monthly statistics
  const monthActivities = allMyActivities.filter((a) =>
    a.workDate.startsWith(monthFilter)
  );
  const monthPhotos = monthActivities.reduce((sum, a) => sum + (a.photos?.length || 0), 0);
  const monthReports = allMyReports.filter((r) => r.workDate.startsWith(monthFilter));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 7 Columns: Current Date Report Builder & PDF Export */}
      <div className="lg:col-span-7 space-y-6">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-khmer">
                {t('report.title')}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span className="font-mono tabular-nums">{selectedDate}</span>
                <span aria-hidden="true">·</span>
                <span>{dateActivities.length} Activities</span>
                <span aria-hidden="true">·</span>
                <span>{totalPhotos} Photos</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t(`report.status.${currentReport?.status || 'not_started'}`)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onSelectDate(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Manager Feedback Alert if present */}
          {currentReport?.managerComment && (
            <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {t('report.managerFeedback')} ({currentReport.managerName || profile.managerName})
                </span>
              </div>
              <p className="mt-1.5 text-sm text-slate-800 dark:text-slate-200 font-khmer">
                {currentReport.managerComment}
              </p>
            </div>
          )}

          {/* Primary PDF Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-h-[44px]"
            >
              <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{t('report.previewPdf')}</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              <span>{exportingPdf ? 'Generating PDF...' : t('report.generatePdf')}</span>
            </button>
          </div>

          {/* Summary & Working Hours Form */}
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('report.summaryLabel')}
                </label>
                <textarea
                  rows={3}
                  disabled={isLocked}
                  maxLength={2000}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder={t('report.summaryPlaceholder')}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-600 font-khmer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('report.workingHours')}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={24}
                  disabled={isLocked}
                  value={workingHours}
                  onChange={(e) => setWorkingHours(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 dark:text-white disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                  Manager: {profile.managerName || 'Assigned by Admin'}
                </p>
              </div>
            </div>

            {!isLocked && (
              <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={savingStatus}
                  onClick={() => handleSave('draft')}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
                >
                  {t('report.saveDraftReport')}
                </button>
                <button
                  type="button"
                  disabled={savingStatus || dateActivities.length === 0}
                  onClick={() => handleSave('submitted')}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 transition-colors min-h-[44px]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {currentReport?.status === 'revision_requested'
                      ? t('report.resubmitReport')
                      : t('report.submitReport')}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Included Activities & Attached Photos List */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Included Activities ({dateActivities.length})
            </h3>
            {dateActivities.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4">
                {t('dashboard.noActivitiesToday')}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {dateActivities.map((act, index) => (
                  <div key={act.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white font-khmer">
                        {String(index + 1).padStart(2, '0')}. {act.title}
                      </p>
                      <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                        {act.startTime}
                        {act.endTime ? ` – ${act.endTime}` : ''}
                      </span>
                    </div>
                    {act.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-khmer">
                        {act.description}
                      </p>
                    )}
                    {act.photos && act.photos.length > 0 && (
                      <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-1">
                        {act.photos.map((photoUrl, pIdx) => (
                          <img
                            key={pIdx}
                            src={photoUrl}
                            alt={`${act.title} photo ${pIdx + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-16 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
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

      {/* Right 5 Columns: Report History & Monthly Overview */}
      <div className="lg:col-span-5 space-y-6">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-khmer">
              {t('nav.history')}
            </h3>
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
            />
          </div>

          {/* Monthly Stat Strip */}
          <div className="grid grid-cols-3 gap-3 my-4">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Reports</p>
              <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {monthReports.length}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Activities</p>
              <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {monthActivities.length}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Photos</p>
              <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {monthPhotos}
              </p>
            </div>
          </div>

          {/* Historical Reports List */}
          {allMyReports.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
              No daily reports saved yet. Select a date and click Save or Submit.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {allMyReports.map((rep) => (
                <button
                  key={rep.id}
                  type="button"
                  onClick={() => onSelectDate(rep.workDate)}
                  className={`w-full text-left py-3.5 px-3 rounded-xl transition-colors flex items-center justify-between gap-3 ${
                    rep.workDate === selectedDate
                      ? 'bg-blue-50/70 dark:bg-blue-950/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
                        {rep.workDate}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {rep.totalActivities} Activities · {rep.totalPhotos} Photos · {rep.workingHours}h
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-medium shrink-0">
                    {rep.status === 'approved' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-600" />
                    )}
                    <span className="text-slate-700 dark:text-slate-200">
                      {t(`report.status.${rep.status}`)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <A4PreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        profile={profile}
        workDate={selectedDate}
        activities={dateActivities}
        report={currentReport}
        summaryText={summary}
        workingHours={workingHours}
      />
    </div>
  );
};
