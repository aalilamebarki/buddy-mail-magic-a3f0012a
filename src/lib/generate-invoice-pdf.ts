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

const fontCache: Record<string, string> = {};

const loadFont = async (path: string): Promise<string> => {
  if (fontCache[path]) return fontCache[path];
  const response = await fetch(path);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  fontCache[path] = base64;
  return base64;
};

const PAYMENT_METHODS: Record<string, string> = {
  cash: 'نقداً',
  check: 'شيك',
  transfer: 'تحويل بنكي',
  card: 'بطاقة بنكية',
};

/* ── Colors matching the design ── */
const TEAL: [number, number, number] = [55, 145, 160];      // header accent #3791A0
const TEXT_DARK: [number, number, number] = [35, 35, 35];
const TEXT_MID: [number, number, number] = [90, 90, 90];
const TEXT_LIGHT: [number, number, number] = [140, 140, 140];
const TEXT_MUTED: [number, number, number] = [180, 180, 180];
const BG_LIGHT: [number, number, number] = [245, 246, 248];  // #f5f6f8
const BORDER_LIGHT: [number, number, number] = [220, 220, 220];

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
  const [amiriBase64, plexBase64] = await Promise.all([
    loadFont('/fonts/Amiri-Regular.ttf'),
    loadFont('/fonts/IBMPlexSansArabic-Regular.ttf'),
  ]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('Amiri-Regular.ttf', amiriBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');

  doc.addFileToVFS('IBMPlexSansArabic-Regular.ttf', plexBase64);
  doc.addFont('IBMPlexSansArabic-Regular.ttf', 'IBMPlex', 'normal');

  doc.setFont('IBMPlex');

  const pw = 210;
  const m = 22;       // generous margins like the design
  const rightX = pw - m;
  const contentW = pw - m * 2;
  const cx = pw / 2;  // center X

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
     1. TEAL TOP BAR (full width)
     ═══════════════════════════════════════ */
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pw, 4, 'F');
  y = 18;

  /* ═══════════════════════════════════════
     2. CENTERED HEADER — Lawyer info
     ═══════════════════════════════════════ */
  // "مكتب الأستاذ"
  doc.setFont('Amiri');
  doc.setFontSize(16);
  doc.setTextColor(...TEXT_DARK);
  doc.text('مكتب الأستاذ', cx, y, { align: 'center' });
  y += 12;

  // Lawyer name — large
  doc.setFontSize(26);
  doc.setTextColor(...TEXT_DARK);
  doc.text(lawyerName, cx, y, { align: 'center' });
  y += 9;
  doc.setFont('IBMPlex');

  // Title (e.g. محام لدى المجلس)
  if (titleAr) {
    doc.setFontSize(13);
    doc.setTextColor(...TEAL);
    const fullTitle = barNameAr ? `${titleAr} لدى ${barNameAr}` : titleAr;
    doc.text(fullTitle, cx, y, { align: 'center' });
    y += 10;
  } else {
    y += 4;
  }

  // Contact info block — centered, smaller
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

  // Light gray separator line
  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.3);
  doc.line(m, y, rightX, y);
  y += 14;

  /* ═══════════════════════════════════════
     3. TITLE — "وصل أداء" (very large, centered)
     ═══════════════════════════════════════ */
  doc.setFontSize(30);
  doc.setTextColor(...TEXT_DARK);
  doc.text('وصل أداء', cx, y, { align: 'center' });
  y += 5;

  // Underline
  doc.setDrawColor(...TEXT_DARK);
  doc.setLineWidth(0.5);
  const ulW = 35;
  doc.line(cx - ulW / 2, y, cx + ulW / 2, y);
  y += 8;

  // Receipt number
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`رقم الوصل: ${data.invoiceNumber}`, cx, y, { align: 'center' });
  y += 12;

  /* ═══════════════════════════════════════
     4. CLIENT INFO BOX — gray bg, structured labels
     ═══════════════════════════════════════ */
  // Calculate height
  let infoRows = 1; // client always
  if (data.caseNumber) infoRows++;
  if (data.caseType || data.caseName) infoRows++;
  const infoBoxH = 8 + infoRows * 18;

  doc.setFillColor(...BG_LIGHT);
  doc.roundedRect(m, y, contentW, infoBoxH, 3, 3, 'F');

  let infoY = y + 10;
  const infoRightX = rightX - 8;

  // الموكل
  doc.setFontSize(11);
  doc.setTextColor(...TEAL);
  doc.text('الموكل', infoRightX, infoY, { align: 'right' });
  infoY += 8;
  doc.setFontSize(16);
  doc.setTextColor(...TEXT_DARK);
  doc.text(data.clientName, infoRightX, infoY, { align: 'right' });
  infoY += 10;

  // رقم الملف
  if (data.caseNumber) {
    doc.setFontSize(11);
    doc.setTextColor(...TEAL);
    doc.text('رقم الملف', infoRightX, infoY, { align: 'right' });
    infoY += 8;
    doc.setFontSize(14);
    doc.setTextColor(...TEXT_DARK);
    doc.text(data.caseNumber, infoRightX, infoY, { align: 'right' });
    infoY += 10;
  }

  // موضوع الملف
  if (data.caseType || data.caseName) {
    doc.setFontSize(11);
    doc.setTextColor(...TEAL);
    doc.text('موضوع الملف', infoRightX, infoY, { align: 'right' });
    infoY += 8;
    doc.setFontSize(14);
    doc.setTextColor(...TEXT_DARK);
    doc.text(`${data.caseType || data.caseName}`, infoRightX, infoY, { align: 'right' });
  }

  y += infoBoxH + 10;

  /* ═══════════════════════════════════════
     5. AMOUNT SECTION
     ═══════════════════════════════════════ */
  // Label on right, amount on left — same line
  doc.setFontSize(12);
  doc.setTextColor(...TEXT_MID);
  doc.text('المبلغ الإجمالي المستلم:', rightX, y, { align: 'right' });

  // Large amount + MAD on left
  doc.setFontSize(24);
  doc.setTextColor(...TEXT_DARK);
  const amountFormatted = data.amount.toLocaleString('fr-MA', { minimumFractionDigits: 2 });
  doc.text(`MAD  ${amountFormatted}`, m, y + 1, { align: 'left' });
  y += 10;

  // Tafkeet
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text('المبلغ بالحروف:', rightX, y, { align: 'right' });
  const tafkeetW = doc.getTextWidth('المبلغ بالحروف:  ');
  doc.setTextColor(...TEXT_MID);
  doc.text(numberToArabicWords(data.amount), rightX - tafkeetW, y, { align: 'right' });
  y += 10;

  // Payment method (if not cash, show it)
  if (data.paymentMethod && data.paymentMethod !== 'cash') {
    const pmText = PAYMENT_METHODS[data.paymentMethod] || data.paymentMethod;
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_LIGHT);
    doc.text(`طريقة الأداء: ${pmText}`, rightX, y, { align: 'right' });
    y += 8;
  }

  y += 4;

  /* ═══════════════════════════════════════
     6. LEGAL TEXT — bordered box
     ═══════════════════════════════════════ */
  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.3);
  doc.line(m, y, rightX, y);
  y += 10;

  doc.setFontSize(14);
  doc.setTextColor(...TEXT_DARK);
  const legalText = `يشهد مكتب الأستاذ ${lawyerName} باستلام المبلغ المذكور أعلاه من السيد(ة) ${data.clientName}، وذلك رسم مستحقات الملف المشار إليه أعلاه، ويعتبر هذا الوصل بمثابة إبراء ذمة نهائي بخصوص هذا الدفع.`;
  const splitLegal = doc.splitTextToSize(legalText, contentW);
  // Center the text block
  doc.text(splitLegal, cx, y, { align: 'center' });
  y += splitLegal.length * 7 + 6;

  doc.setDrawColor(...BORDER_LIGHT);
  doc.line(m, y, rightX, y);
  y += 14;

  /* ═══════════════════════════════════════
     7. DATE SECTION — "حرر بـ..."
     ═══════════════════════════════════════ */
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`حرر ب${city || '...'} في:`, rightX, y, { align: 'right' });
  y += 9;

  doc.setFontSize(16);
  doc.setTextColor(...TEXT_DARK);
  doc.text(data.date, rightX, y, { align: 'right' });
  y += 16;

  /* ═══════════════════════════════════════
     8. SIGNATURE — centered
     ═══════════════════════════════════════ */
  doc.setFontSize(14);
  doc.setTextColor(...TEXT_DARK);
  doc.text('توقيع وختم المكتب', cx, y, { align: 'center' });
  y += 10;

  // Seal placeholder — rounded gray rectangle
  const sealW = 55;
  const sealH = 35;
  const sealX = cx - sealW / 2;
  doc.setFillColor(240, 241, 243);
  doc.roundedRect(sealX, y, sealW, sealH, 6, 6, 'F');

  // "SEAL & SIGNATURE AREA" text inside
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('SEAL & SIGNATURE AREA', cx, y + sealH / 2 + 1, { align: 'center' });

  /* ═══════════════════════════════════════
     QR CODE — bottom left corner
     ═══════════════════════════════════════ */
  const qrSize = 18;
  const qrY = 272;
  doc.addImage(qrDataUrl, 'PNG', m, qrY, qrSize, qrSize);
  doc.setFontSize(6);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('رمز التحقق', m + qrSize / 2, qrY + qrSize + 2.5, { align: 'center' });

  /* ═══════════════════════════════════════
     FOOTER — subtle line
     ═══════════════════════════════════════ */
  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.15);
  doc.line(m, 293, rightX, 293);
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('وثيقة موقعة إلكترونياً', cx, 296, { align: 'center' });

  return doc.output('blob');
};
