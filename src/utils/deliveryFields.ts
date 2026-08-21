/**
 * Service-aware delivery log templates.
 *
 * Every subscribed service has a set of fields a team member fills in each
 * time work is delivered (e.g. monthly for SMM, per-work for Graphic Design,
 * per-task for Website Development). The Subscriptions tab renders the log
 * table and the "Add entry" form dynamically from these templates.
 */

export type DeliveryFieldType = 'month' | 'date' | 'number' | 'text' | 'textarea';

export interface DeliveryFieldDef {
  key: string;
  label: string;
  type: DeliveryFieldType;
  required?: boolean;
  placeholder?: string;
}

export interface DeliveryTemplate {
  /** Exact service name match (case-insensitive). 'Other' is the fallback. */
  service: string;
  /** Short title for the log section. */
  title: string;
  /** Entry type label shown in the header (e.g. "Monthly", "Per work", "Task"). */
  entryType: string;
  /** Fields captured on every entry, in display order. */
  fields: DeliveryFieldDef[];
  /** Keys whose numeric sum is shown as an auto-count in the header/summary. */
  totalFrom?: string[];
  /** Label for the auto-total (e.g. "Total", "Quantity"). */
  totalLabel?: string;
  /** If true, the primary date field is a month picker instead of a date. */
  monthly?: boolean;
}

const NUM = (key: string, label: string, required = false, placeholder = '0'): DeliveryFieldDef => ({
  key,
  label,
  type: 'number',
  required,
  placeholder,
});

const MONTH: DeliveryFieldDef = { key: 'month', label: 'Month', type: 'month', required: true };
const DATE: DeliveryFieldDef = { key: 'date', label: 'Date', type: 'date', required: true };
const REMARKS: DeliveryFieldDef = { key: 'remarks', label: 'Remarks', type: 'textarea' };

/** Every entry carries these on the backend. */
export const COMMON_FIELDS = ['recordedBy', 'recordedAt'];

