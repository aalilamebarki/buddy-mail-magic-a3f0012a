import jsPDF from 'jspdf';
import 'jspdf-autotable';
import QRCode from 'qrcode';

export interface FeeStatementItem {
  description: string;
  amount: number;
}

export interface FeeStatementData {
  statementNumber: string;
  signatureUuid: string;
  clientName: string;
  clientCin?: string;
  clientPhone?: string;
  caseName?: string;
  caseNumber?: string;
  court?: string;
  powerOfAttorneyDate?: string;
  items: FeeStatementItem[];
  lawyerFees: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  totalAmount: number;
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

  // ── Client & Case Info Card ──
  let y = 57;
  doc.setFillColor(248, 249, 252);
  doc.roundedRect(m, y, cw, 36, 3, 3, 'F');
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.3);
  doc.roundedRect(m, y, cw, 36, 3, 3, 'S');

  const infoCol1X = pw - m - 6;
  const infoCol2X = pw / 2 - 4;
  y += 7;

  const drawInfo = (label: string, value: string, x: number, yPos: number) => {
    doc.setFontSize(9);
    doc.setTextColor(100, 110, 130);
    doc.text(label, x, yPos, { align: 'right' });
    doc.setTextColor(20, 30, 50);
    doc.setFontSize(10);
    doc.text(value, x - 30, yPos, { align: 'right' });
  };

  drawInfo('الموكل:', data.clientName, infoCol1X, y);
  drawInfo('رقم الملف:', data.caseNumber || '—', infoCol2X, y);
  y += 9;
  drawInfo('الملف:', data.caseName || '—', infoCol1X, y);
  drawInfo('المحكمة:', data.court || '—', infoCol2X, y);
  y += 9;
  drawInfo('تاريخ التوكيل:', data.powerOfAttorneyDate || '—', infoCol1X, y);
  if (data.clientCin) drawInfo('ب.ت.و:', data.clientCin, infoCol2X, y);

  // ── Expenses Table ──
  y = 100;
  doc.setFontSize(11);
  doc.setTextColor(15, 45, 80);
  doc.text('تفصيل المصاريف القضائية', pw - m, y, { align: 'right' });
  y += 3;

  const tableBody = data.items.map((item, i) => [
    fmtNum(item.amount) + ' درهم',
    item.description,
    String(i + 1),
  ]);

  (doc as any).autoTable({
    startY: y,
    head: [['المبلغ (درهم)', 'البيان', 'الرقم']],
    body: tableBody,
    styles: {
      font: 'Amiri',
      fontSize: 10,
      halign: 'right',
      cellPadding: 3,
      textColor: [30, 30, 30],
      lineColor: [220, 225, 235],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 45, 80],
      textColor: [255, 255, 255],
      fontSize: 10,
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 249, 252],
    },
    columnStyles: {
      0: { cellWidth: 40, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 15, halign: 'center' },
    },
    margin: { left: m, right: m },
    tableWidth: cw,
  });

  // ── Totals Section ──
  y = (doc as any).lastAutoTable.finalY + 6;
  const totalsX = pw - m;
  const totalsValX = m + 45;
  const rH = 8;

  const expensesTotal = data.items.reduce((s, i) => s + i.amount, 0);

  const drawTotalRow = (label: string, value: string, isBold = false) => {
    doc.setFontSize(isBold ? 12 : 10);
    doc.setTextColor(isBold ? 15 : 60, isBold ? 45 : 70, isBold ? 80 : 90);
    doc.text(label, totalsX, y, { align: 'right' });
    doc.setTextColor(isBold ? 15 : 30, isBold ? 45 : 30, isBold ? 80 : 50);
    doc.text(value, totalsValX, y, { align: 'left' });
    if (!isBold) {
      doc.setDrawColor(230, 233, 240);
      doc.setLineWidth(0.15);
      doc.line(m + 10, y + 3, pw - m - 10, y + 3);
    }
    y += rH;
  };

  drawTotalRow('مجموع المصاريف القضائية', fmtNum(expensesTotal) + ' درهم');
  drawTotalRow('أتعاب المحامي', fmtNum(data.lawyerFees) + ' درهم');
  drawTotalRow(`الضريبة (${data.taxRate}%)`, fmtNum(data.taxAmount) + ' درهم');

  // Total box
  y += 2;
  doc.setFillColor(15, 45, 80);
  doc.roundedRect(m + 20, y, cw - 40, 16, 4, 4, 'F');
  doc.setDrawColor(180, 150, 80);
  doc.setLineWidth(0.5);
  doc.roundedRect(m + 21, y + 1, cw - 42, 14, 3, 3, 'S');

  doc.setFontSize(10);
  doc.setTextColor(180, 150, 80);
  doc.text('المبلغ الإجمالي', pw / 2, y + 6, { align: 'center' });
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(fmtNum(data.totalAmount) + ' درهم', pw / 2, y + 14, { align: 'center' });

  // ── Notes ──
  if (data.notes) {
    y += 24;
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
  doc.setFillColor(15, 45, 80);
  doc.rect(0, 280, pw, 17, 'F');
  doc.setFillColor(180, 150, 80);
  doc.rect(0, 280, pw, 1, 'F');
  doc.setFontSize(8);
  doc.setTextColor(200, 210, 220);
  doc.text('بيان أتعاب ومصاريف — وثيقة موقعة إلكترونياً', pw / 2, 287, { align: 'center' });

  return doc.output('blob');
};
