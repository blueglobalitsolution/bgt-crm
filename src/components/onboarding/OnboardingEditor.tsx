import React from 'react';
import { Plus, Trash2, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import {
  ClientOnboarding,
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
} from '../../types';
import {
  ONBOARDING_TABS,
  SOCIAL_PLATFORMS,
  uid,
  generateChecklist,
  onboardingProgress,
} from '../../utils/onboardingFields';

const inputCls =
  'w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100';
const labelCls = 'block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1';

function PasswordInput({ value, onChange, placeholder }: { value?: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '••••••••'}
        className={inputCls + ' pr-9'}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 px-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">{title}</h4>
        {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function AddRowButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
    >
      <Plus className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

// ─── Business Profile ────────────────────────────────────────────────────────

export function BusinessProfileTab({
  value,
  onChange,
}: {
  value: ClientOnboarding;
  onChange: (v: ClientOnboarding) => void;
}) {
  const bp = value.businessProfile || {};
  const set = (patch: Partial<typeof bp>) => onChange({ ...value, businessProfile: { ...bp, ...patch } });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className={labelCls}>Business Type</label>
        <input className={inputCls} value={bp.businessType || ''} onChange={(e) => set({ businessType: e.target.value })} placeholder="e.g. Restaurant business" />
      </div>
      <div>
        <label className={labelCls}>Target Location</label>
        <input className={inputCls} value={bp.targetLocation || ''} onChange={(e) => set({ targetLocation: e.target.value })} placeholder="e.g. Vadodara, Gujarat" />
      </div>
      <div>
        <label className={labelCls}>Established Year</label>
        <input className={inputCls} value={bp.establishedYear || ''} onChange={(e) => set({ establishedYear: e.target.value })} placeholder="e.g. 2015" />
      </div>
      <div>
        <label className={labelCls}>No. of Employees</label>
        <input className={inputCls} value={bp.numberOfEmployees || ''} onChange={(e) => set({ numberOfEmployees: e.target.value })} placeholder="e.g. 25" />
      </div>
      <div>
        <label className={labelCls}>Annual Revenue Range</label>
        <input className={inputCls} value={bp.annualRevenueRange || ''} onChange={(e) => set({ annualRevenueRange: e.target.value })} placeholder="e.g. ₹25L – ₹1Cr" />
      </div>
      <div>
        <label className={labelCls}>Google Maps Link</label>
        <input className={inputCls} value={bp.googleMapLink || ''} onChange={(e) => set({ googleMapLink: e.target.value })} placeholder="https://share.google/... or maps link" />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Business Description</label>
        <textarea
          rows={3}
          className={inputCls}
          value={bp.businessDescription || ''}
          onChange={(e) => set({ businessDescription: e.target.value })}
          placeholder="What the business does, its specialty, and any notes…"
        />
      </div>
    </div>
  );
}

// ─── Access & Credentials ────────────────────────────────────────────────────

export function AccessCredentialsTab({
  value,
  onChange,
}: {
  value: ClientOnboarding;
  onChange: (v: ClientOnboarding) => void;
}) {
  const ac: ClientOnboarding['accessCredentials'] = value.accessCredentials || {
    emails: [],
    hosting: [],
    cms: [],
    analytics: [],
    other: [],
  };
  const set = (patch: Partial<ClientOnboarding['accessCredentials']>) =>
    onChange({ ...value, accessCredentials: { ...ac, ...patch } });

  const setEmail = (id: string, p: Partial<ContactEmail>) =>
    set({ emails: ac.emails.map((e) => (e.id === id ? { ...e, ...p } : e)) });
  const setHost = (id: string, p: Partial<HostingCredential>) =>
    set({ hosting: ac.hosting.map((e) => (e.id === id ? { ...e, ...p } : e)) });
  const setCms = (id: string, p: Partial<CMSCredential>) =>
    set({ cms: ac.cms.map((e) => (e.id === id ? { ...e, ...p } : e)) });
  const setAnalytics = (id: string, p: Partial<AnalyticsCredential>) =>
    set({ analytics: ac.analytics.map((e) => (e.id === id ? { ...e, ...p } : e)) });
  const setOther = (id: string, p: Partial<GenericCredential>) =>
    set({ other: ac.other.map((e) => (e.id === id ? { ...e, ...p } : e)) });

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-3">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>Credentials are stored in plaintext. Only share with authorized team members. Users with View-Only access cannot see this section.</span>
      </div>

      <Section title="Email Accounts" hint="All business emails, with login details.">
        {ac.emails.map((e) => (
          <div key={e.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className={labelCls}>Label</label>
              <input className={inputCls} value={e.label} onChange={(ev) => setEmail(e.id, { label: ev.target.value })} placeholder="Primary" />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} value={e.email} onChange={(ev) => setEmail(e.id, { email: ev.target.value })} placeholder="user@domain.com" />
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <PasswordInput value={e.password} onChange={(v) => setEmail(e.id, { password: v })} />
            </div>
            <div className="flex items-end justify-end gap-1">
              <button type="button" onClick={() => set({ emails: ac.emails.filter((x) => x.id !== e.id) })} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        <AddRowButton onClick={() => set({ emails: [...ac.emails, { id: uid(), label: '', email: '', password: '' }] })} label="Add Email" />
      </Section>

      <Section title="Hosting & Domain" hint="Domain registrar, hosting panel and FTP access.">
        {ac.hosting.map((h) => (
          <div key={h.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className={labelCls}>Provider</label>
                <input className={inputCls} value={h.provider || ''} onChange={(ev) => setHost(h.id, { provider: ev.target.value })} placeholder="Hostinger" />
              </div>
              <div>
                <label className={labelCls}>Domain</label>
                <input className={inputCls} value={h.domain} onChange={(ev) => setHost(h.id, { domain: ev.target.value })} placeholder="example.com" />
              </div>
              <div>
                <label className={labelCls}>Panel URL</label>
                <input className={inputCls} value={h.panelUrl || ''} onChange={(ev) => setHost(h.id, { panelUrl: ev.target.value })} placeholder="https://hpanel.hostinger.com" />
              </div>
              <div>
                <label className={labelCls}>Panel Type</label>
                <select className={inputCls} value={h.panelType || ''} onChange={(ev) => setHost(h.id, { panelType: ev.target.value })}>
                  <option value="">--</option>
                  <option value="cpanel">cPanel</option>
                  <option value="plesk">Plesk</option>
                  <option value="custom">Custom</option>
                  <option value="cloud">Cloud / VPS</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Username</label>
                <input className={inputCls} value={h.username || ''} onChange={(ev) => setHost(h.id, { username: ev.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <PasswordInput value={h.password} onChange={(v) => setHost(h.id, { password: v })} />
              </div>
              <div>
                <label className={labelCls}>FTP Host</label>
                <input className={inputCls} value={h.ftpHost || ''} onChange={(ev) => setHost(h.id, { ftpHost: ev.target.value })} placeholder="ftp.example.com" />
              </div>
              <div className="flex items-end justify-end gap-1">
                <button type="button" onClick={() => set({ hosting: ac.hosting.filter((x) => x.id !== h.id) })} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>SSL Provider</label>
                <input className={inputCls} value={h.sslProvider || ''} onChange={(ev) => setHost(h.id, { sslProvider: ev.target.value })} placeholder="Let's Encrypt" />
              </div>
              <div>
                <label className={labelCls}>SSL Expiry</label>
                <input className={inputCls} type="date" value={h.sslExpiry || ''} onChange={(ev) => setHost(h.id, { sslExpiry: ev.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input className={inputCls} value={h.notes || ''} onChange={(ev) => setHost(h.id, { notes: ev.target.value })} />
              </div>
            </div>
          </div>
        ))}
        <AddRowButton onClick={() => set({ hosting: [...ac.hosting, { id: uid(), domain: '' }] })} label="Add Hosting" />
      </Section>

      <Section title="Website / CMS" hint="Admin login for the website platform.">
        {ac.cms.map((c) => (
          <div key={c.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className={labelCls}>Platform</label>
              <select className={inputCls} value={c.platform || ''} onChange={(ev) => setCms(c.id, { platform: ev.target.value })}>
                <option value="">--</option>
                <option value="wordpress">WordPress</option>
                <option value="shopify">Shopify</option>
                <option value="wix">Wix</option>
                <option value="squarespace">Squarespace</option>
                <option value="webflow">Webflow</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Admin URL</label>
              <input className={inputCls} value={c.adminUrl || ''} onChange={(ev) => setCms(c.id, { adminUrl: ev.target.value })} placeholder="https://site.com/wp-admin" />
            </div>
            <div>
              <label className={labelCls}>Username</label>
              <input className={inputCls} value={c.username || ''} onChange={(ev) => setCms(c.id, { username: ev.target.value })} />
            </div>
            <div className="flex items-end justify-end gap-1">
              <PasswordInput value={c.password} onChange={(v) => setCms(c.id, { password: v })} />
              <button type="button" onClick={() => set({ cms: ac.cms.filter((x) => x.id !== c.id) })} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        <AddRowButton onClick={() => set({ cms: [...ac.cms, { id: uid(), platform: 'wordpress' }] })} label="Add CMS" />
      </Section>

      <Section title="Analytics & Tracking" hint="GA4, Search Console, Meta Pixel, etc.">
        {ac.analytics.map((a) => (
          <div key={a.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={a.type} onChange={(ev) => setAnalytics(a.id, { type: ev.target.value })}>
                <option value="ga4">GA4</option>
                <option value="gtm">GTM</option>
                <option value="meta_pixel">Meta Pixel</option>
                <option value="search_console">Search Console</option>
                <option value="bing_webmaster">Bing Webmaster</option>
                <option value="clarity">Clarity</option>
                <option value="hotjar">Hotjar</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Account / Property ID</label>
              <input className={inputCls} value={a.accountId || ''} onChange={(ev) => setAnalytics(a.id, { accountId: ev.target.value })} placeholder="G-XXXXXXX" />
            </div>
            <div>
              <label className={labelCls}>Access Level</label>
              <input className={inputCls} value={a.accessLevel || ''} onChange={(ev) => setAnalytics(a.id, { accessLevel: ev.target.value })} placeholder="Admin / Editor" />
            </div>
            <div className="flex items-end justify-end gap-1">
              <button type="button" onClick={() => set({ analytics: ac.analytics.filter((x) => x.id !== a.id) })} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        <AddRowButton onClick={() => set({ analytics: [...ac.analytics, { id: uid(), type: 'ga4' }] })} label="Add Analytics" />
      </Section>

      <Section title="Other Accounts" hint="Any other platform credentials (tool subscriptions, booking, etc.).">
        {ac.other.map((o) => (
          <div key={o.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className={labelCls}>Platform</label>
              <input className={inputCls} value={o.platform} onChange={(ev) => setOther(o.id, { platform: ev.target.value })} placeholder="e.g. Zoho" />
            </div>
            <div>
              <label className={labelCls}>URL</label>
              <input className={inputCls} value={o.url || ''} onChange={(ev) => setOther(o.id, { url: ev.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Username</label>
              <input className={inputCls} value={o.username || ''} onChange={(ev) => setOther(o.id, { username: ev.target.value })} />
            </div>
            <div className="flex items-end justify-end gap-1">
              <PasswordInput value={o.password} onChange={(v) => setOther(o.id, { password: v })} />
              <button type="button" onClick={() => set({ other: ac.other.filter((x) => x.id !== o.id) })} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        <AddRowButton onClick={() => set({ other: [...ac.other, { id: uid(), platform: '' }] })} label="Add Other Account" />
      </Section>
    </div>
  );
}

// ─── Social Media ────────────────────────────────────────────────────────────

export function SocialMediaTab({
  value,
  onChange,
}: {
  value: ClientOnboarding;
  onChange: (v: ClientOnboarding) => void;
}) {
  const list = value.socialMedia || [];
  const setList = (next: SocialMediaProfile[]) => onChange({ ...value, socialMedia: next });
  const setOne = (id: string, p: Partial<SocialMediaProfile>) =>
    setList(list.map((s) => (s.id === id ? { ...s, ...p } : s)));

  return (
    <div className="space-y-3">
      {list.map((s) => (
        <div key={s.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <select className={inputCls + ' sm:w-44'} value={s.platform} onChange={(ev) => setOne(s.id, { platform: ev.target.value })}>
              {SOCIAL_PLATFORMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input className={inputCls + ' flex-1 min-w-[120px]'} value={s.handle || ''} onChange={(ev) => setOne(s.id, { handle: ev.target.value })} placeholder="Handle / ID" />
            <input className={inputCls + ' flex-1 min-w-[180px]'} value={s.url || ''} onChange={(ev) => setOne(s.id, { url: ev.target.value })} placeholder="Profile URL" />
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={s.isActive} onChange={(ev) => setOne(s.id, { isActive: ev.target.checked })} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              Active
            </label>
            <button type="button" onClick={() => setList(list.filter((x) => x.id !== s.id))} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className={labelCls}>Posts Count</label>
              <input className={inputCls} value={s.postsCount || ''} onChange={(ev) => setOne(s.id, { postsCount: ev.target.value })} placeholder="e.g. 12" />
            </div>
            <div>
              <label className={labelCls}>Reels</label>
              <input className={inputCls} value={s.reelsCount || ''} onChange={(ev) => setOne(s.id, { reelsCount: ev.target.value })} placeholder="e.g. 4" />
            </div>
            <div>
              <label className={labelCls}>Last Post Date</label>
              <input className={inputCls} type="date" value={s.lastPostDate || ''} onChange={(ev) => setOne(s.id, { lastPostDate: ev.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Ad / BM Account ID</label>
              <input className={inputCls} value={s.adAccountId || ''} onChange={(ev) => setOne(s.id, { adAccountId: ev.target.value })} placeholder="act_9876543210" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Username</label>
              <input className={inputCls} value={s.username || ''} onChange={(ev) => setOne(s.id, { username: ev.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <PasswordInput value={s.password} onChange={(v) => setOne(s.id, { password: v })} />
            </div>
          </div>
        </div>
      ))}
      <AddRowButton onClick={() => setList([...list, { id: uid(), platform: 'Instagram', isActive: true }])} label="Add Platform" />
    </div>
  );
}

// ─── SEO & Marketing ─────────────────────────────────────────────────────────

export function MarketingTab({
  value,
  onChange,
}: {
  value: ClientOnboarding;
  onChange: (v: ClientOnboarding) => void;
}) {
  const m = value.marketing || { seoKeywords: [], targetKeywords: [], adAccounts: [], monthlyGoals: [] };
  const set = (patch: Partial<typeof m>) => onChange({ ...value, marketing: { ...m, ...patch } });

  const addKeyword = (k: string) => {
    const kw = k.trim();
    if (!kw || m.seoKeywords.includes(kw)) return;
    set({ seoKeywords: [...m.seoKeywords, kw] });
  };

  const setTarget = (id: string, p: Partial<TargetKeyword>) =>
    set({ targetKeywords: m.targetKeywords.map((t) => (t.id === id ? { ...t, ...p } : t)) });
  const setAd = (id: string, p: Partial<AdAccount>) =>
    set({ adAccounts: m.adAccounts.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  const setGoal = (id: string, p: Partial<MonthlyGoal>) =>
    set({ monthlyGoals: m.monthlyGoals.map((g) => (g.id === id ? { ...g, ...p } : g)) });

  return (
    <div className="space-y-5">
      <Section title="SEO Keywords" hint="Tap + to add. Enter a keyword and press Enter or click Add.">
        <div className="flex flex-wrap gap-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5">
          {m.seoKeywords.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {k}
              <button type="button" onClick={() => set({ seoKeywords: m.seoKeywords.filter((x) => x !== k) })} className="text-blue-400 hover:text-rose-500">×</button>
            </span>
          ))}
          <KeywordAdder onAdd={addKeyword} />
        </div>
      </Section>

      <Section title="Target Keywords" hint="Keyword → target page → ranking status.">
        {m.targetKeywords.map((t) => (
          <div key={t.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className={labelCls}>Keyword</label>
              <input className={inputCls} value={t.keyword} onChange={(ev) => setTarget(t.id, { keyword: ev.target.value })} placeholder="e.g. best restaurant vadodara" />
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select className={inputCls} value={t.priority} onChange={(ev) => setTarget(t.id, { priority: ev.target.value as any })}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Target Page</label>
              <input className={inputCls} value={t.targetPage || ''} onChange={(ev) => setTarget(t.id, { targetPage: ev.target.value })} placeholder="/home" />
            </div>
            <div className="flex items-end justify-end gap-1">
              <select className={inputCls} value={t.status} onChange={(ev) => setTarget(t.id, { status: ev.target.value })}>
                <option value="researching">Researching</option>
                <option value="optimizing">Optimizing</option>
                <option value="ranking">Ranking</option>
                <option value="maintained">Maintained</option>
              </select>
              <button type="button" onClick={() => set({ targetKeywords: m.targetKeywords.filter((x) => x.id !== t.id) })} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        <AddRowButton onClick={() => set({ targetKeywords: [...m.targetKeywords, { id: uid(), keyword: '', priority: 'medium', status: 'researching' }] })} label="Add Target Keyword" />
      </Section>

      <Section title="Ad Accounts" hint="Google Ads, Meta Ads Manager, etc.">
        {m.adAccounts.map((a) => (
          <div key={a.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div>
              <label className={labelCls}>Platform</label>
              <select className={inputCls} value={a.platform} onChange={(ev) => setAd(a.id, { platform: ev.target.value })}>
                <option value="meta">Meta</option>
                <option value="google">Google Ads</option>
                <option value="linkedin">LinkedIn</option>
                <option value="twitter">Twitter / X</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Account Name</label>
              <input className={inputCls} value={a.accountName || ''} onChange={(ev) => setAd(a.id, { accountName: ev.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Account ID</label>
              <input className={inputCls} value={a.accountId || ''} onChange={(ev) => setAd(a.id, { accountId: ev.target.value })} placeholder="act_… / 123-456-7890" />
            </div>
            <div>
              <label className={labelCls}>Access Level</label>
              <input className={inputCls} value={a.accessLevel || ''} onChange={(ev) => setAd(a.id, { accessLevel: ev.target.value })} placeholder="Admin" />
            </div>
            <div className="flex items-end justify-end gap-1">
              <button type="button" onClick={() => set({ adAccounts: m.adAccounts.filter((x) => x.id !== a.id) })} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        <AddRowButton onClick={() => set({ adAccounts: [...m.adAccounts, { id: uid(), platform: 'meta' }] })} label="Add Ad Account" />
      </Section>

      <Section title="Monthly Goals" hint="Goals per month for content, traffic, rankings.">
        {m.monthlyGoals.map((g) => (
          <div key={g.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-5 gap-2">
            <div>
              <label className={labelCls}>Month</label>
              <input className={inputCls} type="month" value={g.month || ''} onChange={(ev) => setGoal(g.id, { month: ev.target.value })} />
            </div>
            <div className="sm:col-span-3">
              <label className={labelCls}>Goal</label>
              <input className={inputCls} value={g.goal || ''} onChange={(ev) => setGoal(g.id, { goal: ev.target.value })} placeholder="e.g. Increase organic traffic by 20%" />
            </div>
            <div className="flex items-end justify-end gap-1">
              <button type="button" onClick={() => set({ monthlyGoals: m.monthlyGoals.filter((x) => x.id !== g.id) })} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        <AddRowButton onClick={() => set({ monthlyGoals: [...m.monthlyGoals, { id: uid(), month: '', goal: '' }] })} label="Add Monthly Goal" />
      </Section>
    </div>
  );
}

function KeywordAdder({ onAdd }: { onAdd: (k: string) => void }) {
  const [val, setVal] = React.useState('');
  return (
    <span className="inline-flex items-center gap-1">
      <input
        className="w-36 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 px-2 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onAdd(val);
            setVal('');
          }
        }}
        placeholder="+ Add keyword…"
      />
      <button
        type="button"
        onClick={() => {
          onAdd(val);
          setVal('');
        }}
        className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-700"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

// ─── Competitors ─────────────────────────────────────────────────────────────

export function CompetitorsTab({
  value,
  onChange,
}: {
  value: ClientOnboarding;
  onChange: (v: ClientOnboarding) => void;
}) {
  const list = value.competitors || [];
  const setList = (next: CompetitorProfile[]) => onChange({ ...value, competitors: next });
  const setOne = (id: string, p: Partial<CompetitorProfile>) =>
    setList(list.map((c) => (c.id === id ? { ...c, ...p } : c)));

  const togglePlatform = (id: string, platform: string) => {
    setList(
      list.map((c) =>
        c.id === id
          ? { ...c, platforms: c.platforms.includes(platform) ? c.platforms.filter((p) => p !== platform) : [...c.platforms, platform] }
          : c
      )
    );
  };

  return (
    <div className="space-y-3">
      {list.map((c) => (
        <div key={c.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Name</label>
              <input className={inputCls} value={c.name} onChange={(ev) => setOne(c.id, { name: ev.target.value })} placeholder="Competitor name" />
            </div>
            <div>
              <label className={labelCls}>Website</label>
              <input className={inputCls} value={c.website || ''} onChange={(ev) => setOne(c.id, { website: ev.target.value })} placeholder="https://…" />
            </div>
            <div className="flex items-end justify-end gap-1">
              <button type="button" onClick={() => setList(list.filter((x) => x.id !== c.id))} className="p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Platforms</label>
            <div className="flex flex-wrap gap-1.5">
              {SOCIAL_PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(c.id, p)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                    c.platforms.includes(p)
                      ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Strengths</label>
              <textarea rows={2} className={inputCls} value={c.strengths || ''} onChange={(ev) => setOne(c.id, { strengths: ev.target.value })} placeholder="What they do well…" />
            </div>
            <div>
              <label className={labelCls}>Weaknesses</label>
              <textarea rows={2} className={inputCls} value={c.weaknesses || ''} onChange={(ev) => setOne(c.id, { weaknesses: ev.target.value })} placeholder="Where we can win…" />
            </div>
          </div>
        </div>
      ))}
      <AddRowButton onClick={() => setList([...list, { id: uid(), name: '', platforms: [] }])} label="Add Competitor" />
    </div>
  );
}

// ─── Onboarding Checklist ────────────────────────────────────────────────────

export function OnboardingChecklistTab({
  value,
  onChange,
  services,
}: {
  value: ClientOnboarding;
  onChange: (v: ClientOnboarding) => void;
  services: string[];
}) {
  const { done, total, pct } = onboardingProgress(value);
  const list = value.checklist || generateChecklist(services);

  const toggle = (id: string) =>
    onChange({ ...value, checklist: list.map((i) => (i.id === id ? { ...i, completed: !i.completed } : i)) });

  const regenerate = () => onChange({ ...value, checklist: generateChecklist(services) });

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {done} of {total} completed
          </span>
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{pct}%</span>
        </div>
        <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[10px] text-slate-400">
          Auto-generated from subscribed services: {services.length ? services.join(', ') : 'none yet'}
        </p>
      </div>

      <div className="space-y-1.5">
        {list.map((i) => (
          <label key={i.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
            <input
              type="checkbox"
              checked={i.completed}
              onChange={() => toggle(i.id)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className={`text-xs ${i.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {i.label}
            </span>
            {i.service !== 'all' && (
              <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">
                {i.service}
              </span>
            )}
            {i.required && (
              <span className="text-[9px] font-semibold text-rose-500">Required</span>
            )}
          </label>
        ))}
      </div>

      <AddRowButton onClick={regenerate} label="Regenerate Checklist from Services" />
    </div>
  );
}

// ─── Tab switcher ────────────────────────────────────────────────────────────

export function OnboardingEditor({
  value,
  onChange,
  services,
  activeTab,
  setActiveTab,
  canEditCredentials,
}: {
  value: ClientOnboarding;
  onChange: (v: ClientOnboarding) => void;
  services: string[];
  activeTab: string;
  setActiveTab: (t: string) => void;
  canEditCredentials: boolean;
}) {
  const { pct } = onboardingProgress(value);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{pct}% complete</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ONBOARDING_TABS.map((t) => {
          const locked = t.key === 'accessCredentials' && !canEditCredentials;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => !locked && setActiveTab(t.key)}
              disabled={locked}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                activeTab === t.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              } ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {t.icon} {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'businessProfile' && <BusinessProfileTab value={value} onChange={onChange} />}
      {activeTab === 'accessCredentials' &&
        (canEditCredentials ? (
          <AccessCredentialsTab value={value} onChange={onChange} />
        ) : (
          <p className="text-xs text-slate-400 italic">View-Only users cannot access credentials.</p>
        ))}
      {activeTab === 'socialMedia' && <SocialMediaTab value={value} onChange={onChange} />}
      {activeTab === 'marketing' && <MarketingTab value={value} onChange={onChange} />}
      {activeTab === 'competitors' && <CompetitorsTab value={value} onChange={onChange} />}
      <OnboardingChecklistTab value={value} onChange={onChange} services={services} />
    </div>
  );
}

export { ONBOARDING_TABS };
