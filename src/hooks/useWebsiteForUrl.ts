import { useEffect, useState } from 'react';
import { Website } from '../types';
import { auditApi } from '../utils/auditApi';

/**
 * Resolves the linked Website record (with latest audit) for a lead's website URL.
 */
export function useWebsiteForUrl(websiteUrl?: string) {
  const [website, setWebsite] = useState<Website | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!websiteUrl) {
      setWebsite(null);
      return;
    }
    setLoading(true);
    auditApi
      .listWebsites()
      .then((res) => {
        if (cancelled) return;
        const url = websiteUrl.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase();
        const match = res.websites.find((w) => {
          const wUrl = w.url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase();
          return wUrl === url || w.domain === url;
        });
        setWebsite(match || null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [websiteUrl]);

  return { website, loading };
}
