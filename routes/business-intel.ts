import { Router, Request, Response } from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { requireAuth } from '../middleware/auth';
import { listServerLeads } from '../database/repository';
import { callDeepSeekJSON } from '../src/utils/deepseek';

const router = Router();

router.use(requireAuth);

// In-memory upload: max 8MB, images only.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed') as any);
  },
});

function cleanStr(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function cleanNum(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// Normalize a raw number/string like "919876543210" or "+91 98765 43210"
function toMobile(v: unknown): string | undefined {
  const s = cleanStr(v);
  if (!s) return undefined;
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  return s.replace(/[^\d+]/g, '') || undefined;
}

function parseJsonResponse(text: string): Record<string, any> | null {
  const cleaned = (text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ─── Extract from an uploaded image using Gemini vision ─────────────────────
const uploadImage = upload.single('file');

function uploadImageWrapper(req: Request, res: Response, next: any) {
  uploadImage(req, res, (err: any) => {
    if (err) {
      const msg = err?.message?.startsWith('Only image') ? 'Only image files are allowed.' : 'Image upload failed.';
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

router.post('/extract-from-image', uploadImageWrapper, async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No image file was uploaded.' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const base64 = file.buffer.toString('base64');
    const prompt = `You are an expert business-data extraction assistant for a CRM used by a digital marketing agency.
Extract every piece of business information visible in this image (business card, storefront, menu, poster, letterhead, etc.).

Return ONLY a JSON object with these fields (use empty string / omit fields that are not present):
- companyName: the business name
- contactPerson: any person's name found (owner / manager / sales contact)
- mobile: primary phone number, digits only (10-digit Indian numbers should be kept as-is; others keep country code + digits)
- whatsapp: whatsapp number if visibly different from mobile
- email: email address
- website: website URL
- address: full street address if present
- city: city name
- state: state name
- industry: the business category / industry type
- confidence: integer 0-100 estimating how reliably the information was extracted

Do not invent information. If a field is not visible, omit it.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        { role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: file.mimetype, data: base64 } }] },
      ],
      config: { temperature: 0.1 },
    });

    const parsed = parseJsonResponse(response.text || '');
    if (!parsed) {
      return res.status(422).json({ error: 'The AI could not interpret this image. Try a clearer photo.' });
    }

    res.json({
      companyName: cleanStr(parsed.companyName),
      contactPerson: cleanStr(parsed.contactPerson),
      mobile: toMobile(parsed.mobile),
      whatsapp: toMobile(parsed.whatsapp),
      email: cleanStr(parsed.email),
      website: cleanStr(parsed.website),
      address: cleanStr(parsed.address),
      city: cleanStr(parsed.city),
      state: cleanStr(parsed.state),
      industry: cleanStr(parsed.industry),
      rating: cleanNum(parsed.rating),
      reviewCount: cleanNum(parsed.reviewCount),
      confidence: cleanNum(parsed.confidence) ?? 60,
      source: 'image',
    });
  } catch (err: any) {
    console.error('business-intel image extraction error:', err);
    res.status(500).json({ error: 'Failed to extract business info from image', message: err?.message });
  }
});

// ─── Resolve a Google Maps / My Business URL via the Places API ─────────────

/** Follow redirects (e.g. maps.app.goo.gl short links) to the final URL. */
async function resolveRedirects(raw: string): Promise<string> {
  try {
    const res = await fetch(raw, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(10000) });
    if (res.url && /^https?:\/\//i.test(res.url)) return res.url;
    return raw;
  } catch {
    return raw;
  }
}

function parseMapsUrl(raw: string): { placeId?: string; query?: string; lat?: number; lng?: number } {
  const url = raw.trim();
  const out: { placeId?: string; query?: string; lat?: number; lng?: number } = {};

  // place_id:ChIJ... query param
  const pid = url.match(/place_id:([^&]+)/i)?.[1];
  if (pid) {
    out.placeId = decodeURIComponent(pid);
    return out;
  }

  // Coordinates from "@lat,lng"
  const coords = url.match(/@(-?[\d.]+),(-?[\d.]+)/);
  if (coords) {
    out.lat = Number(coords[1]);
    out.lng = Number(coords[2]);
  }

  // Query param "?q=..."
  const q = new URL(url, 'https://google.com').searchParams.get('q');
  if (q && !q.startsWith('place_id:')) {
    out.query = q;
    return out;
  }

  // /place/<Business+Name> slug
  const slug = url.match(/\/place\/([^/?]+)/i)?.[1];
  if (slug) {
    const name = decodeURIComponent(slug).replace(/[+_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    out.query = name;
  }

  return out;
}

/** Find existing leads that likely match the resolved business (name/phone). */
function findDuplicateLeads(info: Record<string, any>): any[] {
  const leads = listServerLeads();
  const name = cleanStr(info.companyName)?.toLowerCase();
  const mobile = cleanStr(info.mobile)?.replace(/\D/g, '');
  if (!name && !mobile) return [];
  return leads
    .filter((l: any) => {
      if (!l) return false;
      const lName = cleanStr(l.companyName)?.toLowerCase();
      const lMobile = cleanStr(l.mobile)?.replace(/\D/g, '');
      if (name && lName && lName === name) return true;
      if (mobile && lMobile && mobile.length >= 8 && lMobile === mobile) return true;
      return false;
    })
    .slice(0, 5)
    .map((l: any) => ({
      id: l.id,
      companyName: l.companyName,
      contactPerson: l.contactPerson,
      mobile: l.mobile,
      email: l.email,
      status: l.status,
      createdAt: l.createdAt,
    }));
}

function resolvePythonCommand(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  return process.platform === 'win32' ? 'python' : 'python3';
}

/** Run `python -m audit_worker.gmb <url> <nameHint>` and resolve the JSON it prints. */
function runGmbWorker(url: string, nameHint = ''): Promise<any> {
  return new Promise((resolve) => {
    const args = ['-m', 'audit_worker.gmb', url];
    if (nameHint) args.push(nameHint);
    const child = spawn(resolvePythonCommand(), args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => (stdout += d.toString()));
    child.stderr?.on('data', (d) => (stderr += d.toString()));

    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }, 45000);

    child.on('error', () => {
      clearTimeout(timer);
      resolve({ error: stderr.slice(0, 300) || 'Failed to start GMB worker' });
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(stdout.trim().split('\n').pop() || '{}');
        resolve(parsed);
      } catch {
        resolve({ error: stderr.slice(0, 300) || `Worker exited with code ${code}` });
      }
    });
  });
}

router.post('/extract-from-gmb', async (req: Request, res: Response) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A Google Maps / My Business URL is required.' });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return res.status(500).json({ error: 'DEEPSEEK_API_KEY is not configured on the server.' });
    }

    // Short links (maps.app.goo.gl, etc.) need to be unshortened first.
    const resolvedUrl = await resolveRedirects(url);
    const parsed = parseMapsUrl(resolvedUrl);
    const nameFromSlug = parsed.query || '';
    const coordsLine = parsed.lat !== undefined && parsed.lng !== undefined ? `${parsed.lat}, ${parsed.lng}` : '';

    // Business name from a Google Search / share URL (?q=Business+Name).
    let nameHint = nameFromSlug;
    if (!nameHint) {
      try {
        const q = new URL(resolvedUrl).searchParams.get('q');
        if (q && !q.startsWith('place_id:')) nameHint = q;
      } catch {
        /* ignore */
      }
    }

    // Aggregation pipeline: search DDG for real sources, fetch the business
    // website + aggregator pages, extract phones/emails/social links.
    const worker = await runGmbWorker(resolvedUrl, nameHint);
    if (worker.error) {
      console.error('GMB worker error:', worker.error);
    }

    const nameAddress = worker.name_address || '';
    const websiteUrl = worker.website_url || '';
    const websiteText = worker.website_text || '';
    const phones = Array.isArray(worker.phones) ? worker.phones : [];
    const emails = Array.isArray(worker.emails) ? worker.emails : [];
    const socialLinks = Array.isArray(worker.social_links) ? worker.social_links : [];
    const sources = Array.isArray(worker.sources) ? worker.sources : [];

    const systemPrompt = `You are a business-data extraction assistant for a CRM used by a digital marketing agency.
Extract business information from the Google Maps / My Business page, its website and business directories provided.
Return ONLY a JSON object with these fields (use empty string / omit fields that are not present):
- companyName: the business name (use "Name from URL" / "Name & address" as the strongest hint)
- contactPerson: any person's name found (owner / manager / sales contact / doctor / director)
- mobile: primary phone number, digits only (10-digit Indian numbers kept as-is; others keep country code + digits)
- whatsapp: whatsapp number if visibly different from mobile
- email: email address (prefer the business email over the business website)
- website: website URL
- address: full street address
- city: city name
- state: state name
- industry: the business category / industry type
- rating: numeric rating (e.g. 4.5) if present
- reviewCount: number of reviews if present
- socialMediaLinks: array of social profile URLs (facebook/instagram/linkedin/youtube/twitter/whatsapp)
- services: array of the business services / products / specialties
- confidence: integer 0-100 estimating how reliably the information was extracted

Do not invent information. If a field is not present, omit it.`;

    const userContent = [
      `Resolved URL: ${resolvedUrl}`,
      nameHint ? `Name from URL: ${nameHint}` : null,
      coordsLine ? `Coordinates: ${coordsLine}` : null,
      nameAddress ? `Name & address: ${nameAddress}` : null,
      websiteUrl ? `Website found: ${websiteUrl}` : null,
      phones.length ? `Phones found: ${phones.join(' | ')}` : null,
      emails.length ? `Emails found: ${emails.join(' | ')}` : null,
      socialLinks.length ? `Social links found: ${socialLinks.join(' | ')}` : null,
      ...sources.map((s: any) => (s.text ? `--- Source (${s.kind}) ${s.url} ---\n${String(s.text).slice(0, 6000)}` : null)),
    ]
      .filter(Boolean)
      .join('\n\n');

    const parsedJson = await callDeepSeekJSON(systemPrompt, userContent);

    if (!parsedJson) {
      return res.status(502).json({ error: 'DeepSeek could not interpret this business link.' });
    }

    // Clean the company name: keep the leading business-name part, drop
    // trailing area/city tokens (e.g. "Jay Imaging Centre, Raiya Chokdi, Rajkot"
    // -> "Jay Imaging Centre").
    const cleanName = (raw?: string) => {
      const parts = (raw || '').split(',').map((s) => s.trim()).filter(Boolean);
      return parts[0] || raw || '';
    };

    const pickPhone = (): string | undefined => {
      const p = cleanStr(parsedJson.mobile);
      if (p) return toMobile(p);
      // fall back to the first phone the worker found (prefer 10-digit Indian)
      const ten = phones.find((x: string) => x.replace(/\D/g, '').length === 10);
      return toMobile(ten || phones[0]);
    };

    const result = {
      companyName: cleanStr(parsedJson.companyName) ? cleanName(cleanStr(parsedJson.companyName)) : cleanName(nameHint || nameAddress) || undefined,
      contactPerson: cleanStr(parsedJson.contactPerson),
      mobile: pickPhone(),
      whatsapp: toMobile(parsedJson.whatsapp),
      email: cleanStr(parsedJson.email) || emails[0] || undefined,
      website: cleanStr(parsedJson.website) || cleanStr(websiteUrl) || undefined,
      address: cleanStr(parsedJson.address),
      city: cleanStr(parsedJson.city),
      state: cleanStr(parsedJson.state),
      industry: cleanStr(parsedJson.industry),
      rating: cleanNum(parsedJson.rating),
      reviewCount: cleanNum(parsedJson.reviewCount),
      socialMediaLinks: Array.isArray(parsedJson.socialMediaLinks) ? parsedJson.socialMediaLinks : socialLinks,
      services: Array.isArray(parsedJson.services) ? parsedJson.services : [],
      confidence: cleanNum(parsedJson.confidence) ?? (cleanStr(parsedJson.address) || cleanStr(parsedJson.mobile) ? 70 : 45),
      source: 'gmb' as const,
      placeId: cleanStr(parsedJson.placeId),
      lat: parsed.lat,
      lng: parsed.lng,
    };

    const duplicates = findDuplicateLeads(result);
    res.json({ ...result, duplicates });
  } catch (err: any) {
    console.error('business-intel gmb extraction error:', err);
    res.status(500).json({ error: 'Failed to fetch business info from Google Maps', message: err?.message });
  }
});

export { router as businessIntelRouter };
