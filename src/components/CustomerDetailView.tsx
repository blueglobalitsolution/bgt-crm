import React, { useState } from 'react';
import {
  Client,
  ContactPerson,
  ContactEmail,
  HostingCredential,
  CMSCredential,
  AnalyticsCredential,
  GenericCredential,
  SocialMediaProfile,
  TargetKeyword,
  CompetitorProfile,
  AdAccount,
  MonthlyGoal,
  SubscriptionMonthlyLog,
} from '../types';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { onboardingProgress } from '../utils/onboardingFields';
import { externalHref } from '../utils/url';
import { buildWhatsAppUrl } from '../utils/whatsapp';
import { auditApi } from '../utils/auditApi';
import { deliveryTemplateFor, computeDeliveryTotal, deliverySummary, DeliveryFieldDef } from '../utils/deliveryFields';
import {
  X,
  Eye,
  EyeOff,
  ShieldAlert,
  ExternalLink,
  Phone,
  MessageSquare,
  Pencil,
  MapPin,
  Globe,
  Mail,
  Building,
  Briefcase,
  Copy,
  Check,
  ChevronDown,
  Loader2,
  Trash2,
} from 'lucide-react';

interface CustomerDetailViewProps {
  client: Client | null;
  onClose: () => void;
  onEdit: (client: Client) => void;
  onClientUpdated?: (client: Client) => void;
  canViewCredentials: boolean;
}

type TabKey = 'overview' | 'contacts' | 'credentials' | 'social' | 'marketing' | 'competitors' | 'subscriptions' | 'checklist';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '🏢' },
  { key: 'contacts', label: 'Contacts', icon: '👥' },
  { key: 'credentials', label: 'Access & Credentials', icon: '🔐' },
  { key: 'social', label: 'Social Media', icon: '📱' },
  { key: 'marketing', label: 'SEO & Marketing', icon: '🎯' },
  { key: 'competitors', label: 'Competitors', icon: '⚔️' },
  { key: 'subscriptions', label: 'Subscriptions', icon: '💳' },
  { key: 'checklist', label: 'Checklist', icon: '✅' },
];

const formatINR = (val?: number) => {
  if (!val) return '₹0';
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
  return `₹${val}`;
};

const inputClsSm =
  'w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 focus:ring-2 focus:ring-emerald-500 dark:text-slate-100';

