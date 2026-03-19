/**
 * Invoice Word (.docx) Export — وصل أداء
 * Moroccan Professional style: Navy (#1a2a44) / Gold (#c5a059)
 * Full RTL + Bilingual (Arabic / French) support
 * 
 * PRIMARY: Injects body content into the original .docx template.
 * FALLBACK: Generates standalone document if no template available.
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
import type { InvoiceRecord } from '@/hooks/useInvoices';
import { formatDateArabic } from '@/lib/formatters';
import { numberToArabicWords } from '@/lib/pdf-utils';
import { downloadTemplate, injectIntoTemplate } from '@/lib/template-injector';

/* ── Design tokens ────────────────────────────────────────────────── */
const FONT = 'Traditional Arabic';
const NAVY = '1a2a44';
const GOLD = 'c5a059';
const TEXT_GRAY = '646464';
const TEXT_LIGHT = '969696';
const BG_ROW = 'FAFAF8';
const BORDER_CLR = 'e0ddd6';

const PAYMENT_METHODS: Record<string, { ar: string; fr: string }> = {
  cash: { ar: 'نقداً', fr: 'Espèces' },
  check: { ar: 'شيك', fr: 'Chèque' },
  transfer: { ar: 'تحويل بنكي', fr: 'Virement bancaire' },
  card: { ar: 'بطاقة بنكية', fr: 'Carte bancaire' },
};

/* ── Helpers ───────────────────────────────────────────────────────── */

const fmt = (n: number) =>
  n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

const rightText = (
  text: string,
  opts?: { size?: number; bold?: boolean; color?: string; font?: string; spacing?: number },
) =>
  new Paragraph({
    alignment: AlignmentType.RIGHT,
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

const bilingualPara = (
  arText: string,
  frText: string,
  opts?: { arSize?: number; frSize?: number; arColor?: string; frColor?: string; bold?: boolean; alignment?: typeof AlignmentType[keyof typeof AlignmentType]; spacing?: number },
) =>
  new Paragraph({
    alignment: opts?.alignment ?? AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: opts?.spacing ?? 0, after: 0 },
    children: [
      new TextRun({
        text: arText,
        font: FONT,
        size: opts?.arSize ?? 20,
        bold: opts?.bold ?? false,
        color: opts?.arColor ?? NAVY,
        rightToLeft: true,
      }),
      new TextRun({
        text: `  /  ${frText}`,
        font: FONT,
        size: opts?.frSize ?? 14,
        color: opts?.frColor ?? TEXT_LIGHT,
        rightToLeft: true,
      }),
    ],
  });

const emptyPara = (spacing = 80) =>
  new Paragraph({ spacing: { before: spacing, after: 0 }, bidirectional: true, children: [] });

const ornamentLine = () =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({ text: '━━━━━  ◆  ━━━━━', color: GOLD, font: FONT, size: 16, rightToLeft: true }),
    ],
  });

/* ── Header section (fallback when no stored letterhead) ──────────── */

