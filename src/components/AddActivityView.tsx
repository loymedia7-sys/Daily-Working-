import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  Image as ImageIcon,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ACTIVITY_CATEGORIES,
  ActivityRecord,
  ActivityStatus,
  DEFAULT_TEMPLATES,
} from '../types';
import { compressImageFile, uploadActivityPhoto } from '../services/cloudinaryService';
import { CameraModal } from './CameraModal';

interface AddActivityViewProps {
  userId: string;
  selectedDate: string;
  editingActivity: ActivityRecord | null;
  onSave: (payload: {
    title: string;
    category: string;
    workDate: string;
    startTime: string;
    endTime: string;
    status: ActivityStatus;
    description: string;
    result: string;
    photos: string[];
  }) => Promise<void>;
  onCancel: () => void;
}

const DRAFT_STORAGE_KEY = 'dailywork_activity_draft_v1';

export const AddActivityView: React.FC<AddActivityViewProps> = ({
  userId,
  selectedDate,
  editingActivity,
  onSave,
  onCancel,
}) => {
  const { t, i18n } = useTranslation();
  const nowTimeStr = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const [title, setTitle] = useState(editingActivity?.title || '');
  const [category, setCategory] = useState<string>(
    editingActivity?.category || ACTIVITY_CATEGORIES[0]
  );
  const [workDate, setWorkDate] = useState(editingActivity?.workDate || selectedDate);
  const [startTime, setStartTime] = useState(editingActivity?.startTime || nowTimeStr());
  const [endTime, setEndTime] = useState(editingActivity?.endTime || '');
  const [status, setStatus] = useState<ActivityStatus>(
    editingActivity?.status || 'completed'
  );
  const [description, setDescription] = useState(editingActivity?.description || '');
  const [result, setResult] = useState(editingActivity?.result || '');
  const [photos, setPhotos] = useState<string[]>(editingActivity?.photos || []);
  const [draftRestored, setDraftRestored] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Restore unsaved local draft when creating a new activity
  useEffect(() => {
    if (editingActivity) return;
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.title || parsed.description || (parsed.photos && parsed.photos.length > 0)) {
          setTitle(parsed.title || '');
          setCategory(parsed.category || ACTIVITY_CATEGORIES[0]);
          setWorkDate(parsed.workDate || selectedDate);
          setStartTime(parsed.startTime || nowTimeStr());
          setEndTime(parsed.endTime || '');
          setStatus(parsed.status || 'completed');
          setDescription(parsed.description || '');
          setResult(parsed.result || '');
          setPhotos(Array.isArray(parsed.photos) ? parsed.photos.slice(0, 5) : []);
          setDraftRestored(true);
        }
      }
    } catch {
      // Ignore draft parse error
    }
  }, [editingActivity, selectedDate]);

  // Auto-save draft to localStorage while working
  useEffect(() => {
    if (editingActivity) return;
    try {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          title,
          category,
          workDate,
          startTime,
          endTime,
          status,
          description,
          result,
          photos,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }, [title, category, workDate, startTime, endTime, status, description, result, photos, editingActivity]);

  const handleClearDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setTitle('');
    setDescription('');
    setResult('');
    setPhotos([]);
    setDraftRestored(false);
  };

  const handleApplyTemplate = (tplId: string) => {
    const tpl = DEFAULT_TEMPLATES.find((item) => item.id === tplId);
    if (!tpl) return;
    setTitle(tpl.title);
    setCategory(tpl.category);
    setDescription(tpl.description);
    setResult(tpl.result);
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingPhoto(true);
    try {
      for (const file of files) {
        if (photos.length >= 5) break;
        const compressed = await compressImageFile(file);
        const uploaded = await uploadActivityPhoto(compressed, userId, workDate);
        setPhotos((prev) => (prev.length < 5 ? [...prev, uploaded.url] : prev));
      }
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleCameraCapture = async (dataUrl: string) => {
    setUploadingPhoto(true);
    try {
      const uploaded = await uploadActivityPhoto(dataUrl, userId, workDate);
      setPhotos((prev) => (prev.length < 5 ? [...prev, uploaded.url] : prev));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        category,
        workDate,
        startTime: startTime || nowTimeStr(),
        endTime: endTime.trim(),
        status,
        description: description.trim(),
        result: result.trim(),
        photos,
      });
      if (!editingActivity) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-khmer">
              {editingActivity ? t('activity.formTitleEdit') : t('activity.formTitleNew')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {workDate} · {photos.length}/5 Photos Attached
            </p>
          </div>

          {draftRestored && !editingActivity && (
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span>{t('activity.draftRecovered')}</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={handleClearDraft}
                className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('activity.clearDraft')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Quick Activity Templates Bar */}
        {!editingActivity && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>{t('activity.templates')}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleApplyTemplate(tpl.id)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-khmer"
                >
                  {i18n.language === 'km' ? tpl.labelKm : tpl.labelEn}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Photo Evidence Capture Zone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              {t('activity.photos')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                disabled={photos.length >= 5 || uploadingPhoto}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors min-h-[48px]"
              >
                <Camera className="w-4 h-4 shrink-0" />
                <span>{t('activity.takePhoto')}</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photos.length >= 5 || uploadingPhoto}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors min-h-[48px]"
              >
                <ImageIcon className="w-4 h-4 shrink-0" />
                <span>{uploadingPhoto ? 'Processing...' : t('activity.chooseGallery')}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
                {photos.map((photoUrl, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                  >
                    <img
                      src={photoUrl}
                      alt={`Activity evidence ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/75 text-white hover:bg-red-600 transition-colors"
                      title={t('activity.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('activity.title')} *
              </label>
              <input
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('activity.titlePlaceholder')}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-khmer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('activity.category')}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-khmer"
              >
                {ACTIVITY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`activity.categories.${cat}`, cat)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date, Start Time, End Time, Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('activity.workDate')}
              </label>
              <input
                type="date"
                required
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('activity.startTime')}
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('activity.endTime')}
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('activity.status')}
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setStatus('in_progress')}
                  className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
                    status === 'in_progress'
                      ? 'bg-white dark:bg-slate-900 text-amber-600 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Clock className="w-3 h-3 shrink-0" />
                  <span className="truncate">{t('activity.statusInProgress')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('completed')}
                  className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
                    status === 'completed'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{t('activity.statusCompleted')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Work Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('activity.description')}
            </label>
            <textarea
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('activity.descriptionPlaceholder')}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-khmer"
            />
          </div>

          {/* Work Result */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('activity.result')}
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder={t('activity.resultPlaceholder')}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-khmer"
            />
          </div>

          {/* Submit & Cancel Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
            >
              {t('activity.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || uploadingPhoto || !title.trim()}
              className="rounded-xl bg-slate-900 dark:bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 transition-colors min-h-[44px]"
            >
              {saving ? t('activity.saving') : t('activity.saveActivity')}
            </button>
          </div>
        </form>
      </div>

      <CameraModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};
