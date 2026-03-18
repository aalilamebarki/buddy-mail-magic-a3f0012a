/**
 * Universal DOCX Template Engine
 * 
 * Works with ANY Word letterhead template from ANY lawyer.
 * 
 * Strategy:
 * 1. Template = letterhead file (.docx) with header/footer/styling
 * 2. On generation: fetch template → detect body zone → inject content → save
 * 3. Header/footer XML files are preserved untouched
 * 4. Body content is replaced with new content using the template's default font/style
 * 
 * Supports:
 * - Explicit placeholders: {{CONTENT}}, {{DATE}}, {{CLIENT}}, etc.
 * - Automatic body detection: finds the content area between header and closing
 * - Split-run handling: placeholders split across multiple XML runs (common in Arabic)
 * - Font inheritance: extracts and applies the template's default font/size
 * 
 * A4 Print-optimized: 1.5x line spacing, balanced paragraph spacing.
 */

import JSZip from 'jszip';

// ─── Types ──────────────────────────────────────────────────────────────

export interface TemplateContext {
  /** Main document content (multi-line text) */
  content: string;
  date?: string;
  clientName?: string;
  clientAddress?: string;
  caseName?: string;
  court?: string;
  caseNumber?: string;
  lawyerName?: string;
  opposingParty?: string;
  opposingPartyAddress?: string;
}

interface ExtractedRunProps {
  xml: string;
  font: string;
  fontSize: string;
}

// ─── XML Helpers ────────────────────────────────────────────────────────

export const escapeXml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// ─── Split-Run Placeholder Handling ─────────────────────────────────────

/**
 * Replace a placeholder that may be split across multiple <w:r> runs.
 * Common in Arabic DOCX: {{CONTENT}} → <w:t>{{</w:t><w:t>CONTENT}}</w:t>
 */
function replaceSplitPlaceholder(docXml: string, placeholder: string, replacement: string): string {
  const escapedPh = placeholder.replace(/[{}]/g, '\\$&');

  // Direct replacement first
  if (docXml.includes(placeholder)) {
    return docXml.replace(new RegExp(escapedPh, 'g'), replacement);
  }

  // Split-run replacement
  const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  return docXml.replace(pRegex, (pXml) => {
    const texts: string[] = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m;
    while ((m = tRegex.exec(pXml)) !== null) texts.push(m[1]);
    const joined = texts.join('');

    if (!joined.includes(placeholder)) return pXml;

    let firstT = true;
    return pXml.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (_match, attrs, _text) => {
      if (firstT) {
        firstT = false;
        const newText = joined.replace(new RegExp(escapedPh, 'g'), replacement);
        return `<w:t${attrs}>${newText}</w:t>`;
      }
      return `<w:t${attrs}></w:t>`;
    });
  });
}

// ─── Font/Style Extraction ──────────────────────────────────────────────

/**
 * Extract default font and size from the template.
 * Priority: body paragraphs → styles.xml → fallback defaults
 */
function extractDefaultStyle(docXml: string, stylesXml?: string): ExtractedRunProps {
  let font = 'Traditional Arabic';
  let fontSize = '28'; // 14pt
  let rPrXml = '';

  // Try to find the most common rPr in body paragraphs
  const rPrCounts = new Map<string, number>();
  const rPrRegex = /<w:rPr>([\s\S]*?)<\/w:rPr>/g;
  let match;
  while ((match = rPrRegex.exec(docXml)) !== null) {
    const key = match[1].trim();
    rPrCounts.set(key, (rPrCounts.get(key) || 0) + 1);
  }

  // Use the most frequent rPr
  let maxCount = 0;
  for (const [key, count] of rPrCounts) {
    if (count > maxCount) {
      maxCount = count;
      rPrXml = `<w:rPr>${key}</w:rPr>`;
    }
  }

  // Extract font and size from the winning rPr
  if (rPrXml) {
    const csFont = rPrXml.match(/<w:rFonts[^>]*w:cs="([^"]+)"/);
    const asciiFont = rPrXml.match(/<w:rFonts[^>]*w:ascii="([^"]+)"/);
    if (csFont) font = csFont[1];
    else if (asciiFont) font = asciiFont[1];

    const csSize = rPrXml.match(/<w:szCs\s+w:val="(\d+)"/);
    const sz = rPrXml.match(/<w:sz\s+w:val="(\d+)"/);
    if (csSize) fontSize = csSize[1];
    else if (sz) fontSize = sz[1];
  }

  // Fallback: styles.xml
  if (!rPrXml && stylesXml) {
    const csFont = stylesXml.match(/<w:rFonts[^>]*w:cs="([^"]+)"/);
    if (csFont) font = csFont[1];
    const csSize = stylesXml.match(/<w:szCs\s+w:val="(\d+)"/);
    if (csSize) fontSize = csSize[1];
  }

  return { xml: rPrXml, font, fontSize };
}

