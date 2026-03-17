import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

/* ── Colors ── */
const NAVY: [number, number, number] = [15, 45, 80];
const GOLD: [number, number, number] = [180, 150, 80];
const LIGHT_BG: [number, number, number] = [248, 249, 252];
const BORDER: [number, number, number] = [220, 225, 235];
const GRAY: [number, number, number] = [120, 120, 120];
const DARK: [number, number, number] = [30, 30, 50];

/* ── Helpers ── */
const drawLine = (doc: jsPDF, x1: number, y: number, x2: number, color: [number, number, number] = BORDER, w = 0.3) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(w);
  doc.line(x1, y, x2, y);
};

const textRight = (doc: jsPDF, text: string, x: number, y: number, size = 10, color: [number, number, number] = DARK) => {
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(text, x, y, { align: 'right' });
};

const textCenter = (doc: jsPDF, text: string, x: number, y: number, size = 10, color: [number, number, number] = DARK) => {
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(text, x, y, { align: 'center' });
};

const textLeft = (doc: jsPDF, text: string, x: number, y: number, size = 10, color: [number, number, number] = DARK) => {
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(text, x, y, { align: 'left' });
};

/* ── Summary row helper ── */
const summaryRow = (
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  m: number,
  pw: number,
  opts?: { bold?: boolean; large?: boolean; labelColor?: [number, number, number]; valueColor?: [number, number, number]; bg?: [number, number, number] }
) => {
  const cw = pw - m * 2;
  if (opts?.bg) {
    doc.setFillColor(...opts.bg);
    doc.rect(m, y - 4.5, cw, 7, 'F');
  }
  const sz = opts?.large ? 12 : 10;
  textRight(doc, label, pw - m - 4, y, sz, opts?.labelColor || DARK);
  textLeft(doc, value, m + 4, y, sz, opts?.valueColor || DARK);
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

  const lh = data.letterhead;
  const verificationUrl = `${window.location.origin}/verify/${data.signatureUuid}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 1 });

  /* ═══════════════════════════════════════
     HEADER — Top accent bar
     ═══════════════════════════════════════ */
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 5, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 5, pw, 0.8, 'F');

  /* ── Lawyer info (right) ── */
  const headerNameAr = lh?.lawyerName || data.lawyerName;
  textRight(doc, `مكتب الأستاذ`, pw - m, 14, 11, NAVY);
  textRight(doc, headerNameAr, pw - m, 22, 18, NAVY);

  const titleAr = lh?.titleAr || 'محامٍ لدى محاكم المملكة المغربية';
  textRight(doc, titleAr, pw - m, 28, 9, GOLD);

  /* ── Office details (left) ── */
  let leftY = 13;
  if (lh?.address || lh?.city) {
    textLeft(doc, 'المقر الاجتماعي', m, leftY, 8, GRAY);
    leftY += 4;
    if (lh.address) {
      textLeft(doc, lh.address, m, leftY, 8, DARK);
      leftY += 4;
    }
    if (lh.city) {
      textLeft(doc, lh.city, m, leftY, 8, DARK);
      leftY += 4;
    }
  }
  if (lh?.phone) {
    textLeft(doc, `الهاتف: ${lh.phone}`, m, leftY, 8, DARK);
    leftY += 4;
  }
  if (lh?.email) {
    textLeft(doc, `البريد: ${lh.email}`, m, leftY, 8, DARK);
    leftY += 4;
  }

  /* ── Divider ── */
  let y = 34;
  drawLine(doc, m, y, pw - m, BORDER, 0.4);

  /* ═══════════════════════════════════════
     TITLE
     ═══════════════════════════════════════ */
  y += 10;
  textCenter(doc, 'بيان أتعاب', pw / 2, y, 22, NAVY);
  y += 7;
  textCenter(doc, `رقم المرجع: ${data.statementNumber}`, pw / 2, y, 9, GRAY);

  /* ═══════════════════════════════════════
     CLIENT / CASE INFO CARD
     ═══════════════════════════════════════ */
  y += 8;
  const cd0 = data.caseDetails[0];
  const cardH = 24;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(m, y, cw, cardH, 2, 2, 'F');
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(m, y, cw, cardH, 2, 2, 'S');

  const col1X = pw - m - 6;
  const col2X = pw / 2 - 5;
  const row1Y = y + 8;
  const row2Y = y + 18;

  // Row 1
  textRight(doc, 'الموكل', col1X, row1Y - 3, 8, GRAY);
  textRight(doc, data.clientName, col1X, row1Y + 2, 11, NAVY);

  if (cd0?.court) {
    textRight(doc, 'المحكمة المختصة', col2X, row1Y - 3, 8, GRAY);
    textRight(doc, cd0.court, col2X, row1Y + 2, 10, DARK);
  }

  // Row 2
  if (cd0?.caseNumber) {
    textRight(doc, 'رقم الملف', col1X, row2Y - 3, 8, GRAY);
    textRight(doc, `#${cd0.caseNumber}`, col1X, row2Y + 2, 10, DARK);
  }
  if (cd0?.caseTitle) {
    textRight(doc, 'طبيعة النزاع', col2X, row2Y - 3, 8, GRAY);
    textRight(doc, cd0.caseTitle, col2X, row2Y + 2, 10, DARK);
  }

  y += cardH + 8;

  /* ═══════════════════════════════════════
     SERVICES TABLE (per case)
     ═══════════════════════════════════════ */
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    const cd = data.caseDetails[ci];

    if (y > 230) { doc.addPage(); y = 15; }

    // Case header (only if multiple cases)
    if (data.caseDetails.length > 1) {
      doc.setFillColor(235, 240, 248);
      doc.roundedRect(m, y, cw, 9, 2, 2, 'F');
      textRight(doc, `ملف ${ci + 1}: ${cd.caseNumber} — ${cd.caseTitle}`, pw - m - 4, y + 6, 10, NAVY);
      y += 13;
    }

    // Section title
    textRight(doc, 'بيان الخدمات', pw - m - 2, y, 11, NAVY);
    textLeft(doc, 'المبلغ (درهم)', m + 2, y, 11, NAVY);
    y += 3;
    drawLine(doc, m, y, pw - m, NAVY, 0.5);
    y += 4;

    // Service rows
    for (const item of cd.items) {
      if (y > 265) { doc.addPage(); y = 15; }
      textRight(doc, item.description, pw - m - 4, y, 11, DARK);
      textLeft(doc, fmtNum(item.amount), m + 4, y, 10, DARK);
      y += 3;
      drawLine(doc, m, y, pw - m, BORDER, 0.15);
      y += 6;
    }

    if (y > 250) { doc.addPage(); y = 15; }

    // Summary lines
    y += 2;
    summaryRow(doc, 'الأتعاب المهنية', fmtNum(cd.lawyerFees), y, m, pw);
    y += 7;
    summaryRow(doc, 'المصاريف والرسوم', fmtNum(cd.expensesTotal), y, m, pw);
    y += 7;
    drawLine(doc, m, y - 3, pw - m, BORDER, 0.3);
    summaryRow(doc, 'المجموع (الصافي)', fmtNum(cd.subtotal), y, m, pw, { bold: true });
    y += 7;
    summaryRow(doc, `الضريبة (%${cd.taxRate})`, fmtNum(cd.taxAmount), y, m, pw);
    y += 7;

    // Total TTC
    drawLine(doc, m, y - 3, pw - m, NAVY, 0.5);
    summaryRow(doc, 'المجموع (TTC)', fmtNum(cd.totalAmount), y, m, pw, {
      bold: true,
      large: true,
      labelColor: NAVY,
      valueColor: NAVY,
    });
    y += 10;
  }

  /* ═══════════════════════════════════════
     GRAND TOTAL (if multi-case)
     ═══════════════════════════════════════ */
  if (data.caseDetails.length > 1) {
    if (y > 240) { doc.addPage(); y = 15; }
    drawLine(doc, m + 20, y, pw - m - 20, GOLD, 0.6);
    y += 8;
    summaryRow(doc, 'المجموع الإجمالي (TTC)', fmtNum(data.grandTotal) + ' MAD', y, m, pw, {
      bold: true,
      large: true,
      labelColor: NAVY,
      valueColor: NAVY,
      bg: LIGHT_BG,
    });
    y += 12;
  }

  /* ═══════════════════════════════════════
     AMOUNT DUE
     ═══════════════════════════════════════ */
  if (y > 250) { doc.addPage(); y = 15; }
  y += 3;
  drawLine(doc, m, y - 2, pw - m, NAVY, 0.8);
  y += 4;
  textRight(doc, 'الواجب أداؤه', pw - m - 4, y, 14, NAVY);
  textLeft(doc, fmtNum(data.grandTotal) + ' MAD', m + 4, y, 14, NAVY);
  y += 3;
  drawLine(doc, m, y, pw - m, NAVY, 0.8);

  /* ═══════════════════════════════════════
     NOTES
     ═══════════════════════════════════════ */
  if (data.notes) {
    y += 8;
    if (y > 260) { doc.addPage(); y = 15; }
    textRight(doc, 'ملاحظات:', pw - m, y, 9, GRAY);
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(data.notes, cw - 20);
    doc.text(lines, pw - m - 22, y, { align: 'right' });
    y += lines.length * 5 + 5;
  }

  /* ═══════════════════════════════════════
     QR + SIGNATURE + LEGAL NOTE
     ═══════════════════════════════════════ */
  y = Math.max(y + 8, 235);
  if (y > 255) { doc.addPage(); y = 15; }

  // Legal note (right side)
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  const legalNote = 'يتم تحديد الأتعاب وفقاً للقوانين المنظمة لمهنة المحاماة\nبالمغرب وللاتفاق المسبق.';
  doc.text(legalNote, pw - m, y, { align: 'right' });

  // Signature (left side)
  textLeft(doc, 'التوقيع والختم', m, y, 10, NAVY);
  drawLine(doc, m, y + 12, m + 45, BORDER, 0.3);

  // QR code (left-bottom)
  doc.addImage(qrDataUrl, 'PNG', m, y + 16, 20, 20);
  textCenter(doc, 'رمز التحقق', m + 10, y + 38, 6, GRAY);

  /* ═══════════════════════════════════════
     FOOTER (all pages)
     ═══════════════════════════════════════ */
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const pageH = doc.internal.pageSize.getHeight();

    doc.setFillColor(...NAVY);
    doc.rect(0, pageH - 10, pw, 10, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, pageH - 10, pw, 0.6, 'F');

    doc.setFont('Amiri');
    textCenter(doc, 'بيان أتعاب ومصاريف — وثيقة موقعة إلكترونياً', pw / 2, pageH - 4, 7, [200, 210, 220]);
  }

  return doc.output('blob');
};
