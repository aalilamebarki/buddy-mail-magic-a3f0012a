/**
 * Court Sessions Word Export — Professional RTL Table Layout
 * 
 * Generates a clean, well-structured .docx with proper Arabic table formatting.
 * Uses EMU-based column widths for precise control and proper RTL bidi settings.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import type { SessionRecord } from '@/hooks/useSessions';

/* ── Config ────────────────────────────────────────────────────────── */

interface ExportParams {
  exportDate: Date;
  getNextSession: (caseId: string, afterDate: string) => string | null;
  mode: 'day' | 'week';
  sessions: SessionRecord[];
}

const FONT = 'Traditional Arabic';
const TITLE_SIZE = 40;     // 20pt
const SUBTITLE_SIZE = 28;  // 14pt
const HEADER_SIZE = 26;    // 13pt
const BODY_SIZE = 24;      // 12pt
const SMALL_SIZE = 20;     // 10pt

const NAVY = '1a2a44';
const DARK_GRAY = '333333';
const MID_GRAY = '666666';
const LIGHT_BG = 'F2F4F7';
const WHITE = 'FFFFFF';
const ROW_ALT = 'F8F9FB';

/* ── Helpers ───────────────────────────────────────────────────────── */

const forceLtr = (v: string) => `\u200E${v}\u200E`;

const formatArabicDate = (date: Date, withWeekday = false) =>
  date.toLocaleDateString('ar-u-nu-latn', {
    day: 'numeric',
    month: 'long',
    weekday: withWeekday ? 'long' : undefined,
    year: 'numeric',
  });

const thinBorder = (color = 'BBBBBB') => ({
  top:    { style: BorderStyle.SINGLE, size: 1, color },
  right:  { style: BorderStyle.SINGLE, size: 1, color },
  bottom: { style: BorderStyle.SINGLE, size: 1, color },
  left:   { style: BorderStyle.SINGLE, size: 1, color },
});

const noBorder = () => ({
  top:    { style: BorderStyle.NONE, size: 0, color: WHITE },
  right:  { style: BorderStyle.NONE, size: 0, color: WHITE },
  bottom: { style: BorderStyle.NONE, size: 0, color: WHITE },
  left:   { style: BorderStyle.NONE, size: 0, color: WHITE },
});

/* ── Text Builders ─────────────────────────────────────────────────── */

const txt = (
  text: string,
  opts?: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    bold?: boolean;
    color?: string;
    ltr?: boolean;
    size?: number;
  },
) =>
  new Paragraph({
    alignment: opts?.alignment ?? AlignmentType.RIGHT,
    bidirectional: true,
    spacing: { before: 0, after: 0, line: 276 },
    children: [
      new TextRun({
        text: opts?.ltr ? forceLtr(text) : text,
        font: FONT,
        size: opts?.size ?? BODY_SIZE,
        bold: opts?.bold ?? false,
        color: opts?.color ?? DARK_GRAY,
        rightToLeft: !opts?.ltr,
      }),
    ],
  });

/* ── Cell Builder ──────────────────────────────────────────────────── */

const cell = (
  text: string,
  width: number,
  opts?: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    bold?: boolean;
    fill?: string;
    ltr?: boolean;
    size?: number;
    textColor?: string;
    borderColor?: string;
  },
) =>
  new TableCell({
    borders: thinBorder(opts?.borderColor ?? (opts?.fill === NAVY ? NAVY : 'CCCCCC')),
    verticalAlign: VerticalAlign.CENTER,
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: opts?.fill ? { fill: opts.fill } : undefined,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: opts?.alignment ?? AlignmentType.CENTER,
        bidirectional: true,
        spacing: { before: 0, after: 0, line: 260 },
        children: [
          new TextRun({
            text: opts?.ltr ? forceLtr(text) : text,
            font: FONT,
            size: opts?.size ?? BODY_SIZE,
            bold: opts?.bold ?? false,
            color: opts?.textColor ?? DARK_GRAY,
            rightToLeft: !opts?.ltr,
          }),
        ],
      }),
    ],
  });

/* ── Column Definition ─────────────────────────────────────────────── */

const COLUMNS = [
  { label: '#',             width: 5,  align: AlignmentType.CENTER },
  { label: 'الموكل',        width: 20, align: AlignmentType.RIGHT },
  { label: 'رقم الملف',     width: 15, align: AlignmentType.CENTER },
  { label: 'الخصم',         width: 20, align: AlignmentType.RIGHT },
  { label: 'تاريخ الجلسة',  width: 15, align: AlignmentType.CENTER },
  { label: 'الجلسة المقبلة', width: 15, align: AlignmentType.CENTER },
  { label: 'ملاحظات',       width: 10, align: AlignmentType.RIGHT },
] as const;

/* ── Court Title Banner ────────────────────────────────────────────── */

const courtBanner = (court: string, count: number) =>
  new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell(`${court}  —  ${count} جلسة`, 100, {
            alignment: AlignmentType.RIGHT,
            bold: true,
            fill: NAVY,
            textColor: WHITE,
            size: HEADER_SIZE,
            borderColor: NAVY,
          }),
        ],
      }),
    ],
  });

/* ── Sessions Table ────────────────────────────────────────────────── */

