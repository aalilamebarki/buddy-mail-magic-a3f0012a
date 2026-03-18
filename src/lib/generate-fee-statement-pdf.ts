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

type RgbColor = [number, number, number];

const fontCache: Record<string, string> = {};

const loadFont = async (path: string): Promise<string> => {
  if (fontCache[path]) return fontCache[path];

  const response = await fetch(path);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  const base64 = btoa(binary);
  fontCache[path] = base64;
  return base64;
};

const NAVY: RgbColor = [30, 47, 78];
const GOLD: RgbColor = [200, 165, 93];
const TEXT_DARK: RgbColor = [43, 55, 78];
const TEXT_MID: RgbColor = [103, 118, 142];
const TEXT_LIGHT: RgbColor = [150, 161, 179];
const BORDER: RgbColor = [230, 235, 242];
const PANEL_BG: RgbColor = [245, 247, 250];
const WHITE: RgbColor = [255, 255, 255];

const formatMoney = (value: number) =>
  value.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const compactUnique = (values: Array<string | undefined>) => {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });

  return result;
};

const joinValues = (values: Array<string | undefined>, fallback = '—') => {
  const items = compactUnique(values);
  return items.length > 0 ? items.join('، ') : fallback;
};

const drawRule = (
  doc: jsPDF,
  y: number,
  left: number,
  right: number,
  color: RgbColor = BORDER,
  width = 0.2,
) => {
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.line(left, y, right, y);
};

const drawDashedRect = (doc: jsPDF, x: number, y: number, width: number, height: number) => {
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);

  for (let dx = x; dx < x + width; dx += 2.4) {
    doc.line(dx, y, Math.min(dx + 1.2, x + width), y);
    doc.line(dx, y + height, Math.min(dx + 1.2, x + width), y + height);
  }

  for (let dy = y; dy < y + height; dy += 2.4) {
    doc.line(x, dy, x, Math.min(dy + 1.2, y + height));
    doc.line(x + width, dy, x + width, Math.min(dy + 1.2, y + height));
  }
};

const numberToArabicWords = (num: number): string => {
  if (num === 0) return 'صفر درهم';

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const parts: string[] = [];

  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = Math.floor(num % 1000);

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else parts.push(`${ones[millions]} ملايين`);
  }

  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('ألف');
    } else if (thousands === 2) {
      parts.push('ألفان');
    } else if (thousands >= 3 && thousands <= 10) {
      parts.push(`${ones[thousands]} آلاف`);
    } else {
      const tHundreds = Math.floor(thousands / 100);
      const tRemainder = thousands % 100;
      const tParts: string[] = [];

      if (tHundreds > 0) tParts.push(hundreds[tHundreds]);
      if (tRemainder >= 10 && tRemainder < 20) {
        tParts.push(teens[tRemainder - 10]);
      } else {
        const tOnes = tRemainder % 10;
        const tTens = Math.floor(tRemainder / 10);
        if (tOnes > 0) tParts.push(ones[tOnes]);
        if (tTens > 0) tParts.push(tens[tTens]);
      }

      parts.push(`${tParts.join(' و')} ألف`);
    }
  }

  if (remainder > 0) {
    const rHundreds = Math.floor(remainder / 100);
    const rRemainder = remainder % 100;

    if (rHundreds > 0) parts.push(hundreds[rHundreds]);
    if (rRemainder >= 10 && rRemainder < 20) {
      parts.push(teens[rRemainder - 10]);
    } else {
      const rOnes = rRemainder % 10;
      const rTens = Math.floor(rRemainder / 10);
      if (rOnes > 0 && rTens > 0) parts.push(`${ones[rOnes]} و${tens[rTens]}`);
      else if (rOnes > 0) parts.push(ones[rOnes]);
      else if (rTens > 0) parts.push(tens[rTens]);
    }
  }

  return `فقط ${parts.join(' و')} درهم مغربي لا غير.`;
};

