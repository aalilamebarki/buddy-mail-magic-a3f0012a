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

const NAVY: [number, number, number] = [15, 45, 80];
const GOLD: [number, number, number] = [180, 150, 80];
const LIGHT_BG: [number, number, number] = [245, 247, 250];
const BORDER: [number, number, number] = [220, 225, 235];
const GRAY: [number, number, number] = [120, 120, 120];

/** Convert number to Arabic words (simplified for common amounts) */
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
  const m = 25;
  const cw = pw - m * 2;
  const cx = pw / 2;

  const lh = data.letterhead;
  const lawyerName = lh?.lawyerName || data.lawyerName;
  const titleAr = lh?.titleAr || 'محامٍ';
  const city = lh?.city || '';
  const address = lh?.address || '';
  const phone = lh?.phone || '';
  const email = lh?.email || '';
  const barNameAr = lh?.barNameAr || '';

  // QR
  const verificationUrl = `${window.location.origin}/verify/${data.signatureUuid}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 1 });

  // ── Header: Navy top bar ──
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 6, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 6, pw, 1, 'F');

  // ── Lawyer office name ──
  let y = 18;
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text(`مكتب الأستاذ`, cx, y, { align: 'center' });
  y += 10;
  doc.setFontSize(24);
  doc.text(lawyerName, cx, y, { align: 'center' });
  y += 8;

  // Title (e.g., محاج لدى المجلس)
  if (titleAr || barNameAr) {
    doc.setFontSize(12);
    doc.setTextColor(...GOLD);
    const subtitle = [titleAr, barNameAr ? `لدى ${barNameAr}` : ''].filter(Boolean).join(' ');
    doc.text(subtitle, cx, y, { align: 'center' });
    y += 10;
  } else {
    y += 6;
  }

  // ── Contact info ──
  if (address || phone || email) {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);

    if (address) {
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text('المقر الاجتماعي', cx, y, { align: 'center' });
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      const fullAddr = [address, city].filter(Boolean).join('، ');
      doc.text(fullAddr, cx, y, { align: 'center' });
      y += 5;
    }
    if (phone) {
      doc.text(`الهاتف: ${phone}`, cx, y, { align: 'center' });
      y += 5;
    }
    if (email) {
      doc.text(`البريد الإلكتروني: ${email}`, cx, y, { align: 'center' });
      y += 5;
    }
    y += 3;
  }

  // ── Divider ──
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(m + 10, y, pw - m - 10, y);
  y += 10;

  // ── Title: وصل أداء ──
  doc.setFontSize(26);
  doc.setTextColor(...NAVY);
  doc.text('وصل أداء', cx, y, { align: 'center' });
  y += 3;
  // Underline
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  const titleWidth = 42;
  doc.line(cx - titleWidth / 2, y, cx + titleWidth / 2, y);
  y += 8;

  // Receipt number
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text(`رقم الوصل: ${data.invoiceNumber}`, cx, y, { align: 'center' });
  y += 12;

  // ── Client Info Card ──
  const cardH = data.caseType ? 65 : 52;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(m + 10, y, cw - 20, cardH, 3, 3, 'F');
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(m + 10, y, cw - 20, cardH, 3, 3, 'S');
  // Left border accent
  doc.setFillColor(...NAVY);
  doc.rect(pw - m - 10 - 3, y + 3, 3, cardH - 6, 'F');

  let cardY = y + 10;

  // الموكل
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text('الموكل', cx, cardY, { align: 'center' });
  cardY += 7;
  doc.setFontSize(14);
  doc.setTextColor(20, 30, 50);
  doc.text(data.clientName, cx, cardY, { align: 'center' });
  cardY += 10;

  // رقم الملف
  if (data.caseNumber || data.caseName) {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text('رقم الملف', cx, cardY, { align: 'center' });
    cardY += 6;
    doc.setFontSize(11);
    doc.setTextColor(20, 30, 50);
    const caseRef = data.caseNumber ? `#${data.caseNumber}` : (data.caseName || '—');
    doc.text(caseRef, cx, cardY, { align: 'center' });
    cardY += 9;
  }

  // موضوع الملف
  if (data.caseType || data.caseName) {
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text('موضوع الملف', cx, cardY, { align: 'center' });
    cardY += 6;
    doc.setFontSize(11);
    doc.setTextColor(20, 30, 50);
    doc.text(data.caseType || data.caseName || '—', cx, cardY, { align: 'center' });
  }

  y += cardH + 14;

  // ── Amount Section ──
  // Amount label
  doc.setFontSize(11);
  doc.setTextColor(20, 30, 50);
  doc.text('المبلغ الإجمالي المستلم:', pw - m, y, { align: 'right' });

  // Amount value - large
  doc.setFontSize(28);
  doc.setTextColor(...NAVY);
  const amountStr = `MAD  ${data.amount.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  doc.text(amountStr, m, y + 2, { align: 'left' });
  y += 12;

  // Amount in words
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text('المبلغ بالحروف:', pw - m, y, { align: 'right' });
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const amountWords = numberToArabicWords(data.amount);
  doc.text(amountWords, pw - m - 28, y, { align: 'right' });
  y += 16;

  // ── Legal paragraph ──
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  const paymentMethodText = PAYMENT_METHODS[data.paymentMethod] || data.paymentMethod;
  const legalText = `يشهد مكتب الأستاذ ${lawyerName} باستلام المبلغ المذكور أعلاه من السيد(ة) ${data.clientName}، وذلك رسم مستحقات الملف المشار إليه أعلاه، ويعتبر هذا الوصل بمثابة إبراء ذمة نهائي بخصوص هذا الدفع.`;

  const splitText = doc.splitTextToSize(legalText, cw - 10);
  doc.text(splitText, pw - m, y, { align: 'right' });
  y += splitText.length * 7 + 5;

  if (data.description) {
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text(`البيان: ${data.description}`, pw - m, y, { align: 'right' });
    y += 8;
  }

  // Payment method
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text(`طريقة الأداء: ${paymentMethodText}`, pw - m, y, { align: 'right' });
  y += 16;

  // ── Date & City ──
  if (city) {
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text(`حرر ب${city} في:`, pw - m, y, { align: 'right' });
    y += 7;
  }
  doc.setFontSize(13);
  doc.setTextColor(20, 30, 50);
  doc.text(data.date, pw - m, y, { align: 'right' });
  y += 14;

  // ── Signature Section ──
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text('توقيع وختم المكتب', cx, y, { align: 'center' });
  y += 5;

  // Signature placeholder circle
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.setFillColor(248, 249, 252);
  doc.circle(cx, y + 18, 18, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(200, 200, 200);
  doc.text('SEAL & SIGNATURE AREA', cx, y + 19, { align: 'center' });

  // ── QR Code - bottom left ──
  const qrSize = 22;
  doc.addImage(qrDataUrl, 'PNG', m, y + 5, qrSize, qrSize);
  doc.setFontSize(6);
  doc.setTextColor(170, 170, 170);
  doc.text('رمز التحقق', m + qrSize / 2, y + qrSize + 8, { align: 'center' });

  // ── Footer ──
  const footerY = 282;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(m, footerY, pw - m, footerY);
  doc.setFontSize(7);
  doc.setTextColor(170, 170, 170);
  doc.text('وثيقة موقعة إلكترونياً — أي تزوير يعرض صاحبه للمتابعة القانونية', cx, footerY + 5, { align: 'center' });

  return doc.output('blob');
};
