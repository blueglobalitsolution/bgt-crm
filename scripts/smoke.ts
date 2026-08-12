/**
 * BGT CRM - API smoke test.
 * Requires the server to be running (npm run dev or npm run start).
 * Usage: node --import tsx scripts/smoke.ts [baseUrl]
 */
import process from 'node:process';

const BASE = process.argv[2] || 'http://localhost:3000';
const results: Array<{ name: string; ok: boolean; detail?: string }> = [];

async function check(name: string, fn: () => Promise<any>) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e: any) {
    results.push({ name, ok: false, detail: e?.message || String(e) });
  }
}

async function main() {
  let token = '';

  await check('health', async () => {
    const r = await fetch(`${BASE}/api/health`);
    if (r.status !== 200) throw new Error(`health returned ${r.status}`);
  });

  await check('login (admin/admin123)', async () => {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const body: any = await r.json();
    if (r.status !== 200 || !body.token) throw new Error('login failed');
    token = body.token;
  });

  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  await check('login (wrong password rejected)', async () => {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });
    if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
  });

  await check('no-token /api/leads rejected (401)', async () => {
    const r = await fetch(`${BASE}/api/leads`);
    if (r.status !== 401) throw new Error(`expected 401, got ${r.status}`);
  });

  await check('get users', async () => {
    const r = await fetch(`${BASE}/api/users`, { headers: auth });
    const body: any = await r.json();
    if (r.status !== 200 || !Array.isArray(body.users)) throw new Error('users failed');
  });

  await check('get leads', async () => {
    const r = await fetch(`${BASE}/api/leads`, { headers: auth });
    const body: any = await r.json();
    if (r.status !== 200 || !Array.isArray(body.leads)) throw new Error('leads failed');
  });

  await check('create + delete a lead', async () => {
    const lead = {
      id: `smoke-${Date.now()}`,
      companyName: 'Smoke Test Co',
      contactPerson: 'Tester',
      mobile: '9000000000',
      status: 'New',
      interestedServices: [],
      leadSource: 'Smoke',
      expectedValue: 0,
      assignedTo: 'Unassigned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activities: [],
    };
    const c = await fetch(`${BASE}/api/leads`, { method: 'POST', headers: auth, body: JSON.stringify({ lead }) });
    if (c.status !== 201) throw new Error(`create returned ${c.status}`);
    const d = await fetch(`${BASE}/api/leads/${lead.id}`, { method: 'DELETE', headers: auth });
    if (d.status !== 200) throw new Error(`delete returned ${d.status}`);
  });

  await check('get roles', async () => {
    const r = await fetch(`${BASE}/api/roles`, { headers: auth });
    const body: any = await r.json();
    if (r.status !== 200 || !Array.isArray(body.roles)) throw new Error('roles failed');
  });

  console.log('\n=== BGT CRM Smoke Test ===\n');
  let failed = 0;
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`);
    if (!r.ok) failed += 1;
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
