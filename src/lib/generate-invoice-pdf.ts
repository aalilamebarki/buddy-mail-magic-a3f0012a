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

/* ── Font ── */
const fontCache: Record<string, string> = {};

const loadFont = async (path: string): Promise<string> => {
  if (fontCache[path]) return fontCache[path];
  const res = await fetch(path);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  fontCache[path] = b64;
  return b64;
};

const PAYMENT_METHODS: Record<string, string> = {
  cash: 'نقداً',
  check: 'شيك',
  transfer: 'تحويل بنكي',
  card: 'بطاقة بنكية',
};

const BLACK: [number, number, number] = [0, 0, 0];
const GRAY: [number, number, number] = [120, 120, 120];
const LINE: [number, number, number] = [200, 200, 200];

/* ── Tafkeet ── */
const numberToArabicWords = (num: number): string => {
  if (num === 0) return 'صفر درهم';
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const parts: string[] = [];
  const mil = Math.floor(num / 1000000);
  const th = Math.floor((num % 1000000) / 1000);
  const rem = Math.floor(num % 1000);
  if (mil > 0) { if (mil === 1) parts.push('مليون'); else if (mil === 2) parts.push('مليونان'); else parts.push(`${ones[mil]} ملايين`); }
  if (th > 0) {
    if (th === 1) parts.push('ألف');
    else if (th === 2) parts.push('ألفان');
    else if (th >= 3 && th <= 10) parts.push(`${ones[th]} آلاف`);
    else {
      const tH = Math.floor(th / 100), tR = th % 100, tP: string[] = [];
      if (tH > 0) tP.push(hundreds[tH]);
      if (tR >= 10 && tR < 20) tP.push(teens[tR - 10]);
      else { const tO = tR % 10, tT = Math.floor(tR / 10); if (tO > 0) tP.push(ones[tO]); if (tT > 0) tP.push(tens[tT]); }
      parts.push(tP.join(' و') + ' ألف');
    }
  }
  if (rem > 0) {
    const rH = Math.floor(rem / 100), rR = rem % 100;
    if (rH > 0) parts.push(hundreds[rH]);
    if (rR >= 10 && rR < 20) parts.push(teens[rR - 10]);
    else { const rO = rR % 10, rT = Math.floor(rR / 10); if (rO > 0 && rT > 0) parts.push(`${ones[rO]} و${tens[rT]}`); else if (rO > 0) parts.push(ones[rO]); else if (rT > 0) parts.push(tens[rT]); }
  }
  return `فقط ${parts.join(' و')} درهم مغربي لا غير.`;
};

