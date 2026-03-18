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

/* ── Colors matching the invoice design ── */
const TEAL: [number, number, number] = [55, 145, 160];
const TEXT_DARK: [number, number, number] = [35, 35, 35];
const TEXT_MID: [number, number, number] = [90, 90, 90];
const TEXT_LIGHT: [number, number, number] = [140, 140, 140];
const TEXT_MUTED: [number, number, number] = [180, 180, 180];
const BG_LIGHT: [number, number, number] = [245, 246, 248];
const BORDER_LIGHT: [number, number, number] = [220, 220, 220];
const TABLE_HEADER_BG: [number, number, number] = [240, 241, 244];

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
  const m = 20;
  const cw = pw - m * 2;
  const rightX = pw - m;
  const cx = pw / 2;

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

  let y = 0;

  /* ═══════════════════════════════════════
     1. TEAL TOP BAR
     ═══════════════════════════════════════ */
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pw, 4, 'F');
  y = 18;

  /* ═══════════════════════════════════════
     2. BILINGUAL HEADER — Arabic right, French left
     ═══════════════════════════════════════ */
  // Arabic side (right)
  doc.setFontSize(16);
  doc.setTextColor(...TEXT_DARK);
  doc.text(`الأستاذ ${lawyerName}`, rightX, y, { align: 'right' });

  // French side (left)
  if (nameFr) {
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_DARK);
    doc.text(`Maître ${nameFr}`, m, y, { align: 'left' });
  }
  y += 7;

  // Titles
  if (titleAr || barNameAr) {
    doc.setFontSize(11);
    doc.setTextColor(...TEAL);
    const arTitle = [titleAr, barNameAr ? `هيئة ${barNameAr}` : ''].filter(Boolean).join(' — ');
    doc.text(arTitle, rightX, y, { align: 'right' });
  }
  if (titleFr || barNameFr) {
    doc.setFontSize(9);
    doc.setTextColor(...TEAL);
    const frTitle = [titleFr, barNameFr ? `au Barreau de ${barNameFr}` : ''].filter(Boolean).join(' ');
    doc.text(frTitle, m, y, { align: 'left' });
  }
  y += 6;

  // Phone
  if (phone) {
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MID);
    doc.text(`الهاتف: ${phone}`, rightX, y, { align: 'right' });
    doc.text(`Tél: ${phone}`, m, y, { align: 'left' });
    y += 5;
  }

  // Separator
  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.3);
  doc.line(m, y, rightX, y);
  y += 5;

  // Address centered
  if (address) {
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MID);
    const fullAddr = city ? `المقر: ${address}، ${city}` : `المقر: ${address}`;
    doc.text(fullAddr, cx, y, { align: 'center' });
    y += 5;
  }
  if (email) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MID);
    doc.text(`البريد الإلكتروني: ${email}`, cx, y, { align: 'center' });
    y += 5;
  }

  y += 3;

  // Date — right aligned
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(city ? `حرر ب${city} في: ${data.date}` : data.date, rightX, y, { align: 'right' });
  y += 12;

  /* ═══════════════════════════════════════
     3. TITLE — centered
     ═══════════════════════════════════════ */
  doc.setFontSize(24);
  doc.setTextColor(...TEXT_DARK);
  doc.text('بيان أتعاب ومصاريف', cx, y, { align: 'center' });
  y += 5;

  // Underline
  doc.setDrawColor(...TEXT_DARK);
  doc.setLineWidth(0.5);
  const ulW = 45;
  doc.line(cx - ulW / 2, y, cx + ulW / 2, y);
  y += 7;

  // Reference number
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`رقم المرجع: ${data.statementNumber}`, cx, y, { align: 'center' });
  y += 10;

  /* ═══════════════════════════════════════
     4. CLIENT INFO BOX — right-aligned labels
     ═══════════════════════════════════════ */
  let clientLines = 1;
  if (data.clientCin) clientLines++;
  if (data.clientPhone) clientLines++;
  if (data.powerOfAttorneyDate) clientLines++;
  const boxH = 10 + clientLines * 10;
  const boxInnerX = rightX - 8;

  doc.setFillColor(...BG_LIGHT);
  doc.roundedRect(m, y, cw, boxH, 3, 3, 'F');

  let boxY = y + 8;

  // Client name
  doc.setFontSize(11);
  doc.setTextColor(...TEAL);
  doc.text('الموكل', boxInnerX, boxY, { align: 'right' });
  boxY += 7;
  doc.setFontSize(14);
  doc.setTextColor(...TEXT_DARK);
  doc.text(data.clientName, boxInnerX, boxY, { align: 'right' });
  boxY += 10;

  if (data.clientCin) {
    doc.setFontSize(11);
    doc.setTextColor(...TEAL);
    doc.text('رقم البطاقة الوطنية', boxInnerX, boxY, { align: 'right' });
    const cinLabelW = doc.getTextWidth('رقم البطاقة الوطنية  ');
    doc.setTextColor(...TEXT_DARK);
    doc.text(data.clientCin, boxInnerX - cinLabelW, boxY, { align: 'right' });
    boxY += 10;
  }

  if (data.clientPhone) {
    doc.setFontSize(11);
    doc.setTextColor(...TEAL);
    doc.text('الهاتف', boxInnerX, boxY, { align: 'right' });
    const phoneLabelW = doc.getTextWidth('الهاتف  ');
    doc.setTextColor(...TEXT_DARK);
    doc.text(data.clientPhone, boxInnerX - phoneLabelW, boxY, { align: 'right' });
    boxY += 10;
  }

  if (data.powerOfAttorneyDate) {
    doc.setFontSize(11);
    doc.setTextColor(...TEAL);
    doc.text('تاريخ الوكالة', boxInnerX, boxY, { align: 'right' });
    const dateLabelW = doc.getTextWidth('تاريخ الوكالة  ');
    doc.setTextColor(...TEXT_DARK);
    doc.text(data.powerOfAttorneyDate, boxInnerX - dateLabelW, boxY, { align: 'right' });
  }

  y += boxH + 8;

  /* ═══════════════════════════════════════
     5. CASE DETAILS & ITEMS TABLE
     ═══════════════════════════════════════ */
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    const cd = data.caseDetails[ci];

    if (y > 230) { doc.addPage(); y = 20; doc.setFont('Amiri'); }

    // Case header box
    const caseLabel = data.caseDetails.length > 1 ? `ملف ${ci + 1}: ` : '';

    doc.setFillColor(...BG_LIGHT);
    doc.roundedRect(m, y, cw, 16, 2, 2, 'F');

    doc.setFontSize(14);
    doc.setTextColor(...TEAL);
    doc.text(`${caseLabel}${cd.caseTitle}`, rightX - 6, y + 7, { align: 'right' });

    const caseInfoParts: string[] = [];
    if (cd.caseNumber) caseInfoParts.push(`رقم الملف: ${cd.caseNumber}`);
    if (cd.court) caseInfoParts.push(`المحكمة: ${cd.court}`);

    if (caseInfoParts.length > 0) {
      doc.setFontSize(10);
      doc.setTextColor(...TEXT_MID);
      doc.text(caseInfoParts.join('   ·   '), rightX - 6, y + 13, { align: 'right' });
    }

    y += 20;

    // ── Table ──
    const colAmountW = 35;
    const colDescW = cw - colAmountW;

    // Table header
    doc.setFillColor(...TABLE_HEADER_BG);
    doc.rect(m, y, cw, 9, 'F');
    doc.setDrawColor(...BORDER_LIGHT);
    doc.setLineWidth(0.2);
    doc.rect(m, y, cw, 9, 'S');

    doc.setFontSize(11);
    doc.setTextColor(...TEXT_DARK);
    // RTL: "البيان" on the right, "المبلغ" on the left
    doc.text('البيان', rightX - 5, y + 6.5, { align: 'right' });
    doc.text('المبلغ (درهم)', m + colAmountW / 2, y + 6.5, { align: 'center' });
    // Vertical separator
    doc.line(m + colAmountW, y, m + colAmountW, y + 9);
    y += 9;

    // Table rows — all text right-aligned
    for (let i = 0; i < cd.items.length; i++) {
      if (y > 258) { doc.addPage(); y = 20; doc.setFont('Amiri'); }
      const item = cd.items[i];
      const rowH = 8;

      if (i % 2 === 0) {
        doc.setFillColor(252, 252, 254);
        doc.rect(m, y, cw, rowH, 'F');
      }

      doc.setDrawColor(...BORDER_LIGHT);
      doc.setLineWidth(0.1);
      doc.rect(m, y, cw, rowH, 'S');
      doc.line(m + colAmountW, y, m + colAmountW, y + rowH);

      // Description — right-aligned with bullet
      doc.setFontSize(11);
      doc.setTextColor(...TEXT_DARK);
      const descText = `- ${item.description}`;
      // Truncate if too long
      const maxDescW = colDescW - 10;
      const truncated = doc.getTextWidth(descText) > maxDescW
        ? doc.splitTextToSize(descText, maxDescW)[0]
        : descText;
      doc.text(truncated, rightX - 5, y + 5.5, { align: 'right' });

      // Amount — centered in left column
      doc.setTextColor(...TEXT_MID);
      doc.text(fmtNum(item.amount), m + colAmountW / 2, y + 5.5, { align: 'center' });

      y += rowH;
    }

    y += 4;

    // ── Summary rows — right-aligned ──
    const summaryRightX = rightX - 5;
    const summaryLeftX = m + 5;

    const drawSummary = (label: string, value: string, isBold = false, isHighlight = false) => {
      if (y > 265) { doc.addPage(); y = 20; doc.setFont('Amiri'); }

      if (isHighlight) {
        doc.setFillColor(...TEAL);
        doc.roundedRect(m, y - 1, cw, 10, 1.5, 1.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
      } else {
        doc.setDrawColor(...BORDER_LIGHT);
        doc.setLineWidth(0.1);
        doc.line(m + cw * 0.3, y + 7, rightX, y + 7);
        doc.setTextColor(isBold ? TEAL[0] : TEXT_DARK[0], isBold ? TEAL[1] : TEXT_DARK[1], isBold ? TEAL[2] : TEXT_DARK[2]);
        doc.setFontSize(isBold ? 13 : 11);
      }

      // Label on right, value on left
      doc.text(label, summaryRightX, y + 5.5, { align: 'right' });
      doc.text(value, summaryLeftX, y + 5.5, { align: 'left' });
      y += 10;
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
     6. GRAND TOTAL (multi-case)
     ═══════════════════════════════════════ */
  if (data.caseDetails.length > 1) {
    if (y > 242) { doc.addPage(); y = 20; doc.setFont('Amiri'); }
    y += 4;
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.5);
    doc.line(m, y, rightX, y);
    y += 10;

    doc.setFontSize(16);
    doc.setTextColor(...TEXT_DARK);
    doc.text('المجموع الإجمالي (TTC)', rightX, y, { align: 'right' });
    doc.text(`${fmtNum(data.grandTotal)} درهم`, m, y, { align: 'left' });
    y += 8;

    doc.setFontSize(11);
    doc.setTextColor(...TEXT_MID);
    doc.text(numberToArabicWords(data.grandTotal), rightX, y, { align: 'right' });
    y += 10;
  } else if (data.caseDetails.length === 1) {
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_MID);
    doc.text(numberToArabicWords(data.caseDetails[0].totalAmount), rightX - 5, y, { align: 'right' });
    y += 8;
  }

  /* ═══════════════════════════════════════
     7. NOTES — right-aligned
     ═══════════════════════════════════════ */
  if (data.notes) {
    if (y > 248) { doc.addPage(); y = 20; doc.setFont('Amiri'); }
    y += 2;
    doc.setFontSize(11);
    doc.setTextColor(...TEAL);
    doc.text('ملاحظات:', rightX, y, { align: 'right' });
    y += 7;
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_DARK);
    const lines = doc.splitTextToSize(data.notes, cw);
    doc.text(lines, rightX, y, { align: 'right' });
    y += lines.length * 6 + 5;
  }

  /* ═══════════════════════════════════════
     8. SIGNATURE & QR
     ═══════════════════════════════════════ */
  y = Math.max(y + 8, 235);
  if (y > 256) { doc.addPage(); y = 30; doc.setFont('Amiri'); }

  // Signature on the right
  doc.setFontSize(14);
  doc.setTextColor(...TEXT_DARK);
  doc.text('توقيع وختم المكتب', rightX, y + 2, { align: 'right' });

  // Seal placeholder
  const sealW = 50;
  const sealH = 25;
  const sealX = rightX - sealW;
  doc.setFillColor(240, 241, 243);
  doc.roundedRect(sealX, y + 6, sealW, sealH, 4, 4, 'F');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('SEAL & SIGNATURE', sealX + sealW / 2, y + 6 + sealH / 2 + 1, { align: 'center' });

  // QR on the left
  const qrSize = 20;
  doc.addImage(qrDataUrl, 'PNG', m, y, qrSize, qrSize);
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('رمز التحقق', m + qrSize / 2, y + qrSize + 3, { align: 'center' });

  /* ═══════════════════════════════════════
     FOOTER (all pages)
     ═══════════════════════════════════════ */
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('Amiri');
    doc.setDrawColor(...BORDER_LIGHT);
    doc.setLineWidth(0.15);
    doc.line(m, 288, rightX, 288);
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('وثيقة موقعة إلكترونياً', cx, 292, { align: 'center' });
  }

  return doc.output('blob');
};
