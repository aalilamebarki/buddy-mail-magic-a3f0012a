/**
 * Letterhead Reconstructor
 * 
 * Converts the stored LetterheadStructure JSON back into `docx` library
 * objects (Paragraph, TextRun, Header, Footer) for use in programmatic
 * document generation (fee statements, invoices).
 * 
 * This ensures the letterhead appears EXACTLY as in the original Word file,
 * with all fonts, sizes, colors, and formatting preserved.
 */

import {
  AlignmentType,
  Header,
  Footer,
  Paragraph,
  TextRun,
  ImageRun,
} from 'docx';

import type {
  LetterheadStructure,
  LetterheadParagraph,
  LetterheadRun,
} from './parse-letterhead-structure';

// ─── Alignment Mapping ──────────────────────────────────────────────────

function mapAlignment(alignment?: string): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  if (!alignment) return undefined;
  const map: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
    both: AlignmentType.JUSTIFIED,
  };
  return map[alignment];
}

// ─── Run Builder ────────────────────────────────────────────────────────

function buildTextRun(run: LetterheadRun, defaults: LetterheadStructure): TextRun {
  const opts: any = {
    text: run.text,
    font: run.font || run.fontCs || defaults.defaultFontCs || defaults.defaultFont,
    size: run.sizeCs || run.size || defaults.defaultSize,
    bold: run.bold,
    italics: run.italic,
    color: run.color,
    rightToLeft: run.rtl,
  };

  if (run.underline) {
    opts.underline = { type: 'single' };
  }

  return new TextRun(opts);
}

// ─── Paragraph Builder ──────────────────────────────────────────────────

function buildParagraph(para: LetterheadParagraph, defaults: LetterheadStructure): Paragraph {
  return new Paragraph({
    alignment: mapAlignment(para.alignment),
    bidirectional: para.bidi ?? true,
    spacing: {
      before: para.spacingBefore ?? 0,
      after: para.spacingAfter ?? 0,
      line: para.spacingLine,
    },
    children: para.runs.map(run => buildTextRun(run, defaults)),
  });
}

// ─── Image Builder ──────────────────────────────────────────────────────

function buildImageRun(imageData: string, contentType: string, widthEmu?: number, heightEmu?: number): ImageRun | null {
  try {
    // Convert base64 to Buffer
    const binaryStr = atob(imageData);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Default dimensions if not provided (reasonable letterhead size)
    const width = widthEmu ? Math.round(widthEmu / 9525) : 200; // EMU to pixels
    const height = heightEmu ? Math.round(heightEmu / 9525) : 60;

    return new ImageRun({
      data: bytes,
      transformation: { width, height },
      type: contentType.includes('png') ? 'png' : 'jpg',
    } as any);
  } catch (e) {
    console.warn('Failed to build image run:', e);
    return null;
  }
}

// ─── Main Reconstructors ────────────────────────────────────────────────

/**
 * Build header Paragraph[] from stored structure.
 * Use these in the `sections[].headers` of a docx Document.
 */
export function buildHeaderParagraphs(structure: LetterheadStructure): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Add images first (if any header images)
  const headerImages = structure.images.filter(img => img.section === 'header');
  for (const img of headerImages) {
    const imageRun = buildImageRun(img.data, img.contentType, img.widthEmu, img.heightEmu);
    if (imageRun) {
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [imageRun],
      }));
    }
  }

  // Add text paragraphs
  for (const para of structure.headerParagraphs) {
    paragraphs.push(buildParagraph(para, structure));
  }

  return paragraphs;
}

/**
 * Build footer Paragraph[] from stored structure.
 */
export function buildFooterParagraphs(structure: LetterheadStructure): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  const footerImages = structure.images.filter(img => img.section === 'footer');
  for (const img of footerImages) {
    const imageRun = buildImageRun(img.data, img.contentType, img.widthEmu, img.heightEmu);
    if (imageRun) {
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [imageRun],
      }));
    }
  }

  for (const para of structure.footerParagraphs) {
    paragraphs.push(buildParagraph(para, structure));
  }

  return paragraphs;
}

/**
 * Build a complete Header object for use in docx Document sections.
 */
export function buildHeader(structure: LetterheadStructure): Header {
  return new Header({
    children: buildHeaderParagraphs(structure),
  });
}

/**
 * Build a complete Footer object for use in docx Document sections.
 */
export function buildFooter(structure: LetterheadStructure): Footer {
  return new Footer({
    children: buildFooterParagraphs(structure),
  });
}

/**
 * Get page margin configuration from stored structure.
 * Returns margins in twips for use in docx Document sections.
 */
export function getPageMargins(structure: LetterheadStructure) {
  const m = structure.margins;
  if (!m) return undefined;
  return {
    top: m.top,
    bottom: m.bottom,
    left: m.left,
    right: m.right,
    header: m.header,
    footer: m.footer,
  };
}

/**
 * Get the default font configuration from the stored structure.
 * Use for body text in generated documents.
 */
export function getDefaultFont(structure: LetterheadStructure) {
  return {
    font: structure.defaultFontCs || structure.defaultFont || 'Traditional Arabic',
    size: structure.defaultSize || 24,
  };
}
