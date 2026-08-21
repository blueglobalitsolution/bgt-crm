export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Connected'
  | 'Interested'
  | 'Qualified'
  | 'Meeting'
  | 'Proposal Sent'
  | 'Negotiation'
  | 'Won'
  | 'Lost'
  | 'Not Interested'
  | 'No Response';

/** Ordered sales funnel (active stages). Terminal statuses are handled separately. */
export const LEAD_STATUS_FLOW: LeadStatus[] = [
  'New',
  'Contacted',
  'Connected',
  'Interested',
  'Qualified',
  'Meeting',
  'Proposal Sent',
  'Negotiation',
  'Won',
];

/** Closed / terminal statuses, reachable from almost any stage. */
export const LEAD_TERMINAL_STATUSES: LeadStatus[] = ['Lost', 'Not Interested', 'No Response'];

export const LEAD_STATUS_META: Record<LeadStatus, { label: string; color: string }> = {
  New: { label: 'New', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  Contacted: { label: 'Contacted', color: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' },
  Connected: { label: 'Connected', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' },
  Interested: { label: 'Interested', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' },
  Qualified: { label: 'Qualified', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300' },
  Meeting: { label: 'Meeting', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' },
  'Proposal Sent': { label: 'Proposal Sent', color: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300' },
  Negotiation: { label: 'Negotiation', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' },
  Won: { label: 'Won', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  Lost: { label: 'Lost', color: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  'Not Interested': { label: 'Not Interested', color: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  'No Response': { label: 'No Response', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
};

export type LeadPriority = 'Hot' | 'Warm' | 'Cold';

export type FollowupType = 'Call' | 'WhatsApp' | 'Email' | 'Meeting';

export type ActivityType =
  | 'Phone Call'
  | 'WhatsApp'
  | 'SMS'
  | 'Email'
  | 'Personal Meeting'
  | 'Online Meeting'
  | 'Video Call'
  | 'Proposal Sent'
  | 'Price Discussion'
  | 'Negotiation'
  | 'Deal Won'
  | 'Deal Lost'
  | 'Note'
  | 'Follow-up'
  | 'Requirement'
  // Legacy types kept so historical records still render
  | 'Call'
  | 'Meeting'
  | 'Proposal'
  | 'Status Change'
  | 'System';

export type ActivityOutcome =
  | 'Connected'
  | 'Interested'
  | 'Not Interested'
  | 'No Response'
  | 'Call Back'
  | 'Meeting Scheduled'
  | 'Proposal Requested'
  | 'Other';

export const ACTIVITY_GROUPS: { group: string; items: ActivityType[] }[] = [
  { group: 'Communication', items: ['Phone Call', 'WhatsApp', 'SMS', 'Email'] },
  { group: 'Meetings', items: ['Personal Meeting', 'Online Meeting', 'Video Call'] },
  { group: 'Sales', items: ['Proposal Sent', 'Price Discussion', 'Negotiation', 'Deal Won', 'Deal Lost'] },
  { group: 'Internal', items: ['Note', 'Follow-up', 'Requirement'] },
];

export const ACTIVITY_OUTCOMES: ActivityOutcome[] = [
  'Connected',
  'Interested',
  'Not Interested',
  'No Response',
  'Call Back',
  'Meeting Scheduled',
  'Proposal Requested',
  'Other',
];

/** Map an activity outcome/type to an implied status, or null when none applies. */
export function statusFromOutcome(
  outcome: ActivityOutcome | undefined,
  activityType: ActivityType | undefined,
  currentStatus?: LeadStatus
): LeadStatus | null {
  if (activityType === 'Deal Won') return 'Won';
  if (activityType === 'Deal Lost') return 'Lost';
  if (!outcome) return null;
  switch (outcome) {
    case 'Connected':
      return 'Connected';
    case 'Call Back':
      return currentStatus === 'New' ? 'Contacted' : null;
    case 'Interested':
      return 'Interested';
    case 'Meeting Scheduled':
      return 'Meeting';
    case 'Proposal Requested':
      return 'Qualified';
    case 'Not Interested':
      return 'Not Interested';
    case 'No Response':
      return 'No Response';
    default:
      return null;
  }
}

/** Apply a status only if it moves forward in the funnel or is a terminal state. */
export function shouldApplyStatus(target: LeadStatus | null, current: LeadStatus): boolean {
  if (!target || target === current) return false;
  const flowIdx = LEAD_STATUS_FLOW.indexOf(current);
  const targetIdx = LEAD_STATUS_FLOW.indexOf(target);
  if (flowIdx === -1) return true; // from a terminal status, allow any explicit change
  if (targetIdx === -1) return true; // to a terminal status, always allowed
  return targetIdx > flowIdx;
}

/** Convert an activity type to the narrower follow-up channel type. */
export function followupTypeFromActivity(type: ActivityType): FollowupType {
  switch (type) {
    case 'Phone Call':
    case 'Call':
      return 'Call';
    case 'Email':
      return 'Email';
    case 'Personal Meeting':
    case 'Online Meeting':
    case 'Video Call':
      return 'Meeting';
    default:
      return 'WhatsApp';
  }
}

export const DIGITAL_MARKETING_SERVICES = [
  'Website Development',
  'SEO',
  'Google Ads',
  'Meta Ads',
  'Social Media Marketing',
  'Content Marketing',
  'Performance Marketing',
  'E-commerce Development',
  'Shopify',
  'WordPress',
  'Graphic Design',
  'Video Editing',
  'Branding',
  'Hosting',
  'Maintenance',
  'Mobile App Development',
  'Software Development',
  'Other',
] as const;

export type MarketingService = typeof DIGITAL_MARKETING_SERVICES[number];

export const LEAD_SOURCES = [
  'Excel Import',
  'Website',
  'Google',
  'Google Ads',
  'Facebook',
  'Instagram',
  'WhatsApp',
  'Referral',
  'Justdial',
  'IndiaMART',
  'Cold Calling',
  'Walk-in',
  'Existing Client',
  'Other',
] as const;

export type LeadSource = typeof LEAD_SOURCES[number];

export interface ActivityLog {
  id: string;
  leadId: string;
  type: ActivityType;
  summary: string;
  details?: string;
  timestamp: string;
  author: string;
  outcome?: ActivityOutcome;
}

export interface Followup {
  id: string;
  leadId: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g., "11:30 AM"
  type: FollowupType;
  reminder: string;
  note: string;
  completed: boolean;
  completedAt?: string;
}

/** A single contact person for a business (multiple contacts supported). */
export interface ContactPerson {
  id: string;
  name: string;
  mobile?: string;
  whatsapp?: string;
  email?: string;
  role?: string; // Owner / Manager / Centre Head / Accounts…
  isPrimary: boolean;
}

export interface Lead {
  id: string;
  companyName: string;
  contactPerson: string;
  contacts?: ContactPerson[];
  mobile: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  city?: string;
  state?: string;
  industry?: string;
  interestedServices: string[];
  leadSource: string;
  estimatedBudget?: string;
  expectedValue: number; // In INR ₹
  assignedTo: string;
  status: LeadStatus;
  priority: LeadPriority;
  requirementNotes?: string;
  createdAt: string;
  updatedAt: string;
  nextFollowupDate?: string;
  nextFollowupTime?: string;
  nextFollowupType?: FollowupType;
  nextFollowupNote?: string;
  activities: ActivityLog[];
  aiSummary?: string;
  aiSummaryGeneratedAt?: string;
  // Business profile (imported from Excel)
  jobId?: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  websitePhone?: string;
  whatsappUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  youtubeUrl?: string;
  // Website tech & tracking status
  cms?: string;
  ga4?: string;
  gtm?: string;
  metaPixel?: string;
  whatsappWidget?: string;
  liveChat?: string;
}

/** Business info extracted from an uploaded image or Google Maps / My Business link. */
export interface ExtractedBusinessInfo {
  companyName?: string;
  contactPerson?: string;
  mobile?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  industry?: string;
  rating?: number;
  reviewCount?: number;
  confidence: number; // 0-100
  source: 'image' | 'gmb';
  placeId?: string;
}

export interface ImportPreviewItem {
  id: string;
  rowIndex: number;
  raw: Record<string, any>;
  converted: Partial<Lead>;
  status: 'valid' | 'invalid' | 'duplicate';
  duplicateMatchId?: string;
  duplicateMatchName?: string;
  errors: string[];
  selectedAction?: 'import' | 'merge' | 'skip';
}

/** The website tech & tracking status fields shown on every lead. */
export const TECH_STATUS_FIELDS = [
  { key: 'cms', label: 'CMS' },
  { key: 'ga4', label: 'GA4' },
  { key: 'gtm', label: 'GTM' },
  { key: 'metaPixel', label: 'Meta Pixel' },
  { key: 'whatsappWidget', label: 'WhatsApp Widget' },
  { key: 'liveChat', label: 'Live Chat' },
] as const;

/** Excel columns used by the standard import template, in the exact sequence. */
export const EXCEL_TEMPLATE_COLUMNS = [
  'job_id',
  'business_name',
  'phone',
  'website',
  'address',
  'rating',
  'review_count',
  'email',
  'website_phone',
  'whatsapp_url',
  'instagram_url',
  'facebook_url',
  'linkedin_url',
  'youtube_url',
  'cms',
  'ga4',
  'gtm',
  'meta_pixel',
  'whatsapp_widget',
  'live_chat',
] as const;

// ─── Users & Roles ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  username: string;
  designation: string;
  active: number;
  email?: string;
  createdAt: string;
}

export interface Designation {
  designation: string;
  permissions: string[];
}

export interface Client {
  id: string;
  leadId?: string;
  companyName: string;
  contactPerson?: string;
  contacts?: ContactPerson[];
  mobile?: string;
  email?: string;
  website?: string;
  contractValue: number;
  monthlyRetainer: number;
  startDate?: string;
  endDate?: string;
  services: string[];
  accountManager?: string;
  agreementStatus: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  subscriptions?: ClientSubscription[];
  onboarding?: ClientOnboarding;
}

/** Billing types for customer service subscriptions. */
export const SUBSCRIPTION_TYPES = [
  'Monthly',
  'AMC / Yearly',
  'Hosting',
  'Mailing',
  'Retainer',
  'One-Time',
] as const;

export type SubscriptionType = (typeof SUBSCRIPTION_TYPES)[number];

export interface ClientSubscription {
  id: string;
  clientId: string;
  service: string;
  billingType: SubscriptionType;
  amount: number;
  startDate?: string;
  endDate?: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  monthlyLogs?: SubscriptionMonthlyLog[];
}

/** Monthly content delivery log for a subscription (posts + reels per month). */
export interface SubscriptionMonthlyLog {
  id: string;
  subscriptionId: string;
  month: string; // e.g. "2026-10"
  posts: number;
  reels: number;
  total: number; // auto = posts + reels
  recordedBy?: string;
  recordedAt?: string;
  /** Generic service-aware fields (per the delivery template). */
  fields?: Record<string, string | number>;
}

// ─── Client Onboarding (service-based customer information) ──────────────────

/** Business profile details captured at onboarding. */
export interface BusinessProfile {
  businessType?: string;
  targetLocation?: string;
  businessDescription?: string;
  googleMapLink?: string;
  establishedYear?: string;
  numberOfEmployees?: string;
  annualRevenueRange?: string;
}

/** A single email account with optional credentials. */
export interface ContactEmail {
  id: string;
  label: string; // Primary / Admin / Marketing / Notifications / Other
  email: string;
  password?: string;
  purpose?: string;
}

/** Hosting / domain credential. */
export interface HostingCredential {
  id: string;
  provider?: string;
  domain: string;
  panelUrl?: string;
  panelType?: string; // cpanel / plesk / custom / cloud
  username?: string;
  password?: string;
  ftpHost?: string;
  ftpUser?: string;
  ftpPass?: string;
  sslProvider?: string;
  sslExpiry?: string;
  notes?: string;
}

/** Website CMS credential. */
export interface CMSCredential {
  id: string;
  platform?: string; // wordpress / shopify / wix / squarespace / webflow / custom
  adminUrl?: string;
  username?: string;
  password?: string;
  notes?: string;
}

/** Analytics / tracking credential. */
export interface AnalyticsCredential {
  id: string;
  type: string; // ga4 / gtm / meta_pixel / search_console / bing_webmaster / clarity / hotjar
  accountId?: string;
  propertyId?: string;
  accessLevel?: string;
}

/** Catch-all credential for any other platform. */
export interface GenericCredential {
  id: string;
  platform: string;
  url?: string;
  username?: string;
  password?: string;
  notes?: string;
}

/** Access credentials bundle. */
export interface AccessCredentials {
  emails: ContactEmail[];
  hosting: HostingCredential[];
  cms: CMSCredential[];
  analytics: AnalyticsCredential[];
  other: GenericCredential[];
}

/** A social media platform account with activity + credentials. */
export interface SocialMediaProfile {
  id: string;
  platform: string; // facebook / instagram / linkedin / youtube / twitter / pinterest / threads / gmb / other
  handle?: string;
  url?: string;
  isActive: boolean;
  username?: string;
  password?: string;
  adAccountId?: string;
  businessManagerId?: string;
  postsCount?: string;
  reelsCount?: string;
  lastPostDate?: string;
}

/** Target SEO keyword with rank tracking info. */
export interface TargetKeyword {
  id: string;
  keyword: string;
  priority: 'high' | 'medium' | 'low';
  targetPage?: string;
  status: string; // researching / optimizing / ranking / maintained
}

/** A competitor profile. */
export interface CompetitorProfile {
  id: string;
  name: string;
  website?: string;
  platforms: string[];
  strengths?: string;
  weaknesses?: string;
  notes?: string;
}

/** Paid ads account. */
export interface AdAccount {
  id: string;
  platform: string; // meta / google / linkedin / twitter / other
  accountId?: string;
  accountName?: string;
  accessLevel?: string;
  currency?: string;
  timezone?: string;
}

/** Monthly marketing goal. */
export interface MonthlyGoal {
  id: string;
  month?: string;
  goal?: string;
}

/** Marketing & SEO bundle. */
export interface MarketingData {
  seoKeywords: string[];
  targetKeywords: TargetKeyword[];
  adAccounts: AdAccount[];
  monthlyGoals: MonthlyGoal[];
  notes?: string;
}

/** Onboarding checklist item. */
export interface OnboardingChecklistItem {
  id: string;
  service: string; // 'all' for base items
  field: string;
  label: string;
  required: boolean;
  completed: boolean;
}

/** Full onboarding payload attached to a Client. */
export interface ClientOnboarding {
  businessProfile?: BusinessProfile;
  accessCredentials?: AccessCredentials;
  socialMedia?: SocialMediaProfile[];
  marketing?: MarketingData;
  competitors?: CompetitorProfile[];
  checklist?: OnboardingChecklistItem[];
  status: 'pending' | 'in_progress' | 'completed';
}

export interface CRMStats {
  totalLeads: number;
  newLeads: number;
  followupsToday: number;
  hotLeads: number;
  wonValue: number;
  wonCount: number;
  lostCount: number;
  pipelineValue: number;
}

// ─── Website Audit Engine Types ────────────────────────────────────────────

export type AuditStatus = 'pending' | 'running' | 'completed' | 'failed';

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low' | 'notice';

export type AuditCategory =
  | 'availability'
  | 'broken_link'
  | 'broken_image'
  | 'seo'
  | 'technical'
  | 'performance'
  | 'security'
  | 'content';

export interface Website {
  id: string;
  leadId?: string;
  url: string;
  domain: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  latestAudit?: WebsiteAudit | null;
}

export interface WebsiteAudit {
  id: string;
  websiteId: string;
  status: AuditStatus;
  healthScore: number | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  pagesFound: number;
  pagesCrawled: number;
  internalLinks: number;
  externalLinks: number;
  brokenLinks: number;
  brokenImages: number;
  redirects: number;
  seoIssues: number;
  technicalIssues: number;
  websiteOnline: number | null;
  domainResolves: number | null;
  httpsEnabled: number | null;
  sslValid: number | null;
  sslExpiryDate: string | null;
  httpStatus: number | null;
  responseTimeMs: number | null;
  wwwStatus: string | null;
  error: string | null;
  unresponsive: number;
  scoreAvailability: number;
  scoreTechnical: number;
  scoreLinks: number;
  scoreOnpage: number;
  scorePerformance: number;
  scoreSecurity: number;
  createdAt: string;
}

export interface AuditPage {
  id: string;
  auditId: string;
  url: string;
  statusCode: number | null;
  title: string | null;
  titleLength: number | null;
  metaDescription: string | null;
  metaDescLength: number | null;
  h1Count: number | null;
  h1Text: string | null;
  h2Count: number | null;
  canonicalUrl: string | null;
  robotsMeta: string | null;
  wordCount: number | null;
  score: number | null;
  loadTimeMs: number | null;
  internalLinks: number;
  externalLinks: number;
  brokenLinks: number;
  imagesMissingAlt: number;
}

export interface AuditIssue {
  id: string;
  auditId: string;
  pageId?: string;
  category: AuditCategory;
  severity: AuditSeverity;
  type: string;
  title: string;
  description?: string;
  sourceUrl?: string;
  targetUrl?: string;
  httpStatus?: number;
  recommendation?: string;
  createdAt: string;
}

export interface BrokenLink {
  id: string;
  auditId: string;
  sourcePageUrl: string;
  sourcePageTitle?: string;
  linkUrl: string;
  linkText?: string;
  linkType: string;
  httpStatus: number | null;
  errorType: string;
  isFixed: number;
  isIgnored: number;
  foundAt: string;
  fixedAt?: string;
}

export interface WebsiteAuditDashboardStats {
  totalWebsites: number;
  totalAudits: number;
  auditedWebsites: number;
  averageHealthScore: number;
  totalBrokenLinks: number;
  totalSeoIssues: number;
  totalTechnicalIssues: number;
  sitesWithIssues: number;
  websitesOnline: number;
  websitesOffline: number;
}
