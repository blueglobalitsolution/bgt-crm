// Shared WhatsApp helpers (used by the communication modal and the composer widget).

import { Lead } from '../types';

export function cleanPhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone?: string, text = ''): string {
  const formatted = cleanPhone(phone);
  const encoded = encodeURIComponent(text);
  // wa.me is the universal click-to-chat link: on mobile it opens the native
  // WhatsApp/WhatsApp Business app with the text pre-filled; on desktop it
  // opens WhatsApp Web in a new tab.
  return `https://wa.me/${formatted}?text=${encoded}`;
}

export function buildWhatsAppDraftMessage(lead: Lead): string {
  const servicesStr = lead.interestedServices?.join(', ') || 'Digital Marketing Services';
  return `Hi ${lead.contactPerson || 'there'}, greeting from BGT Digital Marketing! I am reaching out regarding your interest in ${servicesStr} for ${lead.companyName}. When is a good time to connect for a quick 5-minute call?`;
}

export function openWhatsApp(url: string): Window | null {
  return window.open(url, '_blank', 'noopener,noreferrer');
}
