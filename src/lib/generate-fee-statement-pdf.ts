import jsPDF from 'jspdf';

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

export interface LetterheadInfo {
  lawyerName: string;
  nameFr?: string;
  titleAr?: string;
  titleFr?: string;
  barNameAr?: string;
  barNameFr?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
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

const fmt = (n: number) =>
  n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

const BLACK: [number, number, number] = [0, 0, 0];
const GRAY: [number, number, number] = [120, 120, 120];
const LINE: [number, number, number] = [200, 200, 200];

export const generateFeeStatementPDF = async (data: FeeStatementData): Promise<Blob> => {
  const plexBase64 = await loadFont('/fonts/IBMPlexSansArabic-Regular.ttf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('IBMPlexSansArabic-Regular.ttf', plexBase64);
  doc.addFont('IBMPlexSansArabic-Regular.ttf', 'IBMPlex', 'normal');
  doc.setFont('IBMPlex');

  const pw = 210, m = 20, rightX = pw - m, contentW = pw - m * 2, cx = pw / 2;

  const lh = data.letterhead;
  const lawyerName = lh?.lawyerName || data.lawyerName;
  const title = [lh?.titleAr, lh?.barNameAr ? `لدى ${lh.barNameAr}` : ''].filter(Boolean).join(' ').trim();
  const address = [lh?.address, lh?.city].filter(Boolean).join('، ');
  const phone = lh?.phone || '';
  const email = lh?.email || '';
  const city = lh?.city || '';

  let y = 14;

  // ── Header ──
  doc.setFontSize(13);
  doc.setTextColor(...BLACK);
  doc.text('مكتب الأستاذ', cx, y, { align: 'center' });
  y += 9;

  doc.setFontSize(22);
  doc.text(lawyerName, cx, y, { align: 'center' });
  y += 8;

  if (title) {
    doc.setFontSize(11);
    doc.setTextColor(...GRAY);
    doc.text(title, cx, y, { align: 'center' });
    y += 6;
  }

  doc.setTextColor(...BLACK);

  if (address) {
    doc.setFontSize(9);
    doc.text(address, cx, y, { align: 'center' });
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
  doc.text('بيان أتعاب', cx, y, { align: 'center' });
  y += 5;

  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.4);
  doc.line(cx - 20, y, cx + 20, y);
  y += 7;

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`رقم المرجع: ${data.statementNumber}`, cx, y, { align: 'center' });
  y += 10;

  // ── Client info ──
  doc.setTextColor(...BLACK);
  const infoFields: { label: string; value: string }[] = [
    { label: 'الموكل', value: data.clientName },
  ];
  const firstCase = data.caseDetails[0];
  if (firstCase?.caseNumber) infoFields.push({ label: 'رقم الملف', value: firstCase.caseNumber });
  if (firstCase?.court) infoFields.push({ label: 'المحكمة المختصة', value: firstCase.court });
  if (firstCase?.caseType) infoFields.push({ label: 'طبيعة النزاع', value: firstCase.caseType });
  if (data.clientCin) infoFields.push({ label: 'رقم البطاقة الوطنية', value: data.clientCin });
  if (data.powerOfAttorneyDate) infoFields.push({ label: 'تاريخ الوكالة', value: data.powerOfAttorneyDate });

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

  y += 3;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(m, y, rightX, y);
  y += 8;

  // ── Services table ──
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    const cd = data.caseDetails[ci];

    if (data.caseDetails.length > 1) {
      doc.setFontSize(10);
      doc.setTextColor(...BLACK);
      doc.text(`ملف ${ci + 1}: ${cd.caseTitle}`, rightX, y, { align: 'right' });
      y += 6;
    }

    // Table header
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);
    doc.text('بيان الخدمات', rightX, y, { align: 'right' });
    doc.text('المبلغ (درهم)', m, y, { align: 'left' });
    y += 3;
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.3);
    doc.line(m, y, rightX, y);
    y += 6;

    // Items
    for (const item of cd.items) {
      doc.setFontSize(10);
      doc.setTextColor(...BLACK);
      const lines = doc.splitTextToSize(item.description, contentW - 40);
      doc.text(lines, rightX, y, { align: 'right' });
      doc.text(fmt(item.amount), m, y, { align: 'left' });
      y += Math.max(6, lines.length * 5) + 2;

      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.1);
      doc.line(m, y - 1, rightX, y - 1);
    }

    y += 3;

    // Summary
    const summaryRows = [
      { label: 'الأتعاب المهنية', value: cd.lawyerFees },
      { label: 'المصاريف والرسوم', value: cd.expensesTotal },
      { label: 'المجموع (الصافي)', value: cd.subtotal },
    ];
    if (cd.taxRate > 0) {
      summaryRows.push({ label: `الضريبة (${cd.taxRate}%)`, value: cd.taxAmount });
    }
    summaryRows.push({ label: 'المجموع (TTC)', value: cd.totalAmount });

    for (const row of summaryRows) {
      doc.setFontSize(10);
      doc.setTextColor(...BLACK);
      doc.text(row.label, rightX, y, { align: 'right' });
      doc.text(fmt(row.value), m, y, { align: 'left' });
      y += 6;
    }

    y += 4;
  }

  // ── Grand total ──
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.line(m, y, rightX, y);
  y += 8;

  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text('الواجب أداؤه:', rightX, y, { align: 'right' });
  doc.setFontSize(20);
  doc.text(`${fmt(data.grandTotal)} MAD`, m, y + 1, { align: 'left' });
  y += 10;

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(numberToArabicWords(data.grandTotal), rightX, y, { align: 'right' });
  y += 10;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(m, y, rightX, y);
  y += 8;

  // ── Notes ──
  const noteText = data.notes || 'يتم تحديد الأتعاب وفقاً للقوانين المنظمة لمهنة المحاماة بالمغرب وللاتفاق المسبق.';
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  const noteLines = doc.splitTextToSize(noteText, contentW);
  doc.text(noteLines, cx, y, { align: 'center' });
  y += noteLines.length * 5 + 8;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(m, y, rightX, y);
  y += 10;

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

  // ── Footer ──
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.1);
  doc.line(m, 290, rightX, 290);
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text('وثيقة موقعة إلكترونياً', cx, 293, { align: 'center' });

  return doc.output('blob');
};
