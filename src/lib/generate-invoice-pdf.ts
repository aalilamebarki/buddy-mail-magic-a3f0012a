import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import {
  type LetterheadInfo,
  NAVY, GOLD, TEXT, TEXT2, TEXT3, BORDER, BG,
  PW, MARGIN, RX, CW, CX,
  registerFonts, fmt, hline, numberToArabicWords, goldLine,
  drawPageFrame, drawHeader, drawFooter, drawDateAndSignature,
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

  /* ── 1. Page frame ── */
  drawPageFrame(doc);
  let y = 20;

  /* ── 2. Bilingual Header ── */
  y = drawHeader(doc, lawyerName, lh, y);
  y += 6;

  /* ── 3. Title — وصل أداء / Reçu de paiement ── */
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text('وصل أداء', CX, y, { align: 'center' });
  y += 5;

  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT3);
  doc.text('Reçu de paiement', CX, y, { align: 'center' });
  y += 4;

  goldLine(doc, y, CX - 20, CX + 20);
  y += 6;

  // Invoice number
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT2);
  doc.text(`رقم الوصل: ${data.invoiceNumber}`, CX, y, { align: 'center' });
  y += 8;

  /* ── 4. Client info table ── */
  const infoRows: [string, string][] = [
    ['الموكل / Client', data.clientName],
  ];
  if (data.caseNumber) infoRows.push(['رقم الملف / N° Dossier', data.caseNumber]);
  if (data.caseType || data.caseName) infoRows.push(['موضوع الملف / Objet', data.caseType || data.caseName || '']);

  const rowH = 9;
  const tableH = infoRows.length * rowH;

  for (let i = 0; i < infoRows.length; i++) {
    const ry = y + i * rowH;
    // Alternating row bg
    if (i % 2 === 0) {
      doc.setFillColor(...BG);
      doc.rect(MARGIN, ry, CW, rowH, 'F');
    }
    // Right border accent
    doc.setFillColor(...GOLD);
    doc.rect(RX - 1.5, ry, 1.5, rowH, 'F');

    // Label
    doc.setFont('IBMPlex', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GOLD);
    doc.text(infoRows[i][0], RX - 5, ry + 3.5, { align: 'right' });

    // Value
    doc.setFontSize(11);
    doc.setTextColor(...TEXT);
    doc.text(infoRows[i][1], RX - 5, ry + 7.5, { align: 'right' });
  }

  // Table border
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, y, CW, tableH, 'S');

  y += tableH + 10;

  /* ── 5. Amount section ── */
  // Amount box
  doc.setFillColor(...NAVY);
  doc.roundedRect(MARGIN, y, CW, 18, 2, 2, 'F');

  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text('المبلغ المستلم / Montant reçu', RX - 5, y + 5, { align: 'right' });

  doc.setFont('Amiri', 'normal');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(`${fmt(data.amount)} MAD`, MARGIN + 5, y + 14, { align: 'left' });

  y += 22;

  // Tafkeet
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT2);
  doc.text('المبلغ بالحروف:  ' + numberToArabicWords(data.amount), RX - 4, y, { align: 'right' });
  y += 6;

  // Payment method
  const methodLabel = PAYMENT_METHODS[data.paymentMethod] || data.paymentMethod;
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT2);
  doc.text(`طريقة الأداء: ${methodLabel}  |  Mode de paiement: ${data.paymentMethod}`, RX - 4, y, { align: 'right' });
  y += 8;

  hline(doc, y, MARGIN, RX, BORDER, 0.2);
  y += 8;

  /* ── 6. Legal statement ── */
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  const legalText = `يشهد الأستاذ ${lawyerName} باستلام المبلغ المذكور أعلاه من السيد(ة) ${data.clientName}، وذلك رسم مستحقات الملف المشار إليه أعلاه، ويعتبر هذا الوصل بمثابة إبراء ذمة نهائي بخصوص هذا الدفع.`;
  const splitLegal = doc.splitTextToSize(legalText, CW - 8);
  doc.text(splitLegal, CX, y, { align: 'center' });
  y += splitLegal.length * 5 + 6;

  hline(doc, y, MARGIN, RX, BORDER, 0.2);
  y += 10;

  /* ── 7. Date & Signature ── */
  y = drawDateAndSignature(doc, y, data.date, city);

  /* ── 8. QR Code ── */
  const qrSize = 14;
  doc.addImage(qrDataUrl, 'PNG', MARGIN + 2, 262, qrSize, qrSize);
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...TEXT3);
  doc.text('رمز التحقق / Code de vérification', MARGIN + 2 + qrSize / 2, 262 + qrSize + 2, { align: 'center' });

  /* ── Footer ── */
  drawFooter(doc);

  return doc.output('blob');
};