const sessionsTable = (
  rows: Array<{
    clientName: string;
    caseNumber: string;
    nextSession: string;
    opponentName: string;
    sessionDate: string;
    notes: string;
  }>,
) => {
  // Header row
  const headerRow = new TableRow({
    tableHeader: true,
    children: COLUMNS.map(col =>
      cell(col.label, col.width, {
        alignment: AlignmentType.CENTER,
        bold: true,
        fill: LIGHT_BG,
        textColor: NAVY,
        size: HEADER_SIZE,
        borderColor: 'BBBBBB',
      }),
    ),
  });

  // Data rows with alternating backgrounds
  const dataRows = rows.map((row, i) => {
    const bg = i % 2 === 1 ? ROW_ALT : undefined;
    return new TableRow({
      children: [
        cell(String(i + 1), COLUMNS[0].width, { alignment: AlignmentType.CENTER, fill: bg, size: SMALL_SIZE }),
        cell(row.clientName, COLUMNS[1].width, { alignment: AlignmentType.RIGHT, fill: bg }),
        cell(row.caseNumber, COLUMNS[2].width, { alignment: AlignmentType.CENTER, ltr: true, fill: bg }),
        cell(row.opponentName, COLUMNS[3].width, { alignment: AlignmentType.RIGHT, fill: bg }),
        cell(row.sessionDate, COLUMNS[4].width, { alignment: AlignmentType.CENTER, fill: bg }),
        cell(row.nextSession, COLUMNS[5].width, { alignment: AlignmentType.CENTER, fill: bg }),
        cell(row.notes, COLUMNS[6].width, { alignment: AlignmentType.RIGHT, fill: bg, size: SMALL_SIZE }),
      ],
    });
  });

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
};

/* ── Main Export ────────────────────────────────────────────────────── */

export const exportCourtSessionsWord = async ({
  exportDate,
  getNextSession,
  mode,
  sessions,
}: ExportParams) => {
  // Determine date range & labels
  let dateStart: string, dateEnd: string, fileName: string, periodLabel: string, title: string;

  if (mode === 'day') {
    dateStart = dateEnd = format(exportDate, 'yyyy-MM-dd');
    title = 'جدول جلسات يومية';
    periodLabel = formatArabicDate(exportDate, true);
    fileName = `جلسة_يوم_${dateStart}.docx`;
  } else {
    const ws = startOfWeek(exportDate, { weekStartsOn: 1 });
    const we = endOfWeek(exportDate, { weekStartsOn: 1 });
    dateStart = format(ws, 'yyyy-MM-dd');
    dateEnd = format(we, 'yyyy-MM-dd');
    title = 'جدول الجلسات الأسبوعي';
    periodLabel = `من ${formatArabicDate(ws)} إلى ${formatArabicDate(we)}`;
    fileName = 'جدول_الجلسات_الأسبوع.docx';
  }

  const filtered = sessions.filter(s => s.session_date >= dateStart && s.session_date <= dateEnd);
  if (!filtered.length) throw new Error('لا توجد جلسات في هذه الفترة');

  // Group by court
  const grouped = filtered.reduce<Record<string, SessionRecord[]>>((acc, s) => {
    const court = s.cases?.court || 'محكمة غير محددة';
    (acc[court] ??= []).push(s);
    return acc;
  }, {});

  const sortedCourts = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, 'ar'));

  // Build document children
  const children: Array<Paragraph | Table> = [
    // Title
    txt(title, { alignment: AlignmentType.CENTER, bold: true, size: TITLE_SIZE, color: NAVY }),
    new Paragraph({ spacing: { after: 60 } }),
    // Period
    txt(periodLabel, { alignment: AlignmentType.CENTER, size: SUBTITLE_SIZE, color: MID_GRAY }),
    new Paragraph({ spacing: { after: 40 } }),
    // Stats
    txt(`عدد الجلسات: ${filtered.length}  |  عدد المحاكم: ${sortedCourts.length}`, {
      alignment: AlignmentType.CENTER,
      size: SMALL_SIZE,
      color: MID_GRAY,
    }),
    new Paragraph({ spacing: { after: 300 } }),
  ];

  sortedCourts.forEach(([courtName, courtSessions], idx) => {
    const rows = courtSessions.map(s => {
      const next = getNextSession(s.case_id, s.session_date);
      return {
        caseNumber: s.cases?.case_number || '—',
        clientName: s.cases?.clients?.full_name || '—',
        nextSession: next ? formatArabicDate(new Date(`${next}T00:00:00`)) : '—',
        opponentName: s.cases?.opposing_party || '—',
        sessionDate: formatArabicDate(new Date(`${s.session_date}T00:00:00`)),
        notes: s.notes || '',
      };
    });

    children.push(courtBanner(courtName, courtSessions.length));
    children.push(sessionsTable(rows));

    if (idx < sortedCourts.length - 1) {
      children.push(new Paragraph({ spacing: { after: 300 } }));
    }
  });

  // Footer
  children.push(
    new Paragraph({ spacing: { before: 500 } }),
    txt(`تم إنشاء الملف بتاريخ ${formatArabicDate(new Date())}`, {
      alignment: AlignmentType.CENTER,
      color: 'AAAAAA',
      size: 18,
    }),
  );

  const doc = new Document({
    sections: [
      {
        children,
        properties: {
          page: {
            margin: { top: 850, bottom: 850, left: 1000, right: 850 },
            size: { orientation: PageOrientation.LANDSCAPE },
          },
        },
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
};