const TEMPLATES: DeliveryTemplate[] = [
  {
    service: 'Social Media Marketing',
    title: 'Monthly Posts & Reels',
    entryType: 'Monthly',
    monthly: true,
    fields: [MONTH, NUM('posts', 'Posts', true), NUM('reels', 'Reels', true), REMARKS],
    totalFrom: ['posts', 'reels'],
    totalLabel: 'Total',
  },
  {
    service: 'Content Marketing',
    title: 'Monthly Content Delivery',
    entryType: 'Monthly',
    monthly: true,
    fields: [MONTH, NUM('posts', 'Posts'), NUM('reels', 'Reels'), NUM('articles', 'Articles / Blogs'), REMARKS],
    totalFrom: ['posts', 'reels', 'articles'],
    totalLabel: 'Total',
  },
  {
    service: 'Graphic Design',
    title: 'Design Work Delivered',
    entryType: 'Per work',
    fields: [DATE, NUM('quantity', 'Quantity', true, 'e.g. 5'), REMARKS],
    totalFrom: ['quantity'],
    totalLabel: 'Quantity',
  },
  {
    service: 'Video Editing',
    title: 'Videos Delivered',
    entryType: 'Per work',
    fields: [DATE, NUM('quantity', 'Quantity (videos)', true, 'e.g. 3'), REMARKS],
    totalFrom: ['quantity'],
    totalLabel: 'Quantity',
  },
  {
    service: 'Branding',
    title: 'Brand Deliverables',
    entryType: 'Per work',
    fields: [DATE, { key: 'deliverable', label: 'Deliverable type', type: 'text', placeholder: 'Logo / Brand kit / Stationery' }, NUM('quantity', 'Quantity'), REMARKS],
    totalFrom: ['quantity'],
    totalLabel: 'Quantity',
  },
  {
    service: 'Website Development',
    title: 'Development Tasks',
    entryType: 'Task',
    fields: [DATE, { key: 'task', label: 'Task / Module', type: 'text', required: true }, NUM('progress', 'Progress %', false, 'e.g. 50'), REMARKS],
  },
  {
    service: 'E-commerce Development',
    title: 'Development Tasks',
    entryType: 'Task',
    fields: [DATE, { key: 'task', label: 'Task / Module', type: 'text', required: true }, NUM('progress', 'Progress %', false, 'e.g. 50'), REMARKS],
  },
  {
    service: 'Shopify',
    title: 'Shopify Tasks',
    entryType: 'Task',
    fields: [DATE, { key: 'task', label: 'Task / Module', type: 'text', required: true }, NUM('progress', 'Progress %', false, 'e.g. 50'), REMARKS],
  },
  {
    service: 'WordPress',
    title: 'WordPress Tasks',
    entryType: 'Task',
    fields: [DATE, { key: 'task', label: 'Task / Module', type: 'text', required: true }, NUM('progress', 'Progress %', false, 'e.g. 50'), REMARKS],
  },
  {
    service: 'Mobile App Development',
    title: 'App Development Tasks',
    entryType: 'Task',
    fields: [DATE, { key: 'task', label: 'Feature / Module', type: 'text', required: true }, NUM('hours', 'Hours'), NUM('progress', 'Progress %', false, 'e.g. 50'), REMARKS],
  },
  {
    service: 'Software Development',
    title: 'Software Development Tasks',
    entryType: 'Task',
    fields: [DATE, { key: 'task', label: 'Feature / Module', type: 'text', required: true }, NUM('hours', 'Hours'), NUM('progress', 'Progress %', false, 'e.g. 50'), REMARKS],
  },
  {
    service: 'SEO',
    title: 'Monthly SEO Work',
    entryType: 'Monthly',
    monthly: true,
    fields: [MONTH, NUM('keywords', 'Keywords targeted'), NUM('backlinks', 'Backlinks'), REMARKS],
    totalFrom: ['keywords', 'backlinks'],
    totalLabel: 'Total',
  },
  {
    service: 'Google Ads',
    title: 'Monthly Ads Report',
    entryType: 'Monthly',
    monthly: true,
    fields: [MONTH, NUM('campaigns', 'Campaigns'), NUM('spend', 'Spend ₹'), NUM('leads', 'Leads / Conversions'), REMARKS],
    totalFrom: ['campaigns', 'leads'],
    totalLabel: 'Total',
  },
  {
    service: 'Meta Ads',
    title: 'Monthly Ads Report',
    entryType: 'Monthly',
    monthly: true,
    fields: [MONTH, NUM('campaigns', 'Campaigns'), NUM('spend', 'Spend ₹'), NUM('leads', 'Leads / Conversions'), REMARKS],
    totalFrom: ['campaigns', 'leads'],
    totalLabel: 'Total',
  },
  {
    service: 'Performance Marketing',
    title: 'Monthly Performance Report',
    entryType: 'Monthly',
    monthly: true,
    fields: [MONTH, NUM('campaigns', 'Campaigns'), NUM('spend', 'Spend ₹'), NUM('conversions', 'Conversions'), REMARKS],
    totalFrom: ['campaigns', 'conversions'],
    totalLabel: 'Total',
  },
  {
    service: 'Hosting',
    title: 'Hosting Check-ins',
    entryType: 'Check',
    fields: [DATE, NUM('uptime', 'Uptime %', false, 'e.g. 99.9'), { key: 'renewal', label: 'Renewal date', type: 'date' }, REMARKS],
  },
  {
    service: 'Maintenance',
    title: 'Maintenance Tasks',
    entryType: 'Task',
    fields: [DATE, { key: 'task', label: 'Task done', type: 'text', required: true }, NUM('hours', 'Hours'), REMARKS],
  },
  {
    service: 'Other',
    title: 'Work Delivered',
    entryType: 'Generic',
    fields: [DATE, NUM('quantity', 'Quantity', false, 'e.g. 5'), REMARKS],
    totalFrom: ['quantity'],
    totalLabel: 'Quantity',
  },
];

export function deliveryTemplateFor(service: string): DeliveryTemplate {
  const found = TEMPLATES.find((t) => t.service.toLowerCase() === (service || '').trim().toLowerCase());
  return found || TEMPLATES[TEMPLATES.length - 1]; // 'Other' fallback
}

/** Compute the auto-total for a template from the numeric fields provided. */
export function computeDeliveryTotal(template: DeliveryTemplate, fields: Record<string, string | number | undefined>): number {
  if (!template.totalFrom || template.totalFrom.length === 0) return 0;
  return template.totalFrom.reduce((sum, key) => {
    const v = fields[key];
    return sum + (Number(v) || 0);
  }, 0);
}

/** A compact single-line summary for the subscription row header. */
export function deliverySummary(template: DeliveryTemplate, fields: Record<string, string | number | undefined>): string | null {
  const parts: string[] = [];
  if (template.monthly && fields.month) parts.push(String(fields.month));
  if (template.totalFrom) {
    const total = computeDeliveryTotal(template, fields);
    if (total > 0) parts.push(`${template.totalLabel || 'Total'}: ${total}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
