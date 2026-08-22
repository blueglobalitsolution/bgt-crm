import React, { useState } from 'react';
import { X, Loader2, Image as ImageIcon, MapPin, Check, AlertTriangle } from 'lucide-react';
import { ExtractedBusinessInfo } from '../types';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { externalHref } from '../utils/url';

interface BusinessIntelConfirmModalProps {
  isOpen: boolean;
  loading: boolean;
  error: string | null;
  data: ExtractedBusinessInfo | null;
  source: 'image' | 'gmb';
  onCancel: () => void;
  onApply: (data: ExtractedBusinessInfo) => void;
}

const fieldLabels: { key: keyof ExtractedBusinessInfo; label: string }[] = [
  { key: 'companyName', label: 'Business Name' },
  { key: 'contactPerson', label: 'Contact Person' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Website' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'industry', label: 'Industry' },
  { key: 'rating', label: 'Rating' },
  { key: 'reviewCount', label: 'Review Count' },
];

export const BusinessIntelConfirmModal: React.FC<BusinessIntelConfirmModalProps> = ({
  isOpen,
  loading,
  error,
  data,
  source,
  onCancel,
  onApply,
}) => {
  const [draft, setDraft] = useState<Partial<ExtractedBusinessInfo>>({});

  useEscapeClose(onCancel, isOpen && !loading);

  React.useEffect(() => {
    if (data) setDraft({ ...data });
  }, [data]);

  if (!isOpen) return null;

  const set = (key: keyof ExtractedBusinessInfo, value: string) => {
    setDraft((d) => ({
      ...d,
      [key]: key === 'rating' || key === 'reviewCount' ? (value === '' ? undefined : Number(value)) : value,
    }));
  };

  const rating = typeof draft.rating === 'number' ? draft.rating.toFixed(1) : '';
  const reviewCount = draft.reviewCount != null ? String(draft.reviewCount) : '';

  const renderInputs = () => {
    const fields = fieldLabels
      .map((f) => ({ ...f, value: draft[f.key] as string | undefined }))
      .filter((f) => f.value !== undefined && f.value !== '');

    if (fields.length === 0) {
      return (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>No usable business details were extracted. You can still add this lead manually.</span>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[45vh] overflow-y-auto pr-1">
        {fields.map((f) => (
          <div key={f.key} className={f.key === 'address' || f.key === 'companyName' ? 'sm:col-span-2' : ''}>
            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              {f.label}
            </label>
            <input
              value={f.value || ''}
              onChange={(e) => set(f.key, e.target.value)}
              type={f.key === 'rating' || f.key === 'reviewCount' ? 'number' : 'text'}
              step={f.key === 'rating' ? '0.1' : undefined}
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm bg-blue-600">
              {source === 'image' ? <ImageIcon className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                {source === 'image' ? 'Extract from Image' : 'Import from Google Maps'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review the detected business details before adding
                {data?.confidence != null && ` · ${data.confidence}% confidence`}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {source === 'image' ? 'Analyzing image…' : 'Looking up business on Google Maps…'}
              </p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : data ? (
            <>
              {data.duplicates && data.duplicates.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300 mb-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Possible duplicate {data.duplicates.length > 1 ? 'leads' : 'lead'} found
                  </div>
                  <div className="space-y-1.5">
                    {data.duplicates.map((d) => (
                      <div key={d.id} className="text-[11px] text-amber-800 dark:text-amber-200 bg-white/60 dark:bg-slate-900/60 rounded-lg px-2.5 py-1.5 border border-amber-200 dark:border-amber-900">
                        <span className="font-semibold">{d.companyName || '—'}</span>
                        {d.status && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50">{d.status}</span>}
                        <div className="text-[10px] text-amber-700/80 dark:text-amber-300/70">
                          {d.contactPerson ? `${d.contactPerson} · ` : ''}
                          {d.mobile ? `${d.mobile}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[10px] text-amber-700/80 dark:text-amber-300/70">
                    This business may already exist as a lead. Apply and review, or cancel to avoid a duplicate.
                  </p>
                </div>
              )}
              {renderInputs()}

              {(draft.socialMediaLinks && draft.socialMediaLinks.length > 0) || (draft.services && draft.services.length > 0) ? (
                <div className="space-y-3">
                  {draft.socialMediaLinks && draft.socialMediaLinks.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        Social Media
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {draft.socialMediaLinks.map((s) => (
                          <a
                            key={s}
                            href={externalHref(s)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100"
                          >
                            {s.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 30)} ↗
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {draft.services && draft.services.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        Services / Products ({draft.services.length})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {draft.services.map((s) => (
                          <span key={s} className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Ready to import.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          {data && !loading && (
            <span className="mr-auto text-[10px] text-slate-400">
              {rating ? `★ ${rating}` : ''}
              {reviewCount ? ` (${reviewCount} reviews)` : ''}
            </span>
          )}
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={() => onApply(draft as ExtractedBusinessInfo)}
            disabled={loading || !data}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow-sm transition-all disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply to Form</span>
          </button>
        </div>
      </div>
    </div>
  );
};
