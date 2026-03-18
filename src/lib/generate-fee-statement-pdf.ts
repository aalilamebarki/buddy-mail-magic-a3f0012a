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

const NAVY: [number, number, number] = [26, 43, 60];
const BLACK: [number, number, number] = [0, 0, 0];
const DARK_GRAY: [number, number, number] = [51, 51, 51];
const GRAY: [number, number, number] = [136, 136, 136];
const LIGHT_GRAY: [number, number, number] = [187, 187, 187];
const BORDER: [number, number, number] = [221, 221, 221];
const BOX_BG: [number, number, number] = [247, 248, 250];
const TABLE_HEADER_BG: [number, number, number] = [240, 242, 245];

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
     BILINGUAL HEADER — Navy accent
     ═══════════════════════════════════════ */

  doc.setFontSize(18);
  doc.setTextColor(...NAVY);
  doc.text(`الأستاذ ${lawyerName}`, rightX, y, { align: 'right' });

  if (nameFr) {
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(`Maître ${nameFr}`, m, y, { align: 'left' });
  }

  y += 7;

  if (titleAr || barNameAr) {
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    const arTitle = [titleAr, barNameAr ? `هيئة ${barNameAr}` : ''].filter(Boolean).join(' — ');
    doc.text(arTitle, rightX, y, { align: 'right' });
  }

  if (titleFr || barNameFr) {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    const frTitle = [titleFr, barNameFr ? `au Barreau de ${barNameFr}` : ''].filter(Boolean).join(' ');
    doc.text(frTitle, m, y, { align: 'left' });
  }

  y += 5;

  if (phone) {
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`Tél: ${phone}`, m, y, { align: 'left' });
  }

  y += 4;

  // Navy separator
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.7);
  doc.line(m, y, rightX, y);
  y += 1.5;
  doc.setLineWidth(0.3);
  doc.line(m + 25, y, rightX - 25, y);
  y += 5;

  if (address) {
    doc.setFontSize(9);
    doc.setTextColor(...DARK_GRAY);
    const fullAddr = [address, city ? `- ${city}` : ''].filter(Boolean).join(' ');
    doc.text(fullAddr, pw / 2, y, { align: 'center' });
    y += 5;
  }

  if (email) {
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`E-mail : ${email}`, pw / 2, y, { align: 'center' });
    y += 5;
  }

  // City & Date
  y += 3;
  doc.setFontSize(10);
  doc.setTextColor(...DARK_GRAY);
  if (city) {
    doc.text(`${city} في: ${data.date}`, rightX, y, { align: 'right' });
  } else {
    doc.text(data.date, rightX, y, { align: 'right' });
  }
  y += 14;

  /* ═══════════════════════════════════════
     TITLE
     ═══════════════════════════════════════ */
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text('بيان أتعاب ومصاريف', pw / 2, y, { align: 'center' });
  y += 4;
  const titleBarW = 50;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.line(pw / 2 - titleBarW / 2, y, pw / 2 + titleBarW / 2, y);
  y += 7;

  // Ref number
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text(`رقم المرجع: ${data.statementNumber}`, pw / 2, y, { align: 'center' });
  y += 10;

  /* ═══════════════════════════════════════
     CLIENT INFO BOX — light gray bg + navy right border
     ═══════════════════════════════════════ */
  let boxLines = 1;
  if (data.clientCin) boxLines++;
  if (data.clientPhone) boxLines++;
  if (data.powerOfAttorneyDate) boxLines++;
  const boxH = 6 + boxLines * 7;
  const boxInnerX = rightX - 5;

  doc.setFillColor(...BOX_BG);
  doc.roundedRect(m, y, cw, boxH, 2, 2, 'F');
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1.2);
  doc.line(rightX, y, rightX, y + boxH);

  let boxY = y + 6;

  doc.setFontSize(12);
  doc.setTextColor(...GRAY);
  doc.text('الموكل: ', boxInnerX, boxY, { align: 'right' });
  const clW = doc.getTextWidth('الموكل: ');
  doc.setTextColor(...BLACK);
  doc.text(data.clientName, boxInnerX - clW, boxY, { align: 'right' });
  boxY += 7;

  if (data.clientCin) {
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text(`رقم البطاقة الوطنية: ${data.clientCin}`, boxInnerX, boxY, { align: 'right' });
    boxY += 7;
  }

  if (data.clientPhone) {
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text(`الهاتف: ${data.clientPhone}`, boxInnerX, boxY, { align: 'right' });
    boxY += 7;
  }

  if (data.powerOfAttorneyDate) {
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text(`تاريخ الوكالة: ${data.powerOfAttorneyDate}`, boxInnerX, boxY, { align: 'right' });
  }

  y += boxH + 8;

  /* ═══════════════════════════════════════
     CASE DETAILS & ITEMS TABLE
     ═══════════════════════════════════════ */
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    const cd = data.caseDetails[ci];

    if (y > 235) { doc.addPage(); y = 20; }

    // Case header box
    const caseLabel = data.caseDetails.length > 1 ? `ملف ${ci + 1}: ` : '';

    doc.setFillColor(...BOX_BG);
    doc.roundedRect(m, y, cw, 16, 1.5, 1.5, 'F');
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.5);
    doc.line(m, y, m, y + 16); // navy left border

    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(`${caseLabel}${cd.caseTitle}`, rightX - 4, y + 6, { align: 'right' });

    const caseInfoParts: string[] = [];
    if (cd.caseNumber) caseInfoParts.push(`رقم الملف: ${cd.caseNumber}`);
    if (cd.court) caseInfoParts.push(`المحكمة: ${cd.court}`);

    if (caseInfoParts.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text(caseInfoParts.join('  |  '), rightX - 4, y + 12, { align: 'right' });
    }

    y += 20;

    // ── Table ──
    const colAmountW = 35;
    const colDescW = cw - colAmountW;

    // Table header
    doc.setFillColor(...TABLE_HEADER_BG);
    doc.rect(m, y, cw, 8, 'F');
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.rect(m, y, cw, 8, 'S');

    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text('البيان', rightX - 4, y + 5.5, { align: 'right' });
    doc.text('المبلغ (درهم)', m + colAmountW / 2, y + 5.5, { align: 'center' });

    // Vertical divider in header
    doc.line(m + colAmountW, y, m + colAmountW, y + 8);

    y += 8;

    // Table rows
    doc.setFontSize(10);
    for (let i = 0; i < cd.items.length; i++) {
      if (y > 260) { doc.addPage(); y = 20; }
      const item = cd.items[i];
      const rowH = 7;

      // Alternating row bg
      if (i % 2 === 0) {
        doc.setFillColor(252, 252, 253);
        doc.rect(m, y, cw, rowH, 'F');
      }

      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.15);
      doc.rect(m, y, cw, rowH, 'S');
      doc.line(m + colAmountW, y, m + colAmountW, y + rowH);

      doc.setTextColor(...BLACK);
      doc.text(item.description, rightX - 4, y + 5, { align: 'right' });
      doc.setTextColor(...DARK_GRAY);
      doc.text(fmtNum(item.amount), m + colAmountW / 2, y + 5, { align: 'center' });

      y += rowH;
    }

    y += 3;

    // ── Summary rows ──
    const summaryX = m + colAmountW;
    const summaryLabelX = summaryX + 4;
    const summaryValueX = rightX - 4;

    const drawSummary = (label: string, value: string, isBold = false, isHighlight = false) => {
      if (y > 268) { doc.addPage(); y = 20; }

      if (isHighlight) {
        doc.setFillColor(...NAVY);
        doc.roundedRect(summaryX - 2, y - 1, cw - colAmountW + 6, 8, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.1);
        doc.line(summaryX, y + 5, rightX, y + 5);
        doc.setTextColor(isBold ? NAVY[0] : DARK_GRAY[0], isBold ? NAVY[1] : DARK_GRAY[1], isBold ? NAVY[2] : DARK_GRAY[2]);
      }

      doc.setFontSize(isBold || isHighlight ? 11 : 10);
      doc.text(label, summaryValueX, y + 4, { align: 'right' });
      doc.text(value, summaryLabelX, y + 4, { align: 'left' });
      y += 8;
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
    if (y > 245) { doc.addPage(); y = 20; }
    y += 4;
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.5);
    doc.line(m, y, rightX, y);
    y += 10;

    doc.setFontSize(14);
    doc.setTextColor(...NAVY);
    doc.text('المجموع الإجمالي (TTC)', rightX - 2, y, { align: 'right' });
    doc.text(`${fmtNum(data.grandTotal)} درهم`, m + 2, y, { align: 'left' });
    y += 6;

    // Tafkeet
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(numberToArabicWords(data.grandTotal), rightX - 2, y, { align: 'right' });
    y += 10;
  } else if (data.caseDetails.length === 1) {
    // Single case — show tafkeet after totals
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(numberToArabicWords(data.caseDetails[0].totalAmount), rightX - 4, y, { align: 'right' });
    y += 8;
  }

  /* ═══════════════════════════════════════
     NOTES
     ═══════════════════════════════════════ */
  if (data.notes) {
    if (y > 250) { doc.addPage(); y = 20; }
    y += 2;
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text('ملاحظات:', rightX, y, { align: 'right' });
    y += 5;
    doc.setTextColor(...DARK_GRAY);
    const lines = doc.splitTextToSize(data.notes, cw);
    doc.text(lines, rightX, y, { align: 'right' });
    y += lines.length * 5 + 5;
  }

  /* ═══════════════════════════════════════
     SIGNATURE & QR
     ═══════════════════════════════════════ */
  y = Math.max(y + 8, 235);
  if (y > 258) { doc.addPage(); y = 30; }

  // QR (bottom-left)
  const qrSize = 22;
  doc.addImage(qrDataUrl, 'PNG', m, y, qrSize, qrSize);
  doc.setFontSize(6);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text('رمز التحقق', m + qrSize / 2, y + qrSize + 3, { align: 'center' });

  // Signature (right)
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text('التوقيع والختم', rightX, y + 2, { align: 'right' });
  doc.setDrawColor(...LIGHT_GRAY);
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
    doc.setLineWidth(0.2);
    doc.line(m, 285, rightX, 285);
    doc.setFontSize(7);
    doc.setTextColor(...LIGHT_GRAY);
    doc.text('وثيقة موقعة إلكترونياً', pw / 2, 289, { align: 'center' });
  }

  return doc.output('blob');
};
