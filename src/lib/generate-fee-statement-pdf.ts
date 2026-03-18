import jsPDF from 'jspdf';
import {
  type RGB, type LetterheadInfo,
  NAVY, TEXT, TEXT2, TEXT3, BORDER, BG, WHITE,
  PW, MARGIN, RX, CW, CX,
  registerFonts, fmt, hline, numberToArabicWords,
  drawTopBar, drawHeader, drawFooter, drawDateAndSignature, ensureSpace,
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

  /* ── 1. Navy top bar ── */
  drawTopBar(doc);
  let y = 16;

  /* ── 2. Header ── */
  y = drawHeader(doc, lawyerName, lh, y);
  y += 10;

  /* ── 3. Title — بيان أتعاب ── */
  doc.setFont('Amiri');
  doc.setFontSize(28);
  doc.setTextColor(...TEXT);
  doc.text('بيان أتعاب', CX, y, { align: 'center' });
  y += 5;

  doc.setDrawColor(...TEXT);
  doc.setLineWidth(0.4);
  doc.line(CX - 22, y, CX + 22, y);
  y += 7;

  doc.setFont('IBMPlex');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT3);
  doc.text(`رقم المرجع: ${data.statementNumber}`, CX, y, { align: 'center' });
  y += 10;

  /* ── 4. Client info box ── */
  const firstCase = data.caseDetails[0];
  const infoFields: { label: string; value: string }[] = [
    { label: 'الموكل', value: data.clientName },
  ];
  if (firstCase?.caseNumber) infoFields.push({ label: 'رقم الملف', value: firstCase.caseNumber });
  if (firstCase?.court) infoFields.push({ label: 'المحكمة المختصة', value: firstCase.court });
  if (firstCase?.caseType) infoFields.push({ label: 'طبيعة النزاع', value: firstCase.caseType });
  if (data.clientCin) infoFields.push({ label: 'رقم البطاقة الوطنية', value: data.clientCin });
  if (data.powerOfAttorneyDate) infoFields.push({ label: 'تاريخ الوكالة', value: data.powerOfAttorneyDate });

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

  y += boxH + 10;

  /* ── 5. Services table (per case) ── */
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    const cd = data.caseDetails[ci];

    // Multi-case header
    if (data.caseDetails.length > 1) {
      y = ensureSpace(doc, y, 20);
      doc.setFillColor(...NAVY);
      doc.rect(MARGIN, y, CW, 7, 'F');
      doc.setFont('IBMPlex');
      doc.setFontSize(9);
      doc.setTextColor(...WHITE);
      doc.text(`ملف ${ci + 1}: ${cd.caseTitle || cd.caseNumber}`, CX, y + 5, { align: 'center' });
      y += 9;
    }

    // Table header
    y = ensureSpace(doc, y, 15);
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, RX, y);

    doc.setFont('IBMPlex');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text('بيان الخدمات', RX - 2, y + 5, { align: 'right' });
    doc.text('المبلغ (درهم)', MARGIN + 2, y + 5, { align: 'left' });
    y += 6;

    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, RX, y);
    y += 1;

    // Rows
    for (let i = 0; i < cd.items.length; i++) {
      const item = cd.items[i];
      const descLines = doc.splitTextToSize(item.description || '—', CW - 44);
      const rowH = Math.max(8, descLines.length * 5 + 4);

      y = ensureSpace(doc, y, rowH + 2);

      if (i % 2 === 0) {
        doc.setFillColor(...BG);
        doc.rect(MARGIN, y, CW, rowH, 'F');
      }

      doc.setFont('IBMPlex');
      doc.setFontSize(9.5);
      doc.setTextColor(...TEXT);
      doc.text(descLines, RX - 2, y + 5, { align: 'right' });

      doc.setTextColor(...TEXT2);
      doc.text(fmt(item.amount), MARGIN + 2, y + 5, { align: 'left' });

      y += rowH;
      hline(doc, y, MARGIN, RX, BORDER, 0.1);
    }

    y += 4;

    // Summary rows
    const summaryRows: { label: string; value: number; strong?: boolean }[] = [
      { label: 'الأتعاب المهنية', value: cd.lawyerFees },
      { label: 'المصاريف والرسوم', value: cd.expensesTotal },
      { label: 'المجموع (الصافي)', value: cd.subtotal, strong: true },
    ];
    if (cd.taxRate > 0) summaryRows.push({ label: `الضريبة (${cd.taxRate}%)`, value: cd.taxAmount });
    summaryRows.push({ label: 'المجموع (TTC)', value: cd.totalAmount, strong: true });

    for (const row of summaryRows) {
      const rh = 7;
      y = ensureSpace(doc, y, rh + 2);

      if (row.strong) {
        doc.setFillColor(...BG);
        doc.rect(MARGIN, y, CW, rh, 'F');
      }

      hline(doc, y, MARGIN, RX, BORDER, 0.1);

      doc.setFont('IBMPlex');
      doc.setFontSize(row.strong ? 10.5 : 9.5);
      doc.setTextColor(...(row.strong ? TEXT : TEXT2));
      doc.text(row.label, RX - 2, y + 5, { align: 'right' });

      doc.setTextColor(...TEXT);
      doc.text(fmt(row.value), MARGIN + 2, y + 5, { align: 'left' });

      y += rh;
    }

    y += 5;
  }

  /* ── 6. Grand total ── */
  y = ensureSpace(doc, y, 30);
  hline(doc, y, MARGIN, RX, NAVY, 0.5);
  y += 10;

  doc.setFont('IBMPlex');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT2);
  doc.text('الواجب أداؤه:', RX, y, { align: 'right' });

  doc.setFont('Amiri');
  doc.setFontSize(24);
  doc.setTextColor(...TEXT);
  doc.text(`MAD  ${fmt(data.grandTotal)}`, MARGIN, y + 1, { align: 'left' });
  y += 10;

  doc.setFont('IBMPlex');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT3);
  doc.text('المبلغ بالحروف:  ' + numberToArabicWords(data.grandTotal), RX, y, { align: 'right' });
  y += 8;

  hline(doc, y, MARGIN, RX);
  y += 8;

  /* ── 7. Notes ── */
  const noteText = data.notes || 'يتم تحديد الأتعاب وفقاً للقوانين المنظمة لمهنة المحاماة بالمغرب وللاتفاق المسبق.';
  doc.setFont('IBMPlex');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT2);
  const noteLines = doc.splitTextToSize(noteText, CW - 10);
  y = ensureSpace(doc, y, noteLines.length * 4.5 + 10);
  doc.text(noteLines, CX, y, { align: 'center' });
  y += noteLines.length * 4.5 + 6;

  hline(doc, y, MARGIN, RX);
  y += 10;

  /* ── 8. Date & Signature ── */
  y = ensureSpace(doc, y, 60);
  y = drawDateAndSignature(doc, y, data.date, city);

  /* ── Footer ── */
  drawFooter(doc);

  return doc.output('blob');
};
