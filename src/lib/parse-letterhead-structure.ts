/**
 * Letterhead Structure Parser
 * 
 * Parses a .docx letterhead file into a structured JSON representation
 * that captures ALL formatting details:
 * - Font family, size, color
 * - Bold, italic, underline
 * - Alignment, spacing
 * - RTL direction
 * - Images (as base64)
 * 
 * This JSON is stored in the database and used to reconstruct
 * the letterhead in any generated document (fee statements, invoices, memos).
 */

import JSZip from 'jszip';

// ─── Types ──────────────────────────────────────────────────────────────

export interface LetterheadRun {
  text: string;
  font?: string;
  fontCs?: string;
  size?: number;      // half-points (Word internal: 24 = 12pt)
  sizeCs?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;     // hex without #
  rtl?: boolean;
}

export interface LetterheadParagraph {
  runs: LetterheadRun[];
  alignment?: 'left' | 'center' | 'right' | 'both';
  bidi?: boolean;
  spacingBefore?: number;
  spacingAfter?: number;
  spacingLine?: number;
}

export interface LetterheadImage {
  /** base64 encoded image data */
  data: string;
  /** MIME type */
  contentType: string;
  /** Width in EMU (English Metric Units) */
  widthEmu?: number;
  /** Height in EMU */
  heightEmu?: number;
  /** Which section: header or footer */
  section: 'header' | 'footer';
}

export interface LetterheadStructure {
  /** Version for future migrations */
  version: number;
  /** Parsed header paragraphs with full formatting */
  headerParagraphs: LetterheadParagraph[];
  /** Parsed footer paragraphs with full formatting */
  footerParagraphs: LetterheadParagraph[];
  /** Images found in header/footer */
  images: LetterheadImage[];
  /** Default font detected in the template */
  defaultFont: string;
  /** Default font for complex scripts (Arabic) */
  defaultFontCs: string;
  /** Default font size (half-points) */
  defaultSize: number;
  /** Page margins in twips (1/1440 inch) */
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    header?: number;
    footer?: number;
  };
}

// ─── XML Parsing Helpers ────────────────────────────────────────────────

