import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface LetterheadInfo {
  lawyerName: string;
  nameFr?: string | null;
  titleAr?: string | null;
  titleFr?: string | null;
  barNameAr?: string | null;
  barNameFr?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface InvoiceData {
  invoiceNumber: string;
  signatureUuid: string;
  clientName: string;
  caseName?: string;
  caseNumber?: string;
  caseType?: string;
  amount: number;
  description?: string;
  paymentMethod: string;
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

const PAYMENT_METHODS: Record<string, string> = {
  cash: 'نقداً',
  check: 'شيك',
  transfer: 'تحويل بنكي',
  card: 'بطاقة بنكية',
};

const BLACK: [number, number, number] = [0, 0, 0];
const GRAY: [number, number, number] = [100, 100, 100];
const LIGHT_GRAY: [number, number, number] = [180, 180, 180];
const BORDER: [number, number, number] = [200, 200, 200];

/** Convert number to Arabic words */
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
      const tParts: string[] = [];
      if (tH > 0) tParts.push(hundreds[tH]);
      if (tR >= 10 && tR < 20) tParts.push(teens[tR - 10]);
      else {
        const tO = tR % 10;
        const tT = Math.floor(tR / 10);
        if (tO > 0) tParts.push(ones[tO]);
        if (tT > 0) tParts.push(tens[tT]);
      }
      parts.push(tParts.join(' و') + ' ألف');
    }
  }

  if (remainder > 0) {
    const rH = Math.floor(remainder / 100);
    const rR = remainder % 100;
    if (rH > 0) parts.push(hundreds[rH]);
    if (rR >= 10 && rR < 20) parts.push(teens[rR - 10]);
    else {
      const rO = rR % 10;
      const rT = Math.floor(rR / 10);
      if (rO > 0 && rT > 0) parts.push(`${ones[rO]} و${tens[rT]}`);
      else if (rO > 0) parts.push(ones[rO]);
      else if (rT > 0) parts.push(tens[rT]);
    }
  }

  return `فقط ${parts.join(' و')} درهم مغربي لا غير.`;
};

export const generateInvoicePDF = async (data: InvoiceData): Promise<Blob> => {
  const fontBase64 = await loadAmiriFont();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  doc.setFont('Amiri');

  const pw = 210;
  const m = 20;
  const cw = pw - m * 2;
  const rightX = pw - m;

  const lh = data.letterhead;
  const lawyerName = lh?.lawyerName || data.lawyerName;
  const titleAr = lh?.titleAr || '';
  const barNameAr = lh?.barNameAr || '';
  const city = lh?.city || '';
  const address = lh?.address || '';
  const phone = lh?.phone || '';
  const email = lh?.email || '';

  // QR
  const verificationUrl = `${window.location.origin}/verify/${data.signatureUuid}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 1 });

  let y = 20;

  // ── Lawyer Name ──
  doc.setFontSize(16);
  doc.setTextColor(...BLACK);
  doc.text(`الأستاذ ${lawyerName}`, rightX, y, { align: 'right' });
  y += 7;

  if (titleAr || barNameAr) {
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    const subtitle = [titleAr, barNameAr].filter(Boolean).join(' — ');
    doc.text(subtitle, rightX, y, { align: 'right' });
    y += 6;
  }

  // Contact info on same side
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  const contactParts = [address, city, phone, email].filter(Boolean);
  if (contactParts.length) {
    doc.text(contactParts.join(' • '), rightX, y, { align: 'right' });
    y += 6;
  }

  // ── Separator ──
  y += 2;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(m, y, rightX, y);
  y += 12;

  // ── Title ──
  doc.setFontSize(20);
  doc.setTextColor(...BLACK);
  doc.text('وصل أداء', pw / 2, y, { align: 'center' });
  y += 10;

  // Invoice number & date
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`رقم: ${data.invoiceNumber}`, rightX, y, { align: 'right' });
  doc.text(data.date, m, y, { align: 'left' });
  y += 12;

  // ── Client & Case info ──
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text(`الموكل: ${data.clientName}`, rightX, y, { align: 'right' });
  y += 7;

  if (data.caseNumber) {
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text(`رقم الملف: ${data.caseNumber}`, rightX, y, { align: 'right' });
    y += 7;
  }

  if (data.caseType || data.caseName) {
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text(`الموضوع: ${data.caseType || data.caseName}`, rightX, y, { align: 'right' });
    y += 7;
  }

  y += 8;

  // ── Separator ──
  doc.setDrawColor(...BORDER);
  doc.line(m, y, rightX, y);
  y += 10;

  // ── Amount ──
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text('المبلغ المستلم:', rightX, y, { align: 'right' });

  doc.setFontSize(18);
  doc.setTextColor(...BLACK);
  const amountStr = `${data.amount.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} درهم`;
  doc.text(amountStr, rightX, y + 10, { align: 'right' });
  y += 22;

  // Amount in words
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(numberToArabicWords(data.amount), rightX, y, { align: 'right' });
  y += 10;

  // Payment method
  const paymentMethodText = PAYMENT_METHODS[data.paymentMethod] || data.paymentMethod;
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text(`طريقة الأداء: ${paymentMethodText}`, rightX, y, { align: 'right' });
  y += 8;

  if (data.description) {
    doc.text(`البيان: ${data.description}`, rightX, y, { align: 'right' });
    y += 8;
  }

  y += 6;

  // ── Legal text ──
  doc.setDrawColor(...BORDER);
  doc.line(m, y, rightX, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  const legalText = `يشهد مكتب الأستاذ ${lawyerName} باستلام المبلغ المذكور أعلاه من السيد(ة) ${data.clientName}، ويعتبر هذا الوصل بمثابة إبراء ذمة بخصوص هذا الدفع.`;
  const splitText = doc.splitTextToSize(legalText, cw);
  doc.text(splitText, rightX, y, { align: 'right' });
  y += splitText.length * 6 + 10;

  // ── Date & City ──
  if (city) {
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text(`حرر ب${city} في: ${data.date}`, rightX, y, { align: 'right' });
    y += 14;
  }

  // ── Signature ──
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text('التوقيع والختم', rightX, y, { align: 'right' });
  y += 20;
  doc.setDrawColor(...LIGHT_GRAY);
  doc.setLineWidth(0.3);
  doc.line(rightX - 50, y, rightX, y);

  // ── QR Code - bottom left ──
  const qrSize = 18;
  const qrY = 260;
  doc.addImage(qrDataUrl, 'PNG', m, qrY, qrSize, qrSize);
  doc.setFontSize(6);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text('رمز التحقق', m + qrSize / 2, qrY + qrSize + 3, { align: 'center' });

  // ── Footer ──
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(m, 285, rightX, 285);
  doc.setFontSize(7);
  doc.setTextColor(...LIGHT_GRAY);
  doc.text('وثيقة موقعة إلكترونياً', pw / 2, 289, { align: 'center' });

  return doc.output('blob');
};