const renderHeader = (
  doc: jsPDF,
  pageWidth: number,
  margin: number,
  data: FeeStatementData,
) => {
  const centerX = pageWidth / 2;
  const rightX = pageWidth - margin;
  const letterhead = data.letterhead;
  const lawyerName = letterhead?.lawyerName || data.lawyerName;
  const title = [letterhead?.titleAr, letterhead?.barNameAr ? `لدى ${letterhead.barNameAr}` : '']
    .filter(Boolean)
    .join(' ')
    .trim();
  const address = [letterhead?.address, letterhead?.city, 'المغرب'].filter(Boolean).join('، ');

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 1.7, 'F');

  let y = 17;

  doc.setFont('Amiri');
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text('مكتب الأستاذ', centerX, y, { align: 'center' });
  y += 10;

  doc.setFontSize(27);
  doc.setTextColor(...NAVY);
  const nameLines = doc.splitTextToSize(lawyerName, 90);
  doc.text(nameLines, centerX, y, { align: 'center' });
  y += nameLines.length * 9;

  if (title) {
    doc.setFont('IBMPlex');
    doc.setFontSize(14);
    doc.setTextColor(...GOLD);
    doc.text(title, centerX, y, { align: 'center' });
    y += 9;
  }

  doc.setFont('IBMPlex');
  doc.setFontSize(11);
  doc.setTextColor(...TEXT_DARK);
  doc.text('المقر الاجتماعي', centerX, y, { align: 'center' });
  y += 7;

  if (address) {
    doc.setFontSize(10.5);
    doc.setTextColor(...TEXT_MID);
    const addressLines = doc.splitTextToSize(address, 125);
    doc.text(addressLines, centerX, y, { align: 'center' });
    y += addressLines.length * 5.2;
  }

  if (letterhead?.phone) {
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MID);
    doc.text(`الهاتف: ${letterhead.phone}`, centerX, y, { align: 'center' });
    y += 5.5;
  }

  if (letterhead?.email) {
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MID);
    doc.text(`البريد الإلكتروني: ${letterhead.email}`, centerX, y, { align: 'center' });
    y += 5.5;
  }

  y += 5;
  drawRule(doc, y, margin + 8, rightX - 8);
  y += 18;

  doc.setFont('Amiri');
  doc.setFontSize(30);
  doc.setTextColor(...NAVY);
  doc.text('بيان أتعاب', centerX, y, { align: 'center' });
  y += 6;

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(centerX - 28, y, centerX + 28, y);
  y += 7;

  doc.setFontSize(10.5);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`رقم المرجع: ${data.statementNumber}`, centerX, y, { align: 'center' });

  return y + 14;
};

const renderInfoPanel = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  fields: Array<{ label: string; value: string }>,
) => {
  const innerRight = x + width - 8;
  const valueWidth = width - 18;

  const totalHeight = fields.reduce((sum, field) => {
    const lines = doc.splitTextToSize(field.value || '—', valueWidth);
    return sum + 7 + lines.length * 6.2 + 4;
  }, 10);

  doc.setFillColor(...PANEL_BG);
  doc.rect(x, y, width, totalHeight, 'F');
  doc.setFillColor(...NAVY);
  doc.rect(x + width - 2, y, 2, totalHeight, 'F');

  let cursorY = y + 10;

  fields.forEach((field) => {
    const lines = doc.splitTextToSize(field.value || '—', valueWidth);

    doc.setFontSize(11);
    doc.setTextColor(...TEXT_LIGHT);
    doc.text(field.label, innerRight, cursorY, { align: 'right' });
    cursorY += 8;

    doc.setFontSize(15);
    doc.setTextColor(...TEXT_DARK);
    doc.text(lines, innerRight, cursorY, { align: 'right' });
    cursorY += lines.length * 6.2 + 4;
  });

  return y + totalHeight;
};

