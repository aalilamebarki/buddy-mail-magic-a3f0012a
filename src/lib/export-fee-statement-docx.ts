/**
 * Fee Statement Word (.docx) Export
 * Moroccan Professional style: Navy (#1a2a44) / Gold (#c5a059)
 * Matches the HTML preview design with bilingual labels
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { FeeStatementRecord } from '@/hooks/useFeeStatements';
import { formatDateArabic } from '@/lib/formatters';
import { numberToArabicWords } from '@/lib/pdf-utils';

/* ── Design tokens ────────────────────────────────────────────────── */
const FONT = 'Traditional Arabic';
const FONT_BODY = 'Traditional Arabic';
const NAVY = '1a2a44';
const GOLD = 'c5a059';
const TEXT_GRAY = '646464';
const TEXT_LIGHT = '969696';
const BG_ROW = 'FAFAF8';
const BG_SUMMARY = 'F0EFF5';
const BORDER_CLR = 'e0ddd6';

/* ── Helpers ───────────────────────────────────────────────────────── */

const fmt = (n: number) =>
  n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const noBorder = () => ({
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
});

const thinBorder = (color = BORDER_CLR) => ({
  top: { style: BorderStyle.SINGLE, size: 1, color },
  bottom: { style: BorderStyle.SINGLE, size: 1, color },
  left: { style: BorderStyle.SINGLE, size: 1, color },
  right: { style: BorderStyle.SINGLE, size: 1, color },
});

const goldLeftBorder = () => ({
  ...thinBorder(),
  right: { style: BorderStyle.SINGLE, size: 6, color: GOLD },
});

/* ── Reusable paragraph builders ──────────────────────────────────── */

const centerText = (
  text: string,
  opts?: { size?: number; bold?: boolean; color?: string; font?: string; spacing?: number },
) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: opts?.spacing ?? 0, after: 0 },
    children: [
      new TextRun({
        text,
        font: opts?.font ?? FONT,
        size: opts?.size ?? 24,
        bold: opts?.bold ?? false,
        color: opts?.color ?? NAVY,
        rightToLeft: true,
      }),
    ],
  });

const emptyPara = (spacing = 80) =>
  new Paragraph({ spacing: { before: spacing, after: 0 }, bidirectional: true, children: [] });

/* ── Gold ornament line ───────────────────────────────────────────── */

const ornamentLine = () =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text: '━━━━━  ◆  ━━━━━', color: GOLD, font: FONT, size: 16, rightToLeft: true }),
    ],
  });

/* ── Header section ───────────────────────────────────────────────── */

function buildHeader(lh: FeeStatementRecord['letterheads']): Paragraph[] {
  const paras: Paragraph[] = [];

  // "الأستاذ" label
  paras.push(centerText('━━━  الأستاذ  ━━━', { size: 18, color: GOLD }));

  if (lh?.name_fr) {
    paras.push(centerText('Maître', { size: 14, color: TEXT_LIGHT }));
  }

  // Lawyer name (large)
  paras.push(centerText(lh?.lawyer_name || '—', { size: 44, bold: true, color: NAVY, spacing: 40 }));

  if (lh?.name_fr) {
    paras.push(centerText(lh.name_fr, { size: 22, color: TEXT_GRAY, spacing: 20 }));
  }

  // Ornament
  paras.push(ornamentLine());

  // Title (ar + fr)
  if (lh?.title_ar || lh?.bar_name_ar) {
    const titleAr = [lh?.title_ar, lh?.bar_name_ar ? `لدى ${lh.bar_name_ar}` : ''].filter(Boolean).join(' ');
    paras.push(centerText(titleAr, { size: 20, color: '1e1e1e' }));
  }
  if (lh?.title_fr || lh?.bar_name_fr) {
    const titleFr = [lh?.title_fr, lh?.bar_name_fr ? `près ${lh.bar_name_fr}` : ''].filter(Boolean).join(' ');
    paras.push(centerText(titleFr, { size: 16, color: TEXT_LIGHT }));
  }

  // Contact
  const contactParts: string[] = [];
  if (lh?.address) contactParts.push(lh.city ? `${lh.address}، ${lh.city}` : lh.address);
  if (lh?.phone) contactParts.push(`هاتف: ${lh.phone}`);
  if (lh?.email) contactParts.push(lh.email);
  if (contactParts.length > 0) {
    paras.push(centerText(contactParts.join('  |  '), { size: 15, color: TEXT_LIGHT, spacing: 40 }));
  }

  // Double separator
  paras.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { before: 80, after: 0 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: NAVY } },
      children: [],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { before: 2, after: 0 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: GOLD } },
      children: [],
    }),
  );

  return paras;
}

