/**
 * Extract letterhead info (lawyer name, phone, email, address, etc.)
 * from a Word (.docx) template by parsing its XML content.
 * 
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

/** Extract all text from XML, joining runs */
function extractText(xml: string): string[] {
  const lines: string[] = [];
  // Match each paragraph
  const pRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pContent = pMatch[1];
    // Extract all <w:t> text within this paragraph
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

// ─── Pattern matchers ───────────────────────────────────────────────────

const PHONE_REGEX = /(?:0[5-7]\d{2}[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}|\+212[-.\s]?\d[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}|0[5-7]\d{8}|\+212\d{9})/;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Moroccan cities
const CITIES = [
  'الرباط', 'الدار البيضاء', 'فاس', 'مراكش', 'طنجة', 'مكناس', 'أكادير', 'وجدة',
  'القنيطرة', 'تطوان', 'سلا', 'الجديدة', 'آسفي', 'بني ملال', 'خريبكة', 'الناظور',
  'سطات', 'تازة', 'العرائش', 'خنيفرة', 'قلعة السراغنة', 'الحسيمة', 'ورزازات',
  'Rabat', 'Casablanca', 'Fès', 'Marrakech', 'Tanger', 'Meknès', 'Agadir', 'Oujda',
  'Kénitra', 'Tétouan', 'Salé', 'El Jadida',
];

// Bar associations
const BAR_PATTERNS_AR = [
  /هيئة\s*المحامين\s*ب([^\s,،.]+)/,
  /نقابة\s*المحامين\s*ب([^\s,،.]+)/,
  /هيئة\s+([^\s,،.]+)/,
];

const BAR_PATTERNS_FR = [
  /barreau\s+d[eu']\s*([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+)*)/i,
  /ordre\s+des\s+avocats\s+d[eu']\s*([A-ZÀ-Ÿ][a-zà-ÿ]+)/i,
];

// Title patterns
const TITLE_AR_PATTERNS = [
  /محام(?:ي|ية)?\s+(?:لدى|بمحكمة|ب)/,
  /محام(?:ي|ية)?\s+مقبول/,
  /محام(?:ي|ية)?/,
];

const TITLE_FR_PATTERNS = [
  /avocat(?:e)?\s+(?:près|agré[ée]|au\s+barreau)/i,
  /avocat(?:e)?/i,
];

// Address patterns
const ADDRESS_PATTERNS = [
  /(?:شارع|زنقة|حي|عمارة|الطابق|رقم|عين|ساحة|بلوك)/,
  /(?:rue|avenue|bd|boulevard|lot|imm|n°|résidence|étage)/i,
];

// ─── Name detection ─────────────────────────────────────────────────────

function isArabicName(text: string): boolean {
  // Arabic name: 2-4 words, all Arabic script, reasonable length
  const words = text.split(/\s+/);
  return (
    words.length >= 2 &&
    words.length <= 5 &&
    /^[\u0600-\u06FF\s]+$/.test(text) &&
    text.length > 5 &&
    text.length < 60 &&
    !TITLE_AR_PATTERNS.some(p => p.test(text)) &&
    !ADDRESS_PATTERNS[0].test(text) &&
    !BAR_PATTERNS_AR.some(p => p.test(text)) &&
    !/(?:مكتب|الأستاذ|الأستاذة|محام|السيد|هاتف|فاكس|بريد)/.test(text)
  );
}

function isFrenchName(text: string): boolean {
  const words = text.split(/\s+/);
  return (
    words.length >= 2 &&
    words.length <= 5 &&
    /^[A-ZÀ-Ÿa-zà-ÿ\s.-]+$/.test(text) &&
    text.length > 5 &&
    text.length < 60 &&
    !TITLE_FR_PATTERNS.some(p => p.test(text)) &&
    !/(?:cabinet|maître|avocat|tél|fax|email|adresse)/i.test(text)
  );
}

// ─── Main extraction ────────────────────────────────────────────────────

export async function extractLetterheadInfo(file: File | Blob): Promise<ExtractedLetterheadInfo> {
  const zip = await JSZip.loadAsync(file);
  const result: ExtractedLetterheadInfo = {};

  // Collect text from all relevant parts
  const allLines: string[] = [];

  // 1. Headers (most likely location for letterhead info)
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (/word\/header\d*\.xml/i.test(path)) {
      const xml = await zipEntry.async('string');
      allLines.push(...extractText(xml));
    }
  }

  // 2. Footers (phone/email often here)
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (/word\/footer\d*\.xml/i.test(path)) {
      const xml = await zipEntry.async('string');
      allLines.push(...extractText(xml));
    }
  }

  // 3. First ~15 lines of body
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (docXml) {
    const bodyLines = extractText(docXml);
    allLines.push(...bodyLines.slice(0, 15));
  }

  // Join all for pattern scanning
  const fullText = allLines.join('\n');

  // ── Extract phone ──
  const phoneMatch = fullText.match(PHONE_REGEX);
  if (phoneMatch) result.phone = phoneMatch[0].replace(/[-.\s]/g, '').replace(/^(\+212)(\d)/, '$1 $2');

  // ── Extract email ──
  const emailMatch = fullText.match(EMAIL_REGEX);
  if (emailMatch) result.email = emailMatch[0];

  // ── Extract city ──
  for (const city of CITIES) {
    if (fullText.includes(city)) {
      result.city = city;
      break;
    }
  }

  // ── Extract bar association ──
  for (const pattern of BAR_PATTERNS_AR) {
    const match = fullText.match(pattern);
    if (match) {
      result.barNameAr = match[0];
      break;
    }
  }
  for (const pattern of BAR_PATTERNS_FR) {
    const match = fullText.match(pattern);
    if (match) {
      result.barNameFr = match[0];
      break;
    }
  }

  // ── Extract title ──
  for (const line of allLines) {
    if (!result.titleAr) {
      for (const pattern of TITLE_AR_PATTERNS) {
        if (pattern.test(line)) {
          result.titleAr = line.trim();
          break;
        }
      }
    }
    if (!result.titleFr) {
      for (const pattern of TITLE_FR_PATTERNS) {
        if (pattern.test(line)) {
          result.titleFr = line.trim();
          break;
        }
      }
    }
  }

  // ── Extract address ──
  for (const line of allLines) {
    if (ADDRESS_PATTERNS.some(p => p.test(line)) && !PHONE_REGEX.test(line) && !EMAIL_REGEX.test(line)) {
      result.address = line.trim();
      break;
    }
  }

  // ── Extract names ──
  // Look for "الأستاذ" / "Maître" prefix patterns first
  for (const line of allLines) {
    if (!result.lawyerName) {
      const ustadMatch = line.match(/(?:الأستاذ(?:ة)?|مكتب الأستاذ(?:ة)?)\s+([\u0600-\u06FF\s]+)/);
      if (ustadMatch) result.lawyerName = ustadMatch[1].trim();
    }
    if (!result.nameFr) {
      const maitreMatch = line.match(/(?:Maître|Me|Cabinet\s+(?:de\s+)?Maître)\s+([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿa-zà-ÿ]+)*)/i);
      if (maitreMatch) result.nameFr = maitreMatch[1].trim();
    }
  }

  // Fallback: detect standalone names
  if (!result.lawyerName) {
    for (const line of allLines) {
      if (isArabicName(line)) {
        result.lawyerName = line.trim();
        break;
      }
    }
  }
  if (!result.nameFr) {
    for (const line of allLines) {
      if (isFrenchName(line)) {
        result.nameFr = line.trim();
        break;
      }
    }
  }

  return result;
}
