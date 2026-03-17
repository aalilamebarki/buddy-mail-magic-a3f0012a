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

const BLACK: [number, number, number] = [0, 0, 0];
const GRAY: [number, number, number] = [100, 100, 100];
const LIGHT_GRAY: [number, number, number] = [180, 180, 180];
const BORDER: [number, number, number] = [200, 200, 200];

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
     Right side: Arabic | Left side: French
     ═══════════════════════════════════════ */

  // Right side - Arabic name
  doc.setFontSize(18);
  doc.setTextColor(...BLACK);
  doc.text(`الأستاذ ${lawyerName}`, rightX, y, { align: 'right' });

  // Left side - French name
  if (nameFr) {
    doc.setFontSize(12);
    doc.setTextColor(...BLACK);
    doc.text(`Maître ${nameFr}`, m, y, { align: 'left' });
  }

  y += 8;

  // Arabic title & bar
  if (titleAr || barNameAr) {
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    const arTitle = [titleAr, barNameAr ? `هيئة ${barNameAr}` : ''].filter(Boolean).join(' ');
    doc.text(arTitle, rightX, y, { align: 'right' });
  }

  // French title & bar
  if (titleFr || barNameFr) {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    const frTitle = [titleFr, barNameFr ? `au Barreau de ${barNameFr}` : ''].filter(Boolean).join(' ');
    doc.text(frTitle, m, y, { align: 'left' });
  }

  y += 6;

  // Phone on the left
  if (phone) {
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`Tél: ${phone}`, m, y, { align: 'left' });
    y += 4;
  }

  // Separator lines
  y += 2;
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.5);
  doc.line(m, y, rightX, y);
  y += 1;
  doc.setLineWidth(0.3);
  doc.line(m + 20, y + 1, rightX - 20, y + 1);
  y += 5;

  // Address (centered)
  if (address) {
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);
    const fullAddr = [address, city ? `-${city}` : ''].filter(Boolean).join(' ');
    doc.text(fullAddr, pw / 2, y, { align: 'center' });
    y += 5;
  }

  // Email (centered)
  if (email) {
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`E-mail : ${email}`, pw / 2, y, { align: 'center' });
    y += 5;
  }

  // City & Date
  y += 3;
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  if (city) {
    doc.text(`${city} في: ${data.date}`, rightX, y, { align: 'right' });
  } else {
    doc.text(data.date, rightX, y, { align: 'right' });
  }
  y += 12;

  // ── Title ──
  doc.setFontSize(20);
  doc.setTextColor(...BLACK);
  doc.text('بيان أتعاب ومصاريف', pw / 2, y, { align: 'center' });
  y += 4;
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.5);
  const titleW = 55;
  doc.line(pw / 2 - titleW / 2, y, pw / 2 + titleW / 2, y);
  y += 8;

  // Ref number
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text(`رقم المرجع: ${data.statementNumber}`, pw / 2, y, { align: 'center' });
  y += 10;

  // ── Client info ──
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text(`الموكل: ${data.clientName}`, rightX, y, { align: 'right' });
  y += 7;

  if (data.clientCin) {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(`رقم البطاقة الوطنية: ${data.clientCin}`, rightX, y, { align: 'right' });
    y += 6;
  }

  if (data.powerOfAttorneyDate) {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(`تاريخ الوكالة: ${data.powerOfAttorneyDate}`, rightX, y, { align: 'right' });
    y += 6;
  }

  y += 6;

  // ── Case details ──
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    const cd = data.caseDetails[ci];

    if (y > 240) { doc.addPage(); y = 20; }

    // Case header
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(m, y, rightX, y);
    y += 8;

    doc.setFontSize(11);
    doc.setTextColor(...BLACK);
    const caseLabel = data.caseDetails.length > 1 ? `ملف ${ci + 1}: ` : '';
    doc.text(`${caseLabel}${cd.caseTitle}`, rightX, y, { align: 'right' });
    y += 6;

    if (cd.caseNumber) {
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text(`رقم الملف: ${cd.caseNumber}`, rightX, y, { align: 'right' });
      y += 5;
    }
    if (cd.court) {
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text(`المحكمة: ${cd.court}`, rightX, y, { align: 'right' });
      y += 5;
    }

    y += 6;

    // Items table header
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text('البيان', rightX - 2, y, { align: 'right' });
    doc.text('المبلغ (درهم)', m + 2, y, { align: 'left' });
    y += 2;
    doc.setDrawColor(...BORDER);
    doc.line(m, y, rightX, y);
    y += 6;

    // Items
    doc.setFontSize(10);
    for (const item of cd.items) {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setTextColor(...BLACK);
      doc.text(item.description, rightX - 2, y, { align: 'right' });
      doc.text(fmtNum(item.amount), m + 2, y, { align: 'left' });
      y += 6;
    }

    y += 2;
    doc.setDrawColor(...BORDER);
    doc.line(m + 40, y, rightX, y);
    y += 6;

    // Summary rows
    const drawSummaryRow = (label: string, value: string, bold = false) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(bold ? 11 : 10);
      doc.setTextColor(...BLACK);
      doc.text(label, rightX - 2, y, { align: 'right' });
      doc.text(value, m + 2, y, { align: 'left' });
      y += 6;
    };

    drawSummaryRow('المصاريف', fmtNum(cd.expensesTotal));
    drawSummaryRow('الأتعاب', fmtNum(cd.lawyerFees));
    drawSummaryRow('المجموع (HT)', fmtNum(cd.subtotal));
    if (cd.taxRate > 0) {
      drawSummaryRow(`الضريبة (${cd.taxRate}%)`, fmtNum(cd.taxAmount));
    }
    drawSummaryRow('المجموع (TTC)', fmtNum(cd.totalAmount), true);

    y += 4;
  }

  // ── Grand total (multi-case) ──
  if (data.caseDetails.length > 1) {
    if (y > 250) { doc.addPage(); y = 20; }
    y += 4;
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.5);
    doc.line(m, y, rightX, y);
    y += 8;

    doc.setFontSize(13);
    doc.setTextColor(...BLACK);
    doc.text('المجموع الإجمالي (TTC)', rightX - 2, y, { align: 'right' });
    doc.text(`${fmtNum(data.grandTotal)} درهم`, m + 2, y, { align: 'left' });
    y += 10;
  }

  // ── Notes ──
  if (data.notes) {
    if (y > 255) { doc.addPage(); y = 20; }
    y += 4;
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text('ملاحظات:', rightX, y, { align: 'right' });
    y += 5;
    doc.setTextColor(...BLACK);
    const lines = doc.splitTextToSize(data.notes, cw);
    doc.text(lines, rightX, y, { align: 'right' });
    y += lines.length * 5 + 5;
  }

  // ── Signature ──
  y = Math.max(y + 10, 230);
  if (y > 260) { doc.addPage(); y = 30; }

  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text('التوقيع والختم', rightX, y, { align: 'right' });
  y += 20;
  doc.setDrawColor(...LIGHT_GRAY);
  doc.setLineWidth(0.3);
  doc.line(rightX - 50, y, rightX, y);

  // ── QR Code ──
  const qrSize = 18;
  doc.addImage(qrDataUrl, 'PNG', m, y - 18, qrSize, qrSize);
  doc.setFontSize(6);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text('رمز التحقق', m + qrSize / 2, y - 18 + qrSize + 3, { align: 'center' });

  // ── Footer (all pages) ──
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
