import { auditApi } from './auditApi';
import { SEVERITY_META, formatDuration, formatSqliteDate, formatResponseTime } from './auditFormat';

/**
 * Fetches the full audit report and opens a clean, printable window so the
 * sales team can save/print it for follow-up conversations.
 */
export async function printAuditReport(auditId: string): Promise<void> {
  const { audit, website, pages, issues, brokenLinks } = await auditApi.getReport(auditId);

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Website Audit Report - ${website.domain}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:32px auto;max-width:860px;padding:0 24px;color:#0f172a}
  h1{font-size:22px;margin:0 0 4px} .sub{color:#64748b;font-size:13px;margin-bottom:24px}
  .score{display:inline-block;background:#1d4ed8;color:#fff;border-radius:12px;padding:10px 18px;font-size:28px;font-weight:800}
  h2{font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:#334155;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:28px 0 12px}
  table{width:100%;border-collapse:collapse;font-size:12.5px} th,td{text-align:left;padding:7px 9px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  th{background:#f1f5f9;font-size:11px;text-transform:uppercase;letter-spacing:.03em;color:#475569}
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px} .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:12.5px}
  .box b{display:block;color:#64748b;font-size:11px;text-transform:uppercase;margin-bottom:2px}
  .sev{font-weight:700} .sev-critical,.sev-high{color:#b91c1c} .sev-medium{color:#b45309} .sev-low,.sev-notice{color:#0369a1}
  .pass{color:#15803d;font-weight:600} .fail{color:#b91c1c;font-weight:600}
  @media print{ body{margin:10mm} h2{break-after:avoid} table{break-inside:avoid} }
</style></head><body>
  <h1>Website Health Audit Report</h1>
  <div class="sub">${website.domain} &bull; Run on ${formatSqliteDate(audit.completedAt || audit.createdAt)} &bull; BGT Digital Marketing CRM</div>
  <span class="score">${audit.healthScore ?? 0}/100</span>
  <p class="sub" style="margin-top:8px">Status: ${audit.status.toUpperCase()} &bull; Duration: ${formatDuration(audit.durationMs)} &bull; Crawled ${audit.pagesCrawled} pages</p>

  <h2>Category Scores</h2>
  <div class="grid">
    <div class="box"><b>Website Availability</b>${audit.scoreAvailability ?? 0} / 15</div>
    <div class="box"><b>Technical SEO</b>${audit.scoreTechnical ?? 0} / 20</div>
    <div class="box"><b>Broken Links</b>${audit.scoreLinks ?? 0} / 20</div>
    <div class="box"><b>On-Page SEO</b>${audit.scoreOnpage ?? 0} / 20</div>
    <div class="box"><b>Performance</b>${audit.scorePerformance ?? 0} / 15</div>
    <div class="box"><b>Security / SSL</b>${audit.scoreSecurity ?? 0} / 10</div>
  </div>

  <h2>Website Status</h2>
  <table>
    <tr><th>Check</th><th>Result</th></tr>
    <tr><td>Website Online</td><td>${audit.websiteOnline === 1 ? '<span class="pass">Online</span>' : '<span class="fail">Offline</span>'}</td></tr>
    <tr><td>DNS</td><td>${audit.domainResolves === 1 ? '<span class="pass">Resolves</span>' : '<span class="fail">Fails</span>'}</td></tr>
    <tr><td>HTTPS</td><td>${audit.httpsEnabled === 1 ? '<span class="pass">Enabled</span>' : '<span class="fail">Not enabled</span>'}</td></tr>
    <tr><td>SSL Certificate</td><td>${audit.sslValid === 1 ? `<span class="pass">Valid${audit.sslExpiryDate ? ` (expires ${audit.sslExpiryDate})` : ''}</span>` : '<span class="fail">Invalid / missing</span>'}</td></tr>
    <tr><td>HTTP Status</td><td>${audit.httpStatus ?? '—'}</td></tr>
    <tr><td>Response Time</td><td>${formatResponseTime(audit.responseTimeMs)}</td></tr>
  </table>

  <h2>Crawl Summary</h2>
  <div class="grid">
    <div class="box"><b>Pages Crawled</b>${audit.pagesCrawled}</div>
    <div class="box"><b>Internal Links</b>${audit.internalLinks}</div>
    <div class="box"><b>External Links</b>${audit.externalLinks}</div>
    <div class="box"><b>Broken Links</b>${audit.brokenLinks}</div>
    <div class="box"><b>Broken Images</b>${audit.brokenImages}</div>
    <div class="box"><b>Redirects</b>${audit.redirects}</div>
    <div class="box"><b>SEO Issues</b>${audit.seoIssues}</div>
    <div class="box"><b>Technical Issues</b>${audit.technicalIssues}</div>
  </div>

  <h2>Issues (${issues.length})</h2>
  <table>
    <tr><th>Severity</th><th>Category</th><th>Issue</th></tr>
    ${issues.slice(0, 60).map((i) => `<tr><td class="sev sev-${i.severity}">${(SEVERITY_META[i.severity] || SEVERITY_META.notice).label}</td><td>${i.category}</td><td>${i.title}${i.sourceUrl ? `<br><span style="color:#64748b">${i.sourceUrl}</span>` : ''}</td></tr>`).join('')}
  </table>

  <h2>Broken Links (${brokenLinks.length})</h2>
  <table>
    <tr><th>Broken URL</th><th>Status</th><th>Found On</th></tr>
    ${brokenLinks.slice(0, 50).map((b) => `<tr><td>${b.linkUrl}</td><td class="fail">${b.errorType}</td><td>${b.sourcePageUrl}</td></tr>`).join('')}
  </table>

  <h2>Top Page Scores</h2>
  <table>
    <tr><th>URL</th><th>Score</th><th>Title</th><th>Meta Desc</th><th>H1</th><th>Words</th></tr>
    ${pages.slice(0, 50).map((p) => `<tr><td>${p.url}</td><td>${p.score ?? 0}/100</td><td>${p.title ? '✓' : '✗'}</td><td>${p.metaDescription ? '✓' : '✗'}</td><td>${(p.h1Count ?? 0) === 1 ? '✓' : (p.h1Count ?? 0) > 1 ? '!' : '✗'}</td><td>${p.wordCount ?? 0}</td></tr>`).join('')}
  </table>

  <p class="sub" style="margin-top:28px;font-size:11px">Generated by BGT Digital Marketing CRM &bull; Website Audit Engine</p>
  <script>window.print()</script>
</body></html>`;

  const win = window.open('', '_blank', 'width=1000,height=800');
  if (!win) {
    alert('Please allow popups to open the report.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
