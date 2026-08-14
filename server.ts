import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { auditRouter, seedWebsitesFromLeads } from './routes/audit';
import { datacenterRouter } from './routes/datacenter';
import { usersRouter } from './routes/users';
import { leadsRouter } from './routes/leads';
import { adminRouter } from './routes/admin';
import { clientsRouter } from './routes/clients';
import { followupsRouter } from './routes/followups';
import { seedDefaultData, sweepOrphanedAudits, backupDatabase, seedClientsFromWonLeads, seedClientSubscriptions, migrateLegacyStatuses } from './database/repository';
import { getDb } from './database/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Initialize SQLite + seed websites from sample leads (idempotent)
  const seeded = seedWebsitesFromLeads();
  if (seeded > 0) {
    console.log(`Website Audit: created ${seeded} website record(s) from leads.`);
  }

  // Seed default designations + default admin user on first run
  seedDefaultData();
  console.log('Users & roles: initialized.');

  // Mark audits orphaned by a previous crash/restart as failed
  const swept = sweepOrphanedAudits();
  if (swept > 0) {
    console.log(`Audit sweeper: marked ${swept} orphaned audit(s) as failed.`);
  }

  // One-time migration: legacy 'Follow-up' status -> 'Contacted'
  const statusMigrated = migrateLegacyStatuses();
  if (statusMigrated > 0) {
    console.log(`Lead statuses: migrated ${statusMigrated} legacy 'Follow-up' lead(s) to 'Contacted'.`);
  }

  // One-time migration: create client records for existing Won leads
  const clientsSeeded = seedClientsFromWonLeads();
  if (clientsSeeded > 0) {
    console.log(`Clients: created ${clientsSeeded} client record(s) from Won leads.`);
  }

  // One-time migration: create subscriptions from existing client retainer/contract data
  const subsSeeded = seedClientSubscriptions();
  if (subsSeeded > 0) {
    console.log(`Subscriptions: created ${subsSeeded} subscription row(s) from client data.`);
  }

  // Daily SQLite backup
  const backupFile = backupDatabase();
  if (backupFile) {
    console.log(`Database backup created: ${backupFile}`);
  }

  // Keep the SQLite WAL small and the connection warm so reads never stall
  // on the first request (the mobile follow-ups endpoint is hit frequently).
  const keepWarm = () => {
    try {
      const db = getDb();
      db.prepare('SELECT 1').get();
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch {
      /* ignore */
    }
  };
  keepWarm();
  setInterval(keepWarm, 15000).unref?.();

  // Users / roles / login API (mounted FIRST so the public login route is reachable)
  app.use('/api', usersRouter);

  // Public follow-ups API (for the mobile app notification sync).
  // MUST be mounted before routers with a blanket requireAuth (audit/leads/etc.)
  // so the endpoint stays publicly reachable.
  app.use('/api', followupsRouter);

  // Website Audit Engine API
  app.use('/api', auditRouter);

  // Datacenter (deleted-lead archive) API
  app.use('/api', datacenterRouter);

  // Shared leads API
  app.use('/api', leadsRouter);

  // Clients (converted leads) API
  app.use('/api', clientsRouter);

  // Admin ops (backup)
  app.use('/api', adminRouter);

  // Initialize Gemini AI Client
  let ai: GoogleGenAI | null = null;
  function getGenAI() {
    if (!ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('GEMINI_API_KEY is not configured yet.');
      }
      ai = new GoogleGenAI({
        apiKey: apiKey || '',
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return ai;
  }

  // API Health Endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // AI Endpoint 1: Lead Summary Generator
  app.post('/api/ai/lead-summary', async (req, res) => {
    try {
      const { lead } = req.body;
      if (!lead) {
        return res.status(400).json({ error: 'Lead data is required' });
      }

      const client = getGenAI();
      const services = Array.isArray(lead.interestedServices)
        ? lead.interestedServices.join(', ')
        : lead.interestedServices || 'Digital Marketing Services';

      const activityContext = Array.isArray(lead.activities) && lead.activities.length > 0
        ? lead.activities.map((a: any) => `- ${a.timestamp?.slice(0,10)} [${a.type}]: ${a.summary} (${a.details || ''})`).join('\n')
        : 'No previous activities recorded.';

      const prompt = `
You are an expert sales manager at a Digital Marketing Agency ("BGT CRM").
Analyze the following lead details and generate a concise, actionable 2-3 sentence executive summary for the sales representative.

Lead Information:
- Company Name: ${lead.companyName || 'Unknown'}
- Contact Person: ${lead.contactPerson || 'N/A'}
- Industry: ${lead.industry || 'Not specified'}
- Interested Services: ${services}
- Current Status: ${lead.status || 'New'}
- Lead Priority: ${lead.priority || 'Warm'}
- Estimated Budget: ${lead.estimatedBudget || 'Not specified'}
- Customer Requirement Notes: "${lead.requirementNotes || 'No specific notes.'}"

Recent Activity Timeline:
${activityContext}

Instructions:
1. Briefly state what the customer needs and their potential value or urgency.
2. Provide a clear, immediate next step recommendation (e.g. "Send revised quotation with case studies", "Schedule a quick phone call").
3. Keep the tone sharp, professional, direct, and under 70 words. Do not use generic filler words.
`;

      const response = await client.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          systemInstruction: 'You are a CRM AI Sales Assistant providing quick executive lead summaries.',
          temperature: 0.3,
        },
      });

      const summary = response.text?.trim() || 'Customer is interested in digital marketing services. Follow up to understand exact scope.';
      return res.json({ summary });
    } catch (err: any) {
      console.error('Error generating AI lead summary:', err);
      return res.status(500).json({
        error: 'Failed to generate AI summary',
        message: err?.message || 'Server error',
      });
    }
  });

  // AI Endpoint 2: Generate Personalized WhatsApp / Email Followup Script
  app.post('/api/ai/followup-script', async (req, res) => {
    try {
      const { lead, channel = 'WhatsApp' } = req.body;
      if (!lead) {
        return res.status(400).json({ error: 'Lead data is required' });
      }

      const client = getGenAI();
      const services = Array.isArray(lead.interestedServices)
        ? lead.interestedServices.join(' and ')
        : lead.interestedServices || 'Digital Marketing';

      const prompt = `
Generate a friendly, high-converting ${channel} message draft for a client lead.

Client Details:
- Contact Name: ${lead.contactPerson || 'Client'}
- Company: ${lead.companyName}
- Services of Interest: ${services}
- Notes: ${lead.requirementNotes || 'Follow up regarding digital marketing inquiry.'}
- Sender Agency: BGT Digital Marketing CRM Team

Format guidelines for ${channel}:
${channel === 'WhatsApp' ? '- Short, engaging, polite, 3-4 lines max, with professional emojis.' : '- Professional email layout with Subject line and body.'}
`;

      const response = await client.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          temperature: 0.5,
        },
      });

      return res.json({ script: response.text?.trim() || '' });
    } catch (err: any) {
      console.error('Error generating followup script:', err);
      return res.status(500).json({ error: 'Failed to generate script' });
    }
  });

  // Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
