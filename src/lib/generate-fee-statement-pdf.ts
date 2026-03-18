import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import {
  type RGB, type LetterheadInfo,
  NAVY, GOLD, TEXT, TEXT2, TEXT3, BORDER, BG, WHITE,
  PW, MARGIN, RX, CW, CX,
  registerFonts, fmt, hline, numberToArabicWords, goldLine,
  drawPageFrame, drawHeader, drawFooter, drawDateAndSignature, ensureSpace,
} from './pdf-utils';

export type { LetterheadInfo };

export interface FeeStatementItem {
  description: string;
  amount: number;
}

export interface CaseDetailData {
  caseTitle: string;
  caseNumber: string;
  court?: string;
  caseType?: string;
  items: FeeStatementItem[];
  lawyerFees: number;
  expensesTotal: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
}

export interface FeeStatementData {
  statementNumber: string;
  signatureUuid: string;
  clientName: string;
  clientCin?: string;
  clientPhone?: string;
  powerOfAttorneyDate?: string;
  taxRate: number;
  grandSubtotal: number;
  grandTaxAmount: number;
  grandTotal: number;
  caseDetails: CaseDetailData[];
  notes?: string;
  date: string;
  lawyerName: string;
  letterhead?: LetterheadInfo;
}

/* ── QR Code generator ── */
const generateQRDataUrl = async (text: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(text, {
      width: 200,
      margin: 1,
      color: { dark: '#1a2a44', light: '#ffffff' },
    });
  } catch {
    return '';
  }
};

/* ── Draw client info card ── */
const drawClientInfoCard = (
  doc: jsPDF,
  y: number,
  data: FeeStatementData,
  firstCase: CaseDetailData,
): number => {
  const infoRows: [string, string, string][] = [
    ['الموكل', 'Client', data.clientName],
  ];
  if (firstCase?.caseNumber) infoRows.push(['رقم الملف', 'N° Dossier', firstCase.caseNumber]);
  if (firstCase?.court) infoRows.push(['المحكمة', 'Tribunal', firstCase.court]);
  if (firstCase?.caseType) infoRows.push(['طبيعة النزاع', 'Nature du litige', firstCase.caseType]);
  if (data.clientCin) infoRows.push(['رقم ب.و', 'CIN', data.clientCin]);
  if (data.powerOfAttorneyDate) infoRows.push(['تاريخ الوكالة', 'Date procuration', data.powerOfAttorneyDate]);

  const rowH = 9;
  const labelColW = 48;
  const tableW = CW;

  // Card background
  doc.setFillColor(252, 252, 254);
  doc.roundedRect(MARGIN, y - 1, tableW, infoRows.length * rowH + 2, 2, 2, 'F');
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, y - 1, tableW, infoRows.length * rowH + 2, 2, 2, 'S');

  for (let i = 0; i < infoRows.length; i++) {
    const ry = y + i * rowH;

    // Gold accent bar on right
    doc.setFillColor(...GOLD);
    doc.rect(RX - 2, ry, 2, rowH, 'F');

    // Bilingual label
    doc.setFont('IBMPlex', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    doc.text(infoRows[i][0], RX - 6, ry + 3.5, { align: 'right' });

    doc.setFont('IBMPlex', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...TEXT3);
    doc.text(infoRows[i][1], RX - 6, ry + 7, { align: 'right' });

    // Value
    doc.setFont('Amiri', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...TEXT);
    doc.text(infoRows[i][2], RX - labelColW - 4, ry + 6, { align: 'right' });

    // Separator
    if (i < infoRows.length - 1) {
      hline(doc, ry + rowH, MARGIN + 4, RX - 4, [230, 230, 235] as RGB, 0.15);
    }
  }

  return y + infoRows.length * rowH + 6;
};

