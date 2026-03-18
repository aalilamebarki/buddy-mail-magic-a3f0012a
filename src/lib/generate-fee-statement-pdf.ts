import jsPDF from 'jspdf';

export interface FeeStatementItem {
  description: string;
  amount: number;
}

export interface CaseDetailData {
  caseTitle: string;
  caseNumber: string;
  court?: string;
  caseType?: string;
  items: FeeStatementItem[];
  lawyerFees: number;
  expensesTotal: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
}

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

export interface FeeStatementData {
  statementNumber: string;
  signatureUuid: string;
  clientName: string;
  clientCin?: string;
  clientPhone?: string;
  powerOfAttorneyDate?: string;
  taxRate: number;
  grandSubtotal: number;
  grandTaxAmount: number;
  grandTotal: number;
  caseDetails: CaseDetailData[];
  notes?: string;
  date: string;
  lawyerName: string;
  letterhead?: LetterheadInfo;
}

/* ── Font ── */
const fontCache: Record<string, string> = {};
const loadFont = async (path: string): Promise<string> => {
  if (fontCache[path]) return fontCache[path];
  const res = await fetch(path);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  fontCache[path] = btoa(bin);
  return fontCache[path];
};

const fmt = (n: number) =>
  n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Design tokens ── */
type RGB = [number, number, number];
const NAVY: RGB = [26, 42, 68];        // #1a2a44
const TEXT: RGB = [30, 30, 30];
const TEXT2: RGB = [100, 100, 100];
const TEXT3: RGB = [160, 160, 160];
const BORDER: RGB = [220, 220, 220];
const BG: RGB = [245, 246, 248];
const WHITE: RGB = [255, 255, 255];

/* ── Tafkeet ── */
const numberToArabicWords = (num: number): string => {
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
    else if (th <= 10) parts.push(`${ones[th]} آلاف`);
    else { const tH = Math.floor(th / 100), tR = th % 100, tP: string[] = []; if (tH > 0) tP.push(hundreds[tH]); if (tR >= 10 && tR < 20) tP.push(teens[tR - 10]); else { const tO = tR % 10, tT = Math.floor(tR / 10); if (tO > 0) tP.push(ones[tO]); if (tT > 0) tP.push(tens[tT]); } parts.push(tP.join(' و') + ' ألف'); }
  }
  if (rem > 0) { const rH = Math.floor(rem / 100), rR = rem % 100; if (rH > 0) parts.push(hundreds[rH]); if (rR >= 10 && rR < 20) parts.push(teens[rR - 10]); else { const rO = rR % 10, rT = Math.floor(rR / 10); if (rO > 0 && rT > 0) parts.push(`${ones[rO]} و${tens[rT]}`); else if (rO > 0) parts.push(ones[rO]); else if (rT > 0) parts.push(tens[rT]); } }
  return `فقط ${parts.join(' و')} درهم مغربي لا غير.`;
};

/* ── Helpers ── */
const hline = (doc: jsPDF, y: number, x1: number, x2: number, color: RGB = BORDER, w = 0.3) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(w);
  doc.line(x1, y, x2, y);
};

const drawDottedRect = (doc: jsPDF, x: number, y: number, w: number, h: number) => {
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  const gap = 2.5, dash = 1.2;
  for (let dx = x; dx < x + w; dx += gap) { doc.line(dx, y, Math.min(dx + dash, x + w), y); doc.line(dx, y + h, Math.min(dx + dash, x + w), y + h); }
  for (let dy = y; dy < y + h; dy += gap) { doc.line(x, dy, x, Math.min(dy + dash, y + h)); doc.line(x + w, dy, x + w, Math.min(dy + dash, y + h)); }
};

