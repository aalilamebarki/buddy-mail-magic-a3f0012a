import jsPDF from 'jspdf';

/* ══════════════════════════════════════════════
   SHARED PDF UTILITIES — Moroccan Professional
   Design: Bilingual header, navy & gold accents
   Fonts: Amiri (titles) + IBM Plex Sans Arabic (body)
   ══════════════════════════════════════════════ */

export type RGB = [number, number, number];

/* ── Design Tokens ── */
export const NAVY: RGB     = [26, 42, 68];        // #1a2a44
export const GOLD: RGB     = [197, 160, 89];       // #c5a059
export const TEXT: RGB      = [30, 30, 30];
export const TEXT2: RGB     = [100, 100, 100];
export const TEXT3: RGB     = [150, 150, 150];
export const BORDER: RGB    = [200, 200, 200];
export const BG: RGB        = [248, 248, 248];
export const WHITE: RGB     = [255, 255, 255];

/* ── Font loader with cache ── */
const fontCache: Record<string, string> = {};

export const loadFont = async (path: string): Promise<string> => {
  if (fontCache[path]) return fontCache[path];
  const res = await fetch(path);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  fontCache[path] = btoa(bin);
  return fontCache[path];
};

/* ── Register both fonts on a jsPDF doc ── */
export const registerFonts = async (doc: jsPDF) => {
  const [plexB64, plexBoldB64, amiriB64] = await Promise.all([
    loadFont('/fonts/IBMPlexSansArabic-Regular.ttf'),
    loadFont('/fonts/IBMPlexSansArabic-Bold.ttf'),
    loadFont('/fonts/Amiri-Regular.ttf'),
  ]);
  doc.addFileToVFS('IBMPlex.ttf', plexB64);
  doc.addFont('IBMPlex.ttf', 'IBMPlex', 'normal');
  doc.addFileToVFS('IBMPlexBold.ttf', plexBoldB64);
  doc.addFont('IBMPlexBold.ttf', 'IBMPlex', 'bold');
  doc.addFileToVFS('Amiri.ttf', amiriB64);
  doc.addFont('Amiri.ttf', 'Amiri', 'normal');
};

/* ── Number formatting (Moroccan) ── */
export const fmt = (n: number) =>
  n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Horizontal line ── */
export const hline = (doc: jsPDF, y: number, x1: number, x2: number, color: RGB = BORDER, w = 0.3) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(w);
  doc.line(x1, y, x2, y);
};

/* ── Dotted rectangle (for signature area) ── */
export const drawDottedRect = (doc: jsPDF, x: number, y: number, w: number, h: number) => {
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  const gap = 2.5, dash = 1.2;
  for (let dx = x; dx < x + w; dx += gap) {
    doc.line(dx, y, Math.min(dx + dash, x + w), y);
    doc.line(dx, y + h, Math.min(dx + dash, x + w), y + h);
  }
  for (let dy = y; dy < y + h; dy += gap) {
    doc.line(x, dy, x, Math.min(dy + dash, y + h));
    doc.line(x + w, dy, x + w, Math.min(dy + dash, y + h));
  }
};

/* ── Tafkeet — Arabic number-to-words ── */
export const numberToArabicWords = (num: number): string => {
  if (num === 0) return 'صفر درهم';
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const parts: string[] = [];
  const mil = Math.floor(num / 1000000), th = Math.floor((num % 1000000) / 1000), rem = Math.floor(num % 1000);
  if (mil > 0) { if (mil === 1) parts.push('مليون'); else if (mil === 2) parts.push('مليونان'); else parts.push(`${ones[mil]} ملايين`); }
  if (th > 0) {
    if (th === 1) parts.push('ألف'); else if (th === 2) parts.push('ألفان');
    else if (th >= 3 && th <= 10) parts.push(`${ones[th]} آلاف`);
    else {
      const tH = Math.floor(th / 100), tR = th % 100, tP: string[] = [];
      if (tH > 0) tP.push(hundreds[tH]);
      if (tR >= 10 && tR < 20) tP.push(teens[tR - 10]);
      else { const tO = tR % 10, tT = Math.floor(tR / 10); if (tO > 0) tP.push(ones[tO]); if (tT > 0) tP.push(tens[tT]); }
      parts.push(tP.join(' و') + ' ألف');
    }
  }
  if (rem > 0) {
    const rH = Math.floor(rem / 100), rR = rem % 100;
    if (rH > 0) parts.push(hundreds[rH]);
    if (rR >= 10 && rR < 20) parts.push(teens[rR - 10]);
    else {
      const rO = rR % 10, rT = Math.floor(rR / 10);
      if (rO > 0 && rT > 0) parts.push(`${ones[rO]} و${tens[rT]}`);
      else if (rO > 0) parts.push(ones[rO]);
      else if (rT > 0) parts.push(tens[rT]);
    }
  }
  return `فقط ${parts.join(' و')} درهم مغربي لا غير.`;
};

/* ── Page constants ── */
export const PW = 210;
export const MARGIN = 18;
export const RX = PW - MARGIN;
export const CW = PW - MARGIN * 2;
export const CX = PW / 2;

