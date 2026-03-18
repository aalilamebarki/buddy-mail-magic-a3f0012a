/**
 * DOCX Template Engine
 * 
 * Injects content into Word templates while preserving the template's formatting.
 * 
 * Supports two modes:
 * 1. Explicit placeholders: {{CONTENT}}, {{DATE}}, {{CLIENT}}, {{CASE}}, {{COURT}}, {{CASE_NUMBER}}, {{LAWYER}}
 * 2. Natural Arabic markers: لفائدة:, ضد:, عنوانه:, etc. (auto-detected from real Moroccan legal templates)
 * 
 * Handles split-run placeholders (common in Arabic DOCX where a tag like {{CONTENT}} 
 * gets split across multiple <w:r> elements).
 * 
 * A4 Print-optimized: proper line spacing (1.5x), balanced spacing after paragraphs.
 */

import JSZip from 'jszip';

// ─── Types ──────────────────────────────────────────────────────────────

export interface TemplateContext {
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
 * In Arabic DOCX, a placeholder like {{CONTENT}} often gets split across
 * multiple <w:r> runs, e.g.:
 *   <w:r><w:t>{{</w:t></w:r><w:r><w:t>CONTENT</w:t></w:r><w:r><w:t>}}</w:t></w:r>
 * 
 * This function reassembles all text in a paragraph and replaces the placeholder
 * while preserving the formatting of the first run.
 */
function replaceSplitPlaceholder(docXml: string, placeholder: string, replacement: string): string {
  const escapedPh = placeholder.replace(/[{}]/g, '\\$&');
  
  // First try direct replacement (placeholder in single run)
  if (docXml.includes(placeholder)) {
    return docXml.replace(new RegExp(escapedPh, 'g'), replacement);
  }
  
  // Try split-run replacement: find paragraphs containing the placeholder chars
  const phChars = placeholder.replace(/[{}]/g, '');
  if (!phChars) return docXml;
  
  const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  return docXml.replace(pRegex, (pXml) => {
    // Extract all text content from this paragraph
    const texts: string[] = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m;
    while ((m = tRegex.exec(pXml)) !== null) {
      texts.push(m[1]);
    }
    const joined = texts.join('');
    
    // Check if combined text contains the placeholder
    if (!joined.includes(placeholder)) return pXml;
    
    // Replace: clear all <w:t> contents, put replacement in first <w:t>
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

/**
 * Replace a whole paragraph containing a placeholder with new paragraph XML.
 * Handles both single-run and split-run placeholders.
 */
function replaceParagraphContaining(docXml: string, placeholder: string, newParagraphsXml: string): string {
  const escapedPh = placeholder.replace(/[{}]/g, '\\$&');
  
  // Try single-run match first
  const singleRunRegex = new RegExp(`<w:p\\b[^>]*>[\\s\\S]*?${escapedPh}[\\s\\S]*?<\\/w:p>`, 'i');
  if (singleRunRegex.test(docXml)) {
    return docXml.replace(singleRunRegex, newParagraphsXml);
  }
  
  // Try split-run: check each paragraph
  const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let found = false;
  const result = docXml.replace(pRegex, (pXml) => {
    if (found) return pXml;
    const texts: string[] = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m;
    while ((m = tRegex.exec(pXml)) !== null) {
      texts.push(m[1]);
    }
    if (texts.join('').includes(placeholder)) {
      found = true;
      return newParagraphsXml;
    }
    return pXml;
  });
  
  return result;
}

// ─── Formatting Extraction ─────────────────────────────────────────────

function extractRunPropsFromXml(docXml: string, placeholder: string): ExtractedRunProps {
  let font = 'Traditional Arabic';
  let fontSize = '28';
  let rPrXml = '';

  // Find paragraph containing placeholder (handles split runs)
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(docXml)) !== null) {
    const pContent = pMatch[1];
    const texts: string[] = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m;
    while ((m = tRegex.exec(pContent)) !== null) {
      texts.push(m[1]);
    }
    if (texts.join('').includes(placeholder)) {
      const rPrMatch = pContent.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
      if (rPrMatch) {
        rPrXml = rPrMatch[0];
        const fontMatch = rPrXml.match(/<w:rFonts[^>]*w:cs="([^"]+)"/);
        if (fontMatch) font = fontMatch[1];
        const fontAscii = rPrXml.match(/<w:rFonts[^>]*w:ascii="([^"]+)"/);
        if (fontAscii && !fontMatch) font = fontAscii[1];
        const sizeMatch = rPrXml.match(/<w:szCs\s+w:val="(\d+)"/);
        if (sizeMatch) fontSize = sizeMatch[1];
        const szMatch = rPrXml.match(/<w:sz\s+w:val="(\d+)"/);
        if (szMatch && !sizeMatch) fontSize = szMatch[1];
      }
      break;
    }
  }