function buildHeader(lh: InvoiceRecord['letterheads']): Paragraph[] {
  const paras: Paragraph[] = [];

  paras.push(centerText('━━━  الأستاذ  ━━━', { size: 18, color: GOLD }));

  if (lh?.name_fr) {
    paras.push(centerText('Maître', { size: 14, color: TEXT_LIGHT }));
  }

  paras.push(centerText(lh?.lawyer_name || '—', { size: 44, bold: true, color: NAVY, spacing: 40 }));

  if (lh?.name_fr) {
    paras.push(centerText(lh.name_fr, { size: 22, color: TEXT_GRAY, spacing: 20 }));
  }

  paras.push(ornamentLine());

  if (lh?.title_ar || lh?.bar_name_ar) {
    const titleAr = [lh?.title_ar, lh?.bar_name_ar ? `لدى ${lh.bar_name_ar}` : ''].filter(Boolean).join(' ');
    paras.push(centerText(titleAr, { size: 20, color: '1e1e1e' }));
  }
  if (lh?.title_fr || lh?.bar_name_fr) {
    const titleFr = [lh?.title_fr, lh?.bar_name_fr ? `près ${lh.bar_name_fr}` : ''].filter(Boolean).join(' ');
    paras.push(centerText(titleFr, { size: 16, color: TEXT_LIGHT }));
  }

  const contactParts: string[] = [];
  if (lh?.address) contactParts.push(lh.city ? `${lh.address}، ${lh.city}` : lh.address);
  if (lh?.phone) contactParts.push(`هاتف: ${lh.phone}`);
  if (lh?.email) contactParts.push(lh.email);
  if (contactParts.length > 0) {
    paras.push(centerText(contactParts.join('  |  '), { size: 15, color: TEXT_LIGHT, spacing: 40 }));
  }

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

/* ── Document title ───────────────────────────────────────────────── */

function buildTitle(invoiceNumber: string): Paragraph[] {
  return [
    emptyPara(200),
    centerText('وصل أداء', { size: 40, bold: true, color: NAVY }),
    centerText('Reçu de paiement', { size: 18, color: TEXT_LIGHT, spacing: 20 }),
    emptyPara(60),
    centerText(`━━  ${invoiceNumber}  ━━`, { size: 16, color: TEXT_GRAY }),
    emptyPara(100),
  ];
}

/* ── Client / case info table ─────────────────────────────────────── */

function buildInfoTable(invoice: InvoiceRecord): Table {
  const rows: { labelAr: string; labelFr: string; value: string }[] = [];

  if (invoice.clients?.full_name)
    rows.push({ labelAr: 'الموكل', labelFr: 'Client', value: invoice.clients.full_name });
  if (invoice.clients?.cin)
    rows.push({ labelAr: 'رقم ب.و', labelFr: 'CIN', value: invoice.clients.cin });
  if (invoice.cases?.case_number)
    rows.push({ labelAr: 'رقم الملف', labelFr: 'N° Dossier', value: invoice.cases.case_number });
  if (invoice.cases?.title)
    rows.push({ labelAr: 'موضوع الملف', labelFr: 'Objet', value: invoice.cases.title });
  if (invoice.cases?.case_type)
    rows.push({ labelAr: 'طبيعة النزاع', labelFr: 'Nature', value: invoice.cases.case_type });

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows: rows.map((row, i) =>
      new TableRow({
        children: [
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
                  new TextRun({ text: row.labelAr, font: FONT, size: 18, color: GOLD, rightToLeft: true }),
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
                  new TextRun({ text: row.value, font: FONT, size: 22, bold: true, color: '1e1e1e', rightToLeft: true }),
                ],
              }),
            ],
          }),
        ],
      }),
    ),
  });
}

/* ── Amount card (navy background) ────────────────────────────────── */

