import jsPDF from 'jspdf';

/* ══════════════════════════════════════════════
   SHARED PDF UTILITIES
   Design: Formal Classic — Navy (#1a2a44) accent
   Fonts: Amiri (titles) + IBM Plex Sans Arabic (body)
   ══════════════════════════════════════════════ */

export type RGB = [number, number, number];

/* ── Design Tokens ── */
export const NAVY: RGB    = [26, 42, 68];       // #1a2a44 — primary accent
export const TEXT: RGB     = [30, 30, 30];       // near-black body
export const TEXT2: RGB    = [100, 100, 100];     // secondary / labels
export const TEXT3: RGB    = [160, 160, 160];     // muted / hints
export const BORDER: RGB   = [220, 220, 220];     // rules & dividers
export const BG: RGB       = [245, 246, 248];     // light panel bg
export const WHITE: RGB    = [255, 255, 255];

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
  const [plexB64, amiriB64] = await Promise.all([
    loadFont('/fonts/IBMPlexSansArabic-Regular.ttf'),
    loadFont('/fonts/Amiri-Regular.ttf'),
  ]);
  doc.addFileToVFS('IBMPlex.ttf', plexB64);
  doc.addFont('IBMPlex.ttf', 'IBMPlex', 'normal');
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
export const PW = 210;           // A4 width
export const MARGIN = 22;
export const RX = PW - MARGIN;   // right edge
export const CW = PW - MARGIN * 2; // content width
export const CX = PW / 2;        // center x

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

/* ── Draw unified header ──
   Returns new Y position after header */
export const drawHeader = (
  doc: jsPDF,
  lawyerName: string,
  letterhead: LetterheadInfo | undefined,
  startY: number,
): number => {
  const lh = letterhead;
  const titleText = [lh?.titleAr, lh?.barNameAr ? `لدى ${lh.barNameAr}` : ''].filter(Boolean).join(' ').trim();
  const city = lh?.city || '';
  let y = startY;

  // مكتب الأستاذ
  doc.setFont('Amiri');
  doc.setFontSize(15);
  doc.setTextColor(...TEXT);
  doc.text('مكتب الأستاذ', CX, y, { align: 'center' });
  y += 11;

  // اسم المحامي
  doc.setFontSize(26);
  doc.setTextColor(...TEXT);
  doc.text(lawyerName, CX, y, { align: 'center' });
  y += 8;

  // اللقب المهني
  if (titleText) {
    doc.setFont('IBMPlex');
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(titleText, CX, y, { align: 'center' });
    y += 8;
  }

  // المقر الاجتماعي
  doc.setFont('IBMPlex');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text('المقر الاجتماعي', CX, y, { align: 'center' });
  y += 6;

  if (lh?.address) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT2);
    const addr = city ? `${lh.address}، ${city}، المغرب` : lh.address;
    doc.text(addr, CX, y, { align: 'center' });
    y += 5;
  }
  if (lh?.phone) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT2);
    doc.text(`الهاتف: ${lh.phone}`, CX, y, { align: 'center' });
    y += 5;
  }
  if (lh?.email) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT2);
    doc.text(`البريد: ${lh.email}`, CX, y, { align: 'center' });
    y += 5;
  }

  y += 4;
  hline(doc, y, MARGIN, RX);

  return y + 2;
};

/* ── Draw footer on current page ── */
export const drawFooter = (doc: jsPDF) => {
  hline(doc, 291, MARGIN, RX, BORDER, 0.15);
  doc.setFont('IBMPlex');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT3);
  doc.text('وثيقة موقعة إلكترونياً', CX, 294, { align: 'center' });
};

/* ── Draw navy top bar ── */
export const drawTopBar = (doc: jsPDF) => {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PW, 3.5, 'F');
};

/* ── Check if we need a new page, and add one if so ── */
export const ensureSpace = (doc: jsPDF, y: number, needed: number): number => {
  if (y + needed > 275) {
    drawFooter(doc);
    doc.addPage();
    drawTopBar(doc);
    return 16;
  }
  return y;
};

/* ── Draw date + signature + seal area ── */
export const drawDateAndSignature = (doc: jsPDF, y: number, date: string, city: string): number => {
  // Date
  doc.setFont('IBMPlex');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT3);
  doc.text(`حرر ب${city || '...'} في:`, RX, y, { align: 'right' });
  y += 7;

  doc.setFontSize(14);
  doc.setTextColor(...TEXT);
  doc.text(date, RX, y, { align: 'right' });
  y += 14;

  // Signature
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text('التوقيع والختم', CX, y, { align: 'center' });
  y += 8;

  const sealW = 55, sealH = 28;
  const sealX = CX - sealW / 2;
  doc.setFillColor(245, 245, 245);
  doc.rect(sealX, y, sealW, sealH, 'F');
  drawDottedRect(doc, sealX, y, sealW, sealH);
  doc.setFontSize(7);
  doc.setTextColor(...TEXT3);
  doc.text('SEAL & SIGNATURE AREA', CX, y + sealH / 2 + 1, { align: 'center' });

  return y + sealH;
};