/* ── Draw services table for a case ── */
const drawServicesTable = (
  doc: jsPDF,
  y: number,
  cd: CaseDetailData,
  caseIndex: number,
  isMultiCase: boolean,
): number => {
  // Multi-case header badge
  if (isMultiCase) {
    y = ensureSpace(doc, y, 20);
    doc.setFillColor(...NAVY);
    doc.roundedRect(CX - 42, y, 84, 7, 2, 2, 'F');
    doc.setFont('IBMPlex', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`ملف ${caseIndex + 1}: ${cd.caseTitle || cd.caseNumber}`, CX, y + 5, { align: 'center' });
    y += 11;
  }

  // Table header
  y = ensureSpace(doc, y, 14);
  doc.setFillColor(...NAVY);
  doc.roundedRect(MARGIN, y, CW, 7.5, 1.5, 1.5, 'F');

  doc.setFont('IBMPlex', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('بيان الخدمات والمصاريف', RX - 6, y + 5, { align: 'right' });
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(6);
  doc.text('Désignation des services', RX - 52, y + 5, { align: 'right' });
  doc.text('المبلغ (درهم)', MARGIN + 6, y + 5, { align: 'left' });
  y += 7.5;

  // Item rows
  for (let i = 0; i < cd.items.length; i++) {
    const item = cd.items[i];
    const descLines = doc.splitTextToSize(item.description || '—', CW - 46);
    const rH = Math.max(7.5, descLines.length * 4 + 3.5);

    y = ensureSpace(doc, y, rH + 2);

    // Alternating row bg
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 253);
      doc.rect(MARGIN, y, CW, rH, 'F');
    }

    // Row number circle
    doc.setFillColor(...GOLD);
    doc.circle(RX - 4, y + rH / 2, 2.2, 'F');
    doc.setFont('IBMPlex', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.text(`${i + 1}`, RX - 4, y + rH / 2 + 0.8, { align: 'center' });

    // Description
    doc.setFont('IBMPlex', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT);
    doc.text(descLines, RX - 10, y + 4.5, { align: 'right' });

    // Amount
    doc.setFont('IBMPlex', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text(fmt(item.amount), MARGIN + 6, y + 4.5, { align: 'left' });

    y += rH;
    hline(doc, y, MARGIN + 2, RX - 2, [235, 235, 240] as RGB, 0.1);
  }

  y += 4;

  // Summary section
  const summaryRows: { labelAr: string; labelFr: string; value: number; highlight?: boolean }[] = [
    { labelAr: 'الأتعاب المهنية', labelFr: 'Honoraires', value: cd.lawyerFees },
    { labelAr: 'المصاريف والرسوم', labelFr: 'Frais et débours', value: cd.expensesTotal },
    { labelAr: 'المجموع الصافي', labelFr: 'Sous-total HT', value: cd.subtotal, highlight: true },
  ];
  if (cd.taxRate > 0) {
    summaryRows.push({ labelAr: `الضريبة (${cd.taxRate}%)`, labelFr: `TVA (${cd.taxRate}%)`, value: cd.taxAmount });
  }
  summaryRows.push({ labelAr: 'المجموع الكلي', labelFr: 'Total TTC', value: cd.totalAmount, highlight: true });

  for (const row of summaryRows) {
    const rh = 7.5;
    y = ensureSpace(doc, y, rh + 2);

    if (row.highlight) {
      doc.setFillColor(245, 245, 250);
      doc.rect(MARGIN, y, CW, rh, 'F');
      doc.setFillColor(...GOLD);
      doc.rect(MARGIN, y, 2, rh, 'F');
    }

    hline(doc, y, MARGIN, RX, [230, 230, 235] as RGB, 0.1);

    // Arabic label
    doc.setFont('IBMPlex', row.highlight ? 'bold' : 'normal');
    doc.setFontSize(row.highlight ? 9 : 8);
    doc.setTextColor(...(row.highlight ? NAVY : TEXT2));
    doc.text(row.labelAr, RX - 6, y + 4, { align: 'right' });

    // French label
    doc.setFont('IBMPlex', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...TEXT3);
    doc.text(row.labelFr, RX - 6, y + 6.5, { align: 'right' });

    // Value
    doc.setFont('IBMPlex', row.highlight ? 'bold' : 'normal');
    doc.setFontSize(row.highlight ? 9.5 : 8.5);
    doc.setTextColor(...(row.highlight ? NAVY : TEXT));
    doc.text(fmt(row.value), MARGIN + 6, y + 5, { align: 'left' });

    y += rh;
  }

  return y + 5;
};

/* ── Draw grand total box ── */
const drawGrandTotal = (doc: jsPDF, y: number, data: FeeStatementData): number => {
  y = ensureSpace(doc, y, 38);

  goldLine(doc, y, CX - 28, CX + 28);
  y += 5;

  // Navy total card
  const cardH = 20;
  doc.setFillColor(...NAVY);
  doc.roundedRect(MARGIN, y, CW, cardH, 3, 3, 'F');

  // Gold inner border accent
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN + 1.5, y + 1.5, CW - 3, cardH - 3, 2, 2, 'S');

  // Label
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GOLD);
  doc.text('الواجب أداؤه', RX - 6, y + 6, { align: 'right' });
  doc.setFontSize(6.5);
  doc.text('Net à payer', RX - 6, y + 10, { align: 'right' });

  // Amount
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(`${fmt(data.grandTotal)} MAD`, MARGIN + 6, y + 13.5, { align: 'left' });

  y += cardH + 5;

  // Tafkeet
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT2);
  const tafkeet = numberToArabicWords(data.grandTotal);
  const tafkeetLines = doc.splitTextToSize(`المبلغ بالحروف:  ${tafkeet}`, CW - 10);
  doc.text(tafkeetLines, CX, y, { align: 'center' });
  y += tafkeetLines.length * 4 + 4;

  return y;
};

