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

/* ── Font loader ── */
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

/* ── Colors — formal classic ── */
const DARK: [number, number, number] = [33, 37, 41];
const MID: [number, number, number] = [108, 117, 125];
const LIGHT: [number, number, number] = [173, 181, 189];
const RULE: [number, number, number] = [206, 212, 218];
const PANEL: [number, number, number] = [248, 249, 250];

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
    if (th === 1) parts.push('ألف'); else if (th === 2) parts.push('ألفان');
    else if (th >= 3 && th <= 10) parts.push(`${ones[th]} آلاف`);
    else { const tH = Math.floor(th / 100), tR = th % 100, tP: string[] = []; if (tH > 0) tP.push(hundreds[tH]); if (tR >= 10 && tR < 20) tP.push(teens[tR - 10]); else { const tO = tR % 10, tT = Math.floor(tR / 10); if (tO > 0) tP.push(ones[tO]); if (tT > 0) tP.push(tens[tT]); } parts.push(tP.join(' و') + ' ألف'); }
  }
  if (rem > 0) { const rH = Math.floor(rem / 100), rR = rem % 100; if (rH > 0) parts.push(hundreds[rH]); if (rR >= 10 && rR < 20) parts.push(teens[rR - 10]); else { const rO = rR % 10, rT = Math.floor(rR / 10); if (rO > 0 && rT > 0) parts.push(`${ones[rO]} و${tens[rT]}`); else if (rO > 0) parts.push(ones[rO]); else if (rT > 0) parts.push(tens[rT]); } }
  return `فقط ${parts.join(' و')} درهم مغربي لا غير.`;
};

const rule = (doc: jsPDF, y: number, x1: number, x2: number, color = RULE, w = 0.25) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(w);
  doc.line(x1, y, x2, y);
};

