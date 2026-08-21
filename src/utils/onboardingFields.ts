import { OnboardingChecklistItem, ClientOnboarding } from '../types';

/**
 * Maps CRM services to the onboarding tabs that are relevant for that service.
 * The tabs are always shown in the onboarding section, but the checklist
 * items (and therefore the "required" fields) are derived from the services
 * the customer actually subscribed to.
 */

export type OnboardingTabKey =
  | 'businessProfile'
  | 'accessCredentials'
  | 'socialMedia'
  | 'marketing'
  | 'competitors';

export interface OnboardingTabMeta {
  key: OnboardingTabKey;
  label: string;
  icon: string;
  hint: string;
  requiredFor: string[]; // service names that make this tab required
}

export const ONBOARDING_TABS: OnboardingTabMeta[] = [
  {
    key: 'businessProfile',
    label: 'Business Profile',
    icon: '🏢',
    hint: 'Business type, location, description & maps link',
    requiredFor: [],
  },
  {
    key: 'accessCredentials',
    label: 'Access & Credentials',
    icon: '🔐',
    hint: 'Emails, hosting, CMS & analytics logins',
    requiredFor: [
      'Website Development',
      'E-commerce Development',
      'Shopify',
      'WordPress',
      'Hosting',
      'Maintenance',
      'SEO',
      'Performance Marketing',
      'Content Marketing',
    ],
  },
  {
    key: 'socialMedia',
    label: 'Social Media',
    icon: '📱',
    hint: 'Platforms, handles, links & credentials',
    requiredFor: ['Social Media Marketing', 'Content Marketing', 'Branding', 'SEO'],
  },
  {
    key: 'marketing',
    label: 'SEO & Marketing',
    icon: '🎯',
    hint: 'Keywords, targets, ad accounts & goals',
    requiredFor: ['SEO', 'Google Ads', 'Meta Ads', 'Performance Marketing', 'Content Marketing', 'Social Media Marketing'],
  },
  {
    key: 'competitors',
    label: 'Competitors',
    icon: '👥',
    hint: 'Competing businesses & their platforms',
    requiredFor: ['SEO', 'Performance Marketing', 'Content Marketing'],
  },
];

export const SOCIAL_PLATFORMS = [
  'Facebook',
  'Instagram',
  'LinkedIn',
  'YouTube',
  'Twitter / X',
  'Pinterest',
  'Threads',
  'Google My Business',
  'WhatsApp Business',
  'Telegram',
  'Other',
];

export const SEO_KEYWORD_SUGGESTIONS = [
  'Best',
  'Near me',
  'Top',
  'Affordable',
  'Local',
  'Premium',
];

let seq = 0;
export const uid = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Base checklist items that apply to every customer, regardless of services. */
const BASE_CHECKLIST: Array<Omit<OnboardingChecklistItem, 'id' | 'completed'>> = [
  { service: 'all', field: 'businessProfile.businessType', label: 'Business type', required: true },
  { service: 'all', field: 'businessProfile.targetLocation', label: 'Target location', required: true },
  { service: 'all', field: 'businessProfile.googleMapLink', label: 'Google Maps link', required: false },
  { service: 'all', field: 'accessCredentials.emails', label: 'Business email + password', required: true },
  { service: 'all', field: 'accessCredentials.hosting', label: 'Domain / hosting access', required: false },
  { service: 'all', field: 'socialMedia', label: 'Social media handles & links', required: false },
];