/* ── Document title section ───────────────────────────────────────── */

function buildTitle(statementNumber: string): Paragraph[] {
  return [
    emptyPara(200),
    centerText('بيان الأتعاب والمصاريف', { size: 40, bold: true, color: NAVY }),
    centerText("Note d'honoraires et frais", { size: 18, color: TEXT_LIGHT, spacing: 20 }),
    emptyPara(60),
    centerText(`━━  ${statementNumber}  ━━`, { size: 16, color: TEXT_GRAY }),
    emptyPara(100),
  ];
}

/* ── Client info table ────────────────────────────────────────────── */

function buildClientInfoTable(statement: FeeStatementRecord, firstCase: any): Table {
  const rows: { label: string; labelFr: string; value: string }[] = [];
  if (statement.clients?.full_name) rows.push({ label: 'الموكل', labelFr: 'Client', value: statement.clients.full_name });
  if (firstCase?.case_number) rows.push({ label: 'رقم الملف', labelFr: 'N° Dossier', value: firstCase.case_number });
  if (firstCase?.court) rows.push({ label: 'المحكمة', labelFr: 'Tribunal', value: firstCase.court });
  if (firstCase?.case_type) rows.push({ label: 'طبيعة النزاع', labelFr: 'Nature', value: firstCase.case_type });
  if (statement.clients?.cin) rows.push({ label: 'رقم ب.و', labelFr: 'CIN', value: statement.clients.cin });
  if (statement.power_of_attorney_date) {
    rows.push({
      label: 'تاريخ الوكالة',
      labelFr: 'Date de procuration',
      value: formatDateArabic(statement.power_of_attorney_date, { year: 'numeric', month: 'long', day: 'numeric' }),
    });
  }

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows: rows.map((row, i) =>
      new TableRow({
        children: [
          // Label cell (gold left border)
          new TableCell({
            borders: goldLeftBorder(),
            width: { size: 30, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: i % 2 === 0 ? BG_ROW : 'FFFFFF', type: ShadingType.CLEAR },
            margins: { top: 30, bottom: 30, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                bidirectional: true,
                spacing: { after: 0 },
                children: [
                  new TextRun({ text: row.label, font: FONT, size: 18, color: GOLD, rightToLeft: true }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                bidirectional: true,
                spacing: { after: 0 },
                children: [
                  new TextRun({ text: row.labelFr, font: FONT, size: 13, color: TEXT_LIGHT, rightToLeft: true }),
                ],
              }),
            ],
          }),
          // Value cell
          new TableCell({
            borders: thinBorder(),
            width: { size: 70, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: i % 2 === 0 ? BG_ROW : 'FFFFFF', type: ShadingType.CLEAR },
            margins: { top: 30, bottom: 30, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                bidirectional: true,
                spacing: { after: 0 },
                children: [
                  new TextRun({ text: row.value, font: FONT_BODY, size: 22, bold: true, color: '1e1e1e', rightToLeft: true }),
                ],
              }),
            ],
          }),
        ],
      }),
    ),
  });
}

/* ── Services table for one case ──────────────────────────────────── */

