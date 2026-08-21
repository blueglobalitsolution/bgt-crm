import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ContactPerson } from '../types';

const inputCls =
  'w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100';
const labelCls = 'block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1';

interface ContactsEditorProps {
  contacts: ContactPerson[];
  onChange: (contacts: ContactPerson[]) => void;
}

let seq = 0;
const newContact = (): ContactPerson => ({
  id: `contact-${Date.now().toString(36)}-${(seq++).toString(36)}`,
  name: '',
  isPrimary: false,
});

export const ContactsEditor: React.FC<ContactsEditorProps> = ({ contacts, onChange }) => {
  const setOne = (id: string, patch: Partial<ContactPerson>) =>
    onChange(contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const setPrimary = (id: string) =>
    onChange(contacts.map((c) => ({ ...c, isPrimary: c.id === id })));

  const remove = (id: string) => {
    const next = contacts.filter((c) => c.id !== id);
    if (next.length > 0 && !next.some((c) => c.isPrimary)) next[0].isPrimary = true;
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-400">Add every person at the business who may be contacted.</p>
        <button
          type="button"
          onClick={() => {
            const next = [...contacts, newContact()];
            if (next.length === 1) next[0].isPrimary = true;
            onChange(next);
          }}
          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add Contact
        </button>
      </div>

      {contacts.length === 0 && (
        <p className="text-[11px] text-slate-400 italic">No contacts added yet.</p>
      )}

      {contacts.map((c) => (
        <div
          key={c.id}
          className={`bg-slate-50 dark:bg-slate-800/50 border rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-6 gap-2 ${
            c.isPrimary ? 'border-blue-300 dark:border-blue-800 ring-1 ring-blue-200 dark:ring-blue-900/50' : 'border-slate-200 dark:border-slate-700'
          }`}
        >
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={c.name} onChange={(e) => setOne(c.id, { name: e.target.value })} placeholder="Full name" />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <input className={inputCls} value={c.role || ''} onChange={(e) => setOne(c.id, { role: e.target.value })} placeholder="Owner / Manager" />
          </div>
          <div>
            <label className={labelCls}>Mobile</label>
            <input className={inputCls} value={c.mobile || ''} onChange={(e) => setOne(c.id, { mobile: e.target.value })} placeholder="9876543210" />
          </div>
          <div>
            <label className={labelCls}>WhatsApp</label>
            <input className={inputCls} value={c.whatsapp || ''} onChange={(e) => setOne(c.id, { whatsapp: e.target.value })} placeholder="WhatsApp no." />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input className={inputCls} value={c.email || ''} onChange={(e) => setOne(c.id, { email: e.target.value })} placeholder="email@domain.com" />
          </div>
          <div className="flex items-end justify-between gap-1">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="radio"
                name={`primary-contact-${c.id}`}
                checked={c.isPrimary}
                onChange={() => setPrimary(c.id)}
                className="accent-blue-600"
              />
              Primary
            </label>
            <button
              type="button"
              onClick={() => remove(c.id)}
              className="p-1.5 text-slate-400 hover:text-rose-600"
              title="Remove contact"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