/* ── Letterhead info type ── */
export interface LetterheadInfo {
  lawyerName: string;
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

/* ── Draw double-line frame on page ── */
export const drawPageFrame = (doc: jsPDF) => {
  // Outer frame
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.rect(10, 10, PW - 20, 277);
  // Inner frame
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.rect(12, 12, PW - 24, 273);
};

/* ── Draw gold decorative line ── */
export const goldLine = (doc: jsPDF, y: number, x1: number, x2: number) => {
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(x1, y, x2, y);
};

/* ── Draw unified bilingual header ──
   Returns new Y position after header */
export const drawHeader = (
  doc: jsPDF,
  lawyerName: string,
  letterhead: LetterheadInfo | undefined,
  startY: number,
): number => {
  const lh = letterhead;
  let y = startY;

  // "مكتب الأستاذ" label
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text('مكتب الأستاذ', CX, y, { align: 'center' });

  // French equivalent
  if (lh?.nameFr) {
    doc.setFontSize(8);
    doc.setTextColor(...TEXT2);
    doc.text('Cabinet de Maître', CX, y + 4, { align: 'center' });
    y += 4;
  }
  y += 8;

  // Lawyer name (Arabic)
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(24);
  doc.setTextColor(...NAVY);
  doc.text(lawyerName, CX, y, { align: 'center' });
  y += 4;

  // Lawyer name (French)
  if (lh?.nameFr) {
    doc.setFont('IBMPlex', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...TEXT2);
    doc.text(lh.nameFr, CX, y + 4, { align: 'center' });
    y += 7;
  }
  y += 4;

  // Gold decorative line
  goldLine(doc, y, CX - 35, CX + 35);
  y += 6;

  // Professional title (Arabic)
  const titleAr = lh?.titleAr || '';
  const barAr = lh?.barNameAr ? `لدى ${lh.barNameAr}` : '';
  const titleLine = [titleAr, barAr].filter(Boolean).join(' ');
  if (titleLine) {
    doc.setFont('IBMPlex', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    doc.text(titleLine, CX, y, { align: 'center' });
    y += 5;
  }

  // Professional title (French)
  const titleFr = lh?.titleFr || '';
  const barFr = lh?.barNameFr ? `près ${lh.barNameFr}` : '';
  const titleLineFr = [titleFr, barFr].filter(Boolean).join(' ');
  if (titleLineFr) {
    doc.setFont('IBMPlex', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT3);
    doc.text(titleLineFr, CX, y, { align: 'center' });
    y += 5;
  }

  // Contact info line
  const contactParts: string[] = [];
  if (lh?.phone) contactParts.push(`هاتف: ${lh.phone}`);
  if (lh?.email) contactParts.push(`بريد: ${lh.email}`);

  if (lh?.address) {
    doc.setFont('IBMPlex', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT2);
    const addr = lh.city ? `${lh.address}، ${lh.city}` : lh.address;
    doc.text(addr, CX, y, { align: 'center' });
    y += 4;
  }

  if (contactParts.length > 0) {
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT3);
    doc.text(contactParts.join('  |  '), CX, y, { align: 'center' });
    y += 4;
  }

  y += 2;
  // Navy separator after header
  hline(doc, y, MARGIN, RX, NAVY, 0.6);
  y += 1;
  hline(doc, y + 0.8, MARGIN, RX, GOLD, 0.2);

  return y + 4;
};

/* ── Draw footer on current page ── */
export const drawFooter = (doc: jsPDF) => {
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...TEXT3);
  doc.text('وثيقة صادرة إلكترونياً — Document généré électroniquement', CX, 282, { align: 'center' });
};

/* ── Draw navy top bar ── */
export const drawTopBar = (doc: jsPDF) => {
  // No top bar in Moroccan professional style, replaced by frame
};

/* ── Check if we need a new page, and add one if so ── */
export const ensureSpace = (doc: jsPDF, y: number, needed: number): number => {
  if (y + needed > 270) {
    drawFooter(doc);
    doc.addPage();
    drawPageFrame(doc);
    return 20;
  }
  return y;
};

/* ── Draw date + signature + seal area ── */
export const drawDateAndSignature = (doc: jsPDF, y: number, date: string, city: string): number => {
  // Date on right
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT2);
  doc.text(`حرر ب${city || '...'} في:`, RX - 4, y, { align: 'right' });
  y += 6;

  doc.setFont('Amiri', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text(date, RX - 4, y, { align: 'right' });
  y += 14;

  // Signature label
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text('التوقيع والختم', CX, y, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(...TEXT3);
  doc.text('Signature et cachet', CX, y + 4, { align: 'center' });
  y += 10;

  // Signature box with gold border
  const sealW = 55, sealH = 25;
  const sealX = CX - sealW / 2;
  doc.setFillColor(...BG);
  doc.rect(sealX, y, sealW, sealH, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.rect(sealX, y, sealW, sealH, 'S');

  return y + sealH;
};
