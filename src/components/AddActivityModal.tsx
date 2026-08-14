import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import {
  Lead,
  ActivityType,
  ActivityOutcome,
  ACTIVITY_GROUPS,
  ACTIVITY_OUTCOMES,
  followupTypeFromActivity,
  statusFromOutcome,
  shouldApplyStatus,
  LEAD_STATUS_META,
} from '../types';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { getLocalToday, getLocalNowTime } from '../utils/auditFormat';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface AddActivityModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
}

/** Convert "YYYY-MM-DD" + "2:35 PM" to an ISO timestamp (local time). */
function toIso(date: string, time: string): string {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((time || '').trim());
  let hour = parseInt(m?.[1] || '9', 10);
  const minute = parseInt(m?.[2] || '0', 10);
  const ap = (m?.[3] || 'AM').toUpperCase();
  if (ap === 'PM' && hour < 12) hour += 12;
  if (ap === 'AM' && hour === 12) hour = 0;
  const [y, mo, d] = date.split('-').map(Number);
  const dt = new Date(y, (mo || 1) - 1, d || 1, hour, minute || 0, 0, 0);
  return dt.toISOString();
}

const inputCls =
  'w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100';

export const AddActivityModal: React.FC<AddActivityModalProps> = ({ lead, isOpen, onClose }) => {
  const { addActivity } = useCRM();
  const { user } = useAuth();

  const [activityType, setActivityType] = useState<ActivityType>('Phone Call');
  const [date, setDate] = useState(getLocalToday());
  const [time, setTime] = useState(getLocalNowTime());
  const [outcome, setOutcome] = useState<ActivityOutcome | ''>('');
  const [notes, setNotes] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [nextTime, setNextTime] = useState('');

  useEscapeClose(onClose, !!(isOpen && lead));

  if (!isOpen || !lead) return null;

  const implied = statusFromOutcome(outcome || undefined, activityType, lead.status);
  const willApply = shouldApplyStatus(implied, lead.status);

  const reset = () => {
    setActivityType('Phone Call');
    setDate(getLocalToday());
    setTime(getLocalNowTime());
    setOutcome('');
    setNotes('');
    setNextDate('');
    setNextTime('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const author = user?.name || lead.assignedTo || 'User';
    const nextType = followupTypeFromActivity(activityType);

    addActivity(
      lead.id,
      {
        type: activityType,
        summary: activityType,
        details: notes.trim() || undefined,
        author,
        ...(outcome ? { outcome: outcome as ActivityOutcome } : {}),
      },
      {
        timestamp: toIso(date, time),
        status: willApply ? implied : null,
        scheduleFollowup: nextDate
          ? {
              date: nextDate,
              time: nextTime || getLocalNowTime(),
              type: nextType,
              note: notes.trim() || `Follow-up after ${activityType}`,
            }
          : undefined,
      }
    );

    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" />
              Add Activity
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lead.companyName} · {lead.contactPerson}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
          {/* Activity type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Activity Type
            </label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value as ActivityType)}
              className={inputCls}
            >
              {ACTIVITY_GROUPS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Time</label>
              <input type="text" value={time} onChange={(e) => setTime(e.target.value)} placeholder="2:30 PM" className={inputCls} />
            </div>
          </div>

          {/* Outcome */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Outcome</label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as ActivityOutcome | '')}
              className={inputCls}
            >
              <option value="">— Select outcome —</option>
              {ACTIVITY_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            {outcome && (
              <p className="text-[10px] text-slate-400 mt-1">
                {willApply && implied ? (
                  <>
                    Status will update to{' '}
                    <span className={`inline-block px-1.5 py-0.5 rounded font-bold ${LEAD_STATUS_META[implied].color}`}>
                      {LEAD_STATUS_META[implied].label}
                    </span>
                  </>
                ) : (
                  'Status will not change for this outcome.'
                )}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="What happened? e.g. Customer is interested in SEO and asked for pricing…"
              className={inputCls + ' resize-none'}
            />
          </div>

          {/* Next follow-up */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Next Follow-up (optional)</span>
              {nextDate && (
                <button
                  type="button"
                  onClick={() => {
                    setNextDate('');
                    setNextTime('');
                  }}
                  className="text-[10px] font-semibold text-rose-600 hover:text-rose-700"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className={inputCls} />
              <input type="text" value={nextTime} onChange={(e) => setNextTime(e.target.value)} placeholder="11:30 AM" className={inputCls} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Save Activity
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