// ─── Body Zone Detection ────────────────────────────────────────────────

/**
 * Detect the "body zone" in the document - the area where content should be injected.
 * 
 * Strategy for ANY template:
 * 1. If {{CONTENT}} placeholder exists → replace that paragraph
 * 2. Otherwise, find the body content area:
 *    - Skip header-like paragraphs (short, formatted, near top)
 *    - Find the main content area
 *    - Keep signature/closing paragraphs at the end
 * 
 * Returns { beforeBody, afterBody } - the XML before and after where content goes.
 */
interface BodyZone {
  mode: 'placeholder' | 'body-replace';
  /** For placeholder mode: the full paragraph XML to replace */
  placeholderParagraph?: string;
  /** For body-replace mode: XML to keep before content */
  beforeBody: string;
  /** For body-replace mode: XML to keep after content (sectPr, etc.) */
  afterBody: string;
}

function detectBodyZone(docXml: string): BodyZone {
  // Mode 1: Explicit {{CONTENT}} placeholder
  if (containsPlaceholder(docXml, '{{CONTENT}}')) {
    return { mode: 'placeholder', beforeBody: '', afterBody: '' };
  }

  // Mode 2: Automatic body detection
  // Extract all paragraphs from <w:body>
  const bodyMatch = docXml.match(/<w:body>([\s\S]*)<\/w:body>/);
  if (!bodyMatch) {
    return { mode: 'body-replace', beforeBody: docXml, afterBody: '' };
  }

  const bodyContent = bodyMatch[1];

  // Extract sectPr (section properties - must be preserved)
  const sectPrMatch = bodyContent.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  const sectPr = sectPrMatch ? sectPrMatch[0] : '';

  // Remove sectPr from body for paragraph analysis
  const bodyWithoutSectPr = bodyContent.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/, '').trim();

  // Split into paragraphs
  const paragraphs: string[] = [];
  const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(bodyWithoutSectPr)) !== null) {
    paragraphs.push(pMatch[0]);
  }

  if (paragraphs.length === 0) {
    // Empty body - just inject
    const beforeBody = docXml.replace(/<w:body>[\s\S]*<\/w:body>/, '<w:body>');
    const afterBody = `${sectPr}</w:body>`;
    return { mode: 'body-replace', beforeBody, afterBody };
  }

  // Find the content zone boundaries
  // Header zone: first few paragraphs that look like letterhead info
  // We keep ALL existing paragraphs and inject BEFORE the sectPr
  // This preserves the template structure completely

  const bodyStart = docXml.indexOf('<w:body>') + '<w:body>'.length;
  const bodyEnd = docXml.lastIndexOf('</w:body>');

  // Keep everything before sectPr as "before", sectPr as "after"
  const beforeSectPr = bodyContent.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/, '').trim();

  const beforeBody = docXml.substring(0, bodyStart) + beforeSectPr;
  const afterBody = sectPr + docXml.substring(bodyEnd);

  return { mode: 'body-replace', beforeBody, afterBody };
}

// ─── Line Classification ────────────────────────────────────────────────

export function classifyLine(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith('بسم الله')) return 'basmala';
  if (/^(إلى السيد|حضرة|سيدي|السيد الرئيس|الموجه إلى)/.test(trimmed)) return 'heading';
  if (/^(المدعي|المدعى عليه|الطرف|الطالب|المطلوب|المشتكي|المشتكى به|الموكل|الخصم|نيابة عن|من طرف):?/.test(trimmed)) return 'party_label';
  if (/^(الاسم|العنوان|رقم البطاقة|CIN|الهاتف|المهنة):?/.test(trimmed)) return 'party_value';
  if (/^(الوقائع|في الشكل|في الموضوع|بناءً عليه|لهذه الأسباب|المناقشة|الأساس القانوني|الطلبات|أسباب الاستئناف|وسائل النقض|ملتمسات|حيث إن)/.test(trimmed)) return 'section_title';
  if (/^(وتفضلوا|والسلام|عن الموكل|الإمضاء|المحامي|الأستاذ)/.test(trimmed)) return 'signature';
  if (/^(أولا|ثانيا|ثالثا|رابعا|خامسا)[؛;:]/.test(trimmed)) return 'section_title';
  return 'normal';
}

