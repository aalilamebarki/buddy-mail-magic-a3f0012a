import jsPDF from 'jspdf';
import QRCode from 'qrcode';

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

/* ── Font loader ── */
let amiriFontLoaded = false;
let amiriFontBase64 = '';

const loadAmiriFont = async (): Promise<string> => {
  if (amiriFontLoaded) return amiriFontBase64;
  const response = await fetch('/fonts/Amiri-Regular.ttf');
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  amiriFontBase64 = btoa(binary);
  amiriFontLoaded = true;
  return amiriFontBase64;
};

const fmtNum = (n: number) =>
  n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Colors matching the HTML exactly ── */
const NAVY: [number, number, number] = [26, 42, 68];       // #1a2a44
const GOLD: [number, number, number] = [197, 160, 89];     // #c5a059
const GRAY800: [number, number, number] = [31, 41, 55];
const GRAY600: [number, number, number] = [75, 85, 99];
const GRAY500: [number, number, number] = [107, 114, 128];
const GRAY400: [number, number, number] = [156, 163, 175];
const SLATE50: [number, number, number] = [248, 250, 252];
const RED500: [number, number, number] = [239, 68, 68];
const WHITE: [number, number, number] = [255, 255, 255];
const BORDER: [number, number, number] = [226, 232, 240];
const AMBER50: [number, number, number] = [255, 251, 235];

/** Tafkeet */
const numberToArabicWords = (num: number): string => {
  if (num === 0) return 'صفر درهم';
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const parts: string[] = [];
  const mil = Math.floor(num / 1000000);
  const th = Math.floor((num % 1000000) / 1000);
  const rem = Math.floor(num % 1000);
  if (mil > 0) { if (mil === 1) parts.push('مليون'); else if (mil === 2) parts.push('مليونان'); else parts.push(`${ones[mil]} ملايين`); }
  if (th > 0) {
    if (th === 1) parts.push('ألف'); else if (th === 2) parts.push('ألفان');
    else if (th >= 3 && th <= 10) parts.push(`${ones[th]} آلاف`);
    else { const tH = Math.floor(th / 100), tR = th % 100; const tP: string[] = []; if (tH > 0) tP.push(hundreds[tH]); if (tR >= 10 && tR < 20) tP.push(teens[tR - 10]); else { const tO = tR % 10, tT = Math.floor(tR / 10); if (tO > 0) tP.push(ones[tO]); if (tT > 0) tP.push(tens[tT]); } parts.push(tP.join(' و') + ' ألف'); }
  }
  if (rem > 0) { const rH = Math.floor(rem / 100), rR = rem % 100; if (rH > 0) parts.push(hundreds[rH]); if (rR >= 10 && rR < 20) parts.push(teens[rR - 10]); else { const rO = rR % 10, rT = Math.floor(rR / 10); if (rO > 0 && rT > 0) parts.push(`${ones[rO]} و${tens[rT]}`); else if (rO > 0) parts.push(ones[rO]); else if (rT > 0) parts.push(tens[rT]); } }
  return `فقط ${parts.join(' و')} درهم مغربي لا غير.`;
};

/** Gold gradient divider */
const goldDivider = (doc: jsPDF, y: number, x1: number, x2: number) => {
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.35);
  doc.line(x1, y, x2, y);
};