  return { xml: rPrXml, font, fontSize };
}

function extractParagraphProps(docXml: string, placeholder: string): string {
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(docXml)) !== null) {
    const pContent = pMatch[1];
    const texts: string[] = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m;
    while ((m = tRegex.exec(pContent)) !== null) {
      texts.push(m[1]);
    }
    if (texts.join('').includes(placeholder)) {
      const pPrMatch = pContent.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
      if (pPrMatch) {
        return pPrMatch[0].replace(/<w:rPr>[\s\S]*?<\/w:rPr>/, '');
      }
      break;
    }
  }

  return '<w:pPr><w:bidi/><w:jc w:val="right"/><w:spacing w:after="160" w:line="360" w:lineRule="auto"/></w:pPr>';
}

// ─── Fallback: Extract from styles.xml ──────────────────────────────────

export function extractFontFromStyles(stylesXml: string | undefined): { font: string; fontSize: string } {
  let font = 'Traditional Arabic';
  let fontSize = '28';

  if (stylesXml) {
    const csFontMatch = stylesXml.match(/<w:rFonts[^>]*w:cs="([^"]+)"/);
    if (csFontMatch) font = csFontMatch[1];
    const csSizeMatch = stylesXml.match(/<w:szCs\s+w:val="(\d+)"/);
    if (csSizeMatch) fontSize = csSizeMatch[1];
  }

  return { font, fontSize };
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

// ─── Content Paragraphs Builder — A4 Print-Optimized ────────────────────

