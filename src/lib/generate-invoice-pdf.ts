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

/* ── Color palette — light-weight for B&W print, navy accent for PDF ── */
const NAVY: [number, number, number] = [26, 43, 60];
const TEXT_PRIMARY: [number, number, number] = [40, 40, 40];    // near-black, soft on print
const TEXT_SECONDARY: [number, number, number] = [110, 110, 110]; // labels
const TEXT_MUTED: [number, number, number] = [160, 160, 160];   // footer/subtle
const BORDER_COLOR: [number, number, number] = [210, 210, 210];
const BOX_BG: [number, number, number] = [248, 249, 251];

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
  const m = 18;
  const rightX = pw - m;
  const contentW = pw - m * 2;

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
     ═══════════════════════════════════════ */
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text(`الأستاذ ${lawyerName}`, rightX, y, { align: 'right' });

  if (nameFr) {
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(`Maître ${nameFr}`, m, y, { align: 'left' });
  }
  y += 7;

  if (titleAr || barNameAr) {
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_SECONDARY);
    const arTitle = [titleAr, barNameAr ? `هيئة ${barNameAr}` : ''].filter(Boolean).join(' — ');
    doc.text(arTitle, rightX, y, { align: 'right' });
  }
  if (titleFr || barNameFr) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_SECONDARY);
    const frTitle = [titleFr, barNameFr ? `au Barreau de ${barNameFr}` : ''].filter(Boolean).join(' ');
    doc.text(frTitle, m, y, { align: 'left' });
  }
  y += 5;

  if (phone) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(`Tél: ${phone}`, m, y, { align: 'left' });
  }
  y += 4;

  // Navy separator
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.line(m, y, rightX, y);
  y += 1.5;
  doc.setLineWidth(0.25);
  doc.line(m + 25, y, rightX - 25, y);
  y += 5;

  if (address) {
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_PRIMARY);
    const fullAddr = [address, city ? `- ${city}` : ''].filter(Boolean).join(' ');
    doc.text(fullAddr, pw / 2, y, { align: 'center' });
    y += 5;
  }
  if (email) {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(`E-mail : ${email}`, pw / 2, y, { align: 'center' });
    y += 5;
  }

  // City & Date
  y += 3;
  doc.setFontSize(12);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(city ? `${city} في: ${data.date}` : data.date, rightX, y, { align: 'right' });
  y += 14;

  /* ═══════════════════════════════════════
     TITLE
     ═══════════════════════════════════════ */
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text('وصل أداء', pw / 2, y, { align: 'center' });
  y += 4;
  const titleBarW = 30;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.7);
  doc.line(pw / 2 - titleBarW / 2, y, pw / 2 + titleBarW / 2, y);
  y += 8;

  // Receipt number
  doc.setFontSize(12);
  doc.setTextColor(...TEXT_SECONDARY);
  doc.text(`رقم الوصل: ${data.invoiceNumber}`, pw / 2, y, { align: 'center' });
  y += 12;

  /* ═══════════════════════════════════════
     CLIENT INFO BOX
     ═══════════════════════════════════════ */
  let boxLines = 1;
  if (data.caseNumber) boxLines++;
  if (data.caseType || data.caseName) boxLines++;
  const boxH = 10 + boxLines * 9;
  const boxInnerX = rightX - 6;

  doc.setFillColor(...BOX_BG);
  doc.roundedRect(m, y, contentW, boxH, 2, 2, 'F');
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1.2);
  doc.line(rightX, y, rightX, y + boxH);

  let boxY = y + 8;

  doc.setFontSize(14);
  doc.setTextColor(...TEXT_SECONDARY);
  doc.text('الموكل(ة): ', boxInnerX, boxY, { align: 'right' });
  const clientLabelW = doc.getTextWidth('الموكل(ة): ');
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(data.clientName, boxInnerX - clientLabelW, boxY, { align: 'right' });
  boxY += 9;

  if (data.caseNumber) {
    doc.setFontSize(14);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text('رقم الملف: ', boxInnerX, boxY, { align: 'right' });
    const numLabelW = doc.getTextWidth('رقم الملف: ');
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(data.caseNumber, boxInnerX - numLabelW, boxY, { align: 'right' });
    boxY += 9;
  }

  if (data.caseType || data.caseName) {
    doc.setFontSize(14);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text('الموضوع: ', boxInnerX, boxY, { align: 'right' });
    const subjectLabelW = doc.getTextWidth('الموضوع: ');
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(`${data.caseType || data.caseName}`, boxInnerX - subjectLabelW, boxY, { align: 'right' });
  }

  y += boxH + 10;

  /* ═══════════════════════════════════════
     AMOUNT SECTION
     ═══════════════════════════════════════ */
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.25);
  doc.line(m, y, rightX, y);
  y += 9;

  doc.setFontSize(14);
  doc.setTextColor(...TEXT_SECONDARY);
  doc.text('المبلغ المستلم:', rightX, y, { align: 'right' });
  y += 11;

  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  const amountStr = `${data.amount.toLocaleString('fr-MA', { minimumFractionDigits: 2 })} درهم`;
  doc.text(amountStr, rightX, y, { align: 'right' });
  y += 9;

  // Tafkeet
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_SECONDARY);
  doc.text(numberToArabicWords(data.amount), rightX, y, { align: 'right' });
  y += 10;

  // Payment method
  doc.setFontSize(14);
  doc.setTextColor(...TEXT_SECONDARY);
  doc.text('طريقة الأداء: ', rightX, y, { align: 'right' });
  const pmLabelW = doc.getTextWidth('طريقة الأداء: ');
  const paymentMethodText = PAYMENT_METHODS[data.paymentMethod] || data.paymentMethod;
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text(paymentMethodText, rightX - pmLabelW, y, { align: 'right' });
  y += 8;

  if (data.description) {
    doc.setFontSize(12);
    doc.setTextColor(...TEXT_SECONDARY);
    doc.text(`البيان: ${data.description}`, rightX, y, { align: 'right' });
    y += 8;
  }

  y += 4;
  doc.setDrawColor(...BORDER_COLOR);
  doc.line(m, y, rightX, y);
  y += 10;

  /* ═══════════════════════════════════════
     LEGAL TEXT
     ═══════════════════════════════════════ */
  doc.setFontSize(12);
  doc.setTextColor(...TEXT_PRIMARY);
  const legalText = `يشهد مكتب الأستاذ ${lawyerName} باستلام المبلغ المذكور أعلاه من السيد(ة) ${data.clientName}، وذلك رسم مستحقات الملف المشار إليه أعلاه، ويعتبر هذا الوصل بمثابة إبراء ذمة بخصوص هذا الدفع.`;
  const splitText = doc.splitTextToSize(legalText, contentW);
  doc.text(splitText, rightX, y, { align: 'right' });
  y += splitText.length * 6 + 14;

  /* ═══════════════════════════════════════
     SIGNATURE & QR
     ═══════════════════════════════════════ */
  const qrSize = 22;
  const qrY = Math.max(y, 240);
  doc.addImage(qrDataUrl, 'PNG', m, qrY, qrSize, qrSize);
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('رمز التحقق', m + qrSize / 2, qrY + qrSize + 3, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text('التوقيع والختم', rightX, qrY + 2, { align: 'right' });
  doc.setDrawColor(...TEXT_MUTED);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(rightX - 55, qrY + 22, rightX, qrY + 22);
  doc.setLineDashPattern([], 0);

  /* ═══════════════════════════════════════
     FOOTER
     ═══════════════════════════════════════ */
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.15);
  doc.line(m, 285, rightX, 285);
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text('وثيقة موقعة إلكترونياً', pw / 2, 289, { align: 'center' });

  return doc.output('blob');
};
