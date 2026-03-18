/**
 * Extract letterhead info (lawyer name, phone, email, address, etc.)
 * from a Word (.docx) template by parsing its XML content.
 * 
 * Improved based on real Moroccan lawyer letterhead analysis.
 * Scans headers, footers, and first body paragraphs for patterns.
 */

import JSZip from 'jszip';

export interface ExtractedLetterheadInfo {
  lawyerName?: string;
  nameFr?: string;
  titleAr?: string;
  titleFr?: string;
  barNameAr?: string;
  barNameFr?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
}

// ─── XML text extraction ────────────────────────────────────────────────

/** 
 * Extract all text from XML, joining runs within each paragraph.
 * Handles split runs (common in Arabic DOCX) by joining all <w:t> in a paragraph.
 */
function extractText(xml: string): string[] {
  const lines: string[] = [];
  const pRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pContent = pMatch[1];
    const texts: string[] = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      texts.push(tMatch[1]);
    }
    const line = texts.join('').trim();
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * Normalize Arabic text for better matching:
 * - Remove tatweel (ـ)
 * - Normalize hamza variants 
 * - Remove diacritics (tashkeel)
 */
function normalizeArabic(text: string): string {
  return text
    .replace(/ـ/g, '')                     // Remove tatweel
    .replace(/[إأآٱ]/g, 'ا')               // Normalize alef variants
    .replace(/ؤ/g, 'و')                    // Normalize waw hamza
    .replace(/ئ/g, 'ي')                    // Normalize ya hamza
    .replace(/ة/g, 'ه')                    // Normalize ta marbuta (optional)
    .replace(/[\u064B-\u0652]/g, '')        // Remove tashkeel (diacritics)
    .replace(/\s+/g, ' ')                  // Normalize whitespace
    .trim();
}

// ─── Pattern matchers ───────────────────────────────────────────────────

