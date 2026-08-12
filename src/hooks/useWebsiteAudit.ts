import { useCallback, useEffect, useState } from 'react';
import { auditApi, StartAuditOptions } from '../utils/auditApi';
import { Website, WebsiteAudit, WebsiteAuditDashboardStats } from '../types';

export function useWebsiteAudit() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [stats, setStats] = useState<WebsiteAuditDashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [w, s] = await Promise.all([auditApi.listWebsites(), auditApi.getStats()]);
      setWebsites(w.websites);
      setStats(s.stats);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load audit data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const syncLeadsWebsites = useCallback(
    async (leads: Array<{ id: string; website?: string; companyName: string }>) => {
      const items = leads
        .filter((l) => l.website && l.website.trim())
        .map((l) => ({ leadId: l.id, url: l.website!.trim(), name: l.companyName }));
      if (items.length === 0) return 0;
      try {
        const res = await auditApi.syncWebsites(items);
        await refresh();
        return res.created;
      } catch {
        return 0;
      }
    },
    [refresh]
  );

  const startAudit = useCallback(
    async (websiteId: string, options?: StartAuditOptions) => {
      const res = await auditApi.startAudit(websiteId, options);
      return res.audit;
    },
    []
  );

  return { websites, stats, loading, error, refresh, syncLeadsWebsites, startAudit };
}

/**
 * Poll an audit until it finishes. Calls onUpdate with the latest audit snapshot.
 */
export function useAuditPolling(auditId: string | null, onUpdate: (audit: WebsiteAudit) => void) {
  useEffect(() => {
    if (!auditId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await auditApi.getAudit(auditId);
        if (cancelled) return;
        onUpdate(res.audit);
        if (res.audit.status === 'running' || res.audit.status === 'pending') {
          timer = setTimeout(tick, 3000);
        }
      } catch {
        if (!cancelled) timer = setTimeout(tick, 4000);
      }
    };

    timer = setTimeout(tick, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [auditId, onUpdate]);
}
