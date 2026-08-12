// Shared WhatsApp helpers (used by the communication modal and the composer widget).

let waWindow: Window | null = null;

export function cleanPhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone?: string, text = ''): string {
  const formatted = cleanPhone(phone);
  const encoded = encodeURIComponent(text);
  return `https://web.whatsapp.com/send?phone=${formatted}&text=${encoded}`;
}

/**
 * Opens WhatsApp Web in a small popout window. Reuses the same window so we
 * never stack multiple popups: a live reference is navigated via location.href,
 * and it is re-opened if it was closed.
 */
export function openWhatsAppPopout(url: string): Window | null {
  if (waWindow && !waWindow.closed) {
    waWindow.location.href = url;
    try {
      waWindow.focus();
    } catch {
      /* ignore */
    }
    return waWindow;
  }
  waWindow = window.open(url, 'bgt-whatsapp', 'width=520,height=760,resizable=yes,scrollbars=yes');
  return waWindow;
}