function buildServicesTable(
  items: { description: string; amount: number }[],
  lawyerFees: number,
  expTotal: number,
  subtotal: number,
  taxRate: number,
  taxAmount: number,
  totalAmount: number,
): Table {
  // Header row
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        borders: thinBorder(NAVY),
        width: { size: 70, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { after: 0 },
            children: [
              new TextRun({ text: 'بيان الخدمات', font: FONT, size: 18, bold: true, color: 'FFFFFF', rightToLeft: true }),
              new TextRun({ text: '  /  Désignation', font: FONT, size: 14, color: 'CCCCCC', rightToLeft: true }),
            ],
          }),
        ],
      }),
      new TableCell({
        borders: thinBorder(NAVY),
        width: { size: 30, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            bidirectional: true,
            spacing: { after: 0 },
            children: [
              new TextRun({ text: 'المبلغ (MAD)', font: FONT, size: 16, bold: true, color: 'FFFFFF', rightToLeft: true }),
            ],
          }),
        ],
      }),
    ],
  });

  // Item rows
  const itemRows = items.map((item, i) =>
    new TableRow({
      children: [
        new TableCell({
          borders: thinBorder(),
          width: { size: 70, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: i % 2 === 0 ? BG_ROW : 'FFFFFF', type: ShadingType.CLEAR },
          margins: { top: 30, bottom: 30, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              bidirectional: true,
              spacing: { after: 0 },
              children: [
                new TextRun({ text: item.description || '—', font: FONT_BODY, size: 20, color: '1e1e1e', rightToLeft: true }),
              ],
            }),
          ],
        }),
        new TableCell({
          borders: thinBorder(),
          width: { size: 30, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: i % 2 === 0 ? BG_ROW : 'FFFFFF', type: ShadingType.CLEAR },
          margins: { top: 30, bottom: 30, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              bidirectional: true,
              spacing: { after: 0 },
              children: [
                new TextRun({ text: fmt(item.amount), font: FONT_BODY, size: 20, color: TEXT_GRAY }),
              ],
            }),
          ],
        }),
      ],
    }),
  );

  // Summary rows
  const summaryData: { label: string; labelFr: string; value: number; highlight: boolean }[] = [
    { label: 'الأتعاب المهنية', labelFr: 'Honoraires', value: lawyerFees, highlight: false },
    { label: 'المصاريف والرسوم', labelFr: 'Frais et débours', value: expTotal, highlight: false },
    { label: 'المجموع الصافي', labelFr: 'Sous-total HT', value: subtotal, highlight: true },
  ];
  if (taxRate > 0) {
    summaryData.push({ label: `الضريبة (${taxRate}%)`, labelFr: 'TVA', value: taxAmount, highlight: false });
  }
  summaryData.push({ label: 'المجموع الكلي', labelFr: 'Total TTC', value: totalAmount, highlight: true });

  const summaryRows = summaryData.map(row =>
    new TableRow({
      children: [
        new TableCell({
          borders: thinBorder(),
          width: { size: 70, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: row.highlight ? BG_SUMMARY : 'FFFFFF', type: ShadingType.CLEAR },
          margins: { top: 20, bottom: 20, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              bidirectional: true,
              spacing: { after: 0 },
              children: [
                new TextRun({
                  text: row.label,
                  font: FONT,
                  size: row.highlight ? 20 : 18,
                  bold: row.highlight,
                  color: row.highlight ? NAVY : TEXT_GRAY,
                  rightToLeft: true,
                }),
                new TextRun({
                  text: `  / ${row.labelFr}`,
                  font: FONT,
                  size: 13,
                  color: TEXT_LIGHT,
                  rightToLeft: true,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          borders: thinBorder(),
          width: { size: 30, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          shading: { fill: row.highlight ? BG_SUMMARY : 'FFFFFF', type: ShadingType.CLEAR },
          margins: { top: 20, bottom: 20, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              bidirectional: true,
              spacing: { after: 0 },
              children: [
                new TextRun({
                  text: fmt(row.value),
                  font: FONT_BODY,
                  size: row.highlight ? 22 : 20,
                  bold: row.highlight,
                  color: row.highlight ? NAVY : '1e1e1e',
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  );

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows: [headerRow, ...itemRows, ...summaryRows],
  });
}

/* ── Grand total section ──────────────────────────────────────────── */

function buildGrandTotal(totalAmount: number): (Paragraph | Table)[] {
  const tafkeet = numberToArabicWords(totalAmount);

  // Grand total as a navy table row
  const totalTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: thinBorder(NAVY),
            width: { size: 40, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                bidirectional: true,
                spacing: { after: 0 },
                children: [
                  new TextRun({ text: 'الواجب أداؤه', font: FONT, size: 20, bold: true, color: GOLD, rightToLeft: true }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                bidirectional: true,
                spacing: { after: 0 },
                children: [
                  new TextRun({ text: 'Net à payer', font: FONT, size: 14, color: 'AAAAAA', rightToLeft: true }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: thinBorder(NAVY),
            width: { size: 60, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                bidirectional: true,
                spacing: { after: 0 },
                children: [
                  new TextRun({ text: `${fmt(totalAmount)} MAD`, font: FONT, size: 36, bold: true, color: 'FFFFFF' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return [
    ornamentLine(),
    totalTable,
    // Tafkeet
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { before: 80, after: 0 },
      children: [
        new TextRun({ text: `المبلغ بالحروف:  ${tafkeet}`, font: FONT, size: 16, color: TEXT_GRAY, rightToLeft: true }),
      ],
    }),
  ];
}

/* ── Signature section ────────────────────────────────────────────── */

function buildSignatureSection(date: string, city: string): Paragraph[] {
  return [
    emptyPara(200),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { after: 20 },
      children: [
        new TextRun({ text: `حرر ب${city || '...'} في:`, font: FONT, size: 18, color: TEXT_GRAY, rightToLeft: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { after: 0 },
      children: [
        new TextRun({ text: date, font: FONT, size: 26, bold: true, color: NAVY, rightToLeft: true }),
      ],
    }),
    emptyPara(200),
    centerText('التوقيع والختم', { size: 22, bold: true, color: NAVY }),
    centerText('Signature et cachet', { size: 14, color: TEXT_LIGHT }),
    emptyPara(300),
  ];
}

/* ══════════════════════════════════════════════
   MAIN EXPORT FUNCTION
   ══════════════════════════════════════════════ */

export const exportFeeStatementDocx = async (statement: FeeStatementRecord) => {
  const lh = statement.letterheads;
  const items = statement.fee_statement_items || [];
  const statementCases = statement.fee_statement_cases || [];
  const firstCase = statementCases[0]?.cases || statement.cases;
  const city = lh?.city || '';
  const date = formatDateArabic(statement.created_at, { year: 'numeric', month: 'long', day: 'numeric' });

  const children: (Paragraph | Table)[] = [];

  // 1. Header
  children.push(...buildHeader(lh));

  // 2. Title
  children.push(...buildTitle(statement.statement_number));

  // 3. Client info
  children.push(buildClientInfoTable(statement, firstCase));
  children.push(emptyPara(150));

  // 4. Services tables (per case or single)
  if (statementCases.length > 0) {
    statementCases.forEach((sc, idx) => {
      const caseItems = items.filter(item => item.case_id === sc.case_id || (!item.case_id));
      const normalizedItems = caseItems.map(i => ({ description: i.description, amount: Number(i.amount) }));
      const expTotal = normalizedItems.reduce((s, i) => s + i.amount, 0);

      // Multi-case banner
      if (statementCases.length > 1) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            bidirectional: true,
            spacing: { before: 150, after: 60 },
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            children: [
              new TextRun({
                text: `ملف ${idx + 1}: ${sc.cases?.title || sc.cases?.case_number || '—'}`,
                font: FONT,
                size: 22,
                bold: true,
                color: 'FFFFFF',
                rightToLeft: true,
              }),
            ],
          }),
        );
      }

      children.push(
        buildServicesTable(
          normalizedItems,
          Number(sc.lawyer_fees),
          expTotal,
          Number(sc.subtotal),
          Number(sc.tax_rate),
          Number(sc.tax_amount),
          Number(sc.total_amount),
        ),
      );
      children.push(emptyPara(100));
    });
  } else {
    const normalizedItems = items.map(i => ({ description: i.description, amount: Number(i.amount) }));
    const expTotal = normalizedItems.reduce((s, i) => s + i.amount, 0);
    children.push(
      buildServicesTable(
        normalizedItems,
        Number(statement.lawyer_fees),
        expTotal,
        Number(statement.subtotal),
        Number(statement.tax_rate),
        Number(statement.tax_amount),
        Number(statement.total_amount),
      ),
    );
    children.push(emptyPara(100));
  }

  // 5. Grand total
  children.push(...buildGrandTotal(Number(statement.total_amount)));

  // 6. Notes
  const noteText = statement.notes || 'يتم تحديد الأتعاب وفقاً للقوانين المنظمة لمهنة المحاماة بالمغرب وللاتفاق المسبق بين الطرفين.';
  children.push(
    emptyPara(100),
    centerText(noteText, { size: 16, color: TEXT_GRAY }),
  );

  // 7. Signature
  children.push(...buildSignatureSection(date, city));

  // 8. Footer
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { before: 200, after: 0 },
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: GOLD } },
      children: [
        new TextRun({
          text: 'وثيقة صادرة إلكترونياً — Document généré électroniquement',
          font: FONT,
          size: 13,
          color: TEXT_LIGHT,
          rightToLeft: true,
        }),
      ],
    }),
  );

  const doc = new Document({
    sections: [{
      children,
      properties: {
        page: {
          margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          size: { width: 11906, height: 16838, orientation: undefined },
        },
      },
    }],
  });

  const blob = await Packer.toBlob(doc);
  const clientName = statement.clients?.full_name || '';
  const fileName = `بيان_أتعاب_${clientName}_${statement.statement_number}.docx`;
  saveAs(blob, fileName);
};
