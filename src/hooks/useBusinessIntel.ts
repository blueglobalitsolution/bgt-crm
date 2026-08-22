import { useState, useCallback } from 'react';
import { ExtractedBusinessInfo } from '../types';
import { getAuthToken } from '../utils/auditApi';

interface BusinessIntelResult {
  loading: boolean;
  error: string | null;
  extractFromImage: (file: File) => Promise<ExtractedBusinessInfo | null>;
  extractFromGMB: (url: string) => Promise<ExtractedBusinessInfo | null>;
  clearError: () => void;
}

/**
 * Uploads an image (or resolves a Google Maps / My Business URL) and returns the
 * business information extracted by the server (Gemini vision / Google Places).
 */
export function useBusinessIntel(): BusinessIntelResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const run = useCallback(async (url: string, init: RequestInit): Promise<ExtractedBusinessInfo | null> => {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { ...init, headers: { ...init.headers, ...headers } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      return body as ExtractedBusinessInfo;
    } catch (e: any) {
      setError(e?.message || 'Failed to extract business information.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const extractFromImage = useCallback(
    async (file: File): Promise<ExtractedBusinessInfo | null> => {
      if (file.size > 8 * 1024 * 1024) {
        setError('Image is too large. Please use an image under 8 MB.');
        return null;
      }
      const form = new FormData();
      form.append('file', file);
      return run('/api/business-intel/extract-from-image', { method: 'POST', body: form });
    },
    [run]
  );

  const extractFromGMB = useCallback(
    async (url: string): Promise<ExtractedBusinessInfo | null> =>
      run('/api/business-intel/extract-from-gmb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      }),
    [run]
  );

  return { loading, error, extractFromImage, extractFromGMB, clearError };
}