export const generateFeeStatementPDF = async (data: FeeStatementData): Promise<Blob> => {
  const plexB64 = await loadFont('/fonts/IBMPlexSansArabic-Regular.ttf');
  const amiriB64 = await loadFont('/fonts/Amiri-Regular.ttf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('IBMPlex.ttf', plexB64);
  doc.addFont('IBMPlex.ttf', 'IBMPlex', 'normal');
  doc.addFileToVFS('Amiri.ttf', amiriB64);
  doc.addFont('Amiri.ttf', 'Amiri', 'normal');

  const pw = 210, m = 22, rX = pw - m, cW = pw - m * 2, cx = pw / 2;

  const lh = data.letterhead;
  const lawyerName = lh?.lawyerName || data.lawyerName;
  const titleText = [lh?.titleAr, lh?.barNameAr ? `لدى ${lh.barNameAr}` : ''].filter(Boolean).join(' ').trim();
  const city = lh?.city || '';

  let y = 0;

  /* ══════════════════════════════════════════════
     1. NAVY TOP BORDER
     ══════════════════════════════════════════════ */
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 3.5, 'F');
  y = 16;

  /* ══════════════════════════════════════════════
     2. HEADER — centered
     ══════════════════════════════════════════════ */
  doc.setFont('Amiri');
  doc.setFontSize(15);
  doc.setTextColor(...TEXT);
  doc.text('مكتب الأستاذ', cx, y, { align: 'center' });
  y += 11;

  doc.setFontSize(26);
  doc.setTextColor(...TEXT);
  doc.text(lawyerName, cx, y, { align: 'center' });
  y += 8;

  if (titleText) {
    doc.setFont('IBMPlex');
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(titleText, cx, y, { align: 'center' });
    y += 8;
  }

  // المقر الاجتماعي
  doc.setFont('IBMPlex');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text('المقر الاجتماعي', cx, y, { align: 'center' });
  y += 6;

  if (lh?.address) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT2);
    const addr = city ? `${lh.address}، ${city}، المغرب` : lh.address;
    doc.text(addr, cx, y, { align: 'center' });
    y += 5;
  }
  if (lh?.phone) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT2);
    doc.text(`الهاتف: ${lh.phone}`, cx, y, { align: 'center' });
    y += 5;
  }
  if (lh?.email) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT2);
    doc.text(`البريد: ${lh.email}`, cx, y, { align: 'center' });
    y += 5;
  }

  y += 4;
  hline(doc, y, m, rX);
  y += 12;

  /* ══════════════════════════════════════════════
     3. TITLE — بيان أتعاب
     ══════════════════════════════════════════════ */
  doc.setFont('Amiri');
  doc.setFontSize(28);
  doc.setTextColor(...TEXT);
  doc.text('بيان أتعاب', cx, y, { align: 'center' });
  y += 5;

  doc.setDrawColor(...TEXT);
  doc.setLineWidth(0.4);
  doc.line(cx - 22, y, cx + 22, y);
  y += 7;

  doc.setFont('IBMPlex');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT3);
  doc.text(`رقم المرجع: ${data.statementNumber}`, cx, y, { align: 'center' });
  y += 10;

  /* ══════════════════════════════════════════════
     4. CLIENT INFO BOX — light bg + navy right border
     ══════════════════════════════════════════════ */
  const firstCase = data.caseDetails[0];
  const infoFields: { label: string; value: string }[] = [
    { label: 'الموكل', value: data.clientName },
  ];
  if (firstCase?.caseNumber) infoFields.push({ label: 'رقم الملف', value: firstCase.caseNumber });
  if (firstCase?.court) infoFields.push({ label: 'المحكمة المختصة', value: firstCase.court });
  if (firstCase?.caseType) infoFields.push({ label: 'طبيعة النزاع', value: firstCase.caseType });
  if (data.clientCin) infoFields.push({ label: 'رقم البطاقة الوطنية', value: data.clientCin });
  if (data.powerOfAttorneyDate) infoFields.push({ label: 'تاريخ الوكالة', value: data.powerOfAttorneyDate });

  const boxPad = 8;
  const fieldH = 12;
  const boxH = boxPad * 2 + infoFields.length * fieldH;

  // Light gray background
  doc.setFillColor(...BG);
  doc.rect(m, y, cW, boxH, 'F');

  // Navy right border (2mm thick strip)
  doc.setFillColor(...NAVY);
  doc.rect(rX - 2, y, 2, boxH, 'F');

  let fy = y + boxPad + 3;
  for (const field of infoFields) {
    // Label — small, muted
    doc.setFontSize(8);
    doc.setTextColor(...TEXT3);
    doc.text(field.label, rX - 8, fy, { align: 'right' });

    // Value — larger, bold-look
    doc.setFontSize(13);
    doc.setTextColor(...TEXT);
    doc.text(field.value, rX - 8, fy + 7, { align: 'right' });

    fy += fieldH;
  }

  y += boxH + 10;

  /* ══════════════════════════════════════════════
     5. SERVICES TABLE
     ══════════════════════════════════════════════ */
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    const cd = data.caseDetails[ci];

    // Multi-case header
    if (data.caseDetails.length > 1) {
      doc.setFillColor(...NAVY);
      doc.rect(m, y, cW, 7, 'F');
      doc.setFontSize(9);
      doc.setTextColor(...WHITE);
      doc.text(`ملف ${ci + 1}: ${cd.caseTitle || cd.caseNumber}`, cx, y + 5, { align: 'center' });
      y += 9;
    }

    // Table header
    const colAmt = 38;
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.5);
    doc.line(m, y, rX, y);

    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text('بيان الخدمات', rX - 2, y + 5, { align: 'right' });
    doc.text('المبلغ (درهم)', m + 2, y + 5, { align: 'left' });
    y += 6;

    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.3);
    doc.line(m, y, rX, y);
    y += 1;

    // Rows
    for (let i = 0; i < cd.items.length; i++) {
      const item = cd.items[i];
      const descLines = doc.splitTextToSize(item.description || '—', cW - colAmt - 6);
      const rowH = Math.max(8, descLines.length * 5 + 4);

      // Alternate bg
      if (i % 2 === 0) {
        doc.setFillColor(...BG);
        doc.rect(m, y, cW, rowH, 'F');
      }

      doc.setFontSize(9.5);
      doc.setTextColor(...TEXT);
      doc.text(descLines, rX - 2, y + 5, { align: 'right' });

      doc.setTextColor(...TEXT2);
      doc.text(fmt(item.amount), m + 2, y + 5, { align: 'left' });

      y += rowH;

      hline(doc, y, m, rX, BORDER, 0.1);
    }

    y += 4;

    // ── Summary rows ──
    const summaryRows: { label: string; value: number; strong?: boolean }[] = [
      { label: 'الأتعاب المهنية', value: cd.lawyerFees },
      { label: 'المصاريف والرسوم', value: cd.expensesTotal },
      { label: 'المجموع (الصافي)', value: cd.subtotal, strong: true },
    ];
    if (cd.taxRate > 0) summaryRows.push({ label: `الضريبة (${cd.taxRate}%)`, value: cd.taxAmount });
    summaryRows.push({ label: 'المجموع (TTC)', value: cd.totalAmount, strong: true });

    for (const row of summaryRows) {
      const rh = 7;
      if (row.strong) {
        doc.setFillColor(...BG);
        doc.rect(m, y, cW, rh, 'F');
      }

      hline(doc, y, m, rX, BORDER, 0.1);

      doc.setFontSize(row.strong ? 10.5 : 9.5);
      doc.setTextColor(...(row.strong ? TEXT : TEXT2));
      doc.text(row.label, rX - 2, y + 5, { align: 'right' });

      doc.setTextColor(...TEXT);
      doc.text(fmt(row.value), m + 2, y + 5, { align: 'left' });

      y += rh;
    }

    y += 5;
  }

  /* ══════════════════════════════════════════════
     6. GRAND TOTAL — large with navy underline
     ══════════════════════════════════════════════ */
  hline(doc, y, m, rX, NAVY, 0.5);
  y += 10;

  doc.setFontSize(11);
  doc.setTextColor(...TEXT2);
  doc.text('الواجب أداؤه:', rX, y, { align: 'right' });

  doc.setFont('Amiri');
  doc.setFontSize(24);
  doc.setTextColor(...TEXT);
  doc.text(`MAD  ${fmt(data.grandTotal)}`, m, y + 1, { align: 'left' });
  y += 10;

  doc.setFont('IBMPlex');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT3);
  doc.text('المبلغ بالحروف:  ' + numberToArabicWords(data.grandTotal), rX, y, { align: 'right' });
  y += 8;

  hline(doc, y, m, rX);
  y += 8;

  /* ══════════════════════════════════════════════
     7. NOTES
     ══════════════════════════════════════════════ */
  const noteText = data.notes || 'يتم تحديد الأتعاب وفقاً للقوانين المنظمة لمهنة المحاماة بالمغرب وللاتفاق المسبق.';
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT2);
  const noteLines = doc.splitTextToSize(noteText, cW - 10);
  doc.text(noteLines, cx, y, { align: 'center' });
  y += noteLines.length * 4.5 + 6;

  hline(doc, y, m, rX);
  y += 10;

  /* ══════════════════════════════════════════════
     8. DATE
     ══════════════════════════════════════════════ */
  doc.setFontSize(9);
  doc.setTextColor(...TEXT3);
  doc.text(`حرر ب${city || '...'} في:`, rX, y, { align: 'right' });
  y += 7;

  doc.setFontSize(14);
  doc.setTextColor(...TEXT);
  doc.text(data.date, rX, y, { align: 'right' });
  y += 14;

  /* ══════════════════════════════════════════════
     9. SIGNATURE — dotted box
     ══════════════════════════════════════════════ */
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text('التوقيع والختم', cx, y, { align: 'center' });
  y += 8;

  const sealW = 55, sealH = 28;
  const sealX = cx - sealW / 2;

  doc.setFillColor(245, 245, 245);
  doc.rect(sealX, y, sealW, sealH, 'F');
  drawDottedRect(doc, sealX, y, sealW, sealH);

  doc.setFontSize(7);
  doc.setTextColor(...TEXT3);
  doc.text('SEAL & SIGNATURE AREA', cx, y + sealH / 2 + 1, { align: 'center' });

  /* ══════════════════════════════════════════════
     FOOTER
     ══════════════════════════════════════════════ */
  hline(doc, 291, m, rX, BORDER, 0.15);
  doc.setFontSize(7);
  doc.setTextColor(...TEXT3);
  doc.text('وثيقة موقعة إلكترونياً', cx, 294, { align: 'center' });

  return doc.output('blob');
};