function getAttr(xml: string, tagName: string, attrName: string): string | undefined {
  const regex = new RegExp(`<${tagName}[^>]*${attrName}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match?.[1];
}

function parseAlignment(val?: string): LetterheadParagraph['alignment'] {
  if (!val) return undefined;
  const map: Record<string, LetterheadParagraph['alignment']> = {
    left: 'left', center: 'center', right: 'right',
    both: 'both', start: 'right', end: 'left',
  };
  return map[val.toLowerCase()] || undefined;
}

// ─── Run Parser ─────────────────────────────────────────────────────────

function parseRun(runXml: string): LetterheadRun | null {
  // Extract text
  const texts: string[] = [];
  const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = tRegex.exec(runXml)) !== null) {
    texts.push(m[1]);
  }
  const text = texts.join('');
  if (!text) return null;

  const run: LetterheadRun = { text };

  // Extract run properties
  const rPrMatch = runXml.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
  if (rPrMatch) {
    const rPr = rPrMatch[1];

    // Font
    const fontAscii = rPr.match(/<w:rFonts[^>]*w:ascii="([^"]+)"/);
    const fontCs = rPr.match(/<w:rFonts[^>]*w:cs="([^"]+)"/);
    const fontHAnsi = rPr.match(/<w:rFonts[^>]*w:hAnsi="([^"]+)"/);
    if (fontAscii) run.font = fontAscii[1];
    else if (fontHAnsi) run.font = fontHAnsi[1];
    if (fontCs) run.fontCs = fontCs[1];

    // Size
    const sz = rPr.match(/<w:sz\s+w:val="(\d+)"/);
    const szCs = rPr.match(/<w:szCs\s+w:val="(\d+)"/);
    if (sz) run.size = parseInt(sz[1]);
    if (szCs) run.sizeCs = parseInt(szCs[1]);

    // Bold
    if (/<w:b\b[^>]*\/>/.test(rPr) || /<w:bCs\b[^>]*\/>/.test(rPr)) {
      run.bold = true;
    }

    // Italic
    if (/<w:i\b[^>]*\/>/.test(rPr) || /<w:iCs\b[^>]*\/>/.test(rPr)) {
      run.italic = true;
    }

    // Underline
    if (/<w:u\b/.test(rPr)) {
      run.underline = true;
    }

    // Color
    const colorMatch = rPr.match(/<w:color\s+w:val="([^"]+)"/);
    if (colorMatch && colorMatch[1] !== 'auto') {
      run.color = colorMatch[1];
    }

    // RTL
    if (/<w:rtl\s*\/>/.test(rPr)) {
      run.rtl = true;
    }
  }

  return run;
}

// ─── Paragraph Parser ───────────────────────────────────────────────────

function parseParagraph(pXml: string): LetterheadParagraph {
  const para: LetterheadParagraph = { runs: [] };

  // Parse paragraph properties
  const pPrMatch = pXml.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/);
  if (pPrMatch) {
    const pPr = pPrMatch[1];

    // Alignment
    const jcMatch = pPr.match(/<w:jc\s+w:val="([^"]+)"/);
    if (jcMatch) para.alignment = parseAlignment(jcMatch[1]);

    // Bidi
    if (/<w:bidi\s*\/>/.test(pPr)) para.bidi = true;

    // Spacing
    const spacingMatch = pPr.match(/<w:spacing([^>]*)\/>/);
    if (spacingMatch) {
      const attrs = spacingMatch[1];
      const before = attrs.match(/w:before="(\d+)"/);
      const after = attrs.match(/w:after="(\d+)"/);
      const line = attrs.match(/w:line="(\d+)"/);
      if (before) para.spacingBefore = parseInt(before[1]);
      if (after) para.spacingAfter = parseInt(after[1]);
      if (line) para.spacingLine = parseInt(line[1]);
    }
  }

  // Parse runs
  const runRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
  let rMatch;
  while ((rMatch = runRegex.exec(pXml)) !== null) {
    const run = parseRun(rMatch[0]);
    if (run) para.runs.push(run);
  }

  return para;
}

// ─── Image Extractor ────────────────────────────────────────────────────

async function extractImages(
  zip: JSZip,
  xml: string,
  rels: string,
  section: 'header' | 'footer'
): Promise<LetterheadImage[]> {
  const images: LetterheadImage[] = [];

  // Find image references in the XML
  const drawingRegex = /<w:drawing>([\s\S]*?)<\/w:drawing>/g;
  let dMatch;
  while ((dMatch = drawingRegex.exec(xml)) !== null) {
    const drawingXml = dMatch[1];

    // Get relationship ID
    const embedMatch = drawingXml.match(/r:embed="([^"]+)"/);
    if (!embedMatch) continue;
    const rId = embedMatch[1];

    // Get dimensions
    const cxMatch = drawingXml.match(/cx="(\d+)"/);
    const cyMatch = drawingXml.match(/cy="(\d+)"/);

    // Resolve relationship to file path
    const relRegex = new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`, 'i');
    const relMatch = rels.match(relRegex);
    if (!relMatch) continue;

    let targetPath = relMatch[1];
    // Resolve relative path
    if (!targetPath.startsWith('word/')) {
      targetPath = 'word/' + targetPath.replace(/^\.\.\//, '').replace(/^\//, '');
    }

    // Read the image file
    const imageFile = zip.file(targetPath);
    if (!imageFile) continue;

    try {
      const imageData = await imageFile.async('base64');
      const ext = targetPath.split('.').pop()?.toLowerCase() || 'png';
      const mimeMap: Record<string, string> = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', bmp: 'image/bmp', emf: 'image/x-emf',
        wmf: 'image/x-wmf', tiff: 'image/tiff', tif: 'image/tiff',
      };

      images.push({
        data: imageData,
        contentType: mimeMap[ext] || 'image/png',
        widthEmu: cxMatch ? parseInt(cxMatch[1]) : undefined,
        heightEmu: cyMatch ? parseInt(cyMatch[1]) : undefined,
        section,
      });
    } catch (e) {
      console.warn(`Failed to extract image ${targetPath}:`, e);
    }
  }

  return images;
}

// ─── Relationship File Reader ───────────────────────────────────────────

async function readRels(zip: JSZip, xmlPath: string): Promise<string> {
  // header1.xml → _rels/header1.xml.rels
  const dir = xmlPath.substring(0, xmlPath.lastIndexOf('/'));
  const fileName = xmlPath.substring(xmlPath.lastIndexOf('/') + 1);
  const relsPath = `${dir}/_rels/${fileName}.rels`;
  const relsFile = zip.file(relsPath);
  if (!relsFile) return '';
  return relsFile.async('string');
}

// ─── Default Style Detection ────────────────────────────────────────────

