import React, { useEffect, useState } from 'react';
import { X, Loader2, UserRound, Briefcase, Plus, Trash2 } from 'lucide-react';
import { Lead, Client, DIGITAL_MARKETING_SERVICES, SUBSCRIPTION_TYPES } from '../types';
import { auditApi } from '../utils/auditApi';
import { useAuth } from '../context/AuthContext';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface SubDraft {
  key: string;
  id?: string;
  service: string;
  billingType: string;
  amount: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface ClientFormModalProps {
  isOpen: boolean;
  lead?: Lead | null; // when converting a lead
  client?: Client | null; // when editing an existing client
  onClose: () => void;
  onSaved: () => void;
}

const inputCls =
  'w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100';

let subKeySeq = 0;
const newSubKey = () => `sub-${Date.now()}-${subKeySeq++}`;

export const ClientFormModal: React.FC<ClientFormModalProps> = ({ isOpen, lead, client, onClose, onSaved }) => {
  const { users } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeClose(onClose, isOpen);

  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [monthlyRetainer, setMonthlyRetainer] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [accountManager, setAccountManager] = useState('');
  const [agreementStatus, setAgreementStatus] = useState('Active');
  const [notes, setNotes] = useState('');
  const [subscriptions, setSubscriptions] = useState<SubDraft[]>([]);

  const emptySub = (): SubDraft => ({
    key: newSubKey(),
    service: 'Social Media Marketing',
    billingType: 'Monthly',
    amount: '',
    startDate: '',
    endDate: '',
    status: 'Active',
  });

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    const src = client || lead;
    if (src) {
      setCompanyName(client?.companyName || lead?.companyName || '');
      setContactPerson(client?.contactPerson || lead?.contactPerson || '');
      setMobile(client?.mobile || lead?.mobile || '');
      setEmail(client?.email || lead?.email || '');
      setWebsite(client?.website || lead?.website || '');
      setContractValue(client ? String(client.contractValue || '') : lead?.expectedValue ? String(lead.expectedValue) : '');
      setMonthlyRetainer(client ? String(client.monthlyRetainer || '') : '');
      setStartDate(client?.startDate || (lead?.updatedAt ? lead.updatedAt.slice(0, 10) : ''));
      setEndDate(client?.endDate || '');
      setServices(client?.services || (lead?.interestedServices as string[]) || []);
      setAccountManager(client?.accountManager || lead?.assignedTo || '');
      setAgreementStatus(client?.agreementStatus || 'Active');
      setNotes(client?.notes || '');
      setSubscriptions(
        (client?.subscriptions || []).map((s) => ({
          key: newSubKey(),
          id: s.id,
          service: s.service,
          billingType: s.billingType,
          amount: String(s.amount || ''),
          startDate: s.startDate || '',
          endDate: s.endDate || '',
          status: s.status || 'Active',
        }))
      );
    } else {
      setCompanyName('');
      setContactPerson('');
      setMobile('');
      setEmail('');
      setWebsite('');
      setContractValue('');
      setMonthlyRetainer('');
      setStartDate('');
      setEndDate('');
      setServices([]);
      setAccountManager('');
      setAgreementStatus('Active');
      setNotes('');
      setSubscriptions([emptySub()]);
    }
  }, [isOpen, lead, client]);

  if (!isOpen) return null;

  const updateSub = (key: string, patch: Partial<SubDraft>) => {
    setSubscriptions((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  const removeSub = (key: string) => {
    setSubscriptions((prev) => prev.filter((s) => s.key !== key));
  };

  const toggleService = (srv: string) => {
    setServices((prev) => (prev.includes(srv) ? prev.filter((s) => s !== srv) : [...prev, srv]));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError('Company name is required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload: Partial<Client> = {
        companyName: companyName.trim(),
        contactPerson: contactPerson.trim() || undefined,
        mobile: mobile.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        contractValue: Number(contractValue) || 0,
        monthlyRetainer: Number(monthlyRetainer) || 0,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        services,
        accountManager: accountManager || undefined,
        agreementStatus,
        notes: notes.trim() || undefined,
      };
      let savedClientId: string | null = null;
      if (client) {
        await auditApi.updateClient(client.id, { ...client, ...payload } as Client);
        savedClientId = client.id;
      } else if (lead) {
        const conv = await auditApi.convertLeadToClient(lead.id, payload);
        savedClientId = conv.client.id;
      }

      // Sync subscriptions (create new, update existing, delete removed)
      if (savedClientId) {
        const draftIds = subscriptions.map((s) => s.id).filter((id): id is string => Boolean(id));
        for (const sub of client?.subscriptions || []) {
          if (!draftIds.includes(sub.id)) await auditApi.deleteSubscription(sub.id);
        }
        for (const row of subscriptions) {
          const subPayload = {
            service: row.service,
            billingType: row.billingType,
            amount: Number(row.amount) || 0,
            startDate: row.startDate || undefined,
            endDate: row.endDate || undefined,
            status: row.status || 'Active',
          };
          if (row.id) await auditApi.updateSubscription(row.id, subPayload);
          else await auditApi.createSubscription({ clientId: savedClientId, ...subPayload });
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save client');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                {client ? 'Edit Client' : 'Convert to Client'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lead ? `Converting "${lead.companyName}" into an active client` : client?.companyName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Company Name *</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Contact Person</label>
              <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Mobile</label>
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Website</label>
              <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Contract Value (₹)</label>
              <input type="number" min={0} value={contractValue} onChange={(e) => setContractValue(e.target.value)} className={inputCls} placeholder="e.g. 180000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Monthly Retainer (₹)</label>
              <input type="number" min={0} value={monthlyRetainer} onChange={(e) => setMonthlyRetainer(e.target.value)} className={inputCls} placeholder="e.g. 50000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Agreement Status</label>
              <select value={agreementStatus} onChange={(e) => setAgreementStatus(e.target.value)} className={inputCls}>
                <option value="Active">Active</option>
                <option value="Paused">Paused</option>
                <option value="Churned">Churned</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">End Date (optional)</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Account Manager</label>
              <select value={accountManager} onChange={(e) => setAccountManager(e.target.value)} className={inputCls}>
                <option value="">-- Not set --</option>
                {users
                  .filter((u) => u.active === 1)
                  .map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Services</label>
            <div className="flex flex-wrap gap-1.5">
              {DIGITAL_MARKETING_SERVICES.map((srv) => (
                <button
                  key={srv}
                  type="button"
                  onClick={() => toggleService(srv)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    services.includes(srv)
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {srv}
                </button>
              ))}
            </div>
          </div>

          {/* Service Subscriptions */}
          <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">
                Service Subscriptions
              </label>
              <button
                type="button"
                onClick={() => setSubscriptions((prev) => [...prev, emptySub()])}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Service
              </button>
            </div>
            <p className="text-[10px] text-indigo-500 dark:text-indigo-400">
              List each service the customer is taking, with its billing type, amount and dates.
            </p>

            {subscriptions.length === 0 && (
              <p className="text-[11px] text-slate-400 italic">No subscriptions added yet.</p>
            )}

            {subscriptions.map((sub) => (
              <div key={sub.key} className="bg-white dark:bg-slate-900 border border-indigo-200/70 dark:border-indigo-900/50 rounded-xl p-2.5 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-slate-400 mb-0.5">Service</label>
                    <select
                      value={sub.service}
                      onChange={(e) => updateSub(sub.key, { service: e.target.value })}
                      className={inputCls}
                    >
                      {DIGITAL_MARKETING_SERVICES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="Monthly Retainer">Monthly Retainer</option>
                      <option value="Project / One-Time">Project / One-Time</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Billing Type</label>
                    <select
                      value={sub.billingType}
                      onChange={(e) => updateSub(sub.key, { billingType: e.target.value })}
                      className={inputCls}
                    >
                      {SUBSCRIPTION_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Amount (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={sub.amount}
                      onChange={(e) => updateSub(sub.key, { amount: e.target.value })}
                      className={inputCls}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Status</label>
                    <select
                      value={sub.status}
                      onChange={(e) => updateSub(sub.key, { status: e.target.value })}
                      className={inputCls}
                    >
                      <option value="Active">Active</option>
                      <option value="Expired">Expired</option>
                      <option value="Ended">Ended</option>
                      <option value="Paused">Paused</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Start Date</label>
                    <input type="date" value={sub.startDate} onChange={(e) => updateSub(sub.key, { startDate: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">End Date</label>
                    <input type="date" value={sub.endDate} onChange={(e) => updateSub(sub.key, { endDate: e.target.value })} className={inputCls} />
                  </div>
                  <div className="sm:col-span-3 flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => removeSub(sub.key)}
                      className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 flex items-center gap-1 px-2 py-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} placeholder="Contract notes, scope, billing terms…" />
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm disabled:opacity-60">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {client ? 'Save Client' : 'Convert to Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
