import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import {
  type LetterheadInfo,
  NAVY, TEXT, TEXT2, TEXT3, BORDER, BG,
  PW, MARGIN, RX, CW, CX,
  registerFonts, fmt, hline, numberToArabicWords,
  drawTopBar, drawHeader, drawFooter, drawDateAndSignature,
} from './pdf-utils';

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

const PAYMENT_METHODS: Record<string, string> = {
  cash: 'نقداً',
  check: 'شيك',
  transfer: 'تحويل بنكي',
  card: 'بطاقة بنكية',
};

export const generateInvoicePDF = async (data: InvoiceData): Promise<Blob> => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await registerFonts(doc);

  const lh = data.letterhead;
  const lawyerName = lh?.lawyerName || data.lawyerName;
  const city = lh?.city || '';

  const verificationUrl = `${window.location.origin}/verify/${data.signatureUuid}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 1 });

  /* ── 1. Navy top bar ── */
  drawTopBar(doc);
  let y = 16;

  /* ── 2. Header (same as fee statement) ── */
  y = drawHeader(doc, lawyerName, lh, y);
  y += 10;

  /* ── 3. Title — وصل أداء ── */
  doc.setFont('Amiri');
  doc.setFontSize(28);
  doc.setTextColor(...TEXT);
  doc.text('وصل أداء', CX, y, { align: 'center' });
  y += 5;

  doc.setDrawColor(...TEXT);
  doc.setLineWidth(0.4);
  doc.line(CX - 18, y, CX + 18, y);
  y += 7;

  doc.setFont('IBMPlex');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT3);
  doc.text(`رقم الوصل: ${data.invoiceNumber}`, CX, y, { align: 'center' });
  y += 10;

  /* ── 4. Client info box (same style as fee statement) ── */
  const infoFields: { label: string; value: string }[] = [
    { label: 'الموكل', value: data.clientName },
  ];
  if (data.caseNumber) infoFields.push({ label: 'رقم الملف', value: data.caseNumber });
  if (data.caseType || data.caseName) infoFields.push({ label: 'موضوع الملف', value: data.caseType || data.caseName || '' });

  const boxPad = 8;
  const fieldH = 12;
  const boxH = boxPad * 2 + infoFields.length * fieldH;

  doc.setFillColor(...BG);
  doc.rect(MARGIN, y, CW, boxH, 'F');
  doc.setFillColor(...NAVY);
  doc.rect(RX - 2, y, 2, boxH, 'F');

  let fy = y + boxPad + 3;
  for (const field of infoFields) {
    doc.setFont('IBMPlex');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT3);
    doc.text(field.label, RX - 8, fy, { align: 'right' });

    doc.setFontSize(13);
    doc.setTextColor(...TEXT);
    doc.text(field.value, RX - 8, fy + 7, { align: 'right' });

    fy += fieldH;
  }

  y += boxH + 12;

  /* ── 5. Amount ── */
  doc.setFont('IBMPlex');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT2);
  doc.text('المبلغ الإجمالي المستلم:', RX, y, { align: 'right' });

  doc.setFont('Amiri');
  doc.setFontSize(24);
  doc.setTextColor(...TEXT);
  doc.text(`MAD  ${fmt(data.amount)}`, MARGIN, y + 1, { align: 'left' });
  y += 10;

  // Tafkeet
  doc.setFont('IBMPlex');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT3);
  doc.text('المبلغ بالحروف:  ' + numberToArabicWords(data.amount), RX, y, { align: 'right' });
  y += 8;

  // Payment method
  if (data.paymentMethod && data.paymentMethod !== 'cash') {
    doc.setFontSize(9);
    doc.setTextColor(...TEXT2);
    doc.text(`طريقة الأداء: ${PAYMENT_METHODS[data.paymentMethod] || data.paymentMethod}`, RX, y, { align: 'right' });
    y += 6;
  }

  y += 4;
  hline(doc, y, MARGIN, RX);
  y += 10;

  /* ── 6. Legal statement ── */
  doc.setFont('IBMPlex');
  doc.setFontSize(12);
  doc.setTextColor(...TEXT);
  const legalText = `يشهد مكتب الأستاذ ${lawyerName} باستلام المبلغ المذكور أعلاه من السيد(ة) ${data.clientName}، وذلك رسم مستحقات الملف المشار إليه أعلاه، ويعتبر هذا الوصل بمثابة إبراء ذمة نهائي بخصوص هذا الدفع.`;
  const splitLegal = doc.splitTextToSize(legalText, CW - 8);
  doc.text(splitLegal, CX, y, { align: 'center' });
  y += splitLegal.length * 6 + 8;

  hline(doc, y, MARGIN, RX);
  y += 12;

  /* ── 7. Date & Signature ── */
  y = drawDateAndSignature(doc, y, data.date, city);

  /* ── 8. QR Code ── */
  const qrSize = 16;
  doc.addImage(qrDataUrl, 'PNG', MARGIN, 271, qrSize, qrSize);
  doc.setFont('IBMPlex');
  doc.setFontSize(6);
  doc.setTextColor(...TEXT3);
  doc.text('رمز التحقق', MARGIN + qrSize / 2, 271 + qrSize + 2, { align: 'center' });

  /* ── Footer ── */
  drawFooter(doc);

  return doc.output('blob');
};
