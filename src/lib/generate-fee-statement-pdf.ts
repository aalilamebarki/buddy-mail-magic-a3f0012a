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

const fmt = (n: number) =>
  n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ── Colors — formal classic palette ── */
const DARK: [number, number, number] = [33, 37, 41];       // almost-black
const MID: [number, number, number] = [108, 117, 125];     // secondary text
const LIGHT: [number, number, number] = [173, 181, 189];   // hints
const RULE: [number, number, number] = [206, 212, 218];    // borders
const ACCENT: [number, number, number] = [52, 58, 64];     // table header bg
const PANEL: [number, number, number] = [248, 249, 250];   // light bg panels
const WHITE: [number, number, number] = [255, 255, 255];

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

/* ── Helper: draw a horizontal rule ── */
const rule = (doc: jsPDF, y: number, x1: number, x2: number, color = RULE, w = 0.25) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(w);
  doc.line(x1, y, x2, y);
};

export const generateFeeStatementPDF = async (data: FeeStatementData): Promise<Blob> => {
  const plexBase64 = await loadFont('/fonts/IBMPlexSansArabic-Regular.ttf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('IBMPlexSansArabic-Regular.ttf', plexBase64);
  doc.addFont('IBMPlexSansArabic-Regular.ttf', 'IBMPlex', 'normal');
  doc.setFont('IBMPlex');

  const pw = 210, m = 20, rX = pw - m, cW = pw - m * 2, cx = pw / 2;

  const lh = data.letterhead;
  const lawyerName = lh?.lawyerName || data.lawyerName;
  const title = [lh?.titleAr, lh?.barNameAr ? `لدى ${lh.barNameAr}` : ''].filter(Boolean).join(' ').trim();
  const address = [lh?.address, lh?.city].filter(Boolean).join('، ');
  const phone = lh?.phone || '';
  const email = lh?.email || '';
  const city = lh?.city || '';

  let y = 12;

  /* ═══ Page border — thin elegant frame ═══ */
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

  if (title) {
    doc.setFontSize(10);
    doc.setTextColor(...MID);
    doc.text(title, cx, y, { align: 'center' });
    y += 6;
  }

  // Contact line
  const contactParts = [address, phone ? `الهاتف: ${phone}` : '', email ? `البريد: ${email}` : ''].filter(Boolean);
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
  doc.text('بيان أتعاب ومصاريف', cx, y, { align: 'center' });
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(...LIGHT);
  doc.text(`رقم المرجع: ${data.statementNumber}`, cx, y, { align: 'center' });
  y += 10;

  /* ═══ Client info — panel with light bg ═══ */
  const firstCase = data.caseDetails[0];
  const infoItems: { label: string; value: string }[] = [
    { label: 'الموكل', value: data.clientName },
  ];
  if (firstCase?.caseNumber) infoItems.push({ label: 'رقم الملف', value: firstCase.caseNumber });
  if (firstCase?.court) infoItems.push({ label: 'المحكمة', value: firstCase.court });
  if (firstCase?.caseType) infoItems.push({ label: 'طبيعة النزاع', value: firstCase.caseType });
  if (data.clientCin) infoItems.push({ label: 'رقم البطاقة', value: data.clientCin });
  if (data.powerOfAttorneyDate) infoItems.push({ label: 'تاريخ الوكالة', value: data.powerOfAttorneyDate });

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

  y += panelH + 8;

  /* ═══ Services table — per case ═══ */
  for (let ci = 0; ci < data.caseDetails.length; ci++) {
    const cd = data.caseDetails[ci];

    if (data.caseDetails.length > 1) {
      doc.setFontSize(10);
      doc.setTextColor(...DARK);
      doc.text(`ملف ${ci + 1}: ${cd.caseTitle || cd.caseNumber}`, rX, y, { align: 'right' });
      y += 6;
    }

    // Table header — dark bg
    const headerH = 7;
    doc.setFillColor(...ACCENT);
    doc.rect(m, y, cW, headerH, 'F');

    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.text('بيان الخدمات', rX - 4, y + 5, { align: 'right' });
    doc.text('المبلغ (درهم)', m + 4, y + 5, { align: 'left' });
    y += headerH;

    // Table rows
    for (let i = 0; i < cd.items.length; i++) {
      const item = cd.items[i];
      const lines = doc.splitTextToSize(item.description || '—', cW - 50);
      const rowH = Math.max(7.5, lines.length * 5 + 3);

      // Alternate rows
      if (i % 2 === 0) {
        doc.setFillColor(...PANEL);
        doc.rect(m, y, cW, rowH, 'F');
      }

      // Row border bottom
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.1);
      doc.line(m, y + rowH, rX, y + rowH);

      doc.setFontSize(9.5);
      doc.setTextColor(...DARK);
      doc.text(lines, rX - 4, y + 5, { align: 'right' });

      doc.setTextColor(...MID);
      doc.text(fmt(item.amount), m + 4, y + 5, { align: 'left' });

      y += rowH;
    }

    y += 3;

    // Summary rows
    const summaryData: { label: string; value: number; bold?: boolean }[] = [
      { label: 'الأتعاب المهنية', value: cd.lawyerFees },
      { label: 'المصاريف والرسوم', value: cd.expensesTotal },
      { label: 'المجموع (الصافي)', value: cd.subtotal, bold: true },
    ];
    if (cd.taxRate > 0) summaryData.push({ label: `الضريبة (${cd.taxRate}%)`, value: cd.taxAmount });
    summaryData.push({ label: 'المجموع (TTC)', value: cd.totalAmount, bold: true });

    for (const row of summaryData) {
      if (row.bold) {
        doc.setFillColor(...PANEL);
        doc.rect(m, y - 0.5, cW, 7, 'F');
      }

      rule(doc, y - 0.5, m, rX, RULE, 0.1);

      doc.setFontSize(row.bold ? 10.5 : 9.5);
      doc.setTextColor(...(row.bold ? DARK : MID));
      doc.text(row.label, rX - 4, y + 4.5, { align: 'right' });

      doc.setTextColor(...DARK);
      doc.text(fmt(row.value), m + 4, y + 4.5, { align: 'left' });

      y += 7;
    }

    y += 4;
  }

  /* ═══ Grand total ═══ */
  rule(doc, y, m, rX, DARK, 0.5);
  y += 8;

  doc.setFontSize(12);
  doc.setTextColor(...MID);
  doc.text('الواجب أداؤه:', rX, y, { align: 'right' });

  doc.setFontSize(22);
  doc.setTextColor(...DARK);
  doc.text(`${fmt(data.grandTotal)} MAD`, m, y + 1, { align: 'left' });
  y += 10;

  doc.setFontSize(9);
  doc.setTextColor(...LIGHT);
  doc.text(numberToArabicWords(data.grandTotal), rX, y, { align: 'right' });
  y += 8;

  rule(doc, y, m, rX);
  y += 8;

  /* ═══ Notes ═══ */
  const noteText = data.notes || 'يتم تحديد الأتعاب وفقاً للقوانين المنظمة لمهنة المحاماة بالمغرب وللاتفاق المسبق.';
  doc.setFontSize(8.5);
  doc.setTextColor(...MID);
  const noteLines = doc.splitTextToSize(noteText, cW - 10);
  doc.text(noteLines, cx, y, { align: 'center' });
  y += noteLines.length * 4.5 + 6;

  rule(doc, y, m, rX);
  y += 10;

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

  /* ═══ Footer ═══ */
  rule(doc, 287, m, rX, RULE, 0.15);
  doc.setFontSize(7);
  doc.setTextColor(...LIGHT);
  doc.text('وثيقة موقعة إلكترونياً', cx, 290, { align: 'center' });

  return doc.output('blob');
};
