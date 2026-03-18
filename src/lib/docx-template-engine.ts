/**
 * DOCX Template Engine
 * 
 * Injects content into Word templates while preserving the template's formatting.
 * Supports multiple placeholders: {{CONTENT}}, {{DATE}}, {{CLIENT}}, {{CASE}}, {{COURT}}, {{CASE_NUMBER}}, {{LAWYER}}
 * 
 * A4 Print-optimized: proper line spacing (1.5x), balanced spacing after paragraphs.
 */

import JSZip from 'jszip';

// ─── Types ──────────────────────────────────────────────────────────────

export interface TemplateContext {
  content: string;
  date?: string;
  clientName?: string;
  caseName?: string;
  court?: string;
  caseNumber?: string;
  lawyerName?: string;
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

// ─── Formatting Extraction ─────────────────────────────────────────────

function extractRunPropsFromPlaceholder(docXml: string, placeholder: string): ExtractedRunProps {
  const escapedPh = placeholder.replace(/[{}]/g, '\\$&');
  const pRegex = new RegExp(`<w:p[^>]*>([\\s\\S]*?${escapedPh}[\\s\\S]*?)</w:p>`, 'i');
  const pMatch = docXml.match(pRegex);

  let font = 'Traditional Arabic';
  let fontSize = '28';                    // 14pt — comfortable reading size for legal docs
  let rPrXml = '';

  if (pMatch) {
    const pContent = pMatch[1];
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
  }

  return { xml: rPrXml, font, fontSize };
}

function extractParagraphProps(docXml: string, placeholder: string): string {
  const escapedPh = placeholder.replace(/[{}]/g, '\\$&');
  const pRegex = new RegExp(`<w:p[^>]*>([\\s\\S]*?${escapedPh}[\\s\\S]*?)</w:p>`, 'i');
  const pMatch = docXml.match(pRegex);

  if (pMatch) {
    const pContent = pMatch[1];
    const pPrMatch = pContent.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    if (pPrMatch) {
      return pPrMatch[0].replace(/<w:rPr>[\s\S]*?<\/w:rPr>/, '');
    }
  }

  // Default RTL paragraph props with A4-optimized spacing
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
  return 'normal';
}

// ─── Content Paragraphs Builder — A4 Print-Optimized ────────────────────

function buildContentParagraphs(
  content: string,
  baseRunProps: ExtractedRunProps,
  baseParagraphProps: string
): string {
  const { font, fontSize } = baseRunProps;
  const boldSize = String(parseInt(fontSize) + 4);

  const lines = content.split('\n').filter(l => l.trim());

  return lines.map(line => {
    const type = classifyLine(line);
    let alignment = 'right';
    let isBold = false;
    let lineFontSize = fontSize;
    let spacingAfter = '180';             // ~9pt after — comfortable for body text
    let spacingBefore = '0';
    let spacingLine = '360';              // 1.5x line spacing — optimal for Arabic legal text
    let isUnderline = false;

    switch (type) {
      case 'basmala':
        alignment = 'center';
        isBold = true;
        lineFontSize = boldSize;
        spacingAfter = '360';             // Extra space after basmala
        spacingLine = '360';
        break;
      case 'heading':
        isBold = true;
        lineFontSize = boldSize;
        spacingBefore = '120';
        spacingAfter = '120';
        isUnderline = true;
        spacingLine = '360';
        break;
      case 'party_label':
        isBold = true;
        spacingBefore = '60';
        spacingAfter = '40';
        spacingLine = '312';              // Tighter for label/value pairs
        break;
      case 'party_value':
        spacingAfter = '40';
        spacingLine = '312';
        break;
      case 'section_title':
        isBold = true;
        lineFontSize = boldSize;
        isUnderline = true;
        spacingBefore = '240';            // Clear separation before sections
        spacingAfter = '180';
        spacingLine = '360';
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
    const escapedPh = placeholder.replace(/[{}]/g, '\\$&');
    result = result.replace(new RegExp(escapedPh, 'g'), escapeXml(value));
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

  // 1. Extract formatting from the {{CONTENT}} placeholder paragraph
  const contentRunProps = extractRunPropsFromPlaceholder(docXml, '{{CONTENT}}');
  const contentParaProps = extractParagraphProps(docXml, '{{CONTENT}}');

  // Fallback: try styles.xml if no rPr found in placeholder
  if (!contentRunProps.xml) {
    const stylesXml = await zip.file('word/styles.xml')?.async('string');
    const fallback = extractFontFromStyles(stylesXml);
    contentRunProps.font = fallback.font;
    contentRunProps.fontSize = fallback.fontSize;
  }

  // 2. Replace inline placeholders first ({{DATE}}, {{CLIENT}}, etc.)
  docXml = replaceInlinePlaceholders(docXml, ctx);

  // 3. Replace {{CONTENT}} with multi-paragraph content
  const contentParagraphs = buildContentParagraphs(
    ctx.content,
    contentRunProps,
    contentParaProps
  );

  // Try bookmark first, then placeholder, then append
  const bookmarkRegex = /<w:bookmarkStart[^>]*w:name="CONTENT"[^>]*\/?>[\s\S]*?<w:bookmarkEnd[^>]*\/?>/i;
  const placeholderRegex = /<w:p[^>]*>[\s\S]*?\{\{CONTENT\}\}[\s\S]*?<\/w:p>/i;

  if (docXml.match(bookmarkRegex)) {
    docXml = docXml.replace(bookmarkRegex, contentParagraphs);
  } else if (docXml.match(placeholderRegex)) {
    docXml = docXml.replace(placeholderRegex, contentParagraphs);
  } else {
    // Fallback: insert before sectPr
    const sectPrMatch = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
    const sectPr = sectPrMatch ? sectPrMatch[0] : '';
    docXml = docXml.replace(
      /<w:body>[\s\S]*<\/w:body>/,
      `<w:body>${contentParagraphs}${sectPr}</w:body>`
    );
  }

  zip.file('word/document.xml', docXml);

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