function InfoRow({ label, value, href }: { label: string; value?: React.ReactNode; href?: string }) {
  if (value === undefined || value === null || value === '' || value === 0) return null;
  return (
    <div className="py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="text-xs text-slate-800 dark:text-slate-200 mt-0.5 break-words">
        {href ? (
          <a href={externalHref(href)} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
            {value} <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function MaskedPassword({ value }: { value?: string }) {
  const [show, setShow] = useState(false);
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{show ? value : '••••••••'}</code>
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        title={show ? 'Hide' : 'Show'}
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
}

/** Copyable value row: shows the value as selectable text plus a copy button. */
function CopyCell({ label, value }: { label: string; value?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="py-2 flex items-center gap-3">
      <span className="w-20 shrink-0 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded flex-1 min-w-0 truncate select-all text-slate-800 dark:text-slate-200">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
          copied
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
        title="Copy to clipboard"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/** Password row: masked with 👁 toggle plus a copy button. */
function PasswordRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="py-2 flex items-center gap-3">
      <span className="w-20 shrink-0 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className="flex-1 min-w-0"><MaskedPassword value={value} /></span>
      <CopyCell label="" value={value} />
    </div>
  );
}

/** Link row: clickable external link plus a copy button. */
function LinkCell({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="py-2 flex items-center gap-3">
      <span className="w-20 shrink-0 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <a href={externalHref(value)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex-1 min-w-0 truncate">
        {value} <ExternalLink className="w-3 h-3 inline-block" />
      </a>
      <CopyCell label="" value={value} />
    </div>
  );
}

const SectionCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 ${className}`}>
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{title}</div>
    {children}
  </div>
);

export const CustomerDetailView: React.FC<CustomerDetailViewProps> = ({
  client,
  onClose,
  onEdit,
  onClientUpdated,
  canViewCredentials,
}) => {
  const [tab, setTab] = useState<TabKey>('overview');
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [logDraft, setLogDraft] = useState<Record<string, string>>({});
  const [savingLog, setSavingLog] = useState(false);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  useEscapeClose(onClose, !!client);

  if (!client) return null;

  const o = client.onboarding;
  const bp = o?.businessProfile;
  const ac = o?.accessCredentials;
  const social = o?.socialMedia || [];
  const marketing = o?.marketing;
  const competitors = o?.competitors || [];
  const checklist = o?.checklist || [];
  const { done, total, pct } = onboardingProgress(o);
  const contacts = client.contacts || [];

  const tabs = canViewCredentials ? TABS : TABS.filter((t) => t.key !== 'credentials');

  const renderOverview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SectionCard title="Business Profile" className="lg:col-span-1">
        <InfoRow label="Business Type" value={bp?.businessType} />
        <InfoRow label="Target Location" value={bp?.targetLocation} />
        <InfoRow label="Established Year" value={bp?.establishedYear} />
        <InfoRow label="Employees" value={bp?.numberOfEmployees} />
        <InfoRow label="Annual Revenue" value={bp?.annualRevenueRange} />
        <InfoRow label="Google Maps" value={bp?.googleMapLink} href={bp?.googleMapLink} />
      </SectionCard>
      <div className="space-y-4">
        <SectionCard title="Deal & Contract">
          <div className="grid grid-cols-2 gap-x-4">
            <InfoRow label="Contract Value" value={formatINR(client.contractValue)} />
            <InfoRow label="Monthly Retainer" value={`${formatINR(client.monthlyRetainer)}/mo`} />
            <InfoRow label="Start Date" value={client.startDate} />
            <InfoRow label="End Date" value={client.endDate} />
            <InfoRow label="Agreement Status" value={client.agreementStatus} />
            <InfoRow label="Account Manager" value={client.accountManager} />
          </div>
        </SectionCard>
        <SectionCard title="Services">
          {client.services && client.services.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {client.services.map((s) => (
                <span key={s} className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No services selected.</p>
          )}
        </SectionCard>
      </div>
      <SectionCard title="Website & Notes">
        <InfoRow label="Website" value={client.website} href={client.website} />
        <InfoRow label="Email" value={client.email} href={client.email ? `mailto:${client.email}` : undefined} />
        {bp?.businessDescription && (
          <div className="py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Description</div>
            <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 whitespace-pre-wrap leading-relaxed">{bp.businessDescription}</p>
          </div>
        )}
        {client.notes && (
          <div className="py-1.5 last:border-0">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Notes</div>
            <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 whitespace-pre-wrap leading-relaxed">{client.notes}</p>
          </div>
        )}
      </SectionCard>

      {(contacts.length > 0 || client.contactPerson) && (
        <SectionCard title={`Contacts (${contacts.length || 1})`}>
          {(contacts.length ? contacts : [{ id: 'legacy', name: client.contactPerson || '—', mobile: client.mobile, email: client.email, isPrimary: true } as ContactPerson]).map((pc) => (
            <div key={pc.id} className="py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 text-sm">
                {pc.name || '—'}
                {pc.isPrimary && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">Primary</span>
                )}
              </div>
              {pc.role && <div className="text-[11px] text-slate-400">{pc.role}</div>}
              <div className="mt-1.5 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {pc.mobile && (
                  <a href={`tel:${pc.mobile}`} className="flex items-center gap-2 hover:text-emerald-600 hover:underline">
                    <Phone className="w-3 h-3 text-slate-400" /> {pc.mobile}
                  </a>
                )}
                {pc.whatsapp && (
                  <a href={buildWhatsAppUrl(pc.whatsapp)} target="_blank" rel="noreferrer" title="Open WhatsApp chat" className="flex items-center gap-2 text-green-600 dark:text-green-400 hover:underline">
                    <MessageSquare className="w-3 h-3" /> {pc.whatsapp} ↗
                  </a>
                )}
                {pc.email && (
                  <div className="flex items-center gap-2"><Mail className="w-3 h-3 text-slate-400" /> {pc.email}</div>
                )}
              </div>
            </div>
          ))}
        </SectionCard>
      )}

      {client.subscriptions && client.subscriptions.length > 0 && (
        <SectionCard title={`Subscriptions (${client.subscriptions.length})`} className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {client.subscriptions.map((s) => {
              const template = deliveryTemplateFor(s.service);
              const logs = s.monthlyLogs || [];
              const totalFrom = template.totalFrom || [];
              const grandTotal = logs.reduce((a, l) => a + (l.total || computeDeliveryTotal(template, l.fields || {})), 0);
              const latest = logs[0];
              const latestSummary = latest ? deliverySummary(template, { ...(latest.fields || {}), month: latest.month, posts: latest.posts, reels: latest.reels }) : null;
              return (
                <div key={s.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{s.service}</span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatINR(s.amount)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[11px] text-slate-500">
                    <span>Type: {s.billingType}</span>
                    <span>Start: {s.startDate || '—'}</span>
                    <span>End: {s.endDate || '—'}</span>
                    <span>Status: {s.status}</span>
                  </div>
                  {logs.length > 0 && (
                    <div className="mt-1.5 border-t border-slate-200 dark:border-slate-700 pt-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                      {latestSummary && <div>Latest: <strong>{latestSummary}</strong></div>}
                      {totalFrom.length > 0 && (
                        <div className="text-slate-500">All time {template.totalLabel || 'total'}: <span className="font-bold text-emerald-600 dark:text-emerald-400">{grandTotal}</span></div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );

  const renderTab = () => {
    switch (tab) {
      case 'overview':
        return renderOverview();

      case 'contacts':
        return (
          <SectionCard title={`Contact Persons (${contacts.length || 1})`}>
            {(contacts.length ? contacts : [{ id: 'legacy', name: client.contactPerson || '—', mobile: client.mobile, email: client.email, isPrimary: true } as ContactPerson]).map((pc) => (
              <div key={pc.id} className="py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-sm shrink-0">
                    {(pc.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 text-sm">
                      {pc.name || '—'}
                      {pc.isPrimary && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">Primary</span>
                      )}
                    </div>
                    {pc.role && <div className="text-[11px] text-slate-400">{pc.role}</div>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300 sm:text-right">
                  {pc.mobile && <a href={`tel:${pc.mobile}`} className="hover:text-emerald-600 hover:underline">📞 {pc.mobile}</a>}
                  {pc.whatsapp && <a href={buildWhatsAppUrl(pc.whatsapp)} target="_blank" rel="noreferrer" title="Open WhatsApp chat" className="text-green-600 dark:text-green-400 hover:underline">💬 {pc.whatsapp} ↗</a>}
                  {pc.email && <span className="truncate max-w-[220px]">✉️ {pc.email}</span>}
                </div>
              </div>
            ))}
          </SectionCard>
        );

      case 'credentials': {
        const emails: ContactEmail[] = ac?.emails || [];
        const hosting: HostingCredential[] = ac?.hosting || [];
        const cms: CMSCredential[] = ac?.cms || [];
        const analytics: AnalyticsCredential[] = ac?.analytics || [];
        const other: GenericCredential[] = ac?.other || [];
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-3">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Credentials are stored in plaintext. Only share with authorized team members.</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title={`Emails (${emails.length})`}>
                {emails.length === 0 && <p className="text-xs text-slate-400 italic">No emails added.</p>}
                {emails.map((e) => (
                  <div key={e.id} className="py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="flex items-center gap-2 text-xs mb-1">
                      {e.label && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">{e.label}</span>}
                      {e.purpose && <span className="text-[10px] text-slate-400">{e.purpose}</span>}
                    </div>
                    <CopyCell label="Email" value={e.email} />
                    {e.password && <PasswordRow label="Password" value={e.password} />}
                  </div>
                ))}
              </SectionCard>

              <SectionCard title={`Hosting & Domain (${hosting.length})`}>
                {hosting.length === 0 && <p className="text-xs text-slate-400 italic">No hosting added.</p>}
                {hosting.map((h) => (
                  <div key={h.id} className="py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 space-y-0.5">
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{h.domain}</div>
                    {h.provider && <div className="text-xs text-slate-500">Provider: {h.provider}</div>}
                    {h.panelUrl && <LinkCell label="Panel URL" value={h.panelUrl} />}
                    {h.panelType && <CopyCell label="Panel Type" value={h.panelType} />}
                    {h.username && <CopyCell label="Username" value={h.username} />}
                    {h.password && <PasswordRow label="Password" value={h.password} />}
                    {h.ftpHost && <CopyCell label="FTP Host" value={h.ftpHost} />}
                    {h.ftpUser && <CopyCell label="FTP User" value={h.ftpUser} />}
                    {h.ftpPass && <PasswordRow label="FTP Pass" value={h.ftpPass} />}
                    {h.sslProvider && <CopyCell label="SSL Provider" value={h.sslProvider} />}
                    {h.sslExpiry && <CopyCell label="SSL Expiry" value={h.sslExpiry} />}
                  </div>
                ))}
              </SectionCard>

              <SectionCard title={`CMS (${cms.length})`}>
                {cms.length === 0 && <p className="text-xs text-slate-400 italic">No CMS added.</p>}
                {cms.map((c) => (
                  <div key={c.id} className="py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 capitalize">{c.platform}</div>
                    {c.adminUrl && <LinkCell label="Admin URL" value={c.adminUrl} />}
                    {c.username && <CopyCell label="Username" value={c.username} />}
                    {c.password && <PasswordRow label="Password" value={c.password} />}
                  </div>
                ))}
              </SectionCard>

              <SectionCard title={`Analytics (${analytics.length})`}>
                {analytics.length === 0 && <p className="text-xs text-slate-400 italic">No analytics added.</p>}
                {analytics.map((a) => (
                  <div key={a.id} className="py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase">{a.type.replace(/_/g, ' ')}</div>
                    {a.accountId && <CopyCell label="Account / Property ID" value={a.accountId} />}
                    {a.propertyId && <CopyCell label="Property" value={a.propertyId} />}
                    {a.accessLevel && <CopyCell label="Access Level" value={a.accessLevel} />}
                  </div>
                ))}
              </SectionCard>

              <SectionCard title={`Other Accounts (${other.length})`} className="lg:col-span-2">
                {other.length === 0 && <p className="text-xs text-slate-400 italic">No other accounts.</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {other.map((x) => (
                    <div key={x.id} className="py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{x.platform}</div>
                      {x.url && <LinkCell label="URL" value={x.url} />}
                      {x.username && <CopyCell label="Username" value={x.username} />}
                      {x.password && <PasswordRow label="Password" value={x.password} />}
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        );
      }

      case 'social':
        return (
          <SectionCard title={`Social Media Accounts (${social.length})`}>
            {social.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No social accounts added.</p>
            ) : (
              <div className="space-y-4">
                {social.map((s) => {
                  const hasCreds = canViewCredentials && (s.username || s.password);
                  const extras: { icon: string; label: string; value?: string }[] = [];
                  if (s.postsCount) extras.push({ icon: '📸', label: 'Posts', value: s.postsCount });
                  if (s.reelsCount) extras.push({ icon: '🎬', label: 'Reels', value: s.reelsCount });
                  if (s.lastPostDate) extras.push({ icon: '🕒', label: 'Last post', value: s.lastPostDate });
                  if (s.adAccountId) extras.push({ icon: '📊', label: 'Ad account', value: s.adAccountId });
                  if (s.businessManagerId) extras.push({ icon: '🏢', label: 'Business Mgr', value: s.businessManagerId });
                  return (
                    <div key={s.id} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                      {/* Platform header */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{s.platform}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${s.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                          {s.isActive ? '● Active' : '○ Inactive'}
                        </span>
                        {s.handle && <span className="text-xs text-slate-500">@{s.handle}</span>}
                        {s.url && (
                          <a href={externalHref(s.url)} target="_blank" rel="noreferrer" className="ml-auto text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
                            Open profile <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Credentials */}
                      {hasCreds ? (
                        <div className="mt-2 border-t border-slate-200 dark:border-slate-700 pt-2 space-y-1">
                          {s.username && <CopyCell label="User ID" value={s.username} />}
                          {s.password && <PasswordRow label="Password" value={s.password} />}
                        </div>
                      ) : (
                        canViewCredentials && (
                          <div className="mt-2 border-t border-slate-200 dark:border-slate-700 pt-2">
                            <p className="text-[11px] text-slate-400 italic">No credentials saved for this platform.</p>
                          </div>
                        )
                      )}

                      {/* Extras */}
                      {extras.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                          {extras.map((e) => (
                            <span key={e.label} title={e.label}>{e.icon} {e.label}: {e.value}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        );

      case 'marketing': {
        const keywords: string[] = marketing?.seoKeywords || [];
        const targets: TargetKeyword[] = marketing?.targetKeywords || [];
        const ads: AdAccount[] = marketing?.adAccounts || [];
        const goals: MonthlyGoal[] = marketing?.monthlyGoals || [];
        return (
          <div className="space-y-4">
            <div
              className={`bg-white dark:bg-slate-900 border rounded-xl p-4 ${
                keywords.length > 0 ? 'cursor-pointer border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800' : 'border-slate-200 dark:border-slate-800'
              }`}
              onClick={() => {
                if (keywords.length === 0) return;
                copyText(keywords.join(' '));
                setCopiedAll(true);
                setTimeout(() => setCopiedAll(false), 1500);
              }}
              title={keywords.length > 0 ? 'Click to copy all keywords' : undefined}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  SEO Keywords ({keywords.length})
                  <span className="ml-2 text-[9px] font-semibold text-slate-400 normal-case">click card to copy all</span>
                </div>
                {keywords.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyText(keywords.join(' '));
                      setCopiedAll(true);
                      setTimeout(() => setCopiedAll(false), 1500);
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                      copiedAll
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                    title="Copy all keywords"
                  >
                    {copiedAll ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedAll ? 'Copied all' : 'Copy all'}
                  </button>
                )}
              </div>
              {keywords.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No keywords added.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyText(k);
                        setCopiedKeyword(k);
                        setTimeout(() => setCopiedKeyword(null), 1500);
                      }}
                      title="Click to copy this keyword"
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                        copiedKeyword === k
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                          : 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900'
                      }`}
                    >
                      {copiedKeyword === k ? '✓ Copied' : k}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <SectionCard title={`Target Keywords (${targets.length})`}>
              {targets.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No target keywords.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                        <th className="px-2 py-1.5">Keyword</th>
                        <th className="px-2 py-1.5">Priority</th>
                        <th className="px-2 py-1.5">Target Page</th>
                        <th className="px-2 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {targets.map((t) => (
                        <tr key={t.id}>
                          <td className="px-2 py-2 font-semibold text-slate-800 dark:text-slate-200">{t.keyword}</td>
                          <td className="px-2 py-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${t.priority === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : t.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'}`}>
                              {t.priority}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-slate-500">{t.targetPage || '—'}</td>
                          <td className="px-2 py-2 text-slate-500 capitalize">{t.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title={`Ad Accounts (${ads.length})`}>
                {ads.length === 0 && <p className="text-xs text-slate-400 italic">No ad accounts.</p>}
                {ads.map((a) => (
                  <div key={a.id} className="py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 capitalize">{a.platform}</span>
                      {a.accessLevel && <span className="text-[10px] text-slate-400">{a.accessLevel}</span>}
                    </div>
                    {a.accountName && <div className="text-xs text-slate-500">{a.accountName}</div>}
                    {a.accountId && <InfoRow label="Account ID" value={a.accountId} />}
                  </div>
                ))}
              </SectionCard>

              <SectionCard title={`Monthly Goals (${goals.length})`}>
                {goals.length === 0 && <p className="text-xs text-slate-400 italic">No goals set.</p>}
                {goals.map((g) => (
                  <div key={g.id} className="py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0 flex items-start gap-2">
                    {g.month && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 shrink-0">{g.month}</span>}
                    <span className="text-xs text-slate-700 dark:text-slate-300">{g.goal}</span>
                  </div>
                ))}
              </SectionCard>
            </div>
          </div>
        );
      }

      case 'competitors':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {competitors.length === 0 && (
              <div className="sm:col-span-2 lg:col-span-3">
                <SectionCard title="Competitors (0)"><p className="text-xs text-slate-400 italic">No competitors added.</p></SectionCard>
              </div>
            )}
            {competitors.map((c: CompetitorProfile) => (
              <SectionCard key={c.id} title={c.name}>
                {c.website && (
                  <a href={externalHref(c.website)} target="_blank" rel="noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
                    {c.website} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {c.platforms && c.platforms.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {c.platforms.map((p) => (
                      <span key={p} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{p}</span>
                    ))}
                  </div>
                )}
                {c.strengths && <InfoRow label="Strengths" value={c.strengths} />}
                {c.weaknesses && <InfoRow label="Weaknesses" value={c.weaknesses} />}
              </SectionCard>
            ))}
          </div>
        );

      case 'subscriptions':
        return (
          <SectionCard title={`Service Subscriptions (${client.subscriptions?.length || 0})`}>
            {(!client.subscriptions || client.subscriptions.length === 0) ? (
              <p className="text-xs text-slate-400 italic">No subscriptions added.</p>
            ) : (
              <div className="space-y-3">
                {client.subscriptions.map((s) => {
                  const template = deliveryTemplateFor(s.service);
                  const logs = s.monthlyLogs || [];
                  const isOpen = expandedSub === s.id;
                  const totalFrom = template.totalFrom || [];
                  const grandTotal = logs.reduce((a, l) => a + (l.total || computeDeliveryTotal(template, l.fields || {})), 0);
                  return (
                    <div key={s.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                      {/* Subscription row */}
                      <button
                        type="button"
                        onClick={() => setExpandedSub(isOpen ? null : s.id)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-800 dark:text-slate-200">{s.service}</div>
                            <div className="text-[10px] text-slate-500">
                              {s.billingType} · {s.startDate || '—'} → {s.endDate || '—'} · {s.status}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {logs.length > 0 && totalFrom.length > 0 && (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              {template.totalLabel || 'Total'}: {grandTotal}
                            </span>
                          )}
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatINR(s.amount)}</span>
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isOpen && (
                        <div className="p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {template.title} <span className="normal-case text-slate-400">({template.entryType})</span>
                            </div>
                            <span className="text-[10px] text-slate-400">{logs.length} recorded</span>
                          </div>

                          {logs.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">
                              No {template.entryType.toLowerCase()} delivered yet. Add the first entry below.
                            </p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                                    {template.fields.map((f) => (
                                      <th key={f.key} className={`px-2 py-1.5 ${f.type === 'number' ? 'text-right' : ''}`}>{f.label}</th>
                                    ))}
                                    {template.totalFrom && <th className="px-2 py-1.5 text-right">{template.totalLabel}</th>}
                                    <th className="px-2 py-1.5">Recorded By</th>
                                    {canViewCredentials && <th className="px-2 py-1.5 text-right">Actions</th>}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {logs.map((l) => {
                                    const fields = l.fields || {};
                                    const rowTotal = computeDeliveryTotal(template, { ...fields, month: l.month, posts: l.posts, reels: l.reels, total: l.total });
                                    return (
                                      <tr key={l.id}>
                                        {template.fields.map((f) => {
                                          let v: any = fields[f.key];
                                          if (f.key === 'month') v = fields.month || l.month;
                                          if (f.key === 'date') v = fields.date;
                                          if (v === undefined || v === '') v = '—';
                                          return (
                                            <td key={f.key} className={`px-2 py-2 ${f.type === 'number' ? 'text-right' : ''} ${f.type === 'textarea' ? 'max-w-[220px] whitespace-pre-wrap' : ''} text-slate-700 dark:text-slate-300`}>
                                              {f.type === 'date' && v !== '—' ? String(v) : String(v)}
                                            </td>
                                          );
                                        })}
                                        {template.totalFrom && (
                                          <td className="px-2 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">{rowTotal}</td>
                                        )}
                                        <td className="px-2 py-2 text-slate-500">{l.recordedBy || '—'}</td>
                                        {canViewCredentials && (
                                          <td className="px-2 py-2 text-right">
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                const fields = l.fields || {};
                                                const ref = fields.month || fields.date || '';
                                                const label = ref ? `${template.entryType} entry (${ref})` : 'this delivery log entry';
                                                if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
                                                await auditApi.deleteMonthlyLog(s.id, l.id);
                                                const res = await auditApi.getClient(client.id);
                                                onClientUpdated?.(res.client);
                                              }}
                                              className="p-1 text-slate-400 hover:text-rose-600"
                                              title="Delete this entry"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Add entry form */}
                          {canViewCredentials && (
                            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                Add {template.entryType}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                                {template.fields.map((f) => (
                                  <div key={f.key}>
                                    <label className="block text-[10px] text-slate-400 mb-0.5">
                                      {f.label}{f.required ? ' *' : ''}
                                    </label>
                                    {f.type === 'month' ? (
                                      <input
                                        type="month"
                                        value={logDraft[f.key] || ''}
                                        onChange={(e) => setLogDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                                        className={inputClsSm}
                                      />
                                    ) : f.type === 'date' ? (
                                      <input
                                        type="date"
                                        value={logDraft[f.key] || ''}
                                        onChange={(e) => setLogDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                                        className={inputClsSm}
                                      />
                                    ) : f.type === 'number' ? (
                                      <input
                                        type="number"
                                        min={0}
                                        value={logDraft[f.key] || ''}
                                        onChange={(e) => setLogDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                                        placeholder={f.placeholder || '0'}
                                        className={inputClsSm}
                                      />
                                    ) : f.type === 'textarea' ? (
                                      <input
                                        type="text"
                                        value={logDraft[f.key] || ''}
                                        onChange={(e) => setLogDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                                        placeholder={f.placeholder || 'Add a remark…'}
                                        className={inputClsSm}
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        value={logDraft[f.key] || ''}
                                        onChange={(e) => setLogDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                                        placeholder={f.placeholder || ''}
                                        className={inputClsSm}
                                      />
                                    )}
                                  </div>
                                ))}

                                {template.totalFrom && (
                                  <div>
                                    <label className="block text-[10px] text-slate-400 mb-0.5">{template.totalLabel} (auto)</label>
                                    <div className="px-2 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                      {computeDeliveryTotal(template, logDraft)}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="mt-3 flex justify-end">
                                <button
                                  type="button"
                                  disabled={savingLog}
                                  onClick={async () => {
                                    const missing = template.fields.some((f) => f.required && !logDraft[f.key]);
                                    if (missing) return;
                                    setSavingLog(true);
                                    try {
                                      const fields: Record<string, string | number> = {};
                                      template.fields.forEach((f) => {
                                        const v = logDraft[f.key];
                                        if (v !== undefined && v !== '') {
                                          fields[f.key] = f.type === 'number' ? Number(v) : v;
                                        }
                                      });
                                      await auditApi.createMonthlyLog(s.id, { month: String(fields.month || ''), fields });
                                      setLogDraft({});
                                      const res = await auditApi.getClient(client.id);
                                      onClientUpdated?.(res.client);
                                    } finally {
                                      setSavingLog(false);
                                    }
                                  }}
                                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                                >
                                  {savingLog ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                  Save {template.entryType}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        );

      case 'checklist':
        return (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{done} of {total} completed</span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{pct}%</span>
              </div>
              <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {checklist.length === 0 && (
                <div className="sm:col-span-2">
                  <SectionCard title="Checklist"><p className="text-xs text-slate-400 italic">No checklist generated.</p></SectionCard>
                </div>
              )}
              {checklist.map((i) => (
                <div key={i.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 flex items-center gap-2.5">
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] shrink-0 ${i.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600 text-transparent'}`}>
                    ✓
                  </span>
                  <span className={`text-xs ${i.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>{i.label}</span>
                  {i.service !== 'all' && (
                    <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 shrink-0">{i.service}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-5xl h-full bg-slate-50 dark:bg-slate-950 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
      {/* Top header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
          <Building className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-slate-900 dark:text-slate-100 truncate">{client.companyName}</h2>
          <p className="text-xs text-slate-500 truncate">
            {bp?.businessType ? <>{bp.businessType} · </> : null}
            {client.agreementStatus} · {client.accountManager ? `Account Mgr: ${client.accountManager}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {bp?.googleMapLink && (
            <a href={externalHref(bp.googleMapLink)} target="_blank" rel="noreferrer" title="Google Maps" className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors">
              <MapPin className="w-4 h-4" />
            </a>
          )}
          {client.website && (
            <a href={externalHref(client.website)} target="_blank" rel="noreferrer" title="Website" className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors">
              <Globe className="w-4 h-4" />
            </a>
          )}
          {client.email && (
            <a href={`mailto:${client.email}`} title="Email" className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors">
              <Mail className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={() => onEdit(client)}
            className="ml-1 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Edit</span>
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left sidebar */}
        <aside className="w-52 sm:w-56 shrink-0 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-y-auto hidden md:flex">
          <nav className="flex-1 p-3 space-y-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                  tab === t.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{t.icon}</span>
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-semibold text-slate-400 mb-1.5">Onboarding Progress</div>
            <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[10px] font-semibold text-slate-500 mt-1.5">{pct}% · {done}/{total} items</div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Mobile tab chips */}
          <div className="md:hidden px-3 pt-2.5 pb-1.5 flex gap-1.5 overflow-x-auto shrink-0">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  tab === t.key ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-5xl mx-auto">{renderTab()}</div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
