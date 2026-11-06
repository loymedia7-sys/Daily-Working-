import React, { useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { ActivityRecord, DailyReportRecord, UserProfile } from '../types';
import { generateDailyWorkPdf } from '../utils/generatePDF';

interface A4PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  workDate: string;
  activities: ActivityRecord[];
  report?: DailyReportRecord | null;
  summaryText?: string;
  workingHours?: number;
}

export const A4PreviewModal: React.FC<A4PreviewModalProps> = ({
  isOpen,
  onClose,
  profile,
  workDate,
  activities,
  report,
  summaryText,
  workingHours,
}) => {
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const totalPhotos = activities.reduce((sum, a) => sum + (a.photos?.length || 0), 0);
  const hoursVal = workingHours ?? report?.workingHours ?? 8;
  const finalSummary = summaryText ?? report?.summary ?? '';

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await generateDailyWorkPdf({
        profile,
        workDate,
        activities,
        report,
        summaryText: finalSummary,
        workingHours: hoursVal,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                A4 PDF Report Document Preview
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {profile.fullName} · {workDate} · {activities.length} Activities · {totalPhotos} Photos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Generating PDF...' : 'Download A4 PDF'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable A4 Sheet Container */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1">
          <div className="mx-auto max-w-[210mm] bg-white text-slate-900 shadow-lg border border-slate-200 p-6 sm:p-10 space-y-6">
            {/* A4 Document Banner */}
            <div className="rounded-xl bg-slate-900 text-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wider text-blue-400 uppercase">
                  {profile.companyName || 'DAILYWORK ENTERPRISE'}
                </p>
                <h1 className="text-xl font-bold tracking-tight mt-0.5">
                  DAILY WORK REPORT
                </h1>
                <p className="text-sm font-khmer text-blue-200 mt-0.5">
                  របាយការណ៍ការងារប្រចាំថ្ងៃ
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-sm font-mono font-semibold tabular-nums text-white">
                  {workDate}
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  Status: {(report?.status || 'draft').toUpperCase().replace('_', ' ')}
                </p>
              </div>
            </div>

            {/* Employee Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-y border-slate-200 py-4 text-xs">
              <div>
                <p className="text-slate-500 font-medium">EMPLOYEE</p>
                <p className="font-semibold text-slate-900 mt-0.5">{profile.fullName}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">POSITION</p>
                <p className="font-semibold text-slate-900 mt-0.5">{profile.position}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">DEPARTMENT</p>
                <p className="font-semibold text-slate-900 mt-0.5">{profile.department}</p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">MANAGER</p>
                <p className="font-semibold text-slate-900 mt-0.5">{profile.managerName || 'Assigned Manager'}</p>
              </div>
            </div>

            {/* Activities List */}
            <div className="space-y-5">
              {activities.length === 0 ? (
                <p className="text-sm text-slate-500 italic py-6 text-center">
                  No activities recorded for {workDate}.
                </p>
              ) : (
                activities.map((act, idx) => (
                  <div key={act.id} className="border-b border-slate-200 pb-5 last:border-b-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-900 font-khmer">
                        {String(idx + 1).padStart(2, '0')}. {act.title}
                      </h4>
                      <span className="text-xs font-mono tabular-nums text-slate-600">
                        {act.startTime}{act.endTime ? ` – ${act.endTime}` : ''} · {act.category} · {act.status === 'completed' ? 'Completed' : 'In Progress'}
                      </span>
                    </div>

                    {act.description && (
                      <p className="text-xs text-slate-700 mt-2 leading-relaxed font-khmer">
                        {act.description}
                      </p>
                    )}

                    {act.result && (
                      <p className="text-xs text-slate-900 font-medium mt-1.5 font-khmer">
                        Result: {act.result}
                      </p>
                    )}

                    {act.photos && act.photos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                        {act.photos.map((photo, pIdx) => (
                          <div
                            key={`${act.id}-p-${pIdx}`}
                            className="aspect-4/3 rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
                          >
                            <img
                              src={photo}
                              alt={`${act.title} photo ${pIdx + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Daily Summary */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-900">
                <span>Daily Summary</span>
                <span className="font-mono tabular-nums">
                  Total Activities: {activities.length} · Total Photos: {totalPhotos} · Working Hours: {hoursVal} hrs
                </span>
              </div>
              {finalSummary && (
                <p className="text-xs text-slate-700 font-khmer leading-relaxed">
                  {finalSummary}
                </p>
              )}
              {report?.managerComment && (
                <div className="pt-2 border-t border-slate-200 text-xs">
                  <span className="font-semibold text-blue-700">Manager Review Comment: </span>
                  <span className="text-slate-800 font-khmer">{report.managerComment}</span>
                </div>
              )}
            </div>

            {/* Signature Blocks */}
            <div className="grid grid-cols-2 gap-6 pt-4">
              <div className="border border-slate-300 rounded-xl p-4 h-24 flex flex-col justify-between">
                <p className="text-[11px] font-bold text-slate-500 uppercase">EMPLOYEE SIGNATURE</p>
                <p className="text-xs font-semibold text-slate-900">{profile.fullName}</p>
              </div>
              <div className="border border-slate-300 rounded-xl p-4 h-24 flex flex-col justify-between">
                <p className="text-[11px] font-bold text-slate-500 uppercase">MANAGER APPROVAL</p>
                <p className="text-xs font-semibold text-slate-900">
                  {profile.managerName || 'Assigned Manager'} ({(report?.status || 'draft').toUpperCase()})
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