// ─── Content Paragraphs Builder ─────────────────────────────────────────

function buildContentParagraphs(content: string, style: ExtractedRunProps): string {
  const { font, fontSize } = style;
  const boldSize = String(parseInt(fontSize) + 4);

  const lines = content.split('\n').filter(l => l.trim());

  return lines.map(line => {
    const type = classifyLine(line);
    let alignment = 'right';
    let isBold = false;
    let lineFontSize = fontSize;
    let spacingAfter = '180';
    let spacingBefore = '0';
    let spacingLine = '360';
    let isUnderline = false;

    switch (type) {
      case 'basmala':
        alignment = 'center'; isBold = true; lineFontSize = boldSize;
        spacingAfter = '360'; break;
      case 'heading':
        isBold = true; lineFontSize = boldSize; isUnderline = true;
        spacingBefore = '120'; spacingAfter = '120'; break;
      case 'party_label':
        isBold = true; spacingBefore = '60'; spacingAfter = '40'; spacingLine = '312'; break;
      case 'party_value':
        spacingAfter = '40'; spacingLine = '312'; break;
      case 'section_title':
        isBold = true; lineFontSize = boldSize; isUnderline = true;
        spacingBefore = '240'; spacingAfter = '180'; break;
      case 'signature':
        alignment = 'center'; spacingBefore = '200'; spacingAfter = '40'; spacingLine = '312'; break;
    }

    const pPr = `<w:pPr><w:bidi/><w:jc w:val="${alignment}"/><w:spacing w:before="${spacingBefore}" w:after="${spacingAfter}" w:line="${spacingLine}" w:lineRule="auto"/></w:pPr>`;
    const rPr = `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${lineFontSize}"/><w:szCs w:val="${lineFontSize}"/>${isBold ? '<w:b/><w:bCs/>' : ''}${isUnderline ? '<w:u w:val="single"/>' : ''}<w:rtl/></w:rPr>`;

    return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`;
  }).join('\n');
}

// ─── Page Break Builder ─────────────────────────────────────────────────

function buildPageBreak(): string {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

// ─── Inline Placeholder Replacement ─────────────────────────────────────

function replaceAllPlaceholders(xml: string, ctx: TemplateContext): string {
  const today = ctx.date || new Date().toLocaleDateString('ar-MA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const map: Record<string, string> = {
    '{{DATE}}': today,
    '{{CLIENT}}': ctx.clientName || '',
    '{{CLIENT_ADDRESS}}': ctx.clientAddress || '',
    '{{CASE}}': ctx.caseName || '',
    '{{COURT}}': ctx.court || '',
    '{{CASE_NUMBER}}': ctx.caseNumber || '',
    '{{LAWYER}}': ctx.lawyerName || '',
    '{{OPPOSING_PARTY}}': ctx.opposingParty || '',
    '{{OPPOSING_ADDRESS}}': ctx.opposingPartyAddress || '',
  };

  let result = xml;
  for (const [ph, value] of Object.entries(map)) {
    if (!value) continue;
    result = replaceSplitPlaceholder(result, ph, escapeXml(value));
  }
  return result;
}

// ─── Main Engine ────────────────────────────────────────────────────────

/**
 * Inject content into a Word template.
 * 
 * Works with ANY .docx template:
 * 1. Preserves all header/footer formatting
 * 2. Replaces inline placeholders ({{DATE}}, {{CLIENT}}, etc.)
 * 3. Injects main content either at {{CONTENT}} or at end of body
 * 4. Inherits the template's default font and size
 */
export async function injectIntoTemplate(
  templateBlob: Blob,
  ctx: TemplateContext
): Promise<Blob> {
  const zip = await JSZip.loadAsync(templateBlob);
  let docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('ملف القالب غير صالح');

  // 1. Extract the template's default style
  const stylesXml = await zip.file('word/styles.xml')?.async('string');
  const defaultStyle = extractDefaultStyle(docXml, stylesXml);

  // 2. Replace inline placeholders in body
  docXml = replaceAllPlaceholders(docXml, ctx);

  // 3. Replace inline placeholders in headers/footers
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (/word\/(header|footer)\d*\.xml/i.test(path)) {
      let xml = await zipEntry.async('string');
      xml = replaceAllPlaceholders(xml, ctx);
      zip.file(path, xml);
    }
  }

  // 4. Inject main content
  if (ctx.content) {
    const contentParagraphs = buildContentParagraphs(ctx.content, defaultStyle);
    const bodyZone = detectBodyZone(docXml);

    if (bodyZone.mode === 'placeholder') {
      // Replace the {{CONTENT}} paragraph with content paragraphs
      docXml = replaceParagraphContaining(docXml, '{{CONTENT}}', contentParagraphs);
    } else {
      // Insert content before sectPr (after all existing template body)
      docXml = bodyZone.beforeBody + '\n' + contentParagraphs + '\n' + bodyZone.afterBody;
    }
  }

  zip.file('word/document.xml', docXml);

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/**
 * Generate a document by replacing the template body entirely.
 * Use when you want to CLEAR the template body and insert fresh content.
 * Preserves: headers, footers, section properties (margins, orientation).
 */
export async function generateFromTemplate(
  templateBlob: Blob,
  ctx: TemplateContext
): Promise<Blob> {
  const zip = await JSZip.loadAsync(templateBlob);
  let docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('ملف القالب غير صالح');

  // 1. Extract style
  const stylesXml = await zip.file('word/styles.xml')?.async('string');
  const defaultStyle = extractDefaultStyle(docXml, stylesXml);

  // 2. Extract sectPr (page layout - margins, orientation, header/footer refs)
  const sectPrMatch = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  const sectPr = sectPrMatch ? sectPrMatch[0] : '';

  // 3. Build new body with only the content
  const contentParagraphs = ctx.content
    ? buildContentParagraphs(ctx.content, defaultStyle)
    : '';

  // 4. Replace entire body
  docXml = docXml.replace(
    /<w:body>[\s\S]*<\/w:body>/,
    `<w:body>${contentParagraphs}${sectPr}</w:body>`
  );

  // 5. Replace placeholders in headers/footers
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (/word\/(header|footer)\d*\.xml/i.test(path)) {
      let xml = await zipEntry.async('string');
      xml = replaceAllPlaceholders(xml, ctx);
      zip.file(path, xml);
    }
  }

  zip.file('word/document.xml', docXml);

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Check if XML contains a placeholder (handles split runs) */
function containsPlaceholder(docXml: string, placeholder: string): boolean {
  if (docXml.includes(placeholder)) return true;

  const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(docXml)) !== null) {
    const texts: string[] = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m;
    while ((m = tRegex.exec(pMatch[0])) !== null) texts.push(m[1]);
    if (texts.join('').includes(placeholder)) return true;
  }
  return false;
}

/** Replace the entire paragraph containing a placeholder with new XML */
function replaceParagraphContaining(docXml: string, placeholder: string, newXml: string): string {
  const escapedPh = placeholder.replace(/[{}]/g, '\\$&');

  // Single-run match
  const singleRunRegex = new RegExp(`<w:p\\b[^>]*>[\\s\\S]*?${escapedPh}[\\s\\S]*?<\\/w:p>`, 'i');
  if (singleRunRegex.test(docXml)) {
    return docXml.replace(singleRunRegex, newXml);
  }

  // Split-run match
  let found = false;
  return docXml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (pXml) => {
    if (found) return pXml;
    const texts: string[] = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m;
    while ((m = tRegex.exec(pXml)) !== null) texts.push(m[1]);
    if (texts.join('').includes(placeholder)) {
      found = true;
      return newXml;
    }
    return pXml;
  });
}

// ─── Exported utilities ─────────────────────────────────────────────────

export { extractDefaultStyle as extractFontFromStyles_v2 };

/** Legacy export for compatibility */
export function extractFontFromStyles(stylesXml: string | undefined): { font: string; fontSize: string } {
  let font = 'Traditional Arabic';
  let fontSize = '28';
  if (stylesXml) {
    const csFont = stylesXml.match(/<w:rFonts[^>]*w:cs="([^"]+)"/);
    if (csFont) font = csFont[1];
    const csSize = stylesXml.match(/<w:szCs\s+w:val="(\d+)"/);
    if (csSize) fontSize = csSize[1];
  }
  return { font, fontSize };
}