export const generateInvoicePDF = async (data: InvoiceData): Promise<Blob> => {
  const plexBase64 = await loadFont('/fonts/IBMPlexSansArabic-Regular.ttf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('IBMPlexSansArabic-Regular.ttf', plexBase64);
  doc.addFont('IBMPlexSansArabic-Regular.ttf', 'IBMPlex', 'normal');
  doc.setFont('IBMPlex');

  const pw = 210, m = 20, rX = pw - m, cW = pw - m * 2, cx = pw / 2;

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

  let y = 12;

  /* ═══ Page border ═══ */
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.4);
  doc.rect(10, 8, pw - 20, 282, 'S');

  /* ═══ Header ═══ */
  doc.setFontSize(12);
  doc.setTextColor(...MID);
  doc.text('مكتب الأستاذ', cx, y, { align: 'center' });
  y += 9;

  doc.setFontSize(22);
  doc.setTextColor(...DARK);
  doc.text(lawyerName, cx, y, { align: 'center' });
  y += 7;

  if (titleAr) {
    doc.setFontSize(10);
    doc.setTextColor(...MID);
    const fullTitle = barNameAr ? `${titleAr} لدى ${barNameAr}` : titleAr;
    doc.text(fullTitle, cx, y, { align: 'center' });
    y += 6;
  }

  const contactParts = [
    address ? (city ? `${address}، ${city}` : address) : '',
    phone ? `الهاتف: ${phone}` : '',
    email ? `البريد: ${email}` : '',
  ].filter(Boolean);

  if (contactParts.length) {
    doc.setFontSize(8);
    doc.setTextColor(...LIGHT);
    doc.text(contactParts.join('  |  '), cx, y, { align: 'center' });
    y += 5;
  }

  y += 2;
  rule(doc, y, m + 10, rX - 10, DARK, 0.6);
  y += 1;
  rule(doc, y, m + 10, rX - 10, RULE, 0.2);
  y += 10;

  /* ═══ Title ═══ */
  doc.setFontSize(26);
  doc.setTextColor(...DARK);
  doc.text('وصل أداء', cx, y, { align: 'center' });
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(...LIGHT);
  doc.text(`رقم الوصل: ${data.invoiceNumber}`, cx, y, { align: 'center' });
  y += 10;

  /* ═══ Client info panel ═══ */
  const infoItems: { label: string; value: string }[] = [
    { label: 'الموكل', value: data.clientName },
  ];
  if (data.caseNumber) infoItems.push({ label: 'رقم الملف', value: data.caseNumber });
  if (data.caseType || data.caseName) infoItems.push({ label: 'موضوع الملف', value: data.caseType || data.caseName || '' });

  const panelH = 6 + infoItems.length * 9;
  doc.setFillColor(...PANEL);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.2);
  doc.roundedRect(m, y, cW, panelH, 2, 2, 'FD');

  let iy = y + 6;
  for (const item of infoItems) {
    doc.setFontSize(8);
    doc.setTextColor(...LIGHT);
    doc.text(item.label + ':', rX - 6, iy, { align: 'right' });

    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    const labelW = doc.getTextWidth(item.label + ':  ');
    doc.text(item.value, rX - 6 - labelW, iy, { align: 'right' });
    iy += 9;
  }

  y += panelH + 10;

  /* ═══ Amount ═══ */
  doc.setFontSize(11);
  doc.setTextColor(...MID);
  doc.text('المبلغ الإجمالي المستلم:', rX, y, { align: 'right' });

  doc.setFontSize(22);
  doc.setTextColor(...DARK);
  const amountFormatted = data.amount.toLocaleString('fr-MA', { minimumFractionDigits: 2 });
  doc.text(`MAD  ${amountFormatted}`, m, y + 1, { align: 'left' });
  y += 10;

  // Tafkeet
  doc.setFontSize(9);
  doc.setTextColor(...LIGHT);
  doc.text(numberToArabicWords(data.amount), rX, y, { align: 'right' });
  y += 8;

  // Payment method
  if (data.paymentMethod && data.paymentMethod !== 'cash') {
    doc.setFontSize(9);
    doc.setTextColor(...MID);
    doc.text(`طريقة الأداء: ${PAYMENT_METHODS[data.paymentMethod] || data.paymentMethod}`, rX, y, { align: 'right' });
    y += 6;
  }

  y += 4;
  rule(doc, y, m, rX);
  y += 10;

  /* ═══ Legal text ═══ */
  doc.setFontSize(12);
  doc.setTextColor(...DARK);
  const legalText = `يشهد مكتب الأستاذ ${lawyerName} باستلام المبلغ المذكور أعلاه من السيد(ة) ${data.clientName}، وذلك رسم مستحقات الملف المشار إليه أعلاه، ويعتبر هذا الوصل بمثابة إبراء ذمة نهائي بخصوص هذا الدفع.`;
  const splitLegal = doc.splitTextToSize(legalText, cW - 8);
  doc.text(splitLegal, cx, y, { align: 'center' });
  y += splitLegal.length * 6 + 8;

  rule(doc, y, m, rX);
  y += 12;

  /* ═══ Date ═══ */
  doc.setFontSize(9);
  doc.setTextColor(...LIGHT);
  doc.text(`حرر ب${city || '...'} في:`, rX, y, { align: 'right' });
  y += 7;

  doc.setFontSize(14);
  doc.setTextColor(...DARK);
  doc.text(data.date, rX, y, { align: 'right' });
  y += 14;

  /* ═══ Signature ═══ */
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text('التوقيع والختم', cx, y, { align: 'center' });

  /* ═══ QR Code ═══ */
  const qrSize = 16;
  doc.addImage(qrDataUrl, 'PNG', m, 271, qrSize, qrSize);
  doc.setFontSize(6);
  doc.setTextColor(...LIGHT);
  doc.text('رمز التحقق', m + qrSize / 2, 271 + qrSize + 2, { align: 'center' });

  /* ═══ Footer ═══ */
  rule(doc, 287, m, rX, RULE, 0.15);
  doc.setFontSize(7);
  doc.setTextColor(...LIGHT);
  doc.text('وثيقة موقعة إلكترونياً', cx, 290, { align: 'center' });

  return doc.output('blob');
};
