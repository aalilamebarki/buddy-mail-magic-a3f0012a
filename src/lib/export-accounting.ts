import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AccountingEntry } from '@/hooks/useAccounting';

const ENTRY_TYPE_LABELS: Record<string, string> = {
  invoice: 'وصل أداء',
  fee_statement: 'بيان أتعاب',
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقداً',
  check: 'شيك',
  transfer: 'تحويل بنكي',
  card: 'بطاقة بنكية',
};

const fmtNum = (n: number) => Number(n).toLocaleString('ar-u-nu-latn', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const exportAccountingExcel = (entries: AccountingEntry[], year: number) => {
  const rows = entries.map((e, i) => ({
    'الرقم': i + 1,
    'الرقم التسلسلي': e.entry_number,
    'النوع': ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type,
    'الموكل': e.clients?.full_name || '—',
    'البيان': e.description || '—',
    'المبلغ HT': Number(e.amount_ht),
    'الضريبة TVA': Number(e.tax_amount),
    'المبلغ TTC': Number(e.amount_ttc),
    'طريقة الأداء': PAYMENT_LABELS[e.payment_method || ''] || e.payment_method || '—',
    'التاريخ': e.entry_date,
  }));

  // Add totals row
  const totalHT = entries.reduce((s, e) => s + Number(e.amount_ht), 0);
  const totalTax = entries.reduce((s, e) => s + Number(e.tax_amount), 0);
  const totalTTC = entries.reduce((s, e) => s + Number(e.amount_ttc), 0);

  rows.push({
    'الرقم': '' as any,
    'الرقم التسلسلي': '',
    'النوع': '',
    'الموكل': '',
    'البيان': 'المجموع',
    'المبلغ HT': totalHT,
    'الضريبة TVA': totalTax,
    'المبلغ TTC': totalTTC,
    'طريقة الأداء': '',
    'التاريخ': '',
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `سجل ${year}`);
  XLSX.writeFile(wb, `سجل_محاسبي_${year}.xlsx`);
};

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

export const exportAccountingPDF = async (entries: AccountingEntry[], year: number) => {
  const fontBase64 = await loadAmiriFont();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  doc.setFont('Amiri');
  doc.setR2L(true);

  const pw = 297;
  const m = 12;

  // Header bar
  doc.setFillColor(15, 45, 80);
  doc.rect(0, 0, pw, 6, 'F');
  doc.setFillColor(180, 150, 80);
  doc.rect(0, 6, pw, 1, 'F');

  // Title
  doc.setFontSize(16);
  doc.setTextColor(15, 45, 80);
  doc.text(`السجل المحاسبي — السنة المالية ${year}`, pw / 2, 16, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`تاريخ التصدير: ${new Date().toLocaleDateString('ar-MA')}`, pw / 2, 22, { align: 'center' });

  // Table
  const totalHT = entries.reduce((s, e) => s + Number(e.amount_ht), 0);
  const totalTax = entries.reduce((s, e) => s + Number(e.tax_amount), 0);
  const totalTTC = entries.reduce((s, e) => s + Number(e.amount_ttc), 0);

  const body = entries.map((e, i) => [
    e.entry_date,
    PAYMENT_LABELS[e.payment_method || ''] || e.payment_method || '—',
    fmtNum(e.amount_ttc),
    fmtNum(e.tax_amount),
    fmtNum(e.amount_ht),
    e.description || '—',
    e.clients?.full_name || '—',
    ENTRY_TYPE_LABELS[e.entry_type] || e.entry_type,
    e.entry_number,
    String(i + 1),
  ]);

  // Totals row
  body.push([
    '',
    '',
    fmtNum(totalTTC),
    fmtNum(totalTax),
    fmtNum(totalHT),
    'المجموع',
    '',
    '',
    '',
    '',
  ]);

  autoTable(doc, {
    startY: 26,
    head: [['التاريخ', 'الأداء', 'TTC', 'TVA', 'HT', 'البيان', 'الموكل', 'النوع', 'الرقم التسلسلي', 'م']],
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
    alternateRowStyles: { fillColor: [248, 249, 252] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 22 },
      2: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 28, halign: 'center' },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 30 },
      7: { cellWidth: 22, halign: 'center' },
      8: { cellWidth: 28, halign: 'center' },
      9: { cellWidth: 10, halign: 'center' },
    },
    margin: { left: m, right: m },
    didParseCell: (data) => {
      // Bold totals row
      if (data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [15, 45, 80];
        data.cell.styles.textColor = [255, 255, 255];
      }
    },
  });

  // Footer
  const pageH = 210;
  doc.setFillColor(15, 45, 80);
  doc.rect(0, pageH - 10, pw, 10, 'F');
  doc.setFillColor(180, 150, 80);
  doc.rect(0, pageH - 10, pw, 0.8, 'F');
  doc.setFontSize(7);
  doc.setTextColor(200, 210, 220);
  doc.text('سجل محاسبي — وثيقة مصدرة إلكترونياً', pw / 2, pageH - 4, { align: 'center' });

  doc.save(`سجل_محاسبي_${year}.pdf`);
};