export const generateInvoicePDF = async (data: InvoiceData): Promise<Blob> => {
  const plexBase64 = await loadFont('/fonts/IBMPlexSansArabic-Regular.ttf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('IBMPlexSansArabic-Regular.ttf', plexBase64);
  doc.addFont('IBMPlexSansArabic-Regular.ttf', 'IBMPlex', 'normal');
  doc.setFont('IBMPlex');

  const pw = 210, m = 22, rightX = pw - m, contentW = pw - m * 2, cx = pw / 2;

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

  let y = 14;

  // ── Header ──
  doc.setFontSize(13);
  doc.setTextColor(...BLACK);
  doc.text('مكتب الأستاذ', cx, y, { align: 'center' });
  y += 9;

  doc.setFontSize(22);
  doc.text(lawyerName, cx, y, { align: 'center' });
  y += 8;

  if (titleAr) {
    doc.setFontSize(11);
    doc.setTextColor(...GRAY);
    const fullTitle = barNameAr ? `${titleAr} لدى ${barNameAr}` : titleAr;
    doc.text(fullTitle, cx, y, { align: 'center' });
    y += 6;
  }

  doc.setTextColor(...BLACK);

  if (address) {
    doc.setFontSize(9);
    const fullAddr = city ? `${address}، ${city}` : address;
    doc.text(fullAddr, cx, y, { align: 'center' });
    y += 5;
  }
  if (phone) {
    doc.setFontSize(9);
    doc.text(`الهاتف: ${phone}`, cx, y, { align: 'center' });
    y += 5;
  }
  if (email) {
    doc.setFontSize(9);
    doc.text(`البريد: ${email}`, cx, y, { align: 'center' });
    y += 5;
  }

  y += 3;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(m, y, rightX, y);
  y += 12;

  // ── Title ──
  doc.setFontSize(24);
  doc.setTextColor(...BLACK);
  doc.text('وصل أداء', cx, y, { align: 'center' });
  y += 5;

  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.4);
  doc.line(cx - 20, y, cx + 20, y);
  y += 7;

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`رقم الوصل: ${data.invoiceNumber}`, cx, y, { align: 'center' });
  y += 10;

  // ── Client info ──
  const infoFields: { label: string; value: string }[] = [
    { label: 'الموكل', value: data.clientName },
  ];
  if (data.caseNumber) infoFields.push({ label: 'رقم الملف', value: data.caseNumber });
  if (data.caseType || data.caseName) infoFields.push({ label: 'موضوع الملف', value: data.caseType || data.caseName || '' });

  for (const field of infoFields) {
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(field.label, rightX, y, { align: 'right' });
    y += 5;
    doc.setFontSize(12);
    doc.setTextColor(...BLACK);
    doc.text(field.value, rightX, y, { align: 'right' });
    y += 7;
  }

  y += 5;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(m, y, rightX, y);
  y += 10;

  // ── Amount ──
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text('المبلغ الإجمالي المستلم:', rightX, y, { align: 'right' });

  doc.setFontSize(20);
  const amountFormatted = data.amount.toLocaleString('fr-MA', { minimumFractionDigits: 2 });
  doc.text(`MAD  ${amountFormatted}`, m, y + 1, { align: 'left' });
  y += 10;

  // Tafkeet
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(numberToArabicWords(data.amount), rightX, y, { align: 'right' });
  y += 8;

  // Payment method
  if (data.paymentMethod && data.paymentMethod !== 'cash') {
    doc.setFontSize(9);
    doc.text(`طريقة الأداء: ${PAYMENT_METHODS[data.paymentMethod] || data.paymentMethod}`, rightX, y, { align: 'right' });
    y += 6;
  }

  y += 4;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(m, y, rightX, y);
  y += 10;

  // ── Legal text ──
  doc.setFontSize(12);
  doc.setTextColor(...BLACK);
  const legalText = `يشهد مكتب الأستاذ ${lawyerName} باستلام المبلغ المذكور أعلاه من السيد(ة) ${data.clientName}، وذلك رسم مستحقات الملف المشار إليه أعلاه، ويعتبر هذا الوصل بمثابة إبراء ذمة نهائي بخصوص هذا الدفع.`;
  const splitLegal = doc.splitTextToSize(legalText, contentW);
  doc.text(splitLegal, cx, y, { align: 'center' });
  y += splitLegal.length * 6 + 6;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(m, y, rightX, y);
  y += 12;

  // ── Date ──
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`حرر ب${city || '...'} في:`, rightX, y, { align: 'right' });
  y += 7;
  doc.setFontSize(13);
  doc.setTextColor(...BLACK);
  doc.text(data.date, rightX, y, { align: 'right' });
  y += 14;

  // ── Signature ──
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text('التوقيع والختم', cx, y, { align: 'center' });

  // ── QR Code ──
  const qrSize = 16;
  doc.addImage(qrDataUrl, 'PNG', m, 274, qrSize, qrSize);
  doc.setFontSize(6);
  doc.setTextColor(...GRAY);
  doc.text('رمز التحقق', m + qrSize / 2, 274 + qrSize + 2, { align: 'center' });

  // ── Footer ──
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.1);
  doc.line(m, 293, rightX, 293);
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text('وثيقة موقعة إلكترونياً', cx, 296, { align: 'center' });

  return doc.output('blob');
};