function buildContentParagraphs(
  content: string,
  baseRunProps: ExtractedRunProps,
  _baseParagraphProps: string
): string {
  const { font, fontSize } = baseRunProps;
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
        alignment = 'center';
        isBold = true;
        lineFontSize = boldSize;
        spacingAfter = '360';
        break;
      case 'heading':
        isBold = true;
        lineFontSize = boldSize;
        spacingBefore = '120';
        spacingAfter = '120';
        isUnderline = true;
        break;
      case 'party_label':
        isBold = true;
        spacingBefore = '60';
        spacingAfter = '40';
        spacingLine = '312';
        break;
      case 'party_value':
        spacingAfter = '40';
        spacingLine = '312';
        break;
      case 'section_title':
        isBold = true;
        lineFontSize = boldSize;
        isUnderline = true;
        spacingBefore = '240';
        spacingAfter = '180';
        break;
      case 'signature':
        alignment = 'center';
        spacingBefore = '200';
        spacingAfter = '40';
        spacingLine = '312';
        break;
    }

    const pPr = `<w:pPr><w:bidi/><w:jc w:val="${alignment}"/><w:spacing w:before="${spacingBefore}" w:after="${spacingAfter}" w:line="${spacingLine}" w:lineRule="auto"/></w:pPr>`;

    const rPr = `<w:rPr>
      <w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>
      <w:sz w:val="${lineFontSize}"/><w:szCs w:val="${lineFontSize}"/>
      ${isBold ? '<w:b/><w:bCs/>' : ''}${isUnderline ? '<w:u w:val="single"/>' : ''}<w:rtl/>
    </w:rPr>`;

    return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`;
  }).join('\n');
}

// ─── Natural Arabic Marker Replacement ──────────────────────────────────

/**
 * Replace natural Arabic markers found in real Moroccan templates.
 * E.g., fills text after "لفائدة:" with client name, "ضد:" with opposing party.
 */
function replaceNaturalMarkers(docXml: string, ctx: TemplateContext): string {
  let result = docXml;

  // Map of Arabic markers to their values
  const markerMap: Array<{ marker: RegExp; value: string | undefined }> = [
    { marker: /لفائدة\s*:/g, value: ctx.clientName },
    { marker: /ضد\s*:/g, value: ctx.opposingParty },
  ];

  for (const { marker, value } of markerMap) {
    if (!value) continue;
    
    // Find paragraphs containing the marker and append value
    const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
    result = result.replace(pRegex, (pXml, pContent) => {
      const texts: string[] = [];
      const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let m;
      while ((m = tRegex.exec(pContent)) !== null) {
        texts.push(m[1]);
      }
      const joined = texts.join('');
      marker.lastIndex = 0;
      if (marker.test(joined) && joined.replace(marker, '').trim().length === 0) {
        // This paragraph only contains the marker - append value
        // Find the last <w:t> and append the value
        let replaced = false;
        const newPXml = pXml.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (tMatch, attrs, text) => {
          marker.lastIndex = 0;
          if (!replaced && marker.test(text + ':') || text.includes('لفائدة') || text.includes('ضد')) {
            replaced = true;
            return `<w:t${attrs}>${text} ${escapeXml(value)}</w:t>`;
          }
          return tMatch;
        });
        return replaced ? newPXml : pXml;
      }
      return pXml;
    });
  }

  return result;
}

// ─── Inline Placeholder Replacement ─────────────────────────────────────

function replaceInlinePlaceholders(docXml: string, ctx: TemplateContext): string {
  const today = ctx.date || new Date().toLocaleDateString('ar-MA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const inlineMap: Record<string, string> = {
    '{{DATE}}': today,
    '{{CLIENT}}': ctx.clientName || '',
    '{{CASE}}': ctx.caseName || '',
    '{{COURT}}': ctx.court || '',
    '{{CASE_NUMBER}}': ctx.caseNumber || '',
    '{{LAWYER}}': ctx.lawyerName || '',
  };

  let result = docXml;

  for (const [placeholder, value] of Object.entries(inlineMap)) {
    if (!value) continue;
    result = replaceSplitPlaceholder(result, placeholder, escapeXml(value));
  }

  return result;
}

// ─── Main Engine ────────────────────────────────────────────────────────

export async function injectIntoTemplate(
  templateBlob: Blob,
  ctx: TemplateContext
): Promise<Blob> {
  const zip = await JSZip.loadAsync(templateBlob);
  let docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('ملف القالب غير صالح');

  // 1. Extract formatting from the {{CONTENT}} placeholder (or body default)
  const contentRunProps = extractRunPropsFromXml(docXml, '{{CONTENT}}');
  const contentParaProps = extractParagraphProps(docXml, '{{CONTENT}}');

  // Fallback: try styles.xml if no rPr found
  if (!contentRunProps.xml) {
    const stylesXml = await zip.file('word/styles.xml')?.async('string');
    const fallback = extractFontFromStyles(stylesXml);
    contentRunProps.font = fallback.font;
    contentRunProps.fontSize = fallback.fontSize;
  }

  // 2. Replace inline placeholders (handles split runs)
  docXml = replaceInlinePlaceholders(docXml, ctx);

  // 3. Replace natural Arabic markers (لفائدة:, ضد:, etc.)
  docXml = replaceNaturalMarkers(docXml, ctx);

  // 4. Replace {{CONTENT}} with multi-paragraph content
  if (ctx.content) {
    const contentParagraphs = buildContentParagraphs(
      ctx.content,
      contentRunProps,
      contentParaProps
    );

    // Try bookmark → placeholder → natural body insertion → append
    const bookmarkRegex = /<w:bookmarkStart[^>]*w:name="CONTENT"[^>]*\/?>[\s\S]*?<w:bookmarkEnd[^>]*\/?>/i;

    if (bookmarkRegex.test(docXml)) {
      docXml = docXml.replace(bookmarkRegex, contentParagraphs);
    } else if (containsPlaceholder(docXml, '{{CONTENT}}')) {
      docXml = replaceParagraphContaining(docXml, '{{CONTENT}}', contentParagraphs);
    } else {
      // No explicit placeholder: insert before the last sectPr (keep headers/footers)
      const sectPrMatch = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
      if (sectPrMatch) {
        const idx = docXml.lastIndexOf(sectPrMatch[0]);
        docXml = docXml.substring(0, idx) + contentParagraphs + docXml.substring(idx);
      } else {
        // Absolute fallback
        docXml = docXml.replace(
          /<\/w:body>/,
          `${contentParagraphs}</w:body>`
        );
      }
    }
  }

  zip.file('word/document.xml', docXml);

  // Also process headers/footers for inline placeholders
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (/word\/(header|footer)\d*\.xml/i.test(path)) {
      let xml = await zipEntry.async('string');
      xml = replaceInlinePlaceholders(xml, ctx);
      zip.file(path, xml);
    }
  }

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/** Check if doc XML contains a placeholder (accounting for split runs) */
function containsPlaceholder(docXml: string, placeholder: string): boolean {
  if (docXml.includes(placeholder)) return true;
  
  // Check split runs
  const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(docXml)) !== null) {
    const texts: string[] = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m;
    while ((m = tRegex.exec(pMatch[0])) !== null) {
      texts.push(m[1]);
    }
    if (texts.join('').includes(placeholder)) return true;
  }
  return false;
}
