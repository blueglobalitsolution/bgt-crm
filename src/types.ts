export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Interested'
  | 'Follow-up'
  | 'Meeting'
  | 'Proposal Sent'
  | 'Negotiation'
  | 'Won'
  | 'Lost'
  | 'Not Interested';

export type LeadPriority = 'Hot' | 'Warm' | 'Cold';

export type FollowupType = 'Call' | 'WhatsApp' | 'Email' | 'Meeting';

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
  type: 'Call' | 'WhatsApp' | 'Email' | 'Proposal' | 'Note' | 'Status Change' | 'System';
  summary: string;
  details?: string;
  timestamp: string;
  author: string;
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

export interface Lead {
  id: string;
  companyName: string;
  contactPerson: string;
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
