import React, { useState } from 'react';
import { X, Play } from 'lucide-react';
import { Website } from '../types';

interface AuditRunModalProps {
  website: Website | null;
  onClose: () => void;
  onConfirm: (options: { maxPages: number; renderJs: boolean; timeoutSeconds: number }) => Promise<void>;
}

export const AuditRunModal: React.FC<AuditRunModalProps> = ({ website, onClose, onConfirm }) => {
  const [maxPages, setMaxPages] = useState(500);
  const [renderJs, setRenderJs] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(60);

  if (!website) return null;

  const handleRun = () => {
    // Close instantly; start the audit in the background.
    onClose();
    onConfirm({ maxPages, renderJs, timeoutSeconds }).catch((e: any) => {
      alert(e?.message || 'Failed to start audit');
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
              <Play className="w-4 h-4 text-blue-600" />
              Run Website Audit
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{website.domain}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700 rounded-xl p-3 text-xs">
            <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">What the audit checks</div>
            <ul className="text-slate-600 dark:text-slate-400 space-y-0.5 list-disc pl-4">
              <li>Website availability, SSL, DNS & response time</li>
              <li>Crawl pages, internal & external links</li>
              <li>Broken links & broken images</li>
              <li>On-page SEO (titles, meta, headings, content)</li>
              <li>Technical issues (duplicates, redirects, sitemap)</li>
              <li>100-point health score + sales report</li>
            </ul>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Max pages to crawl
            </label>
            <input
              type="number"
              min={10}
              max={5000}
              step={50}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
            />
            <p className="text-[10px] text-slate-400 mt-1">Larger sites take longer. 500 is a good default.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Response timeout
            </label>
            <select
              value={timeoutSeconds}
              onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
              className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 focus:ring-2 focus:ring-blue-500 dark:text-slate-100"
            >
              <option value={30}>30 seconds (fast sites)</option>
              <option value={60}>60 seconds (default)</option>
              <option value={120}>120 seconds (slow sites)</option>
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              How long to wait for the homepage before marking it unresponsive.
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={renderJs}
              onChange={(e) => setRenderJs(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Render JavaScript (Playwright) — slower, for JS-heavy sites
          </label>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
            >
              Cancel
            </button>
            <button
              onClick={handleRun}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              Start Audit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