function detectDefaults(docXml: string, stylesXml?: string): {
  font: string; fontCs: string; size: number;
} {
  let font = 'Calibri';
  let fontCs = 'Traditional Arabic';
  let size = 24; // 12pt

  // From styles.xml (default paragraph style)
  if (stylesXml) {
    const defaultRpr = stylesXml.match(/<w:style\s+w:type="paragraph"\s+w:default="1"[^>]*>([\s\S]*?)<\/w:style>/);
    if (defaultRpr) {
      const rPr = defaultRpr[1];
      const fa = rPr.match(/<w:rFonts[^>]*w:ascii="([^"]+)"/);
      const fcs = rPr.match(/<w:rFonts[^>]*w:cs="([^"]+)"/);
      const sz = rPr.match(/<w:sz\s+w:val="(\d+)"/);
      const szCs = rPr.match(/<w:szCs\s+w:val="(\d+)"/);
      if (fa) font = fa[1];
      if (fcs) fontCs = fcs[1];
      if (szCs) size = parseInt(szCs[1]);
      else if (sz) size = parseInt(sz[1]);
    }

    // docDefaults fallback
    const docDefaults = stylesXml.match(/<w:docDefaults>([\s\S]*?)<\/w:docDefaults>/);
    if (docDefaults) {
      const dd = docDefaults[1];
      const fa = dd.match(/<w:rFonts[^>]*w:ascii="([^"]+)"/);
      const fcs = dd.match(/<w:rFonts[^>]*w:cs="([^"]+)"/);
      const sz = dd.match(/<w:szCs\s+w:val="(\d+)"/);
      if (fa && font === 'Calibri') font = fa[1];
      if (fcs && fontCs === 'Traditional Arabic') fontCs = fcs[1];
      if (sz) size = parseInt(sz[1]);
    }
  }

  // From most common rPr in body
  const rPrCounts = new Map<string, number>();
  const csRegex = /<w:rFonts[^>]*w:cs="([^"]+)"/g;
  let m;
  while ((m = csRegex.exec(docXml)) !== null) {
    rPrCounts.set(m[1], (rPrCounts.get(m[1]) || 0) + 1);
  }
  let maxCount = 0;
  for (const [f, c] of rPrCounts) {
    if (c > maxCount) { maxCount = c; fontCs = f; }
  }

  return { font, fontCs, size };
}

// ─── Page Margins ───────────────────────────────────────────────────────

function extractMargins(docXml: string): LetterheadStructure['margins'] {
  const sectPr = docXml.match(/<w:sectPr[^>]*>([\s\S]*?)<\/w:sectPr>/);
  if (!sectPr) return undefined;

  const pgMar = sectPr[1].match(/<w:pgMar([^>]*)\/>/);
  if (!pgMar) return undefined;

  const attrs = pgMar[1];
  const get = (name: string) => {
    const m = attrs.match(new RegExp(`w:${name}="(\\d+)"`));
    return m ? parseInt(m[1]) : undefined;
  };

  return {
    top: get('top'),
    bottom: get('bottom'),
    left: get('left'),
    right: get('right'),
    header: get('header'),
    footer: get('footer'),
  };
}

// ─── Main Parser ────────────────────────────────────────────────────────

/**
 * Parse a .docx letterhead into a structured JSON representation.
 * Captures ALL formatting details for faithful reconstruction.
 */
export async function parseLetterheadStructure(file: File | Blob): Promise<LetterheadStructure> {
  const zip = await JSZip.loadAsync(file);

  const structure: LetterheadStructure = {
    version: 1,
    headerParagraphs: [],
    footerParagraphs: [],
    images: [],
    defaultFont: 'Calibri',
    defaultFontCs: 'Traditional Arabic',
    defaultSize: 24,
  };

  // 1. Parse styles & defaults
  const stylesXml = await zip.file('word/styles.xml')?.async('string');
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (docXml) {
    const defaults = detectDefaults(docXml, stylesXml);
    structure.defaultFont = defaults.font;
    structure.defaultFontCs = defaults.fontCs;
    structure.defaultSize = defaults.size;
    structure.margins = extractMargins(docXml);
  }

  // 2. Parse headers
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (!/word\/header\d*\.xml/i.test(path)) continue;
    const xml = await zipEntry.async('string');
    const rels = await readRels(zip, path);

    // Parse paragraphs
    const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(xml)) !== null) {
      const para = parseParagraph(pMatch[0]);
      if (para.runs.length > 0) {
        structure.headerParagraphs.push(para);
      }
    }

    // Extract images
    const imgs = await extractImages(zip, xml, rels, 'header');
    structure.images.push(...imgs);
  }

  // 3. Parse footers
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (!/word\/footer\d*\.xml/i.test(path)) continue;
    const xml = await zipEntry.async('string');
    const rels = await readRels(zip, path);

    const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(xml)) !== null) {
      const para = parseParagraph(pMatch[0]);
      if (para.runs.length > 0) {
        structure.footerParagraphs.push(para);
      }
    }

    const imgs = await extractImages(zip, xml, rels, 'footer');
    structure.images.push(...imgs);
  }

  // 4. If no header paragraphs found, try first body paragraphs as letterhead
  if (structure.headerParagraphs.length === 0 && docXml) {
    const pRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
    let pMatch;
    let count = 0;
    while ((pMatch = pRegex.exec(docXml)) !== null && count < 10) {
      const para = parseParagraph(pMatch[0]);
      if (para.runs.length > 0) {
        // Stop at first paragraph that looks like body content (long text)
        const totalText = para.runs.map(r => r.text).join('');
        if (totalText.length > 100) break;
        structure.headerParagraphs.push(para);
        count++;
      }
    }
  }

  return structure;
}