function buildAmountSection(amount: number): (Paragraph | Table)[] {
  const tafkeet = numberToArabicWords(amount);

  const amountTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows: [
      new TableRow({
        children: [
          // Label cell
          new TableCell({
            borders: thinBorder(NAVY),
            width: { size: 35, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                bidirectional: true,
                spacing: { after: 0 },
                children: [
                  new TextRun({ text: 'المبلغ المستلم', font: FONT, size: 20, bold: true, color: GOLD, rightToLeft: true }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                bidirectional: true,
                spacing: { after: 0 },
                children: [
                  new TextRun({ text: 'Montant reçu', font: FONT, size: 14, color: 'AAAAAA', rightToLeft: true }),
                ],
              }),
            ],
          }),
          // Amount cell
          new TableCell({
            borders: thinBorder(NAVY),
            width: { size: 65, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                bidirectional: true,
                spacing: { after: 0 },
                children: [
                  new TextRun({ text: `${fmt(amount)} MAD`, font: FONT, size: 36, bold: true, color: 'FFFFFF' }),
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
    amountTable,
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

/* ── Payment method section ───────────────────────────────────────── */

function buildPaymentMethod(method: string): Paragraph[] {
  const labels = PAYMENT_METHODS[method] || { ar: method, fr: method };
  return [
    emptyPara(100),
    bilingualPara(
      `طريقة الأداء: ${labels.ar}`,
      `Mode de paiement: ${labels.fr}`,
      { arSize: 20, frSize: 14, arColor: '1e1e1e', frColor: TEXT_LIGHT, spacing: 40 },
    ),
  ];
}

/* ── Legal acknowledgment ─────────────────────────────────────────── */

function buildLegalStatement(lawyerName: string, clientName: string): Paragraph[] {
  const legalAr = `يشهد الأستاذ ${lawyerName} باستلام المبلغ المذكور أعلاه من السيد(ة) ${clientName}، وذلك رسم مستحقات الملف المشار إليه أعلاه، ويعتبر هذا الوصل بمثابة إبراء ذمة نهائي بخصوص هذا الدفع.`;
  const legalFr = `Maître ${lawyerName} atteste avoir reçu le montant susmentionné de M./Mme ${clientName}, au titre des honoraires du dossier ci-dessus référencé. Le présent reçu vaut quittance définitive pour ce paiement.`;

  return [
    emptyPara(120),
    // Arabic legal text with gold right border
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { before: 0, after: 40 },
      border: { right: { style: BorderStyle.SINGLE, size: 6, color: GOLD } },
      indent: { right: 120 },
      children: [
        new TextRun({ text: legalAr, font: FONT, size: 20, color: '1e1e1e', rightToLeft: true }),
      ],
    }),
    // French legal text
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      bidirectional: true,
      spacing: { before: 40, after: 0 },
      border: { right: { style: BorderStyle.SINGLE, size: 6, color: BORDER_CLR } },
      indent: { right: 120 },
      children: [
        new TextRun({ text: legalFr, font: FONT, size: 16, color: TEXT_GRAY, italics: true }),
      ],
    }),
  ];
}

/* ── Signature section ────────────────────────────────────────────── */

function buildSignatureSection(date: string, city: string): Paragraph[] {
  return [
    emptyPara(200),
    bilingualPara(
      `حرر ب${city || '...'} في:`,
      `Fait à ${city || '...'} le:`,
      { arSize: 18, frSize: 14, arColor: TEXT_GRAY, frColor: TEXT_LIGHT },
    ),
    rightText(date, { size: 26, bold: true, color: NAVY, spacing: 40 }),
    emptyPara(200),
    centerText('التوقيع والختم', { size: 22, bold: true, color: NAVY }),
    centerText('Signature et cachet', { size: 14, color: TEXT_LIGHT }),
    emptyPara(300),
  ];
}

/* ══════════════════════════════════════════════
   MAIN EXPORT FUNCTION
   ══════════════════════════════════════════════ */

export const generateInvoiceDocxBlob = async (invoice: InvoiceRecord): Promise<Blob> => {
  const lh = invoice.letterheads;
  const lawyerName = lh?.lawyer_name || 'المحامي';
  const clientName = invoice.clients?.full_name || 'غير محدد';
  const city = lh?.city || '';
  const date = formatDateArabic(invoice.created_at, { year: 'numeric', month: 'long', day: 'numeric' });

  // Check if we have an original template to inject into
  const templatePath = lh?.template_path;
  const hasTemplate = !!templatePath;

  const children: (Paragraph | Table)[] = [];

  // 1. Header — only if no template
  if (!hasTemplate) {
    children.push(...buildHeader(lh));
  }

  // 2. Title
  children.push(...buildTitle(invoice.invoice_number));

  // 3. Client / case info
  children.push(buildInfoTable(invoice));
  children.push(emptyPara(150));

  // 4. Amount section
  children.push(...buildAmountSection(Number(invoice.amount)));

  // 5. Payment method
  children.push(...buildPaymentMethod(invoice.payment_method || 'cash'));

  // 6. Description (if any)
  if (invoice.description) {
    children.push(
      emptyPara(80),
      bilingualPara('ملاحظات', 'Observations', { arSize: 18, frSize: 14, arColor: GOLD, frColor: TEXT_LIGHT, bold: true, spacing: 60 }),
      rightText(invoice.description, { size: 20, color: '1e1e1e', spacing: 40 }),
    );
  }

  // 7. Legal acknowledgment
  children.push(...buildLegalStatement(lawyerName, clientName));

  // 8. Separator
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { before: 120, after: 0 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_CLR } },
      children: [],
    }),
  );

  // 9. Signature
  children.push(...buildSignatureSection(date, city));

  // 10. Footer (only if no template)
  if (!hasTemplate) {
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
  }

  // ── Template injection (primary) or standalone generation (fallback) ──
  if (hasTemplate) {
    const templateBlob = await downloadTemplate(templatePath!);
    if (templateBlob) {
      try {
        return await injectIntoTemplate(templateBlob, children);
      } catch (e) {
        console.warn('Template injection failed, falling back to standalone:', e);
      }
    }
  }

  // Fallback: standalone document
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

  return Packer.toBlob(doc);
};

export const exportInvoiceDocx = async (invoice: InvoiceRecord) => {
  const blob = await generateInvoiceDocxBlob(invoice);
  const clientName = invoice.clients?.full_name || '';
  const fileName = `وصل_أداء_${clientName}_${invoice.invoice_number}.docx`;
  saveAs(blob, fileName);
};
