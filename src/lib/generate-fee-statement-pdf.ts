import jsPDF from 'jspdf';
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

export const generateFeeStatementPDF = async (data: FeeStatementData): Promise<Blob> => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await registerFonts(doc);

  const lh = data.letterhead;
  const lawyerName = lh?.lawyerName || data.lawyerName;
  const city = lh?.city || '';

  /* ── 1. Page frame ── */
  drawPageFrame(doc);
  let y = 20;

  /* ── 2. Bilingual Header ── */
  y = drawHeader(doc, lawyerName, lh, y);
  y += 6;

  /* ── 3. Title — بيان أتعاب / Note d'honoraires ── */
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text('بيان أتعاب ومصاريف', CX, y, { align: 'center' });
  y += 5;

  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT3);
  doc.text("Note d'honoraires et frais", CX, y, { align: 'center' });
  y += 4;

  goldLine(doc, y, CX - 25, CX + 25);
  y += 6;

  // Statement number
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT2);
  doc.text(`رقم المرجع: ${data.statementNumber}`, CX, y, { align: 'center' });
  y += 8;

  /* ── 4. Client info table ── */
  const firstCase = data.caseDetails[0];
  const infoRows: [string, string][] = [
    ['الموكل / Client', data.clientName],
  ];
  if (firstCase?.caseNumber) infoRows.push(['رقم الملف / N° Dossier', firstCase.caseNumber]);
  if (firstCase?.court) infoRows.push(['المحكمة / Tribunal', firstCase.court]);
  if (firstCase?.caseType) infoRows.push(['طبيعة النزاع / Nature', firstCase.caseType]);
  if (data.clientCin) infoRows.push(['رقم ب.و / CIN', data.clientCin]);
  if (data.powerOfAttorneyDate) infoRows.push(['تاريخ الوكالة / Date de procuration', data.powerOfAttorneyDate]);

  const rowH = 9;
  const tableH = infoRows.length * rowH;

  for (let i = 0; i < infoRows.length; i++) {
    const ry = y + i * rowH;
    if (i % 2 === 0) {
      doc.setFillColor(...BG);
      doc.rect(MARGIN, ry, CW, rowH, 'F');
    }
    doc.setFillColor(...GOLD);
    doc.rect(RX - 1.5, ry, 1.5, rowH, 'F');

    doc.setFont('IBMPlex', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GOLD);
    doc.text(infoRows[i][0], RX - 5, ry + 3.5, { align: 'right' });

    doc.setFontSize(11);
    doc.setTextColor(...TEXT);
    doc.text(infoRows[i][1], RX - 5, ry + 7.5, { align: 'right' });
  }

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN, y, CW, tableH, 'S');

  y += tableH + 8;

  /* ── 5. Services table (per case) ── */
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    const cd = data.caseDetails[ci];

    // Multi-case header
    if (data.caseDetails.length > 1) {
      y = ensureSpace(doc, y, 20);
      doc.setFillColor(...NAVY);
      doc.roundedRect(MARGIN, y, CW, 7, 1, 1, 'F');
      doc.setFont('IBMPlex', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(`ملف ${ci + 1}: ${cd.caseTitle || cd.caseNumber}`, CX, y + 5, { align: 'center' });
      y += 9;
    }

    // Table header row
    y = ensureSpace(doc, y, 15);
    doc.setFillColor(...NAVY);
    doc.rect(MARGIN, y, CW, 7, 'F');

    doc.setFont('IBMPlex', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('بيان الخدمات / Désignation', RX - 4, y + 5, { align: 'right' });
    doc.text('المبلغ (درهم) / Montant', MARGIN + 4, y + 5, { align: 'left' });
    y += 7;

    // Data rows
    for (let i = 0; i < cd.items.length; i++) {
      const item = cd.items[i];
      const descLines = doc.splitTextToSize(item.description || '—', CW - 44);
      const rH = Math.max(7, descLines.length * 4.5 + 3);

      y = ensureSpace(doc, y, rH + 2);

      if (i % 2 === 0) {
        doc.setFillColor(...BG);
        doc.rect(MARGIN, y, CW, rH, 'F');
      }

      // Left gold accent
      doc.setFillColor(...GOLD);
      doc.rect(RX - 1, y, 1, rH, 'F');

      doc.setFont('IBMPlex', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      doc.text(descLines, RX - 4, y + 4.5, { align: 'right' });

      doc.setTextColor(...TEXT2);
      doc.text(fmt(item.amount), MARGIN + 4, y + 4.5, { align: 'left' });

      y += rH;
      hline(doc, y, MARGIN, RX, BORDER, 0.1);
    }

    y += 3;

    // Summary rows
    const summaryRows: { label: string; value: number; strong?: boolean }[] = [
      { label: 'الأتعاب المهنية / Honoraires', value: cd.lawyerFees },
      { label: 'المصاريف والرسوم / Frais et débours', value: cd.expensesTotal },
      { label: 'المجموع الصافي / Sous-total HT', value: cd.subtotal, strong: true },
    ];
    if (cd.taxRate > 0) summaryRows.push({ label: `الضريبة / TVA (${cd.taxRate}%)`, value: cd.taxAmount });
    summaryRows.push({ label: 'المجموع الكلي / Total TTC', value: cd.totalAmount, strong: true });

    for (const row of summaryRows) {
      const rh = 7;
      y = ensureSpace(doc, y, rh + 2);

      if (row.strong) {
        doc.setFillColor(240, 240, 245);
        doc.rect(MARGIN, y, CW, rh, 'F');
      }

      hline(doc, y, MARGIN, RX, BORDER, 0.1);

      doc.setFont('IBMPlex', row.strong ? 'bold' : 'normal');
      doc.setFontSize(row.strong ? 10 : 9);
      doc.setTextColor(...(row.strong ? NAVY : TEXT2));
      doc.text(row.label, RX - 4, y + 5, { align: 'right' });

      doc.setTextColor(...TEXT);
      doc.text(fmt(row.value), MARGIN + 4, y + 5, { align: 'left' });

      y += rh;
    }

    y += 5;
  }

  /* ── 6. Grand total box ── */
  y = ensureSpace(doc, y, 35);
  hline(doc, y, MARGIN, RX, NAVY, 0.5);
  y += 6;

  // Navy total box
  doc.setFillColor(...NAVY);
  doc.roundedRect(MARGIN, y, CW, 18, 2, 2, 'F');

  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GOLD);
  doc.text('الواجب أداؤه / Net à payer', RX - 5, y + 5, { align: 'right' });

  doc.setFont('Amiri', 'normal');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(`${fmt(data.grandTotal)} MAD`, MARGIN + 5, y + 14, { align: 'left' });

  y += 22;

  // Tafkeet
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT2);
  doc.text('المبلغ بالحروف:  ' + numberToArabicWords(data.grandTotal), RX - 4, y, { align: 'right' });
  y += 6;

  hline(doc, y, MARGIN, RX, BORDER, 0.2);
  y += 6;

  /* ── 7. Notes ── */
  const noteText = data.notes || 'يتم تحديد الأتعاب وفقاً للقوانين المنظمة لمهنة المحاماة بالمغرب وللاتفاق المسبق.';
  doc.setFont('IBMPlex', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT2);
  const noteLines = doc.splitTextToSize(noteText, CW - 10);
  y = ensureSpace(doc, y, noteLines.length * 4 + 10);
  doc.text(noteLines, CX, y, { align: 'center' });
  y += noteLines.length * 4 + 6;

  hline(doc, y, MARGIN, RX, BORDER, 0.2);
  y += 8;

  /* ── 8. Date & Signature ── */
  y = ensureSpace(doc, y, 55);
  y = drawDateAndSignature(doc, y, data.date, city);

  /* ── Footer ── */
  drawFooter(doc);

  return doc.output('blob');
};
