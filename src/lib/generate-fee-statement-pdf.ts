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
  items: FeeStatementItem[];
  lawyerFees: number;
  expensesTotal: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
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

/* ── helpers ── */
const NAVY: [number, number, number] = [15, 45, 80];
const GOLD: [number, number, number] = [180, 150, 80];
const LIGHT_BG: [number, number, number] = [248, 249, 252];
const BORDER: [number, number, number] = [220, 225, 235];

const drawLine = (doc: jsPDF, x1: number, y: number, x2: number, color: [number, number, number] = BORDER, w = 0.3) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(w);
  doc.line(x1, y, x2, y);
};

const textRight = (doc: jsPDF, text: string, x: number, y: number, size = 10, color: [number, number, number] = [30, 30, 50]) => {
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(text, x, y, { align: 'right' });
};

const textCenter = (doc: jsPDF, text: string, x: number, y: number, size = 10, color: [number, number, number] = [30, 30, 50]) => {
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(text, x, y, { align: 'center' });
};

const textLeft = (doc: jsPDF, text: string, x: number, y: number, size = 10, color: [number, number, number] = [30, 30, 50]) => {
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text(text, x, y, { align: 'left' });
};

export const generateFeeStatementPDF = async (data: FeeStatementData): Promise<Blob> => {
  const fontBase64 = await loadAmiriFont();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  doc.setFont('Amiri');
  // DO NOT call setR2L(true) — it double-reverses Arabic text

  const pw = 210;
  const m = 20;
  const cw = pw - m * 2;

  const verificationUrl = `${window.location.origin}/verify/${data.signatureUuid}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 1 });

  /* ═══════════════════════════════════════
     HEADER
     ═══════════════════════════════════════ */
  // Top accent bar
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 6, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 6, pw, 1, 'F');

  // Lawyer name
  textCenter(doc, data.lawyerName, pw / 2, 17, 18, NAVY);
  textCenter(doc, 'محامٍ لدى محاكم المملكة المغربية', pw / 2, 23, 9, [120, 120, 120]);

  // Gold divider
  drawLine(doc, m + 40, 27, pw - m - 40, GOLD, 0.5);

  // Title badge
  doc.setFillColor(...NAVY);
  doc.roundedRect(pw / 2 - 35, 30, 70, 11, 3, 3, 'F');
  textCenter(doc, 'بيان الأتعاب والمصاريف', pw / 2, 38, 14, [255, 255, 255]);

  // Number & date
  textRight(doc, `رقم: ${data.statementNumber}`, pw - m, 50, 9, [100, 100, 100]);
  textLeft(doc, `التاريخ: ${data.date}`, m, 50, 9, [100, 100, 100]);

  /* ═══════════════════════════════════════
     CLIENT INFO
     ═══════════════════════════════════════ */
  let y = 55;
  const clientCardH = data.powerOfAttorneyDate ? 16 : 12;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(m, y, cw, clientCardH, 3, 3, 'F');
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(m, y, cw, clientCardH, 3, 3, 'S');

  y += 7;
  textRight(doc, 'الموكل:', pw - m - 6, y, 9, [100, 110, 130]);
  textRight(doc, data.clientName, pw - m - 25, y, 11, NAVY);

  if (data.powerOfAttorneyDate) {
    textRight(doc, 'تاريخ التوكيل:', pw / 2, y, 9, [100, 110, 130]);
    textRight(doc, data.powerOfAttorneyDate, pw / 2 - 32, y, 10, [30, 30, 50]);
  }

  y = 55 + clientCardH + 6;

  /* ═══════════════════════════════════════
     PER-CASE SECTIONS
     ═══════════════════════════════════════ */
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    const cd = data.caseDetails[ci];

    // Page break check
    if (y > 230) {
      doc.addPage();
      y = 15;
    }

    // Case header bar
    doc.setFillColor(235, 240, 248);
    doc.roundedRect(m, y, cw, 10, 2, 2, 'F');
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.2);
    doc.roundedRect(m, y, cw, 10, 2, 2, 'S');

    const caseLabel = `ملف ${ci + 1}: ${cd.caseNumber} — ${cd.caseTitle}`;
    textRight(doc, caseLabel, pw - m - 4, y + 7, 10, NAVY);
    y += 14;

    // Expenses table
    if (cd.items.length > 0) {
      const tableBody = cd.items.map((item, i) => [
        fmtNum(item.amount) + ' درهم',
        item.description,
        String(i + 1),
      ]);

      autoTable(doc, {
        startY: y,
        head: [['المبلغ', 'البيان', 'رقم']],
        body: tableBody,
        styles: {
          font: 'Amiri',
          fontSize: 9,
          halign: 'right',
          cellPadding: 3,
          textColor: [30, 30, 30],
          lineColor: [...BORDER],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: [...NAVY],
          textColor: [255, 255, 255],
          fontSize: 9,
          halign: 'center',
        },
        alternateRowStyles: { fillColor: [...LIGHT_BG] },
        columnStyles: {
          0: { cellWidth: 35, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 12, halign: 'center' },
        },
        margin: { left: m, right: m },
        tableWidth: cw,
      });

      y = (doc as any).lastAutoTable.finalY + 4;
    }

    // Case summary rows
    const labelX = pw - m - 4;
    const valX = m + 10;
    const rowGap = 6;

    textRight(doc, 'مجموع المصاريف', labelX, y, 9, [100, 110, 130]);
    textLeft(doc, fmtNum(cd.expensesTotal) + ' درهم', valX, y, 9, [30, 30, 50]);
    y += rowGap;

    textRight(doc, 'أتعاب المحامي', labelX, y, 9, [100, 110, 130]);
    textLeft(doc, fmtNum(cd.lawyerFees) + ' درهم', valX, y, 9, [30, 30, 50]);
    y += rowGap;

    const caseTaxRate = cd.taxRate ?? data.taxRate;
    textRight(doc, `الضريبة (%${caseTaxRate})`, labelX, y, 9, [100, 110, 130]);
    textLeft(doc, fmtNum(cd.taxAmount) + ' درهم', valX, y, 9, [30, 30, 50]);
    y += rowGap + 2;

    // Case total pill
    doc.setFillColor(235, 240, 248);
    doc.roundedRect(m + 25, y - 2, cw - 50, 10, 3, 3, 'F');
    textCenter(doc, `مجموع الملف: ${fmtNum(cd.totalAmount)} درهم`, pw / 2, y + 5, 10, NAVY);
    y += 16;
  }

  /* ═══════════════════════════════════════
     GRAND TOTAL
     ═══════════════════════════════════════ */
  if (y > 240) {
    doc.addPage();
    y = 15;
  }

  // Grand total box
  doc.setFillColor(...NAVY);
  doc.roundedRect(m + 15, y, cw - 30, 24, 4, 4, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.roundedRect(m + 16, y + 1, cw - 32, 22, 3, 3, 'S');

  textCenter(doc, `HT: ${fmtNum(data.grandSubtotal)} — TVA: ${fmtNum(data.grandTaxAmount)}`, pw / 2, y + 8, 9, GOLD);
  textCenter(doc, `المبلغ الإجمالي ${fmtNum(data.grandTotal)} درهم`, pw / 2, y + 18, 15, [255, 255, 255]);

  y += 30;

  /* ═══════════════════════════════════════
     NOTES
     ═══════════════════════════════════════ */
  if (data.notes) {
    if (y > 250) { doc.addPage(); y = 15; }
    textRight(doc, 'ملاحظات:', pw - m, y, 9, [100, 110, 130]);
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(data.notes, cw - 20);
    doc.text(lines, pw - m - 22, y, { align: 'right' });
    y += lines.length * 5 + 5;
  }

  /* ═══════════════════════════════════════
     QR + SIGNATURE
     ═══════════════════════════════════════ */
  y = Math.max(y + 5, 230);
  if (y > 255) { doc.addPage(); y = 15; }

  // QR code (left side)
  doc.addImage(qrDataUrl, 'PNG', m + 3, y, 24, 24);
  textCenter(doc, 'رمز التحقق الإلكتروني', m + 15, y + 27, 7, [150, 150, 150]);

  // Signature (right side)
  textCenter(doc, 'توقيع المحامي', pw - m - 25, y + 5, 11, NAVY);
  drawLine(doc, pw - m - 50, y + 20, pw - m, GOLD, 0.4);

  /* ═══════════════════════════════════════
     FOOTER (all pages)
     ═══════════════════════════════════════ */
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const pageH = doc.internal.pageSize.getHeight();

    doc.setFillColor(...NAVY);
    doc.rect(0, pageH - 12, pw, 12, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, pageH - 12, pw, 0.8, 'F');

    doc.setFont('Amiri');
    textCenter(doc, 'بيان أتعاب ومصاريف — وثيقة موقعة إلكترونياً', pw / 2, pageH - 5, 8, [200, 210, 220]);
  }

  return doc.output('blob');
};
