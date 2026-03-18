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

/* ── Exact same colors as the receipt ── */
const TEAL: [number, number, number] = [55, 145, 160];
const TEXT_DARK: [number, number, number] = [35, 35, 35];
const TEXT_MID: [number, number, number] = [90, 90, 90];
const TEXT_LIGHT: [number, number, number] = [140, 140, 140];
const TEXT_MUTED: [number, number, number] = [180, 180, 180];
const BG_LIGHT: [number, number, number] = [245, 246, 248];
const BORDER_LIGHT: [number, number, number] = [220, 220, 220];

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
  const m = 22;
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

  /* ═══════════════════════════════════════
     1. TEAL TOP BAR
     ═══════════════════════════════════════ */
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pw, 4, 'F');
  y = 18;

  /* ═══════════════════════════════════════
     2. CENTERED HEADER — مكتب الأستاذ
     ═══════════════════════════════════════ */
  doc.setFontSize(16);
  doc.setTextColor(...TEXT_DARK);
  doc.text('مكتب الأستاذ', cx, y, { align: 'center' });
  y += 12;

  doc.setFontSize(26);
  doc.setTextColor(...TEXT_DARK);
  doc.text(lawyerName, cx, y, { align: 'center' });
  y += 9;

  if (titleAr) {
    doc.setFontSize(13);
    doc.setTextColor(...TEAL);
    const fullTitle = barNameAr ? `${titleAr} لدى ${barNameAr}` : titleAr;
    doc.text(fullTitle, cx, y, { align: 'center' });
    y += 10;
  } else {
    y += 4;
  }

  y += 2;

  if (address) {
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_DARK);
    doc.text('المقر الاجتماعي', cx, y, { align: 'center' });
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MID);
    const fullAddr = city ? `${address}، ${city}، المغرب` : address;
    doc.text(fullAddr, cx, y, { align: 'center' });
    y += 6;
  }

  if (phone) {
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MID);
    doc.text(`الهاتف: ${phone}`, cx, y, { align: 'center' });
    y += 6;
  }

  if (email) {
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MID);
    doc.text(`البريد الإلكتروني: ${email}`, cx, y, { align: 'center' });
    y += 6;
  }

  y += 6;

  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.3);
  doc.line(m, y, rightX, y);
  y += 14;

  /* ═══════════════════════════════════════
     3. TITLE — بيان أتعاب ومصاريف
     ═══════════════════════════════════════ */
  doc.setFontSize(30);
  doc.setTextColor(...TEXT_DARK);
  doc.text('بيان أتعاب ومصاريف', cx, y, { align: 'center' });
  y += 5;

  doc.setDrawColor(...TEXT_DARK);
  doc.setLineWidth(0.5);
  const ulW = 50;
  doc.line(cx - ulW / 2, y, cx + ulW / 2, y);
  y += 8;

  doc.setFontSize(11);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`رقم المرجع: ${data.statementNumber}`, cx, y, { align: 'center' });
  y += 12;

  /* ═══════════════════════════════════════
     4. CLIENT INFO BOX — ALL CENTERED (like the receipt image)
     ═══════════════════════════════════════ */
  let clientRows = 1;
  if (data.clientPhone) clientRows++;
  if (data.clientCin) clientRows++;
  if (data.powerOfAttorneyDate) clientRows++;
  const clientBoxH = 8 + clientRows * 18;

  doc.setFillColor(...BG_LIGHT);
  doc.roundedRect(m, y, contentW, clientBoxH, 3, 3, 'F');

  let infoY = y + 10;

  // الموكل — centered
  doc.setFontSize(11);
  doc.setTextColor(...TEAL);
  doc.text('الموكل', cx, infoY, { align: 'center' });
  infoY += 8;
  doc.setFontSize(16);
  doc.setTextColor(...TEXT_DARK);
  doc.text(data.clientName, cx, infoY, { align: 'center' });
  infoY += 10;

  if (data.clientPhone) {
    doc.setFontSize(11);
    doc.setTextColor(...TEAL);
    doc.text('الهاتف', cx, infoY, { align: 'center' });
    infoY += 8;
    doc.setFontSize(14);
    doc.setTextColor(...TEXT_DARK);
    doc.text(data.clientPhone, cx, infoY, { align: 'center' });
    infoY += 10;
  }

  if (data.clientCin) {
    doc.setFontSize(11);
    doc.setTextColor(...TEAL);
    doc.text('رقم البطاقة الوطنية', cx, infoY, { align: 'center' });
    infoY += 8;
    doc.setFontSize(14);
    doc.setTextColor(...TEXT_DARK);
    doc.text(data.clientCin, cx, infoY, { align: 'center' });
    infoY += 10;
  }

  if (data.powerOfAttorneyDate) {
    doc.setFontSize(11);
    doc.setTextColor(...TEAL);
    doc.text('تاريخ الوكالة', cx, infoY, { align: 'center' });
    infoY += 8;
    doc.setFontSize(14);
    doc.setTextColor(...TEXT_DARK);
    doc.text(data.powerOfAttorneyDate, cx, infoY, { align: 'center' });
  }

  y += clientBoxH + 10;

  /* ═══════════════════════════════════════
     5. CASE DETAILS
     ═══════════════════════════════════════ */
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    const cd = data.caseDetails[ci];

    if (y > 220) { doc.addPage(); y = 20; doc.setFont('Amiri'); }

    // Case header — gray box, centered content (like client box)
    const caseLabel = data.caseDetails.length > 1 ? `ملف ${ci + 1}: ` : '';
    const caseInfoParts: string[] = [];
    if (cd.caseNumber) caseInfoParts.push(`رقم الملف: ${cd.caseNumber}`);
    if (cd.court) caseInfoParts.push(`المحكمة: ${cd.court}`);
    const hasInfo = caseInfoParts.length > 0;
    const caseBoxH = hasInfo ? 20 : 14;

    doc.setFillColor(...BG_LIGHT);
    doc.roundedRect(m, y, contentW, caseBoxH, 3, 3, 'F');

    doc.setFontSize(14);
    doc.setTextColor(...TEAL);
    doc.text(`${caseLabel}${cd.caseTitle}`, cx, y + 8, { align: 'center' });

    if (hasInfo) {
      doc.setFontSize(10);
      doc.setTextColor(...TEXT_MID);
      doc.text(caseInfoParts.join('   ·   '), cx, y + 16, { align: 'center' });
    }

    y += caseBoxH + 4;

    // ── Items table ──
    const colAmountW = 38;

    // Table header
    doc.setFillColor(240, 241, 244);
    doc.rect(m, y, contentW, 9, 'F');
    doc.setDrawColor(...BORDER_LIGHT);
    doc.setLineWidth(0.2);
    doc.rect(m, y, contentW, 9, 'S');

    doc.setFontSize(11);
    doc.setTextColor(...TEXT_DARK);
    doc.text('البيان', rightX - 5, y + 6.5, { align: 'right' });
    doc.text('المبلغ (درهم)', m + colAmountW / 2, y + 6.5, { align: 'center' });
    doc.line(m + colAmountW, y, m + colAmountW, y + 9);
    y += 9;

    // Table rows
    for (let i = 0; i < cd.items.length; i++) {
      if (y > 260) { doc.addPage(); y = 20; doc.setFont('Amiri'); }
      const item = cd.items[i];
      const rowH = 8;

      if (i % 2 === 0) {
        doc.setFillColor(252, 252, 254);
        doc.rect(m, y, contentW, rowH, 'F');
      }

      doc.setDrawColor(...BORDER_LIGHT);
      doc.setLineWidth(0.1);
      doc.rect(m, y, contentW, rowH, 'S');
      doc.line(m + colAmountW, y, m + colAmountW, y + rowH);

      doc.setFontSize(11);
      doc.setTextColor(...TEXT_DARK);
      doc.text(item.description, rightX - 5, y + 5.5, { align: 'right' });

      doc.setTextColor(...TEXT_MID);
      doc.text(fmtNum(item.amount), m + colAmountW / 2, y + 5.5, { align: 'center' });

      y += rowH;
    }

    y += 4;

    // ── Summary rows ──
    const drawRow = (label: string, value: string, isBold = false, isHighlight = false) => {
      if (y > 268) { doc.addPage(); y = 20; doc.setFont('Amiri'); }

      if (isHighlight) {
        doc.setFillColor(...TEAL);
        doc.roundedRect(m, y - 1, contentW, 10, 1.5, 1.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13);
        doc.text(label, rightX - 5, y + 5.5, { align: 'right' });
        doc.text(value, m + 5, y + 5.5, { align: 'left' });
      } else {
        doc.setDrawColor(...BORDER_LIGHT);
        doc.setLineWidth(0.1);
        doc.line(m + contentW * 0.35, y + 7, rightX, y + 7);
        doc.setTextColor(isBold ? TEAL[0] : TEXT_DARK[0], isBold ? TEAL[1] : TEXT_DARK[1], isBold ? TEAL[2] : TEXT_DARK[2]);
        doc.setFontSize(isBold ? 12 : 11);
        doc.text(label, rightX - 5, y + 5.5, { align: 'right' });
        doc.setTextColor(...TEXT_DARK);
        doc.text(value, m + 5, y + 5.5, { align: 'left' });
      }

      y += 10;
    };

    drawRow('المصاريف', fmtNum(cd.expensesTotal));
    drawRow('الأتعاب', fmtNum(cd.lawyerFees));
    drawRow('المجموع (HT)', fmtNum(cd.subtotal), true);
    if (cd.taxRate > 0) {
      drawRow(`الضريبة (${cd.taxRate}%)`, fmtNum(cd.taxAmount));
    }
    drawRow('المجموع (TTC)', `${fmtNum(cd.totalAmount)} درهم`, false, true);

    y += 4;
  }

  /* ═══════════════════════════════════════
     6. GRAND TOTAL or TAFKEET
     ═══════════════════════════════════════ */
  if (data.caseDetails.length > 1) {
    if (y > 240) { doc.addPage(); y = 20; doc.setFont('Amiri'); }
    y += 4;
    doc.setDrawColor(...BORDER_LIGHT);
    doc.setLineWidth(0.3);
    doc.line(m, y, rightX, y);
    y += 10;

    doc.setFontSize(12);
    doc.setTextColor(...TEXT_MID);
    doc.text('المبلغ الإجمالي المستلم:', rightX, y, { align: 'right' });

    doc.setFontSize(24);
    doc.setTextColor(...TEXT_DARK);
    doc.text(`MAD  ${fmtNum(data.grandTotal)}`, m, y + 1, { align: 'left' });
    y += 10;

    doc.setFontSize(11);
    doc.setTextColor(...TEXT_LIGHT);
    doc.text('المبلغ بالحروف:', rightX, y, { align: 'right' });
    const tW = doc.getTextWidth('المبلغ بالحروف:  ');
    doc.setTextColor(...TEXT_MID);
    doc.text(numberToArabicWords(data.grandTotal), rightX - tW, y, { align: 'right' });
    y += 10;
  } else if (data.caseDetails.length === 1) {
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_MID);
    doc.text(numberToArabicWords(data.caseDetails[0].totalAmount), rightX - 5, y, { align: 'right' });
    y += 8;
  }

  /* ═══════════════════════════════════════
     7. NOTES
     ═══════════════════════════════════════ */
  if (data.notes) {
    if (y > 250) { doc.addPage(); y = 20; doc.setFont('Amiri'); }
    y += 2;
    doc.setDrawColor(...BORDER_LIGHT);
    doc.setLineWidth(0.3);
    doc.line(m, y, rightX, y);
    y += 8;

    doc.setFontSize(11);
    doc.setTextColor(...TEAL);
    doc.text('ملاحظات:', rightX, y, { align: 'right' });
    y += 7;
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_DARK);
    const lines = doc.splitTextToSize(data.notes, contentW);
    doc.text(lines, rightX, y, { align: 'right' });
    y += lines.length * 6 + 5;
  }

  /* ═══════════════════════════════════════
     8. DATE — حرر بـ... (like receipt)
     ═══════════════════════════════════════ */
  if (y > 250) { doc.addPage(); y = 30; doc.setFont('Amiri'); }
  y += 4;
  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.3);
  doc.line(m, y, rightX, y);
  y += 10;

  doc.setFontSize(11);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`حرر ب${city || '...'} في:`, rightX, y, { align: 'right' });
  y += 9;

  doc.setFontSize(16);
  doc.setTextColor(...TEXT_DARK);
  doc.text(data.date, rightX, y, { align: 'right' });
  y += 16;

  /* ═══════════════════════════════════════
     9. SIGNATURE — centered (identical to receipt)
     ═══════════════════════════════════════ */
  if (y > 250) { doc.addPage(); y = 30; doc.setFont('Amiri'); }

  doc.setFontSize(14);
  doc.setTextColor(...TEXT_DARK);
  doc.text('توقيع وختم المكتب', cx, y, { align: 'center' });
  y += 10;

  const sealW = 55;
  const sealH = 35;
  const sealX = cx - sealW / 2;
  doc.setFillColor(240, 241, 243);
  doc.roundedRect(sealX, y, sealW, sealH, 6, 6, 'F');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('SEAL & SIGNATURE AREA', cx, y + sealH / 2 + 1, { align: 'center' });

  /* ═══════════════════════════════════════
     QR CODE — bottom left
     ═══════════════════════════════════════ */
  const qrSize = 18;
  const qrY = 272;
  doc.addImage(qrDataUrl, 'PNG', m, qrY, qrSize, qrSize);
  doc.setFontSize(6);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('رمز التحقق', m + qrSize / 2, qrY + qrSize + 2.5, { align: 'center' });

  /* ═══════════════════════════════════════
     FOOTER
     ═══════════════════════════════════════ */
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('Amiri');
    doc.setDrawColor(...BORDER_LIGHT);
    doc.setLineWidth(0.15);
    doc.line(m, 293, rightX, 293);
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('وثيقة موقعة إلكترونياً', cx, 296, { align: 'center' });
  }

  return doc.output('blob');
};