// Phone: Moroccan formats with flexible spacing
const PHONE_PATTERNS = [
  // +212 X XXXXXXXX or +212-X-XX-XX-XX-XX
  /\+212[-.\s]*[5-7][-.\s]*\d{2}[-.\s]*\d{2}[-.\s]*\d{2}[-.\s]*\d{2}/g,
  // +212 X XXXXXXXX (8 digits after country code + first digit)
  /\+212[-.\s]*[5-7][-.\s]*\d{8}/g,
  // 06/07/05 XX XX XX XX
  /0[5-7][-.\s]*\d{2}[-.\s]*\d{2}[-.\s]*\d{2}[-.\s]*\d{2}/g,
  // 06XXXXXXXX (compact)
  /0[5-7]\d{8}/g,
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Moroccan cities (Arabic + French)
const CITIES_AR = [
  'الرباط', 'الدار البيضاء', 'فاس', 'مراكش', 'طنجة', 'مكناس', 'أكادير', 'وجدة',
  'القنيطرة', 'تطوان', 'سلا', 'الجديدة', 'آسفي', 'بني ملال', 'خريبكة', 'الناظور',
  'سطات', 'تازة', 'العرائش', 'خنيفرة', 'قلعة السراغنة', 'الحسيمة', 'ورزازات',
  'الداخلة', 'العيون', 'تمارة', 'المحمدية', 'الفقيه بن صالح', 'برشيد',
];

const CITIES_FR = [
  'Rabat', 'Casablanca', 'Fès', 'Fes', 'Marrakech', 'Tanger', 'Meknès', 'Meknes',
  'Agadir', 'Oujda', 'Kénitra', 'Kenitra', 'Tétouan', 'Tetouan', 'Salé', 'Sale',
  'El Jadida', 'Safi', 'Beni Mellal', 'Khouribga', 'Nador', 'Settat', 'Taza',
  'Larache', 'Khénifra', 'Khenifra', 'Al Hoceima', 'Ouarzazate', 'Dakhla', 'Laayoune',
  'Témara', 'Mohammedia',
];

const ALL_CITIES = [...CITIES_AR, ...CITIES_FR];

// Bar association patterns (Arabic) - with normalization support
const BAR_KEYWORDS_AR = [
  'هيئة المحامين',
  'نقابة المحامين',
  'هييه المحامين',  // normalized form
];

// Bar association patterns (French)
const BAR_PATTERNS_FR = [
  /barreau\s+d[eu']\s*([A-ZÀ-Ÿa-zà-ÿ]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ]+)*)/i,
  /ordre\s+des\s+avocats\s+d[eu']\s*([A-ZÀ-Ÿa-zà-ÿ]+)/i,
];

// Title patterns (Arabic) - with normalization
const TITLE_AR_KEYWORDS = [
  'محامي لدى', 'محامية لدى', 'محامي بمحكمة', 'محامية بمحكمة',
  'محامي مقبول', 'محامية مقبول', 'المحامي بهيئة', 'المحامية بهيئة',
  'محام لدى', 'محام بمحكمة', 'محام مقبول',
];

// Title patterns (French)
const TITLE_FR_PATTERNS = [
  /avocat(?:e)?\s+(?:pr[èe]s|agr[ée][ée]|au\s+barreau|stagiaire)/i,
  /avocat(?:e)?\s+(?:inscrit|accept)/i,
];

// Address indicators
const ADDRESS_INDICATORS_AR = [
  'شارع', 'زنقة', 'حي', 'عمارة', 'الطابق', 'رقم', 'ساحة', 'بلوك',
  'إقامة', 'اقامة', 'مكتب', 'مدخل', 'درب', 'نهج', 'طريق',
];

const ADDRESS_INDICATORS_FR = [
  'rue', 'avenue', 'bd', 'boulevard', 'lot', 'imm', 'immeuble',
  'n°', 'résidence', 'residence', 'étage', 'etage', 'bureau',
  'entrée', 'entree', 'bloc', 'quartier',
];

// ─── Name detection ─────────────────────────────────────────────────────

/** Check if a line looks like a standalone Arabic name (2-5 words, Arabic script) */
function isArabicName(text: string): boolean {
  const normalized = normalizeArabic(text);
  const words = normalized.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  if (normalized.length < 4 || normalized.length > 60) return false;
  // Must be Arabic script
  if (!/^[\u0600-\u06FF\s]+$/.test(normalized)) return false;
  // Must not contain common non-name words
  const nonNameWords = [
    'مكتب', 'محامي', 'محامية', 'محام', 'هاتف', 'فاكس', 'بريد',
    'شارع', 'زنقة', 'حي', 'عمارة', 'الطابق', 'إقامة', 'اقامه',
    'هيئة', 'نقابة', 'المحكمة', 'بهيئة', 'المحامين', 'ضد', 'لفائدة',
    'مقال', 'طلب', 'مذكرة',
  ];
  return !nonNameWords.some(w => normalized.includes(normalizeArabic(w)));
}

/** Check if a line looks like a standalone French name */
function isFrenchName(text: string): boolean {
  const words = text.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  if (text.length < 4 || text.length > 60) return false;
  if (!/^[A-ZÀ-Ÿa-zà-ÿ\s.'-]+$/.test(text)) return false;
  const nonNameWords = [
    'cabinet', 'maître', 'maitre', 'avocat', 'avocate', 'tél', 'tel',
    'fax', 'email', 'adresse', 'barreau', 'ordre', 'bureau', 'rue',
    'avenue', 'boulevard', 'résidence', 'residence',
  ];
  return !nonNameWords.some(w => text.toLowerCase().includes(w));
}

// ─── Extraction helpers ─────────────────────────────────────────────────

function extractPhones(fullText: string): string[] {
  const phones: string[] = [];
  for (const pattern of PHONE_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(fullText)) !== null) {
      const cleaned = match[0].replace(/[-.\s]/g, '');
      if (!phones.includes(cleaned)) {
        phones.push(cleaned);
      }
    }
  }
  return phones;
}

function extractBarAr(lines: string[]): string | undefined {
  for (const line of lines) {
    const normalized = normalizeArabic(line);
    for (const keyword of BAR_KEYWORDS_AR) {
      const normalizedKeyword = normalizeArabic(keyword);
      if (normalized.includes(normalizedKeyword)) {
        return line.trim();
      }
    }
    // Also try original line with flexible pattern
    if (/هيئ[ةه]\s*المحامين/u.test(line) || /نقاب[ةه]\s*المحامين/u.test(line)) {
      return line.trim();
    }
  }
  return undefined;
}

function extractBarFr(fullText: string): string | undefined {
  for (const pattern of BAR_PATTERNS_FR) {
    const match = fullText.match(pattern);
    if (match) return match[0];
  }
  return undefined;
}

function extractTitleAr(lines: string[]): string | undefined {
  for (const line of lines) {
    const normalized = normalizeArabic(line);
    for (const keyword of TITLE_AR_KEYWORDS) {
      if (normalized.includes(normalizeArabic(keyword))) {
        return line.trim();
      }
    }
  }
  return undefined;
}

function extractTitleFr(lines: string[]): string | undefined {
  for (const line of lines) {
    for (const pattern of TITLE_FR_PATTERNS) {
      if (pattern.test(line)) return line.trim();
    }
  }
  return undefined;
}

function extractAddress(lines: string[]): string | undefined {
  for (const line of lines) {
    const normalized = normalizeArabic(line);
    const isAddress =
      ADDRESS_INDICATORS_AR.some(ind => normalized.includes(normalizeArabic(ind))) ||
      ADDRESS_INDICATORS_FR.some(ind => line.toLowerCase().includes(ind));
    
    // Make sure it's not just a phone or email line
    if (isAddress && !EMAIL_REGEX.test(line)) {
      const hasOnlyPhone = PHONE_PATTERNS.some(p => {
        p.lastIndex = 0;
        return p.test(line);
      });
      // Allow address lines that also contain phone, but prefer lines without
      if (!hasOnlyPhone || line.length > 25) {
        return line.trim();
      }
    }
  }
  return undefined;
}

function extractCity(fullText: string): string | undefined {
  // Check French cities first (more specific)
  for (const city of CITIES_FR) {
    if (fullText.includes(city)) return city;
  }
  // Then Arabic cities with normalization
  for (const city of CITIES_AR) {
    if (fullText.includes(city) || normalizeArabic(fullText).includes(normalizeArabic(city))) {
      return city;
    }
  }
  return undefined;
}

function extractNameAr(lines: string[]): string | undefined {
  // Strategy 1: Look for "الأستاذ(ة)" prefix (with variants)
  for (const line of lines) {
    const normalized = normalizeArabic(line);
    // Match: الاستاذ/الاستاذه/مكتب الاستاذ followed by name
    const ustadMatch = normalized.match(/(?:مكتب\s+)?(?:الاستاذ[ه]?\s+)([\u0600-\u06FF\s]+)/);
    if (ustadMatch) {
      // Clean up: remove trailing non-name words
      let name = ustadMatch[1].trim();
      // Remove trailing title/bar info
      const cutoffs = ['المحامي', 'المحاميه', 'محامي', 'بهييه', 'بهيئه', 'لدى'];
      for (const cutoff of cutoffs) {
        const idx = normalizeArabic(name).indexOf(cutoff);
        if (idx > 0) name = name.substring(0, idx).trim();
      }
      if (name.split(/\s+/).length >= 2) {
        // Return original (non-normalized) name from original line
        return extractOriginalName(line, name);
      }
    }
  }

  // Strategy 2: Standalone Arabic name detection
  for (const line of lines) {
    if (isArabicName(line)) {
      return line.trim();
    }
  }
  return undefined;
}

/** Try to extract original (non-normalized) text matching a normalized name */
function extractOriginalName(originalLine: string, normalizedName: string): string {
  // Find the position of the name words in the original line
  const nameWords = normalizedName.split(/\s+/);
  if (nameWords.length < 2) return normalizedName;

  // Simple approach: split original line and find matching segment
  const originalWords = originalLine.split(/\s+/);
  for (let i = 0; i < originalWords.length; i++) {
    const word = normalizeArabic(originalWords[i]);
    if (word === nameWords[0]) {
      const segment = originalWords.slice(i, i + nameWords.length).join(' ');
      if (segment.length > 3) return segment;
    }
  }
  return normalizedName;
}

function extractNameFr(lines: string[]): string | undefined {
  // Strategy 1: Look for "Maître" / "Me" / "Cabinet" prefix
  for (const line of lines) {
    const maitreMatch = line.match(
      /(?:Ma[iî]tre|Me|Cabinet\s+(?:de\s+)?(?:Ma[iî]tre|Me))\s+([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ]+)*)/i
    );
    if (maitreMatch) return maitreMatch[1].trim();
  }

  // Strategy 2: Standalone French name detection
  for (const line of lines) {
    if (isFrenchName(line)) return line.trim();
  }
  return undefined;
}

// ─── Main extraction ────────────────────────────────────────────────────

export async function extractLetterheadInfo(file: File | Blob): Promise<ExtractedLetterheadInfo> {
  const zip = await JSZip.loadAsync(file);
  const result: ExtractedLetterheadInfo = {};

  // Collect text from all relevant parts in priority order
  const headerLines: string[] = [];
  const footerLines: string[] = [];
  const bodyLines: string[] = [];

  // 1. Headers (most likely location for letterhead info)
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (/word\/header\d*\.xml/i.test(path)) {
      const xml = await zipEntry.async('string');
      headerLines.push(...extractText(xml));
    }
  }

  // 2. Footers (phone/email often here)
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (/word\/footer\d*\.xml/i.test(path)) {
      const xml = await zipEntry.async('string');
      footerLines.push(...extractText(xml));
    }
  }

  // 3. First ~20 lines of body (letterhead info sometimes in body too)
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (docXml) {
    const allBodyLines = extractText(docXml);
    bodyLines.push(...allBodyLines.slice(0, 20));
  }

  // Combined: headers first (highest priority), then footers, then body
  const allLines = [...headerLines, ...footerLines, ...bodyLines];
  const fullText = allLines.join('\n');

  // ── Extract phone(s) ──
  const phones = extractPhones(fullText);
  if (phones.length > 0) {
    // Format first phone nicely
    result.phone = phones[0].replace(/^(\+212)(\d)/, '$1 $2');
  }

  // ── Extract email ──
  const emailMatch = fullText.match(EMAIL_REGEX);
  if (emailMatch) result.email = emailMatch[0];

  // ── Extract city ──
  result.city = extractCity(fullText);

  // ── Extract bar association ──
  result.barNameAr = extractBarAr(allLines);
  result.barNameFr = extractBarFr(fullText);

  // ── Extract title ──
  result.titleAr = extractTitleAr(allLines);
  result.titleFr = extractTitleFr(allLines);

  // ── Extract address ──
  result.address = extractAddress(allLines);

  // ── Extract names ──
  // Prioritize header lines for names
  result.lawyerName = extractNameAr(headerLines) || extractNameAr(allLines);
  result.nameFr = extractNameFr(headerLines) || extractNameFr(allLines);

  // ── Fallback: if bar found but no title, construct title ──
  if (result.barNameAr && !result.titleAr) {
    result.titleAr = `محامي بهيئة المحامين ${result.city ? 'ب' + result.city : ''}`.trim();
  }
  if (result.barNameFr && !result.titleFr) {
    result.titleFr = `Avocat au ${result.barNameFr}`;
  }

  return result;
}