export const generateFeeStatementPDF = async (data: FeeStatementData): Promise<Blob> => {
  const fontBase64 = await loadAmiriFont();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  doc.setFont('Amiri');

  const pw = 210, m = 18, rightX = pw - m, contentW = pw - m * 2, cx = pw / 2;

  const lh = data.letterhead;
  const lawyerName = lh?.lawyerName || data.lawyerName;
  const titleAr = lh?.titleAr || '';
  const barNameAr = lh?.barNameAr || '';
  const city = lh?.city || '';
  const address = lh?.address || '';
  const phone = lh?.phone || '';
  const email = lh?.email || '';

  const verificationUrl = `${window.location.origin}/verify/${data.signatureUuid}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 1 });

  let y = 0;

  // ───────────────────────────────────────
  // 1. NAVY TOP BORDER (4px = ~1.5mm)
  // ───────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 1.5, 'F');
  y = 10;

  // ───────────────────────────────────────
  // 2. HEADER — مكتب الأستاذ + Name + Title
  // ───────────────────────────────────────
  // "مكتب الأستاذ" — small, gold, tracking
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text('مكتب الأستاذ', cx, y, { align: 'center' });
  y += 8;

  // Lawyer name — large, navy, bold serif
  doc.setFontSize(24);
  doc.setTextColor(...NAVY);
  doc.text(lawyerName, cx, y, { align: 'center' });
  y += 7;

  // Title — small gray
  if (titleAr) {
    doc.setFontSize(10);
    doc.setTextColor(...GRAY500);
    const fullTitle = barNameAr ? `${titleAr} لدى ${barNameAr}` : titleAr;
    doc.text(fullTitle, cx, y, { align: 'center' });
    y += 5;
  }

  // Small gold divider
  goldDivider(doc, y, cx - 20, cx + 20);
  y += 5;

  // المقر الاجتماعي — tiny gold
  if (address) {
    doc.setFontSize(7);
    doc.setTextColor(...GOLD);
    doc.text('المقر الاجتماعي', cx, y, { align: 'center' });
    y += 4;

    // Address — small gray
    doc.setFontSize(9);
    doc.setTextColor(...GRAY600);
    const fullAddr = city ? `${address}، ${city}` : address;
    doc.text(fullAddr, cx, y, { align: 'center' });
    y += 4;
  }

  // Phone
  if (phone) {
    doc.setFontSize(8);
    doc.setTextColor(...GRAY500);
    doc.text(`الهاتف: ${phone}`, cx, y, { align: 'center' });
    y += 4;
  }

  // Email
  if (email) {
    doc.setFontSize(8);
    doc.setTextColor(...GRAY500);
    doc.text(`البريد: ${email}`, cx, y, { align: 'center' });
    y += 4;
  }

  y += 2;

  // Gold divider full width
  goldDivider(doc, y, m + 20, rightX - 20);
  y += 7;

  // ───────────────────────────────────────
  // 3. TITLE — بيان أتعاب
  // ───────────────────────────────────────
  doc.setFontSize(26);
  doc.setTextColor(...NAVY);
  doc.text('بيان أتعاب', cx, y, { align: 'center' });
  y += 3;

  // Gold underline (short)
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(cx - 12, y, cx + 12, y);
  y += 5;

  // Reference number
  doc.setFontSize(8);
  doc.setTextColor(...GRAY400);
  doc.text(`رقم المرجع: ${data.statementNumber}`, cx, y, { align: 'center' });
  y += 4;

  // Gold divider
  goldDivider(doc, y, m + 20, rightX - 20);
  y += 5;

  // ───────────────────────────────────────
  // 4. CLIENT INFO GRID (2 columns)
  // ───────────────────────────────────────
  const gridItems: { label: string; value: string }[] = [
    { label: 'الموكل', value: data.clientName },
  ];

  const firstCase = data.caseDetails[0];
  if (firstCase?.caseNumber) gridItems.push({ label: 'رقم الملف', value: firstCase.caseNumber });
  if (firstCase?.court) gridItems.push({ label: 'المحكمة المختصة', value: firstCase.court });
  if (firstCase?.caseType) gridItems.push({ label: 'طبيعة النزاع', value: firstCase.caseType });
  if (data.clientCin) gridItems.push({ label: 'رقم البطاقة الوطنية', value: data.clientCin });
  if (data.powerOfAttorneyDate) gridItems.push({ label: 'تاريخ الوكالة', value: data.powerOfAttorneyDate });

  const colW = contentW / 2;
  const cellH = 12;
  const rowsCount = Math.ceil(gridItems.length / 2);

  for (let row = 0; row < rowsCount; row++) {
    for (let col = 0; col < 2; col++) {
      const idx = row * 2 + col;
      if (idx >= gridItems.length) continue;
      const item = gridItems[idx];

      // RTL: col 0 → right half, col 1 → left half
      const cellX = col === 0 ? m + colW : m;

      // BG
      doc.setFillColor(...SLATE50);
      doc.rect(cellX, y, colW, cellH, 'F');

      // Border
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.15);
      doc.rect(cellX, y, colW, cellH, 'S');

      // Label — tiny gold
      doc.setFontSize(6.5);
      doc.setTextColor(...GOLD);
      doc.text(item.label, cellX + colW - 3, y + 4, { align: 'right' });

      // Value — medium dark
      doc.setFontSize(9.5);
      doc.setTextColor(...GRAY800);
      doc.text(item.value, cellX + colW - 3, y + 10, { align: 'right' });
    }
    y += cellH;
  }

  y += 4;

  // ───────────────────────────────────────
  // 5. SERVICES TABLE (per case)
  // ───────────────────────────────────────
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    const cd = data.caseDetails[ci];

    // Multi-case label
    if (data.caseDetails.length > 1) {
      doc.setFillColor(...NAVY);
      doc.roundedRect(m, y, contentW, 6, 1, 1, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...WHITE);
      doc.text(`ملف ${ci + 1}: ${cd.caseTitle}`, cx, y + 4.5, { align: 'center' });
      y += 8;
    }

    const colAmtW = 32;
    const colDescW = contentW - colAmtW;

    // Table header — navy bg, white text
    doc.setFillColor(...NAVY);
    doc.rect(m, y, contentW, 7, 'F');

    doc.setFontSize(8.5);
    doc.setTextColor(...WHITE);
    // RTL: description on right, amount on left
    doc.text('بيان الخدمات', m + colAmtW + colDescW / 2, y + 5, { align: 'center' });
    doc.text('المبلغ (درهم)', m + colAmtW / 2, y + 5, { align: 'center' });

    // Vertical separator inside header
    doc.setDrawColor(255, 255, 255, 0.3);
    doc.setLineWidth(0.15);
    doc.line(m + colAmtW, y + 1.5, m + colAmtW, y + 5.5);
    y += 7;

    // Table rows
    for (let i = 0; i < cd.items.length; i++) {
      const item = cd.items[i];
      const rowH = 8;

      // Alternating rows
      if (i % 2 !== 0) {
        doc.setFillColor(...SLATE50);
        doc.rect(m, y, contentW, rowH, 'F');
      }

      // Row border
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.1);
      doc.rect(m, y, contentW, rowH, 'S');

      // Vertical separator
      doc.line(m + colAmtW, y, m + colAmtW, y + rowH);

      // Description — right aligned
      doc.setFontSize(9);
      doc.setTextColor(...GRAY800);
      doc.text(item.description, rightX - 3, y + 5.5, { align: 'right' });

      // Amount — centered in amount column
      doc.setFontSize(9);
      doc.setTextColor(...GRAY500);
      doc.text(fmtNum(item.amount), m + colAmtW / 2, y + 5.5, { align: 'center' });

      y += rowH;
    }

    y += 2;

    // ── Summary rows (matching HTML exactly) ──

    // الأتعاب المهنية — with gold right border, amber bg
    const sRowH = 7;

    // Row: الأتعاب المهنية
    doc.setFillColor(...AMBER50);
    doc.rect(m, y, contentW, sRowH, 'F');
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.1);
    doc.rect(m, y, contentW, sRowH, 'S');
    // Gold right border (RTL = right side)
    doc.setFillColor(...GOLD);
    doc.rect(rightX - 0.8, y, 0.8, sRowH, 'F');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text('الأتعاب المهنية', rightX - 4, y + 5, { align: 'right' });
    doc.setTextColor(...GRAY800);
    doc.text(fmtNum(cd.lawyerFees), m + 4, y + 5, { align: 'left' });
    y += sRowH;

    // Row: المصاريف والرسوم
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.1);
    doc.line(m, y + sRowH, rightX, y + sRowH);
    doc.setFontSize(9);
    doc.setTextColor(...GRAY600);
    doc.text('المصاريف والرسوم', rightX - 4, y + 5, { align: 'right' });
    doc.setTextColor(...GRAY800);
    doc.text(fmtNum(cd.expensesTotal), m + 4, y + 5, { align: 'left' });
    y += sRowH;

    // Row: المجموع (الصافي) — slate bg, bold
    doc.setFillColor(...SLATE50);
    doc.rect(m, y, contentW, sRowH, 'F');
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.1);
    doc.rect(m, y, contentW, sRowH, 'S');
    doc.setFontSize(9.5);
    doc.setTextColor(...GRAY800);
    doc.text('المجموع (الصافي)', rightX - 4, y + 5, { align: 'right' });
    doc.text(fmtNum(cd.subtotal), m + 4, y + 5, { align: 'left' });
    y += sRowH;

    // Row: الضريبة
    if (cd.taxRate > 0) {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.1);
      doc.line(m, y + sRowH, rightX, y + sRowH);
      doc.setFontSize(9);
      doc.setTextColor(...GRAY600);
      doc.text(`الضريبة (${cd.taxRate}%)`, rightX - 4, y + 5, { align: 'right' });
      doc.setTextColor(...GRAY800);
      doc.text(fmtNum(cd.taxAmount), m + 4, y + 5, { align: 'left' });
      y += sRowH;
    }

    // Row: المجموع (TTC) — navy bg 5%, bold
    doc.setFillColor(240, 242, 247); // navy/5
    doc.rect(m, y, contentW, sRowH, 'F');
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.1);
    doc.rect(m, y, contentW, sRowH, 'S');
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text('المجموع (TTC)', rightX - 4, y + 5, { align: 'right' });
    doc.text(fmtNum(cd.totalAmount), m + 4, y + 5, { align: 'left' });
    y += sRowH;

    y += 2;
  }

  // Gold divider before grand total
  goldDivider(doc, y, m, rightX);
  y += 3;

  // ───────────────────────────────────────
  // 6. GRAND TOTAL — الواجب أداؤه (navy bg, white, rounded)
  // ───────────────────────────────────────
  const totalForDisplay = data.caseDetails.length > 1
    ? data.grandTotal
    : (data.caseDetails[0]?.totalAmount || 0);

  doc.setFillColor(...NAVY);
  doc.roundedRect(m, y, contentW, 9, 2, 2, 'F');
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text('الواجب أداؤه', rightX - 5, y + 6.5, { align: 'right' });
  doc.setFontSize(12);
  doc.text(`${fmtNum(totalForDisplay)} MAD`, m + 5, y + 6.5, { align: 'left' });
  y += 12;

  // Tafkeet — centered small
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY400);
  doc.text(numberToArabicWords(totalForDisplay), cx, y, { align: 'center' });
  y += 5;

  // ───────────────────────────────────────
  // 7. NOTES — bordered box with gold right border
  // ───────────────────────────────────────
  const noteText = data.notes || 'يتم تحديد الأتعاب وفقاً للقوانين المنظمة لمهنة المحاماة بالمغرب وللاتفاق المسبق.';
  const noteLines = doc.splitTextToSize(noteText, contentW - 12);
  const noteBoxH = 5 + noteLines.length * 4;

  doc.setFillColor(...SLATE50);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.15);
  doc.roundedRect(m, y, contentW, noteBoxH, 1.5, 1.5, 'FD');

  // Gold right border
  doc.setFillColor(...GOLD);
  doc.rect(rightX - 0.8, y + 0.5, 0.8, noteBoxH - 1, 'F');

  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY500);
  doc.text(noteLines, rightX - 5, y + 4, { align: 'right' });
  y += noteBoxH + 5;

  // ───────────────────────────────────────
  // 8. DATE
  // ───────────────────────────────────────
  doc.setFontSize(8);
  doc.setTextColor(...GRAY500);
  doc.text(`حرر ب${city || '...'} في:`, rightX, y, { align: 'right' });
  y += 5;
  doc.setFontSize(12);
  doc.setTextColor(...GRAY800);
  doc.text(data.date, rightX, y, { align: 'right' });
  y += 8;

  // ───────────────────────────────────────
  // 9. SIGNATURE — centered
  // ───────────────────────────────────────
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text('التوقيع والختم', cx, y, { align: 'center' });
  y += 5;

  const sealW = 45;
  const sealH = 20;
  const sealX = cx - sealW / 2;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  // Dotted border effect
  for (let dx = sealX; dx < sealX + sealW; dx += 2) {
    doc.line(dx, y, dx + 1, y);
    doc.line(dx, y + sealH, dx + 1, y + sealH);
  }
  for (let dy = y; dy < y + sealH; dy += 2) {
    doc.line(sealX, dy, sealX, dy + 1);
    doc.line(sealX + sealW, dy, sealX + sealW, dy + 1);
  }

  // ───────────────────────────────────────
  // QR CODE — bottom left
  // ───────────────────────────────────────
  const qrSize = 14;
  const qrY = 277;
  doc.addImage(qrDataUrl, 'PNG', m, qrY, qrSize, qrSize);
  doc.setFontSize(5);
  doc.setTextColor(...GRAY400);
  doc.text('رمز التحقق', m + qrSize / 2, qrY + qrSize + 2, { align: 'center' });

  // ───────────────────────────────────────
  // FOOTER
  // ───────────────────────────────────────
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.1);
  doc.line(m, 294, rightX, 294);
  doc.setFontSize(6);
  doc.setTextColor(...GRAY400);
  doc.text('وثيقة موقعة إلكترونياً', cx, 296.5, { align: 'center' });

  return doc.output('blob');
};
