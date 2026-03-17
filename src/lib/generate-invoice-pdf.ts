import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface InvoiceData {
  invoiceNumber: string;
  signatureUuid: string;
  clientName: string;
  caseName?: string;
  caseNumber?: string;
  amount: number;
  description?: string;
  paymentMethod: string;
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

const PAYMENT_METHODS: Record<string, string> = {
  cash: 'نقداً',
  check: 'شيك',
  transfer: 'تحويل بنكي',
  card: 'بطاقة بنكية',
};

const drawRoundedRect = (doc: jsPDF, x: number, y: number, w: number, h: number, r: number, fillColor: [number, number, number]) => {
  doc.setFillColor(...fillColor);
  doc.roundedRect(x, y, w, h, r, r, 'F');
};

export const generateInvoicePDF = async (data: InvoiceData): Promise<Blob> => {
  const fontBase64 = await loadAmiriFont();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  doc.setFont('Amiri');
  doc.setR2L(true);

  const pw = 210;
  const m = 25;
  const cw = pw - m * 2;

  // QR
  const verificationUrl = `${window.location.origin}/verify/${data.signatureUuid}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 1 });

  // ── Decorative top bar ──
  doc.setFillColor(15, 45, 80);
  doc.rect(0, 0, pw, 8, 'F');
  doc.setFillColor(180, 150, 80);
  doc.rect(0, 8, pw, 1.5, 'F');

  // ── Lawyer name ──
  doc.setFontSize(20);
  doc.setTextColor(15, 45, 80);
  doc.text(data.lawyerName, pw / 2, 22, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text('محامٍ لدى محاكم المملكة المغربية', pw / 2, 29, { align: 'center' });

  // ── Gold divider ──
  doc.setDrawColor(180, 150, 80);
  doc.setLineWidth(0.6);
  doc.line(m + 20, 34, pw - m - 20, 34);

  // ── Title ──
  drawRoundedRect(doc, pw / 2 - 35, 39, 70, 14, 3, [15, 45, 80]);
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('وصل أداء أتعاب', pw / 2, 49, { align: 'center' });

  // ── Invoice number & date ──
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`رقم: ${data.invoiceNumber}`, pw - m, 62, { align: 'right' });
  doc.text(`التاريخ: ${data.date}`, m, 62, { align: 'left' });

  // ── Details Card ──
  let y = 72;
  const cardPad = 6;
  const rowH = 11;

  // Card background
  drawRoundedRect(doc, m, y, cw, rowH * 6 + cardPad * 2, 4, [248, 249, 252]);
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.3);
  doc.roundedRect(m, y, cw, rowH * 6 + cardPad * 2, 4, 4, 'S');

  y += cardPad + 2;

  const drawDetailRow = (label: string, value: string, isLast = false) => {
    doc.setFontSize(11);
    doc.setTextColor(100, 110, 130);
    doc.text(label, pw - m - 8, y + 3, { align: 'right' });
    doc.setTextColor(20, 30, 50);
    doc.text(value, pw - m - 55, y + 3, { align: 'right' });
    if (!isLast) {
      doc.setDrawColor(230, 233, 240);
      doc.setLineWidth(0.2);
      doc.line(m + 8, y + 7, pw - m - 8, y + 7);
    }
    y += rowH;
  };

  drawDetailRow('الموكل', data.clientName);
  drawDetailRow('الملف', data.caseName || '—');
  drawDetailRow('رقم الملف', data.caseNumber || '—');
  drawDetailRow('طريقة الأداء', PAYMENT_METHODS[data.paymentMethod] || data.paymentMethod);
  drawDetailRow('البيان', data.description || '—');
  drawDetailRow('الحالة', 'مؤدى', true);

  // ── Amount Box ──
  y += 16;
  drawRoundedRect(doc, m + 15, y, cw - 30, 22, 5, [15, 45, 80]);
  // Gold inner border
  doc.setDrawColor(180, 150, 80);
  doc.setLineWidth(0.5);
  doc.roundedRect(m + 16, y + 1, cw - 32, 20, 4, 4, 'S');
  
  doc.setFontSize(12);
  doc.setTextColor(180, 150, 80);
  doc.text('المبلغ المؤدى', pw / 2, y + 8, { align: 'center' });
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(`${data.amount.toLocaleString('ar-u-nu-latn')} درهم`, pw / 2, y + 18, { align: 'center' });

  // ── QR + Signature ──
  y += 35;
  // QR Section
  doc.addImage(qrDataUrl, 'PNG', m + 5, y, 28, 28);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('رمز التحقق الإلكتروني', m + 19, y + 32, { align: 'center' });

  // Signature section
  doc.setFontSize(11);
  doc.setTextColor(15, 45, 80);
  doc.text('توقيع المحامي', pw - m - 25, y + 5, { align: 'center' });
  doc.setDrawColor(180, 150, 80);
  doc.setLineWidth(0.4);
  doc.line(pw - m - 50, y + 25, pw - m, y + 25);

  // ── Footer ──
  const footerY = 278;
  doc.setFillColor(15, 45, 80);
  doc.rect(0, footerY, pw, 20, 'F');
  doc.setFillColor(180, 150, 80);
  doc.rect(0, footerY, pw, 1, 'F');
  doc.setFontSize(8);
  doc.setTextColor(200, 210, 220);
  doc.text('وثيقة موقعة إلكترونياً — أي تزوير يعرض صاحبه للمتابعة القانونية', pw / 2, footerY + 7, { align: 'center' });

  return doc.output('blob');
};