/* ── Draw QR verification section ── */
const drawQRSection = async (doc: jsPDF, y: number, data: FeeStatementData): Promise<number> => {
  y = ensureSpace(doc, y, 30);

  const verifyUrl = `${window.location.origin}/verify-invoice?uuid=${data.signatureUuid}`;
  const qrDataUrl = await generateQRDataUrl(verifyUrl);

  if (qrDataUrl) {
    const qrSize = 18;
    const qrX = MARGIN + 4;
    const qrY = y;

    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    doc.setFont('IBMPlex', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...TEXT3);
    doc.text('رمز التحقق من صحة الوثيقة', qrX + qrSize + 4, qrY + 5);
    doc.text('Code de vérification du document', qrX + qrSize + 4, qrY + 9);

    doc.setFontSize(5.5);
    doc.setTextColor(...GOLD);
    doc.text(`Réf: ${data.statementNumber}`, qrX + qrSize + 4, qrY + 13);

    y = qrY + qrSize + 4;
  }

  return y;
};

/* ══════════════════════════════════════
   MAIN — Generate Fee Statement PDF
   ══════════════════════════════════════ */
export const generateFeeStatementPDF = async (data: FeeStatementData): Promise<Blob> => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await registerFonts(doc);

  const lh = data.letterhead;
  const lawyerName = lh?.lawyerName || data.lawyerName;
  const city = lh?.city || '';

  /* ── 1. Page frame ── */
  drawPageFrame(doc);
  let y = 18;

  /* ── 2. Bilingual Header ── */
  y = drawHeader(doc, lawyerName, lh, y);
  y += 4;

  /* ── 3. Title ── */
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(20);
  doc.setTextColor(...NAVY);
  doc.text('بيان الأتعاب والمصاريف', CX, y, { align: 'center' });
  y += 5;

  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT3);
  doc.text("Note d'honoraires et frais", CX, y, { align: 'center' });
  y += 4;

  goldLine(doc, y, CX - 25, CX + 25);
  y += 5;

  // Statement number badge
  const badgeW = 48;
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(CX - badgeW / 2, y - 2, badgeW, 7, 2, 2, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.roundedRect(CX - badgeW / 2, y - 2, badgeW, 7, 2, 2, 'S');

  doc.setFont('IBMPlex', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...NAVY);
  doc.text(data.statementNumber, CX, y + 2.5, { align: 'center' });
  y += 10;

  /* ── 4. Client info card ── */
  const firstCase = data.caseDetails[0];
  y = drawClientInfoCard(doc, y, data, firstCase);

  /* ── 5. Services tables (per case) ── */
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    y = drawServicesTable(doc, y, data.caseDetails[ci], ci, data.caseDetails.length > 1);
  }

  /* ── 6. Grand total ── */
  y = drawGrandTotal(doc, y, data);

  hline(doc, y, MARGIN, RX, BORDER, 0.2);
  y += 5;

  /* ── 7. Notes ── */
  const noteText = data.notes || 'يتم تحديد الأتعاب وفقاً للقوانين المنظمة لمهنة المحاماة بالمغرب وللاتفاق المسبق.';
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...TEXT2);
  const noteLines = doc.splitTextToSize(noteText, CW - 10);
  y = ensureSpace(doc, y, noteLines.length * 4 + 8);
  doc.text(noteLines, CX, y, { align: 'center' });
  y += noteLines.length * 4 + 5;

  hline(doc, y, MARGIN, RX, BORDER, 0.2);
  y += 5;

  /* ── 8. Date & Signature ── */
  y = ensureSpace(doc, y, 50);
  y = drawDateAndSignature(doc, y, data.date, city);

  /* ── 9. QR verification ── */
  y += 4;
  y = await drawQRSection(doc, y, data);

  /* ── Footer ── */
  drawFooter(doc);

  return doc.output('blob');
};
