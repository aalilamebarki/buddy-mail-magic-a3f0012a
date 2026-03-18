/**
 * Court Sessions Word Export — Clean RTL Table per Court
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

/* ── Types ─────────────────────────────────────────────────────────── */

interface ExportParams {
  exportDate: Date;
  getNextSession: (caseId: string, afterDate: string) => string | null;
  mode: 'day' | 'week';
  sessions: SessionRecord[];
}

/* ── Config ────────────────────────────────────────────────────────── */

const FONT = 'Traditional Arabic';
const NAVY = '1B3A5C';
const BORDER_COLOR = '999999';
const HEADER_BG = 'D6E4F0';

/* ── Helpers ───────────────────────────────────────────────────────── */

const formatArabicDate = (date: Date, withWeekday = false) =>
  date.toLocaleDateString('ar-u-nu-latn', {
    day: 'numeric',
    month: 'long',
    weekday: withWeekday ? 'long' : undefined,
    year: 'numeric',
  });

const border = () => ({
  top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
});

const makeCell = (
  text: string,
  width: number,
  opts?: { bold?: boolean; fill?: string; color?: string; size?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] },
) =>
  new TableCell({
    borders: border(),
    verticalAlign: VerticalAlign.CENTER,
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: opts?.fill ? { fill: opts.fill } : undefined,
    margins: { top: 30, bottom: 30, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: opts?.alignment ?? AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text,
            font: FONT,
            size: opts?.size ?? 24,
            bold: opts?.bold ?? false,
            color: opts?.color ?? '000000',
            rightToLeft: true,
          }),
        ],
      }),
    ],
  });

/* ── Column config (RTL order: right to left) ──────────────────────── */

const COLS = [
  { label: 'الموكل', width: 18 },
  { label: 'رقم الملف', width: 14 },
  { label: 'الخصم', width: 18 },
  { label: 'تاريخ الجلسة', width: 12 },
  { label: 'الجلسة المقبلة', width: 12 },
  { label: 'ملاحظات', width: 26 },
];

/* ── Build one court section ───────────────────────────────────────── */

const buildCourtSection = (
  courtName: string,
  rows: Array<{
    clientName: string;
    caseNumber: string;
    opponentName: string;
    sessionDate: string;
    nextSession: string;
    notes: string;
  }>,
): Array<Paragraph | Table> => {
  // Court name only — centered above the table
  const title = new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 300, after: 100 },
    children: [
      new TextRun({
        text: courtName,
        font: FONT,
        size: 28,
        bold: true,
        color: NAVY,
        rightToLeft: true,
      }),
    ],
  });

  // Header row
  const headerRow = new TableRow({
    tableHeader: true,
    children: COLS.map(col =>
      makeCell(col.label, col.width, {
        bold: true,
        fill: HEADER_BG,
        color: NAVY,
        size: 24,
        alignment: AlignmentType.CENTER,
      }),
    ),
  });

  // Data rows
  const dataRows = rows.map(row =>
    new TableRow({
      children: [
        makeCell(row.clientName, COLS[0].width),
        makeCell(row.caseNumber, COLS[1].width, { alignment: AlignmentType.CENTER }),
        makeCell(row.opponentName, COLS[2].width),
        makeCell(row.sessionDate, COLS[3].width, { alignment: AlignmentType.CENTER }),
        makeCell(row.nextSession, COLS[4].width, { alignment: AlignmentType.CENTER }),
        makeCell(row.notes, COLS[5].width, { size: 20 }),
      ],
    }),
  );

  const table = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    rows: [headerRow, ...dataRows],
  });

  return [title, table];
};

/* ── Main Export ────────────────────────────────────────────────────── */

export const exportCourtSessionsWord = async ({
  exportDate,
  getNextSession,
  mode,
  sessions,
}: ExportParams) => {
  let dateStart: string, dateEnd: string, fileName: string, periodLabel: string, mainTitle: string;

  if (mode === 'day') {
    dateStart = dateEnd = format(exportDate, 'yyyy-MM-dd');
    mainTitle = 'يومية الجلسات';
    periodLabel = formatArabicDate(exportDate, true);
    fileName = `جلسات_${dateStart}.docx`;
  } else {
    const ws = startOfWeek(exportDate, { weekStartsOn: 1 });
    const we = endOfWeek(exportDate, { weekStartsOn: 1 });
    dateStart = format(ws, 'yyyy-MM-dd');
    dateEnd = format(we, 'yyyy-MM-dd');
    mainTitle = 'يومية الجلسات الأسبوعية';
    periodLabel = `من ${formatArabicDate(ws)} إلى ${formatArabicDate(we)}`;
    fileName = 'جلسات_الأسبوع.docx';
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

  // Document header
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: mainTitle,
          font: FONT,
          size: 40,
          bold: true,
          color: NAVY,
          rightToLeft: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: periodLabel,
          font: FONT,
          size: 26,
          color: '444444',
          rightToLeft: true,
        }),
      ],
    }),
  ];

  // Build court sections
  sortedCourts.forEach(([courtName, courtSessions]) => {
    // Determine a representative date for the court header
    const dates = [...new Set(courtSessions.map(s => s.session_date))].sort();
    const dateLabel = dates.length === 1
      ? formatArabicDate(new Date(`${dates[0]}T00:00:00`), true)
      : dates.map(d => formatArabicDate(new Date(`${d}T00:00:00`))).join(' / ');

    const rows = courtSessions.map(s => {
      const next = getNextSession(s.case_id, s.session_date);
      return {
        clientName: s.cases?.clients?.full_name || '—',
        caseNumber: s.cases?.case_number || '—',
        opponentName: s.cases?.opposing_party || '—',
        sessionDate: formatArabicDate(new Date(`${s.session_date}T00:00:00`)),
        nextSession: next ? formatArabicDate(new Date(`${next}T00:00:00`)) : '—',
        notes: s.notes || '',
      };
    });

    children.push(...buildCourtSection(courtName, dateLabel, rows));
  });

  // Footer
  children.push(
    new Paragraph({ spacing: { before: 400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      children: [
        new TextRun({
          text: `تم الإنشاء بتاريخ ${formatArabicDate(new Date())}`,
          font: FONT,
          size: 18,
          color: 'AAAAAA',
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
          margin: { top: 700, bottom: 700, left: 800, right: 800 },
          size: { orientation: PageOrientation.LANDSCAPE },
        },
      },
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
};