type StatementRow =
  | { kind: 'group'; title: string }
  | { kind: 'item'; description: string; amount: number };

const buildStatementRows = (caseDetails: CaseDetailData[]): StatementRow[] => {
  const hasMultipleCases = caseDetails.length > 1;

  return caseDetails.flatMap((caseDetail, index) => {
    const rows: StatementRow[] = [];

    if (hasMultipleCases) {
      rows.push({ kind: 'group', title: caseDetail.caseTitle || `الملف ${index + 1}` });
    }

    rows.push(
      ...caseDetail.items.map((item) => ({
        kind: 'item' as const,
        description: item.description,
        amount: item.amount,
      })),
    );

    return rows;
  });
};

export const generateFeeStatementPDF = async (data: FeeStatementData): Promise<Blob> => {
  const [amiriBase64, plexBase64] = await Promise.all([
    loadFont('/fonts/Amiri-Regular.ttf'),
    loadFont('/fonts/IBMPlexSansArabic-Regular.ttf'),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('Amiri-Regular.ttf', amiriBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');

  doc.addFileToVFS('IBMPlexSansArabic-Regular.ttf', plexBase64);
  doc.addFont('IBMPlexSansArabic-Regular.ttf', 'IBMPlex', 'normal');

  doc.setFont('IBMPlex');

  const pageWidth = 210;
  const margin = 22;
  const rightX = pageWidth - margin;
  const contentWidth = pageWidth - margin * 2;
  const centerX = pageWidth / 2;

  let y = renderHeader(doc, pageWidth, margin, data);

  const caseNumbers = joinValues(data.caseDetails.map((detail) => detail.caseNumber));
  const courts = joinValues(data.caseDetails.map((detail) => detail.court));
  const caseTypes = joinValues(data.caseDetails.map((detail) => detail.caseType));

  y = renderInfoPanel(doc, margin + 3, y, contentWidth - 6, [
    { label: 'الموكل', value: data.clientName || '—' },
    { label: 'رقم الملف', value: caseNumbers },
    { label: 'المحكمة المختصة', value: courts },
    { label: 'طبيعة النزاع', value: caseTypes },
  ]) + 12;

  drawRule(doc, y, margin, rightX);
  y += 8;

  const amountColumnWidth = 42;
  const descriptionColumnWidth = contentWidth - amountColumnWidth - 6;
  const rows = buildStatementRows(data.caseDetails);

  doc.setFontSize(11);
  doc.setTextColor(...TEXT_DARK);
  doc.text('بيان الخدمات', rightX, y, { align: 'right' });
  doc.text('المبلغ (درهم)', margin, y, { align: 'left' });
  y += 4;

  drawRule(doc, y, margin, rightX);
  y += 7;

  rows.forEach((row) => {
    if (row.kind === 'group') {
      doc.setFontSize(10);
      doc.setTextColor(...TEXT_LIGHT);
      doc.text(row.title, rightX, y, { align: 'right' });
      y += 6;
      return;
    }

    const descriptionLines = doc.splitTextToSize(row.description || '—', descriptionColumnWidth);
    const rowHeight = Math.max(10, descriptionLines.length * 5.5 + 3.5);

    drawRule(doc, y - 1.5, margin, rightX);

    doc.setFontSize(10.5);
    doc.setTextColor(...TEXT_DARK);
    doc.text(descriptionLines, rightX, y + 2.5, { align: 'right' });

    doc.setFontSize(10.5);
    doc.setTextColor(...TEXT_MID);
    doc.text(formatMoney(row.amount), margin, y + 2.5, { align: 'left' });

    y += rowHeight;
  });

  drawRule(doc, y - 1.5, margin, rightX);
  y += 6;

  const professionalFees = data.caseDetails.reduce((sum, detail) => sum + Number(detail.lawyerFees || 0), 0);
  const expensesTotal = data.caseDetails.reduce((sum, detail) => sum + Number(detail.expensesTotal || 0), 0);

  const summaryRows = [
    { label: 'الأتعاب المهنية', value: professionalFees, strong: false },
    { label: 'المصاريف والرسوم', value: expensesTotal, strong: false },
    { label: 'المجموع (الصافي)', value: data.grandSubtotal, strong: true },
    ...(data.grandTaxAmount > 0
      ? [{ label: `الضريبة (${data.taxRate}%)`, value: data.grandTaxAmount, strong: false }]
      : []),
    { label: 'المجموع (TTC)', value: data.grandTotal, strong: true },
  ];

  summaryRows.forEach((row, index) => {
    if (row.strong) {
      doc.setFillColor(...PANEL_BG);
      doc.rect(margin, y - 1.5, contentWidth, 8.5, 'F');
    }

    doc.setFontSize(row.strong ? 11 : 10.5);
    doc.setTextColor(row.strong ? NAVY[0] : TEXT_MID[0], row.strong ? NAVY[1] : TEXT_MID[1], row.strong ? NAVY[2] : TEXT_MID[2]);
    doc.text(row.label, rightX, y + 4, { align: 'right' });

    doc.setFontSize(row.strong ? 11 : 10.5);
    doc.setTextColor(...TEXT_DARK);
    doc.text(formatMoney(row.value), margin, y + 4, { align: 'left' });

    y += 8.5;

    if (index < summaryRows.length - 1) {
      drawRule(doc, y - 1.5, margin, rightX);
    }
  });

  y += 8;
  drawRule(doc, y, margin, rightX);
  y += 11;

  doc.setFontSize(14);
  doc.setTextColor(...TEXT_MID);
  doc.text('الواجب أداؤه:', rightX, y, { align: 'right' });

  doc.setFontSize(26);
  doc.setTextColor(...NAVY);
  doc.text(`MAD ${formatMoney(data.grandTotal)}`, margin, y + 1, { align: 'left' });
  y += 12;

  doc.setFontSize(10.5);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text('المبلغ بالحروف:', rightX, y, { align: 'right' });

  const wordsLabelWidth = doc.getTextWidth('المبلغ بالحروف:   ');
  doc.setTextColor(...TEXT_MID);
  doc.text(numberToArabicWords(data.grandTotal), rightX - wordsLabelWidth, y, { align: 'right' });
  y += 12;

  drawRule(doc, y, margin, rightX);
  y += 11;

  const noteText = data.notes || 'يتم تحديد الأتعاب وفقاً للقوانين المنظمة لمهنة المحاماة بالمغرب وللاتفاق المسبق.';
  const noteLines = doc.splitTextToSize(noteText, contentWidth - 26);

  doc.setFontSize(11);
  doc.setTextColor(...TEXT_MID);
  doc.text(noteLines, centerX, y, { align: 'center' });
  y += noteLines.length * 6.5 + 10;

  drawRule(doc, y, margin, rightX);
  y += 14;

  const city = data.letterhead?.city || 'الدار البيضاء';
  doc.setFontSize(10.5);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`حرر ب${city} في:`, rightX, y, { align: 'right' });
  y += 9;

  doc.setFontSize(16);
  doc.setTextColor(...TEXT_DARK);
  doc.text(data.date, rightX, y, { align: 'right' });
  y += 19;

  doc.setFontSize(13);
  doc.setTextColor(...TEXT_DARK);
  doc.text('التوقيع والختم', centerX, y, { align: 'center' });
  y += 11;

  const sealWidth = 62;
  const sealHeight = 30;
  const sealX = centerX - sealWidth / 2;

  drawDashedRect(doc, sealX, y, sealWidth, sealHeight);

  doc.setFontSize(7);
  doc.setTextColor(...BORDER);
  doc.text('SEAL & SIGNATURE AREA', centerX, y + sealHeight / 2 + 1, { align: 'center' });

  return doc.output('blob');
};
