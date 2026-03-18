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

/* ── Colors — light for B&W print, navy accent for PDF ── */
const NAVY: [number, number, number] = [26, 43, 60];
const TEXT_PRIMARY: [number, number, number] = [40, 40, 40];
const TEXT_SECONDARY: [number, number, number] = [110, 110, 110];
const TEXT_MUTED: [number, number, number] = [160, 160, 160];
const BORDER: [number, number, number] = [210, 210, 210];
const BOX_BG: [number, number, number] = [248, 249, 251];
const TABLE_HEADER_BG: [number, number, number] = [242, 243, 246];

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

export const generateFeeStatementPDF = async (data: FeeStatementData): Promise<Blob> => {
  const fontBase64 = await loadAmiriFont();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  doc.setFont('Amiri');

  const pw = 210;
  const m = 18;
  const cw = pw - m * 2;
  const rightX = pw - m;

  const lh = data.letterhead;
  const lawyerName = lh?.lawyerName || data.lawyerName;
  const nameFr = lh?.nameFr || '';
  const titleAr = lh?.titleAr || '';
  const titleFr = lh?.titleFr || '';
  const barNameAr = lh?.barNameAr || '';
  const barNameFr = lh?.barNameFr || '';
  const city = lh?.city || '';
  const address = lh?.address || '';
  const phone = lh?.phone || '';
  const email = lh?.email || '';

  const verificationUrl = `${window.location.origin}/verify/${data.signatureUuid}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 1 });

  let y = 16;

  /* ═══════════════════════════════════════
     BILINGUAL HEADER
     ═══════════════════════════════════════ */
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text(`الأستاذ ${lawyerName}`, rightX, y, { align: 'right' });

  if (nameFr) {
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(`Maître ${nameFr}`, m, y, { align: 'left' });
  }
  y += 7;

  if (titleAr || barNameAr) {
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_SECONDARY);
    const arTitle = [titleAr, barNameAr ? `هيئة ${barNameAr}` : ''].filter(Boolean).join(' — ');
    doc.text(arTitle, rightX, y, { align: 'right' });
  }
  if (titleFr || barNameFr) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_SECONDARY);
    const frTitle = [titleFr, barNameFr ? `au Barreau de ${barNameFr}` : ''].filter(Boolean).join(' ');
    doc.text(frTitle, m, y, { align: 'left' });
  }
  y += 5;

  if (phone) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(`Tél: ${phone}`, m, y, { align: 'left' });
  }
  y += 4;

  // Navy separator
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.line(m, y, rightX, y);
  y += 1.5;
  doc.setLineWidth(0.25);
  doc.line(m + 25, y, rightX - 25, y);
  y += 5;

  if (address) {
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_PRIMARY);
    const fullAddr = [address, city ? `- ${city}` : ''].filter(Boolean).join(' ');
    doc.text(fullAddr, pw / 2, y, { align: 'center' });
    y += 5;
  }
  if (email) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(`E-mail : ${email}`, pw / 2, y, { align: 'center' });
    y += 5;
  }

  y += 3;
  doc.setFontSize(12);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(city ? `${city} في: ${data.date}` : data.date, rightX, y, { align: 'right' });
  y += 13;

  /* ═══════════════════════════════════════
     TITLE
     ═══════════════════════════════════════ */
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text('بيان أتعاب ومصاريف', pw / 2, y, { align: 'center' });
  y += 4;
  const titleBarW = 50;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.7);
  doc.line(pw / 2 - titleBarW / 2, y, pw / 2 + titleBarW / 2, y);
  y += 7;

  doc.setFontSize(12);
  doc.setTextColor(...TEXT_SECONDARY);
  doc.text(`رقم المرجع: ${data.statementNumber}`, pw / 2, y, { align: 'center' });
  y += 10;

  /* ═══════════════════════════════════════
     CLIENT INFO BOX
     ═══════════════════════════════════════ */
  let clientBoxLines = 1;
  if (data.clientCin) clientBoxLines++;
  if (data.clientPhone) clientBoxLines++;
  if (data.powerOfAttorneyDate) clientBoxLines++;
  const boxH = 8 + clientBoxLines * 9;
  const boxInnerX = rightX - 6;

  doc.setFillColor(...BOX_BG);
  doc.roundedRect(m, y, cw, boxH, 2, 2, 'F');
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1.2);
  doc.line(rightX, y, rightX, y + boxH);

  let boxY = y + 7;

  doc.setFontSize(14);
  doc.setTextColor(...TEXT_SECONDARY);
  doc.text('الموكل: ', boxInnerX, boxY, { align: 'right' });
  const clW = doc.getTextWidth('الموكل: ');
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(data.clientName, boxInnerX - clW, boxY, { align: 'right' });
  boxY += 9;

  if (data.clientCin) {
    doc.setFontSize(12);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(`رقم البطاقة الوطنية: ${data.clientCin}`, boxInnerX, boxY, { align: 'right' });
    boxY += 9;
  }
  if (data.clientPhone) {
    doc.setFontSize(12);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(`الهاتف: ${data.clientPhone}`, boxInnerX, boxY, { align: 'right' });
    boxY += 9;
  }
  if (data.powerOfAttorneyDate) {
    doc.setFontSize(12);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(`تاريخ الوكالة: ${data.powerOfAttorneyDate}`, boxInnerX, boxY, { align: 'right' });
  }

  y += boxH + 8;

  /* ═══════════════════════════════════════
     CASE DETAILS & ITEMS TABLE
     ═══════════════════════════════════════ */
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    const cd = data.caseDetails[ci];

    if (y > 230) { doc.addPage(); y = 20; }

    // Case header
    const caseLabel = data.caseDetails.length > 1 ? `ملف ${ci + 1}: ` : '';

    doc.setFillColor(...BOX_BG);
    doc.roundedRect(m, y, cw, 18, 1.5, 1.5, 'F');
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.5);
    doc.line(m, y, m, y + 18);

    doc.setFontSize(14);
    doc.setTextColor(...NAVY);
    doc.text(`${caseLabel}${cd.caseTitle}`, rightX - 4, y + 7, { align: 'right' });

    const caseInfoParts: string[] = [];
    if (cd.caseNumber) caseInfoParts.push(`رقم الملف: ${cd.caseNumber}`);
    if (cd.court) caseInfoParts.push(`المحكمة: ${cd.court}`);

    if (caseInfoParts.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(...TEXT_SECONDARY);
      doc.text(caseInfoParts.join('  |  '), rightX - 4, y + 14, { align: 'right' });
    }

    y += 22;

    // ── Table ──
    const colAmountW = 38;

    // Table header
    doc.setFillColor(...TABLE_HEADER_BG);
    doc.rect(m, y, cw, 9, 'F');
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.25);
    doc.rect(m, y, cw, 9, 'S');

    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text('البيان', rightX - 5, y + 6.5, { align: 'right' });
    doc.text('المبلغ (درهم)', m + colAmountW / 2, y + 6.5, { align: 'center' });
    doc.line(m + colAmountW, y, m + colAmountW, y + 9);
    y += 9;

    // Table rows
    for (let i = 0; i < cd.items.length; i++) {
      if (y > 258) { doc.addPage(); y = 20; }
      const item = cd.items[i];
      const rowH = 8;

      if (i % 2 === 0) {
        doc.setFillColor(253, 253, 254);
        doc.rect(m, y, cw, rowH, 'F');
      }

      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.12);
      doc.rect(m, y, cw, rowH, 'S');
      doc.line(m + colAmountW, y, m + colAmountW, y + rowH);

      doc.setFontSize(12);
      doc.setTextColor(...TEXT_PRIMARY);
      doc.text(item.description, rightX - 5, y + 5.5, { align: 'right' });
      doc.setTextColor(...TEXT_SECONDARY);
      doc.text(fmtNum(item.amount), m + colAmountW / 2, y + 5.5, { align: 'center' });

      y += rowH;
    }

    y += 4;

    // ── Summary rows ──
    const summaryX = m + colAmountW;
    const summaryLabelX = summaryX + 5;
    const summaryValueX = rightX - 5;

    const drawSummary = (label: string, value: string, isBold = false, isHighlight = false) => {
      if (y > 265) { doc.addPage(); y = 20; }

      if (isHighlight) {
        doc.setFillColor(...NAVY);
        doc.roundedRect(summaryX - 2, y - 1, cw - colAmountW + 6, 9, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
      } else {
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.1);
        doc.line(summaryX, y + 6, rightX, y + 6);
        doc.setTextColor(isBold ? NAVY[0] : TEXT_PRIMARY[0], isBold ? NAVY[1] : TEXT_PRIMARY[1], isBold ? NAVY[2] : TEXT_PRIMARY[2]);
        doc.setFontSize(isBold ? 14 : 12);
      }

      doc.text(label, summaryValueX, y + 5, { align: 'right' });
      doc.text(value, summaryLabelX, y + 5, { align: 'left' });
      y += 9;
    };

    drawSummary('المصاريف', fmtNum(cd.expensesTotal));
    drawSummary('الأتعاب', fmtNum(cd.lawyerFees));
    drawSummary('المجموع (HT)', fmtNum(cd.subtotal), true);
    if (cd.taxRate > 0) {
      drawSummary(`الضريبة (${cd.taxRate}%)`, fmtNum(cd.taxAmount));
    }
    drawSummary('المجموع (TTC)', `${fmtNum(cd.totalAmount)} درهم`, false, true);

    y += 6;
  }

  /* ═══════════════════════════════════════
     GRAND TOTAL (multi-case)
     ═══════════════════════════════════════ */
  if (data.caseDetails.length > 1) {
    if (y > 242) { doc.addPage(); y = 20; }
    y += 4;
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.5);
    doc.line(m, y, rightX, y);
    y += 10;

    doc.setFontSize(16);
    doc.setTextColor(...NAVY);
    doc.text('المجموع الإجمالي (TTC)', rightX - 2, y, { align: 'right' });
    doc.text(`${fmtNum(data.grandTotal)} درهم`, m + 2, y, { align: 'left' });
    y += 7;

    doc.setFontSize(11);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(numberToArabicWords(data.grandTotal), rightX - 2, y, { align: 'right' });
    y += 10;
  } else if (data.caseDetails.length === 1) {
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(numberToArabicWords(data.caseDetails[0].totalAmount), rightX - 5, y, { align: 'right' });
    y += 8;
  }

  /* ═══════════════════════════════════════
     NOTES
     ═══════════════════════════════════════ */
  if (data.notes) {
    if (y > 248) { doc.addPage(); y = 20; }
    y += 2;
    doc.setFontSize(12);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text('ملاحظات:', rightX, y, { align: 'right' });
    y += 6;
    doc.setFontSize(12);
    doc.setTextColor(...TEXT_PRIMARY);
    const lines = doc.splitTextToSize(data.notes, cw);
    doc.text(lines, rightX, y, { align: 'right' });
    y += lines.length * 6 + 5;
  }

  /* ═══════════════════════════════════════
     SIGNATURE & QR
     ═══════════════════════════════════════ */
  y = Math.max(y + 8, 235);
  if (y > 256) { doc.addPage(); y = 30; }

  const qrSize = 22;
  doc.addImage(qrDataUrl, 'PNG', m, y, qrSize, qrSize);
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('رمز التحقق', m + qrSize / 2, y + qrSize + 3, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text('التوقيع والختم', rightX, y + 2, { align: 'right' });
  doc.setDrawColor(...TEXT_MUTED);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(rightX - 55, y + 22, rightX, y + 22);
  doc.setLineDashPattern([], 0);

  /* ═══════════════════════════════════════
     FOOTER (all pages)
     ═══════════════════════════════════════ */
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('Amiri');
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.15);
    doc.line(m, 285, rightX, 285);
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('وثيقة موقعة إلكترونياً', pw / 2, 289, { align: 'center' });
  }

  return doc.output('blob');
};
