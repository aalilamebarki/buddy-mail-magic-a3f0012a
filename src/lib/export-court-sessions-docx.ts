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
  opts?: { bold?: boolean; fill?: string; color?: string; size?: number },
) =>
  new TableCell({
    borders: border(),
    verticalAlign: VerticalAlign.CENTER,
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: opts?.fill ? { fill: opts.fill } : undefined,
    margins: { top: 15, bottom: 15, left: 40, right: 40 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text,
            font: FONT,
            size: opts?.size ?? 22,
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
  { label: 'الموكل', width: 20 },
  { label: 'رقم الملف', width: 16 },
  { label: 'الخصم', width: 20 },
  { label: 'الجلسة المقبلة', width: 14 },
  { label: 'ملاحظات', width: 30 },
];

/* ── Build one court section ───────────────────────────────────────── */

const buildCourtSection = (
  courtName: string,
  rows: Array<{
    clientName: string;
    caseNumber: string;
    opponentName: string;
    nextSession: string;
    notes: string;
  }>,
): Array<Paragraph | Table> => {
  // Court name only — centered above the table
  const title = new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 100, after: 40 },
    children: [
      new TextRun({
        text: courtName,
        font: FONT,
        size: 26,
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
        size: 22,
      }),
    ),
  });

  // Data rows
  const dataRows = rows.map(row =>
    new TableRow({
      children: [
        makeCell(row.clientName, COLS[0].width),
        makeCell(row.caseNumber, COLS[1].width),
        makeCell(row.opponentName, COLS[2].width),
        makeCell(row.nextSession, COLS[3].width),
        makeCell(row.notes, COLS[4].width, { size: 20 }),
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

/* ── Build a day heading ───────────────────────────────────────────── */

const buildDayHeading = (date: Date): Paragraph =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    bidirectional: true,
    spacing: { before: 250, after: 80 },
    children: [
      new TextRun({
        text: formatArabicDate(date, true),
        font: FONT,
        size: 32,
        bold: true,
        color: NAVY,
        rightToLeft: true,
      }),
    ],
  });

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

  // Group by date first, then by court within each date
  const groupedByDate = filtered.reduce<Record<string, SessionRecord[]>>((acc, s) => {
    (acc[s.session_date] ??= []).push(s);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort();

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

  // For each day, add day heading then court tables
  sortedDates.forEach(dateStr => {
    const daySessions = groupedByDate[dateStr];
    const dayDate = new Date(`${dateStr}T00:00:00`);

    // Day heading
    children.push(buildDayHeading(dayDate));

    // Group this day's sessions by court
    const courtGroups = daySessions.reduce<Record<string, SessionRecord[]>>((acc, s) => {
      const court = s.cases?.court || 'محكمة غير محددة';
      (acc[court] ??= []).push(s);
      return acc;
    }, {});

    const sortedCourts = Object.entries(courtGroups).sort(([a], [b]) => a.localeCompare(b, 'ar'));

    sortedCourts.forEach(([courtName, courtSessions]) => {
      const rows = courtSessions.map(s => {
        const next = getNextSession(s.case_id, s.session_date);
        return {
          clientName: s.cases?.clients?.full_name || '—',
          caseNumber: s.cases?.case_number || '—',
          opponentName: s.cases?.opposing_party || '—',
          nextSession: next ? formatArabicDate(new Date(`${next}T00:00:00`)) : '—',
          notes: s.notes || '',
        };
      });

      children.push(...buildCourtSection(courtName, rows));
    });
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
