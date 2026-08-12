import { useEffect, useState } from 'react';
import { auditApi } from '../utils/auditApi';

/**
 * Polls the backend for audits that are currently running/pending so the UI can
 * show a live "N audits running" indicator from any screen. Safe to mount once
 * at the app root; polls every 5s and tolerates transient failures.
 */
export function useAuditMonitor(pollMs = 5000) {
  const [runningCount, setRunningCount] = useState(0);
  const [runningAudits, setRunningAudits] = useState<
    Array<{ id: string; websiteId: string; status: string }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (cancelled) return;
      try {
        const res = await auditApi.getRunningAudits();
        if (cancelled) return;
        setRunningCount(res.running);
        setRunningAudits(
          res.audits.map((a) => ({ id: a.id, websiteId: a.websiteId, status: a.status }))
        );
      } catch {
        // transient error — keep last known count
      }
      timer = setTimeout(tick, pollMs);
    };

    timer = setTimeout(tick, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pollMs]);

  return { runningCount, runningAudits };
}
