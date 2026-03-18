import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import {
  type LetterheadInfo,
  NAVY, GOLD, TEXT, TEXT2, TEXT3, BORDER, BG,
  PW, MARGIN, RX, CW, CX,
  registerFonts, fmt, hline, numberToArabicWords, goldLine,
  drawPageFrame, drawHeader, drawFooter, drawDateAndSignature, ensureSpace,
  drawOrnament, drawInfoRow,
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
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 1, color: { dark: '#1a2a44', light: '#ffffff' } });

  /* ── 1. Page frame ── */
  drawPageFrame(doc);
  let y = 16;

  /* ── 2. Bilingual Header ── */
  y = drawHeader(doc, lawyerName, lh, y);
  y += 5;

  /* ── 3. Title — وصل أداء / Reçu de paiement ── */
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(20);
  doc.setTextColor(...NAVY);
  doc.text('وصل أداء', CX, y, { align: 'center' });
  y += 5;

  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT3);
  doc.text('Reçu de paiement', CX, y, { align: 'center' });
  y += 4;

  goldLine(doc, y, CX - 18, CX + 18);
  y += 5;

  // Invoice number badge
  const badgeW = 44;
  doc.setFillColor(...BG);
  doc.roundedRect(CX - badgeW / 2, y - 2, badgeW, 6.5, 1.5, 1.5, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.25);
  doc.roundedRect(CX - badgeW / 2, y - 2, badgeW, 6.5, 1.5, 1.5, 'S');
  doc.setFont('IBMPlex', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...NAVY);
  doc.text(`رقم: ${data.invoiceNumber}`, CX, y + 2.5, { align: 'center' });
  y += 9;

  /* ── 4. Client info card ── */
  const infoRows: [string, string, string][] = [
    ['الموكل', 'Client', data.clientName],
  ];
  if (data.caseNumber) infoRows.push(['رقم الملف', 'N° Dossier', data.caseNumber]);
  if (data.caseType || data.caseName) infoRows.push(['موضوع الملف', 'Objet', data.caseType || data.caseName || '']);

  // Card border
  const totalH = infoRows.length * 8.5 + 1;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, y - 0.5, CW, totalH, 1.5, 1.5, 'S');

  for (let i = 0; i < infoRows.length; i++) {
    y = drawInfoRow(doc, y, infoRows[i][0], infoRows[i][1], infoRows[i][2], i % 2 === 0, i === infoRows.length - 1);
  }
  y += 8;

  /* ── 5. Amount section ── */
  y = ensureSpace(doc, y, 26);

  // Navy card
  const amountCardH = 20;
  doc.setFillColor(...NAVY);
  doc.roundedRect(MARGIN, y, CW, amountCardH, 2.5, 2.5, 'F');

  // Gold inner accent
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN + 1.5, y + 1.5, CW - 3, amountCardH - 3, 1.5, 1.5, 'S');

  doc.setFont('IBMPlex', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text('المبلغ المستلم', RX - 6, y + 6, { align: 'right' });
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(6);
  doc.text('Montant reçu', RX - 6, y + 10, { align: 'right' });

  doc.setFont('Amiri', 'normal');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(`${fmt(data.amount)} MAD`, MARGIN + 6, y + 14, { align: 'left' });

  y += amountCardH + 5;

  // Tafkeet
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT2);
  const tafkeetText = 'المبلغ بالحروف:  ' + numberToArabicWords(data.amount);
  const tafkeetLines = doc.splitTextToSize(tafkeetText, CW - 8);
  doc.text(tafkeetLines, CX, y, { align: 'center' });
  y += tafkeetLines.length * 3.5 + 4;

  // Payment method
  const methodLabel = PAYMENT_METHODS[data.paymentMethod] || data.paymentMethod;
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT2);
  doc.text(`طريقة الأداء: ${methodLabel}`, RX - 4, y, { align: 'right' });
  doc.setFontSize(6);
  doc.setTextColor(...TEXT3);
  doc.text(`Mode de paiement: ${data.paymentMethod}`, RX - 4, y + 3.5, { align: 'right' });
  y += 8;

  hline(doc, y, MARGIN, RX, BORDER, 0.2);
  y += 6;

  /* ── 6. Legal statement ── */
  y = ensureSpace(doc, y, 28);

  // Subtle background for legal text
  const legalText = `يشهد الأستاذ ${lawyerName} باستلام المبلغ المذكور أعلاه من السيد(ة) ${data.clientName}، وذلك رسم مستحقات الملف المشار إليه أعلاه، ويعتبر هذا الوصل بمثابة إبراء ذمة نهائي بخصوص هذا الدفع.`;
  
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT);
  const splitLegal = doc.splitTextToSize(legalText, CW - 12);
  
  // Background card
  const legalH = splitLegal.length * 4.5 + 6;
  doc.setFillColor(...BG);
  doc.roundedRect(MARGIN, y - 2, CW, legalH, 1.5, 1.5, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(RX - 1.5, y - 2, 1.5, legalH, 'F');
  
  doc.text(splitLegal, CX, y + 2, { align: 'center' });
  y += legalH + 4;

  hline(doc, y, MARGIN, RX, BORDER, 0.2);
  y += 8;

  /* ── 7. Date & Signature ── */
  y = ensureSpace(doc, y, 55);
  y = drawDateAndSignature(doc, y, data.date, city);

  /* ── 8. QR Code ── */
  y += 5;
  y = ensureSpace(doc, y, 22);

  // QR with subtle card
  const qrSize = 15;
  const qrX = MARGIN + 3;

  doc.setFillColor(...BG);
  doc.roundedRect(qrX - 1, y - 1, qrSize + 40, qrSize + 2, 1, 1, 'F');
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.15);
  doc.roundedRect(qrX - 1, y - 1, qrSize + 40, qrSize + 2, 1, 1, 'S');

  doc.addImage(qrDataUrl, 'PNG', qrX, y, qrSize, qrSize);
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...TEXT2);
  doc.text('رمز التحقق', qrX + qrSize + 3, y + 4);
  doc.setTextColor(...TEXT3);
  doc.text('Code de vérification', qrX + qrSize + 3, y + 7.5);

  /* ── Footer ── */
  drawFooter(doc);

  return doc.output('blob');
};
