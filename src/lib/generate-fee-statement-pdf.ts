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
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  amiriFontBase64 = btoa(binary);
  amiriFontLoaded = true;
  return amiriFontBase64;
};

const fmtNum = (n: number) =>
  n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Design-matched colors (Navy & Gold) ── */
const NAVY: [number, number, number] = [26, 42, 68];
const GOLD: [number, number, number] = [197, 160, 89];
const TEXT_DARK: [number, number, number] = [30, 30, 30];
const TEXT_MID: [number, number, number] = [80, 80, 80];
const TEXT_LIGHT: [number, number, number] = [130, 130, 130];
const TEXT_MUTED: [number, number, number] = [170, 170, 170];
const BG_LIGHT: [number, number, number] = [248, 250, 252];
const BORDER_LIGHT: [number, number, number] = [226, 232, 240];
const WHITE: [number, number, number] = [255, 255, 255];

/** Convert number to Arabic words (Tafkeet) */
const numberToArabicWords = (num: number): string => {
  if (num === 0) return 'صفر درهم';
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const parts: string[] = [];
  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = Math.floor(num % 1000);
  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else parts.push(`${ones[millions]} ملايين`);
  }
  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(`${ones[thousands]} آلاف`);
    else {
      const tH = Math.floor(thousands / 100);
      const tR = thousands % 100;
      const tP: string[] = [];
      if (tH > 0) tP.push(hundreds[tH]);
      if (tR >= 10 && tR < 20) tP.push(teens[tR - 10]);
      else {
        const tO = tR % 10, tT = Math.floor(tR / 10);
        if (tO > 0) tP.push(ones[tO]);
        if (tT > 0) tP.push(tens[tT]);
      }
      parts.push(tP.join(' و') + ' ألف');
    }
  }
  if (remainder > 0) {
    const rH = Math.floor(remainder / 100), rR = remainder % 100;
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

/* ── Gold gradient divider ── */
const drawGoldDivider = (doc: jsPDF, y: number, x1: number, x2: number) => {
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(x1, y, x2, y);
};

export const generateFeeStatementPDF = async (data: FeeStatementData): Promise<Blob> => {
  const fontBase64 = await loadAmiriFont();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  doc.setFont('Amiri');

  const pw = 210;
  const m = 18;
  const rightX = pw - m;
  const contentW = pw - m * 2;
  const cx = pw / 2;

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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. NAVY TOP BAR
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 3.5, 'F');
  y = 14;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. CENTERED HEADER — مكتب الأستاذ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text('مكتب الأستاذ', cx, y, { align: 'center' });
  y += 9;

  doc.setFontSize(24);
  doc.setTextColor(...NAVY);
  doc.text(lawyerName, cx, y, { align: 'center' });
  y += 7;

  if (titleAr) {
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_MID);
    const fullTitle = barNameAr ? `${titleAr} لدى ${barNameAr}` : titleAr;
    doc.text(fullTitle, cx, y, { align: 'center' });
    y += 7;
  } else {
    y += 3;
  }

  // المقر الاجتماعي
  if (address) {
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text('المقر الاجتماعي', cx, y, { align: 'center' });
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MID);
    const fullAddr = city ? `${address}، ${city}` : address;
    doc.text(fullAddr, cx, y, { align: 'center' });
    y += 5;
  }

  if (phone) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MID);
    doc.text(`الهاتف: ${phone}`, cx, y, { align: 'center' });
    y += 4.5;
  }

  if (email) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MID);
    doc.text(`البريد: ${email}`, cx, y, { align: 'center' });
    y += 4.5;
  }

  y += 2;

  // Gold divider
  drawGoldDivider(doc, y, m + 30, rightX - 30);
  y += 8;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. TITLE — بيان أتعاب
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  doc.setFontSize(28);
  doc.setTextColor(...NAVY);
  doc.text('بيان أتعاب', cx, y, { align: 'center' });
  y += 4;

  // Gold underline
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  const ulW = 30;
  doc.line(cx - ulW / 2, y, cx + ulW / 2, y);
  y += 6;

  // Reference number
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`رقم المرجع: ${data.statementNumber}`, cx, y, { align: 'center' });
  y += 5;

  // Gold divider
  drawGoldDivider(doc, y, m + 30, rightX - 30);
  y += 6;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. CLIENT INFO — Grid layout (2 cols)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const gridItems: { label: string; value: string }[] = [
    { label: 'الموكل', value: data.clientName },
  ];

  // Collect case info from first case for the grid
  const firstCase = data.caseDetails[0];
  if (firstCase?.caseNumber) {
    gridItems.push({ label: 'رقم الملف', value: firstCase.caseNumber });
  }
  if (firstCase?.court) {
    gridItems.push({ label: 'المحكمة المختصة', value: firstCase.court });
  }
  if (firstCase?.caseType) {
    gridItems.push({ label: 'طبيعة النزاع', value: firstCase.caseType });
  }
  if (data.clientCin) {
    gridItems.push({ label: 'رقم البطاقة الوطنية', value: data.clientCin });
  }
  if (data.powerOfAttorneyDate) {
    gridItems.push({ label: 'تاريخ الوكالة', value: data.powerOfAttorneyDate });
  }

  const colW = contentW / 2;
  const rowsCount = Math.ceil(gridItems.length / 2);
  const gridRowH = 13;

  for (let row = 0; row < rowsCount; row++) {
    for (let col = 0; col < 2; col++) {
      const idx = row * 2 + col;
      if (idx >= gridItems.length) continue;
      const item = gridItems[idx];

      // RTL: col 0 = right side, col 1 = left side
      const cellX = col === 0 ? m + colW : m;
      const cellRight = cellX + colW;

      // Background alternation
      doc.setFillColor(...BG_LIGHT);
      doc.rect(cellX, y, colW, gridRowH, 'F');

      // Border
      doc.setDrawColor(...BORDER_LIGHT);
      doc.setLineWidth(0.15);
      doc.rect(cellX, y, colW, gridRowH, 'S');

      // Label
      doc.setFontSize(7.5);
      doc.setTextColor(...GOLD);
      doc.text(item.label, cellRight - 3, y + 4.5, { align: 'right' });

      // Value
      doc.setFontSize(10);
      doc.setTextColor(...TEXT_DARK);
      doc.text(item.value, cellRight - 3, y + 10.5, { align: 'right' });
    }
    y += gridRowH;
  }

  y += 5;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. SERVICES TABLE (per case)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    const cd = data.caseDetails[ci];

    // Multi-case header
    if (data.caseDetails.length > 1) {
      doc.setFillColor(...NAVY);
      doc.roundedRect(m, y, contentW, 7, 1, 1, 'F');
      doc.setFontSize(9);
      doc.setTextColor(...WHITE);
      doc.text(`ملف ${ci + 1}: ${cd.caseTitle}`, cx, y + 5, { align: 'center' });
      y += 9;
    }

    // Table header
    const colAmountW = 38;
    const colDescW = contentW - colAmountW;

    doc.setFillColor(...NAVY);
    doc.rect(m, y, contentW, 8, 'F');

    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.text('بيان الخدمات', m + colDescW / 2 + colAmountW, y + 5.5, { align: 'center' });
    doc.text('المبلغ (درهم)', m + colAmountW / 2, y + 5.5, { align: 'center' });

    // Vertical separator in header
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.2);
    doc.line(m + colAmountW, y + 1.5, m + colAmountW, y + 6.5);
    y += 8;

    // Table rows
    for (let i = 0; i < cd.items.length; i++) {
      const item = cd.items[i];
      const rowH = 9;

      // Alternating bg
      if (i % 2 === 0) {
        doc.setFillColor(...WHITE);
      } else {
        doc.setFillColor(...BG_LIGHT);
      }
      doc.rect(m, y, contentW, rowH, 'F');

      // Borders
      doc.setDrawColor(...BORDER_LIGHT);
      doc.setLineWidth(0.15);
      doc.rect(m, y, contentW, rowH, 'S');
      doc.line(m + colAmountW, y, m + colAmountW, y + rowH);

      // Description
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_DARK);
      doc.text(item.description, rightX - 3, y + 6, { align: 'right' });

      // Amount
      doc.setFontSize(9);
      doc.setTextColor(...TEXT_MID);
      doc.text(fmtNum(item.amount), m + colAmountW / 2, y + 6, { align: 'center' });

      y += rowH;
    }

    y += 3;

    // ── Summary rows ──
    const summaryStartX = m;
    const summaryW = contentW;
    const labelX = rightX - 3;
    const valueX = m + 3;

    const drawSummaryRow = (
      label: string,
      value: string,
      opts: { bg?: [number, number, number]; textColor?: [number, number, number]; bold?: boolean; isTotal?: boolean; isGrand?: boolean } = {}
    ) => {
      const rH = opts.isGrand ? 10 : 7.5;

      if (opts.isGrand) {
        doc.setFillColor(...NAVY);
        doc.rect(summaryStartX, y, summaryW, rH, 'F');
        doc.setFontSize(11);
        doc.setTextColor(...WHITE);
        doc.text(label, labelX, y + 7, { align: 'right' });
        doc.text(value, valueX, y + 7, { align: 'left' });
      } else {
        if (opts.bg) {
          doc.setFillColor(...opts.bg);
          doc.rect(summaryStartX, y, summaryW, rH, 'F');
        }
        doc.setDrawColor(...BORDER_LIGHT);
        doc.setLineWidth(0.1);
        doc.line(summaryStartX, y + rH, summaryStartX + summaryW, y + rH);

        doc.setFontSize(opts.bold ? 10 : 9);
        doc.setTextColor(...(opts.textColor || TEXT_DARK));
        doc.text(label, labelX, y + 5.5, { align: 'right' });

        doc.setTextColor(...TEXT_DARK);
        doc.text(value, valueX, y + 5.5, { align: 'left' });
      }

      y += rH;
    };

    drawSummaryRow('الأتعاب المهنية', fmtNum(cd.lawyerFees), { textColor: NAVY, bold: true });
    drawSummaryRow('المصاريف والرسوم', fmtNum(cd.expensesTotal));
    drawSummaryRow('المجموع (الصافي)', fmtNum(cd.subtotal), { bg: BG_LIGHT, bold: true });
    if (cd.taxRate > 0) {
      drawSummaryRow(`الضريبة (${cd.taxRate}%)`, fmtNum(cd.taxAmount));
    }
    drawSummaryRow(`المجموع (TTC)`, `${fmtNum(cd.totalAmount)} MAD`, { isGrand: true });

    y += 3;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. GRAND TOTAL (multi-case)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (data.caseDetails.length > 1) {
    doc.setFillColor(...NAVY);
    doc.rect(m, y, contentW, 10, 'F');
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text('الواجب أداؤه', rightX - 3, y + 7, { align: 'right' });
    doc.text(`${fmtNum(data.grandTotal)} MAD`, m + 3, y + 7, { align: 'left' });
    y += 12;
  }

  // Tafkeet
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_LIGHT);
  const totalForTafkeet = data.caseDetails.length > 1
    ? data.grandTotal
    : (data.caseDetails[0]?.totalAmount || 0);
  doc.text(numberToArabicWords(totalForTafkeet), cx, y, { align: 'center' });
  y += 6;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. NOTES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const noteText = data.notes || 'يتم تحديد الأتعاب وفقاً للقوانين المنظمة لمهنة المحاماة بالمغرب وللاتفاق المسبق.';
  doc.setFillColor(...BG_LIGHT);
  const noteLines = doc.splitTextToSize(noteText, contentW - 10);
  const noteBoxH = 6 + noteLines.length * 4;
  doc.roundedRect(m, y, contentW, noteBoxH, 1.5, 1.5, 'F');
  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.15);
  doc.roundedRect(m, y, contentW, noteBoxH, 1.5, 1.5, 'S');

  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MID);
  doc.text(noteLines, cx, y + 4, { align: 'center' });
  y += noteBoxH + 5;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 8. DATE — حرر بـ...
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`حرر ب${city || '...'} في:`, rightX, y, { align: 'right' });
  y += 6;
  doc.setFontSize(13);
  doc.setTextColor(...TEXT_DARK);
  doc.text(data.date, rightX, y, { align: 'right' });
  y += 8;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 9. SIGNATURE — centered
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text('التوقيع والختم', cx, y, { align: 'center' });
  y += 6;

  const sealW = 50;
  const sealH = 22;
  const sealX = cx - sealW / 2;
  doc.setFillColor(245, 246, 248);
  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.3);
  doc.roundedRect(sealX, y, sealW, sealH, 4, 4, 'FD');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // QR CODE — bottom left
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const qrSize = 16;
  const qrY = 275;
  doc.addImage(qrDataUrl, 'PNG', m, qrY, qrSize, qrSize);
  doc.setFontSize(5.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('رمز التحقق', m + qrSize / 2, qrY + qrSize + 2, { align: 'center' });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FOOTER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.15);
  doc.line(m, 293, rightX, 293);
  doc.setFontSize(6.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('وثيقة موقعة إلكترونياً', cx, 296, { align: 'center' });

  return doc.output('blob');
};
