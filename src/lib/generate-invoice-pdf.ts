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

// Load Amiri font for Arabic support
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

export const generateInvoicePDF = async (data: InvoiceData): Promise<Blob> => {
  const fontBase64 = await loadAmiriFont();
  
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  // Add Amiri font
  doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  doc.setFont('Amiri');

  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // QR Code with verification data
  const verificationUrl = `${window.location.origin}/verify/${data.signatureUuid}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 1 });

  // --- Header ---
  doc.setFontSize(18);
  doc.setTextColor(30, 58, 95); // legal-navy
  const headerText = data.lawyerName;
  doc.text(headerText, pageWidth - margin, 25, { align: 'right' });

  // Divider
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.line(margin, 32, pageWidth - margin, 32);

  // --- Title ---
  doc.setFontSize(22);
  doc.setTextColor(0, 0, 0);
  doc.text('وصل أداء أتعاب', pageWidth / 2, 45, { align: 'center' });

  // Invoice number & date
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`رقم الوصل: ${data.invoiceNumber}`, pageWidth - margin, 55, { align: 'right' });
  doc.text(`التاريخ: ${data.date}`, margin, 55, { align: 'left' });

  // --- Body table ---
  let y = 70;
  const rowHeight = 12;
  const labelX = pageWidth - margin;
  const valueX = pageWidth - margin - 55;

  const drawRow = (label: string, value: string) => {
    // Background alternating
    if (Math.floor((y - 70) / rowHeight) % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, y - 4, contentWidth, rowHeight, 'F');
    }
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text(label, labelX, y + 3, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    doc.text(value, valueX, y + 3, { align: 'right' });
    y += rowHeight;
  };

  drawRow('اسم الموكل:', data.clientName);
  if (data.caseName) drawRow('الملف:', data.caseName);
  if (data.caseNumber) drawRow('رقم الملف:', data.caseNumber);
  drawRow('طريقة الأداء:', PAYMENT_METHODS[data.paymentMethod] || data.paymentMethod);
  if (data.description) drawRow('البيان:', data.description);

  // Amount box
  y += 8;
  doc.setFillColor(30, 58, 95);
  doc.roundedRect(margin + 30, y, contentWidth - 60, 20, 3, 3, 'F');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  const amountText = `المبلغ المؤدى: ${data.amount.toLocaleString('ar-u-nu-latn')} درهم`;
  doc.text(amountText, pageWidth / 2, y + 13, { align: 'center' });

  // --- QR Code + Signature ---
  y += 35;
  doc.addImage(qrDataUrl, 'PNG', margin, y, 30, 30);
  
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('رمز التحقق الإلكتروني', margin + 15, y + 34, { align: 'center' });
  doc.text(data.signatureUuid.slice(0, 18) + '...', margin + 15, y + 38, { align: 'center' });

  // Signature area
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('توقيع المحامي', pageWidth - margin - 25, y + 5, { align: 'center' });
  doc.setDrawColor(180, 180, 180);
  doc.line(pageWidth - margin - 50, y + 25, pageWidth - margin, y + 25);

  // Footer
  const footerY = 280;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('وثيقة موقعة إلكترونياً — أي تزوير يعرض صاحبه للمتابعة القانونية', pageWidth / 2, footerY, { align: 'center' });

  return doc.output('blob');
};
