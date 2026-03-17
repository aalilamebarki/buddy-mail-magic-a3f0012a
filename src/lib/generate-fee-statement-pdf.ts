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

const fmtNum = (n: number) => n.toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const generateFeeStatementPDF = async (data: FeeStatementData): Promise<Blob> => {
  const fontBase64 = await loadAmiriFont();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  doc.setFont('Amiri');
  doc.setR2L(true);

  const pw = 210;
  const m = 20;
  const cw = pw - m * 2;

  const verificationUrl = `${window.location.origin}/verify/${data.signatureUuid}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 1 });

  // ── Top bar ──
  doc.setFillColor(15, 45, 80);
  doc.rect(0, 0, pw, 7, 'F');
  doc.setFillColor(180, 150, 80);
  doc.rect(0, 7, pw, 1.2, 'F');

  // ── Lawyer name ──
  doc.setFontSize(18);
  doc.setTextColor(15, 45, 80);
  doc.text(data.lawyerName, pw / 2, 18, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('محامٍ لدى محاكم المملكة المغربية', pw / 2, 24, { align: 'center' });

  // ── Gold divider ──
  doc.setDrawColor(180, 150, 80);
  doc.setLineWidth(0.5);
  doc.line(m + 30, 28, pw - m - 30, 28);

  // ── Title ──
  doc.setFillColor(15, 45, 80);
  doc.roundedRect(pw / 2 - 38, 31, 76, 12, 3, 3, 'F');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('بيان الأتعاب والمصاريف', pw / 2, 40, { align: 'center' });

  // ── Number & Date ──
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`رقم: ${data.statementNumber}`, pw - m, 52, { align: 'right' });
  doc.text(`التاريخ: ${data.date}`, m, 52, { align: 'left' });

  // ── Client Info Card ──
  let y = 57;
  const cardHeight = 16 + (data.powerOfAttorneyDate ? 0 : -6);
  doc.setFillColor(248, 249, 252);
  doc.roundedRect(m, y, cw, Math.max(cardHeight, 14), 3, 3, 'F');
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.3);
  doc.roundedRect(m, y, cw, Math.max(cardHeight, 14), 3, 3, 'S');

  y += 7;
  doc.setFontSize(9);
  doc.setTextColor(100, 110, 130);
  doc.text('الموكل:', pw - m - 6, y, { align: 'right' });
  doc.setTextColor(20, 30, 50);
  doc.setFontSize(10);
  doc.text(data.clientName, pw - m - 30, y, { align: 'right' });

  if (data.powerOfAttorneyDate) {
    doc.setFontSize(9);
    doc.setTextColor(100, 110, 130);
    doc.text('تاريخ التوكيل:', pw / 2 - 4, y, { align: 'right' });
    doc.setTextColor(20, 30, 50);
    doc.text(data.powerOfAttorneyDate, pw / 2 - 38, y, { align: 'right' });
  }

  y += 14;

  // ── Per-Case Sections ──
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    const cd = data.caseDetails[ci];

    // Check if we need a new page
    if (y > 230) {
      doc.addPage();
      y = 15;
    }

    // Case header
    doc.setFillColor(235, 240, 248);
    doc.roundedRect(m, y, cw, 10, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setTextColor(15, 45, 80);
    const caseLabel = `ملف ${ci + 1}: ${cd.caseTitle} — رقم: ${cd.caseNumber}${cd.court ? ' — ' + cd.court : ''}`;
    doc.text(caseLabel, pw - m - 4, y + 7, { align: 'right' });
    y += 14;

    // Expenses table for this case
    if (cd.items.length > 0) {
      const tableBody = cd.items.map((item, i) => [
        fmtNum(item.amount) + ' درهم',
        item.description,
        String(i + 1),
      ]);

      autoTable(doc, {
        startY: y,
        head: [['المبلغ (درهم)', 'البيان', 'الرقم']],
        body: tableBody,
        styles: {
          font: 'Amiri',
          fontSize: 9,
          halign: 'right',
          cellPadding: 2.5,
          textColor: [30, 30, 30],
          lineColor: [220, 225, 235],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: [15, 45, 80],
          textColor: [255, 255, 255],
          fontSize: 9,
          halign: 'center',
        },
        alternateRowStyles: { fillColor: [248, 249, 252] },
        columnStyles: {
          0: { cellWidth: 35, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 12, halign: 'center' },
        },
        margin: { left: m, right: m },
        tableWidth: cw,
      });

      y = (doc as any).lastAutoTable.finalY + 3;
    }

    // Case totals
    const rX = pw - m;
    const vX = m + 40;
    const rH = 6;

    doc.setFontSize(9);
    doc.setTextColor(80, 90, 100);
    doc.text('مجموع المصاريف', rX, y, { align: 'right' });
    doc.setTextColor(30, 30, 50);
    doc.text(fmtNum(cd.expensesTotal) + ' درهم', vX, y, { align: 'left' });
    y += rH;

    doc.setTextColor(80, 90, 100);
    doc.text('أتعاب المحامي', rX, y, { align: 'right' });
    doc.setTextColor(30, 30, 50);
    doc.text(fmtNum(cd.lawyerFees) + ' درهم', vX, y, { align: 'left' });
    y += rH;

    doc.setTextColor(80, 90, 100);
    doc.text(`الضريبة (${data.taxRate}%)`, rX, y, { align: 'right' });
    doc.setTextColor(30, 30, 50);
    doc.text(fmtNum(cd.taxAmount) + ' درهم', vX, y, { align: 'left' });
    y += rH;

    // Case total box
    doc.setFillColor(240, 243, 248);
    doc.roundedRect(m + 20, y, cw - 40, 10, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setTextColor(15, 45, 80);
    doc.text(`مجموع الملف: ${fmtNum(cd.totalAmount)} درهم`, pw / 2, y + 7, { align: 'center' });
    y += 16;
  }

  // ── Grand Total Box ──
  if (y > 240) {
    doc.addPage();
    y = 15;
  }

  doc.setFillColor(15, 45, 80);
  doc.roundedRect(m + 10, y, cw - 20, 22, 4, 4, 'F');
  doc.setDrawColor(180, 150, 80);
  doc.setLineWidth(0.5);
  doc.roundedRect(m + 11, y + 1, cw - 22, 20, 3, 3, 'S');

  doc.setFontSize(9);
  doc.setTextColor(180, 150, 80);
  doc.text(`HT: ${fmtNum(data.grandSubtotal)} — TVA: ${fmtNum(data.grandTaxAmount)}`, pw / 2, y + 7, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('المبلغ الإجمالي: ' + fmtNum(data.grandTotal) + ' درهم', pw / 2, y + 17, { align: 'center' });

  y += 28;

  // ── Notes ──
  if (data.notes) {
    if (y > 250) { doc.addPage(); y = 15; }
    doc.setFontSize(9);
    doc.setTextColor(100, 110, 130);
    doc.text('ملاحظات:', pw - m, y, { align: 'right' });
    doc.setTextColor(50, 50, 50);
    const lines = doc.splitTextToSize(data.notes, cw - 20);
    doc.text(lines, pw - m - 25, y, { align: 'right' });
    y += lines.length * 5;
  }

  // ── QR + Signature ──
  y = Math.max(y + 10, 230);
  if (y > 260) { doc.addPage(); y = 15; }
  doc.addImage(qrDataUrl, 'PNG', m + 5, y, 25, 25);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('رمز التحقق', m + 17, y + 28, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(15, 45, 80);
  doc.text('توقيع المحامي', pw - m - 25, y + 5, { align: 'center' });
  doc.setDrawColor(180, 150, 80);
  doc.setLineWidth(0.4);
  doc.line(pw - m - 50, y + 22, pw - m, y + 22);

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(15, 45, 80);
    doc.rect(0, pageH - 12, pw, 12, 'F');
    doc.setFillColor(180, 150, 80);
    doc.rect(0, pageH - 12, pw, 1, 'F');
    doc.setFont('Amiri');
    doc.setFontSize(8);
    doc.setTextColor(200, 210, 220);
    doc.text('بيان أتعاب ومصاريف — وثيقة موقعة إلكترونياً', pw / 2, pageH - 5, { align: 'center' });
  }

  return doc.output('blob');
};