/** Service → checklist items. Matched by exact service name. */
const SERVICE_CHECKLIST: Record<string, Array<Omit<OnboardingChecklistItem, 'id' | 'completed'>>> = {
  'Website Development': [
    { service: 'Website Development', field: 'accessCredentials.cms', label: 'CMS / admin login', required: true },
    { service: 'Website Development', field: 'accessCredentials.hosting', label: 'Hosting panel login', required: true },
    { service: 'Website Development', field: 'businessProfile.website', label: 'Website URL', required: true },
  ],
  'E-commerce Development': [
    { service: 'E-commerce Development', field: 'accessCredentials.cms', label: 'Store admin login', required: true },
    { service: 'E-commerce Development', field: 'accessCredentials.hosting', label: 'Hosting panel login', required: true },
  ],
  Shopify: [
    { service: 'Shopify', field: 'accessCredentials.cms', label: 'Shopify admin login', required: true },
  ],
  WordPress: [
    { service: 'WordPress', field: 'accessCredentials.cms', label: 'WordPress admin login', required: true },
  ],
  Hosting: [
    { service: 'Hosting', field: 'accessCredentials.hosting', label: 'Hosting + domain access', required: true },
    { service: 'Hosting', field: 'accessCredentials.hosting.sslExpiry', label: 'SSL certificate expiry', required: false },
  ],
  Maintenance: [
    { service: 'Maintenance', field: 'accessCredentials.cms', label: 'CMS login', required: true },
    { service: 'Maintenance', field: 'accessCredentials.hosting', label: 'Hosting access', required: true },
  ],
  SEO: [
    { service: 'SEO', field: 'marketing.seoKeywords', label: 'SEO keywords list', required: true },
    { service: 'SEO', field: 'marketing.targetKeywords', label: 'Target keyword plan', required: false },
    { service: 'SEO', field: 'competitors', label: 'Competitor list', required: false },
    { service: 'SEO', field: 'accessCredentials.analytics', label: 'GA4 / Search Console access', required: true },
  ],
  'Google Ads': [
    { service: 'Google Ads', field: 'marketing.adAccounts', label: 'Google Ads account access', required: true },
    { service: 'Google Ads', field: 'accessCredentials.analytics', label: 'GA4 access', required: true },
  ],
  'Meta Ads': [
    { service: 'Meta Ads', field: 'marketing.adAccounts', label: 'Meta ads manager / business manager', required: true },
    { service: 'Meta Ads', field: 'socialMedia', label: 'Facebook / Instagram page access', required: true },
  ],
  'Social Media Marketing': [
    { service: 'Social Media Marketing', field: 'socialMedia', label: 'Social media handles & logins', required: true },
    { service: 'Social Media Marketing', field: 'marketing.monthlyGoals', label: 'Monthly content goals', required: false },
  ],
  'Content Marketing': [
    { service: 'Content Marketing', field: 'marketing.seoKeywords', label: 'Content keywords', required: true },
    { service: 'Content Marketing', field: 'socialMedia', label: 'Social handles', required: true },
    { service: 'Content Marketing', field: 'competitors', label: 'Competitor content', required: false },
  ],
  'Performance Marketing': [
    { service: 'Performance Marketing', field: 'marketing.adAccounts', label: 'Ad accounts', required: true },
    { service: 'Performance Marketing', field: 'accessCredentials.analytics', label: 'Analytics access', required: true },
    { service: 'Performance Marketing', field: 'competitors', label: 'Competitor list', required: false },
  ],
  Branding: [
    { service: 'Branding', field: 'socialMedia', label: 'Social media accounts', required: true },
    { service: 'Branding', field: 'businessProfile.businessDescription', label: 'Brand description', required: false },
  ],
};

/** Which services trigger the credentials tab to be required (non-empty). */
export function servicesRequireTab(services: string[], tab: OnboardingTabKey): boolean {
  if (tab === 'businessProfile') return true;
  const meta = ONBOARDING_TABS.find((t) => t.key === tab);
  if (!meta) return false;
  return services.some((s) => meta.requiredFor.includes(s));
}

/**
 * Generate the onboarding checklist from the customer's subscribed services.
 * Base items always included; service items appended per matched service.
 */
export function generateChecklist(services: string[]): OnboardingChecklistItem[] {
  const items: OnboardingChecklistItem[] = BASE_CHECKLIST.map((i) => ({
    ...i,
    id: uid(),
    completed: false,
  }));
  for (const srv of services) {
    const mapped = SERVICE_CHECKLIST[srv];
    if (!mapped) continue;
    for (const item of mapped) {
      items.push({ ...item, id: uid(), completed: false });
    }
  }
  return items;
}

/** Count how many checklist items are marked complete. */
export function onboardingProgress(o: ClientOnboarding | undefined): { done: number; total: number; pct: number } {
  const list = o?.checklist;
  if (!list || list.length === 0) return { done: 0, total: 0, pct: 0 };
  const done = list.filter((i) => i.completed).length;
  return { done, total: list.length, pct: Math.round((done / list.length) * 100) };
}

/** Derive a coarse status from the checklist progress. */
export function onboardingStatus(o: ClientOnboarding | undefined): 'pending' | 'in_progress' | 'completed' {
  if (o?.status) return o.status;
  const { done, total } = onboardingProgress(o);
  if (total === 0) return 'pending';
  if (done === total) return 'completed';
  if (done > 0) return 'in_progress';
  return 'pending';
}
