import { Router, Request, Response } from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { requireAuth } from '../middleware/auth';

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

function placeToResult(place: any, coords?: { lat?: number; lng?: number }) {
  let city: string | undefined;
  let state: string | undefined;
  if (Array.isArray(place.addressComponents)) {
    for (const comp of place.addressComponents) {
      const types: string[] = Array.isArray(comp.types) ? comp.types : [];
      if (!city && types.includes('locality')) city = comp.longText;
      if (!state && types.includes('administrative_area_level_1')) state = comp.longText;
    }
  }
  const address = cleanStr(place.formattedAddress);
  const streetAddress = cleanStr(place.shortFormattedAddress);
  return {
    companyName: cleanStr(place.displayName?.text),
    mobile: toMobile(place.nationalPhoneNumber) || toMobile(place.internationalPhoneNumber),
    website: cleanStr(place.websiteUri),
    address: streetAddress && streetAddress !== address ? `${streetAddress}, ${address}` : address,
    city,
    state,
    industry: Array.isArray(place.types) && place.types.length ? place.types[0].replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : undefined,
    rating: cleanNum(place.rating),
    reviewCount: cleanNum(place.userRatingCount),
    confidence: 85,
    source: 'gmb' as const,
    placeId: cleanStr(place.id),
    lat: coords?.lat,
    lng: coords?.lng,
  };
}

router.post('/extract-from-gmb', async (req: Request, res: Response) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A Google Maps / My Business URL is required.' });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY is not configured on the server.' });
    }

    const parsed = parseMapsUrl(url);

    let place: any = null;

    if (parsed.placeId) {
      const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(parsed.placeId)}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,shortFormattedAddress,addressComponents,nationalPhoneNumber,internationalPhoneNumber,websiteUri,types,rating,userRatingCount',
        },
      });
      if (r.ok) place = await r.json();
    }

    if (!place && parsed.query) {
      const body: any = { textQuery: parsed.query, pageSize: 1 };
      if (parsed.lat !== undefined && parsed.lng !== undefined) {
        body.locationBias = {
          circle: { center: { latitude: parsed.lat, longitude: parsed.lng }, radius: 5000 },
        };
      }
      const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.addressComponents,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.types,places.rating,places.userRatingCount',
        },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const data = await r.json();
        place = data.places?.[0] || null;
      }
    }

    if (!place) {
      return res.status(404).json({ error: 'Could not find this business on Google Maps. Check the URL and try again.' });
    }

    res.json(placeToResult(place, { lat: parsed.lat, lng: parsed.lng }));
  } catch (err: any) {
    console.error('business-intel gmb extraction error:', err);
    res.status(500).json({ error: 'Failed to fetch business info from Google Maps', message: err?.message });
  }
});

export { router as businessIntelRouter };
