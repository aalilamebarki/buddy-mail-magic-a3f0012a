import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const QUARTER_LABELS: Record<number, string> = {
  1: 'الفصل الأول (يناير – مارس)',
  2: 'الفصل الثاني (أبريل – يونيو)',
  3: 'الفصل الثالث (يوليوز – شتنبر)',
  4: 'الفصل الرابع (أكتوبر – دجنبر)',
};

const MONTH_NAMES: Record<number, string> = {
  1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
  5: 'ماي', 6: 'يونيو', 7: 'يوليوز', 8: 'غشت',
  9: 'شتنبر', 10: 'أكتوبر', 11: 'نونبر', 12: 'دجنبر',
};

const fmt = (n: number) =>
  n.toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface MonthData {
  month: number;
  invoiceCount: number;
  feeStatementCount: number;
  totalHT: number;
  totalTax: number;
  totalTTC: number;
}

interface QuarterData {
  quarter: number;
  invoiceCount: number;
  feeStatementCount: number;
  totalHT: number;
  totalTax: number;
  totalTTC: number;
  months: MonthData[];
}

interface AnnualTotals {
  invoiceCount: number;
  feeStatementCount: number;
  totalHT: number;
  totalTax: number;
  totalTTC: number;
}

let amiriFontLoaded = false;
let amiriFontBase64 = '';

const loadAmiriFont = async (): Promise<string> => {
  if (amiriFontLoaded) return amiriFontBase64;
  const response = await fetch('/fonts/Amiri-Regular.ttf');
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  amiriFontBase64 = btoa(binary);
  amiriFontLoaded = true;
  return amiriFontBase64;
};

export const exportTaxReportPDF = async (
  quarterData: QuarterData[],
  annualTotals: AnnualTotals,
  year: number,
) => {
  const fontBase64 = await loadAmiriFont();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  doc.setFont('Amiri');
  doc.setR2L(true);

  const pw = 210;
  const m = 14;

  // Header bar
  doc.setFillColor(15, 45, 80);
  doc.rect(0, 0, pw, 7, 'F');
  doc.setFillColor(180, 150, 80);
  doc.rect(0, 7, pw, 1.2, 'F');

  // Title
  doc.setFontSize(18);
  doc.setTextColor(15, 45, 80);
  doc.text(`التقرير الضريبي السنوي — ${year}`, pw / 2, 20, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`ملخص الإيرادات وضريبة القيمة المضافة حسب الفصول`, pw / 2, 27, { align: 'center' });
  doc.text(`تاريخ التصدير: ${new Date().toLocaleDateString('ar-MA')}`, pw / 2, 32, { align: 'center' });

  // Summary box
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(m, 36, pw - m * 2, 22, 3, 3, 'F');
  doc.setFontSize(10);
  doc.setTextColor(15, 45, 80);

  const boxY = 44;
  const col1 = pw - m - 5;
  const col2 = pw / 2 + 20;
  const col3 = m + 40;

  doc.text(`إجمالي الإيرادات HT: ${fmt(annualTotals.totalHT)} د.م`, col1, boxY, { align: 'right' });
  doc.text(`مجموع TVA المستحقة: ${fmt(annualTotals.totalTax)} د.م`, col2, boxY, { align: 'right' });
  doc.text(`المجموع TTC: ${fmt(annualTotals.totalTTC)} د.م`, col3, boxY, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${annualTotals.invoiceCount} وصل أداء — ${annualTotals.feeStatementCount} بيان الأتعاب`,
    pw / 2, 53, { align: 'center' }
  );

  // Quarterly table
  const body: (string | number)[][] = [];

  for (const q of quarterData) {
    // Quarter header row
    body.push([
      QUARTER_LABELS[q.quarter],
      String(q.invoiceCount),
      String(q.feeStatementCount),
      fmt(q.totalHT),
      fmt(q.totalTax),
      fmt(q.totalTTC),
    ]);
    // Month rows
    for (const mo of q.months) {
      body.push([
        `    ${MONTH_NAMES[mo.month]}`,
        String(mo.invoiceCount),
        String(mo.feeStatementCount),
        fmt(mo.totalHT),
        fmt(mo.totalTax),
        fmt(mo.totalTTC),
      ]);
    }
  }

  // Annual total row
  body.push([
    'المجموع السنوي',
    String(annualTotals.invoiceCount),
    String(annualTotals.feeStatementCount),
    fmt(annualTotals.totalHT),
    fmt(annualTotals.totalTax),
    fmt(annualTotals.totalTTC),
  ]);

  autoTable(doc, {
    startY: 60,
    head: [['الفترة', 'وصولات', 'بيانات أتعاب', 'HT', 'TVA', 'TTC']],
    body,
    styles: {
      font: 'Amiri',
      fontSize: 9,
      halign: 'right',
      cellPadding: 2.5,
      textColor: [30, 30, 30],
      lineColor: [220, 225, 235],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 45, 80],
      textColor: [255, 255, 255],
      fontSize: 9,
      halign: 'center',
    },
    alternateRowStyles: { fillColor: [252, 252, 254] },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 28, halign: 'center' },
      5: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: m, right: m },
    didParseCell: (data) => {
      const rowIdx = data.row.index;
      const totalRows = body.length;
      // Quarter header rows (every 4th group: index 0, 4, 8, 12)
      const quarterRowIndices = [0, 4, 8, 12];
      if (data.section === 'body' && quarterRowIndices.includes(rowIdx)) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [235, 240, 248];
        data.cell.styles.textColor = [15, 45, 80];
      }
      // Annual total row (last)
      if (data.section === 'body' && rowIdx === totalRows - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [15, 45, 80];
        data.cell.styles.textColor = [255, 255, 255];
      }
    },
  });

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(15, 45, 80);
  doc.rect(0, pageH - 12, pw, 12, 'F');
  doc.setFillColor(180, 150, 80);
  doc.rect(0, pageH - 12, pw, 0.8, 'F');
  doc.setFontSize(7);
  doc.setTextColor(200, 210, 220);
  doc.text('تقرير ضريبي سنوي — وثيقة مصدرة إلكترونياً', pw / 2, pageH - 5, { align: 'center' });

  doc.save(`تقرير_ضريبي_${year}.pdf`);
};
