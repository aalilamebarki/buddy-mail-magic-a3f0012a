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
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import type { SessionRecord } from '@/hooks/useSessions';

interface ExportCourtSessionsWordParams {
  exportDate: Date;
  getNextSession: (caseId: string, afterDate: string) => string | null;
  mode: 'day' | 'week';
  sessions: SessionRecord[];
}

const wordFont = 'Traditional Arabic';

const forceLtr = (value: string) => `\u200E${value}\u200E`;

const cellBorders = (color = '000000') => ({
  top: { style: BorderStyle.SINGLE, size: 1, color },
  right: { style: BorderStyle.SINGLE, size: 1, color },
  bottom: { style: BorderStyle.SINGLE, size: 1, color },
  left: { style: BorderStyle.SINGLE, size: 1, color },
});

const buildParagraph = (
  text: string,
  options?: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    bold?: boolean;
    color?: string;
    ltr?: boolean;
    size?: number;
    spacingAfter?: number;
  },
) => new Paragraph({
  alignment: options?.alignment ?? AlignmentType.RIGHT,
  bidirectional: !options?.ltr,
  spacing: { after: options?.spacingAfter ?? 0 },
  children: [
    new TextRun({
      bold: options?.bold ?? false,
      color: options?.color ?? '000000',
      font: wordFont,
      rightToLeft: !options?.ltr,
      size: options?.size ?? 24,
      text: options?.ltr ? forceLtr(text) : text,
    }),
  ],
});

const buildCell = (
  text: string,
  options?: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    bold?: boolean;
    fill?: string;
    ltr?: boolean;
    size?: number;
    textColor?: string;
    width: number;
  },
) => new TableCell({
  borders: cellBorders(options?.fill ? '000000' : '444444'),
  children: [
    buildParagraph(text, {
      alignment: options?.alignment ?? AlignmentType.RIGHT,
      bold: options?.bold,
      color: options?.textColor,
      ltr: options?.ltr,
      size: options?.size,
    }),
  ],
  margins: {
    bottom: 110,
    left: 90,
    right: 90,
    top: 110,
  },
  shading: options?.fill ? { fill: options.fill } : undefined,
  width: { size: options?.width ?? 20, type: WidthType.PERCENTAGE },
});

const formatArabicDate = (date: Date, withWeekday = false) =>
  date.toLocaleDateString('ar-u-nu-latn', {
    day: 'numeric',
    month: 'long',
    weekday: withWeekday ? 'long' : undefined,
    year: 'numeric',
  });

const buildCourtTitleTable = (court: string, count: number) => new Table({
  borders: cellBorders('000000'),
  layout: TableLayoutType.FIXED,
  rows: [
    new TableRow({
      children: [
        buildCell(`${court} — ${count} جلسة`, {
          alignment: AlignmentType.RIGHT,
          bold: true,
          fill: '000000',
          size: 24,
          textColor: 'FFFFFF',
          width: 100,
        }),
      ],
    }),
  ],
  width: { size: 100, type: WidthType.PERCENTAGE },
});

const buildSessionsTable = (rows: Array<{
  clientName: string;
  caseNumber: string;
  nextSession: string;
  opponentName: string;
  sessionDate: string;
}>) => new Table({
  layout: TableLayoutType.FIXED,
  rows: [
    new TableRow({
      tableHeader: true,
      children: [
        buildCell('#', { alignment: AlignmentType.CENTER, bold: true, fill: 'EAEAEA', width: 6 }),
        buildCell('الموكل', { alignment: AlignmentType.RIGHT, bold: true, fill: 'EAEAEA', width: 23 }),
        buildCell('رقم الملف', { alignment: AlignmentType.CENTER, bold: true, fill: 'EAEAEA', width: 16 }),
        buildCell('الخصم', { alignment: AlignmentType.RIGHT, bold: true, fill: 'EAEAEA', width: 23 }),
        buildCell('تاريخ الجلسة', { alignment: AlignmentType.CENTER, bold: true, fill: 'EAEAEA', width: 16 }),
        buildCell('الجلسة المقبلة', { alignment: AlignmentType.CENTER, bold: true, fill: 'EAEAEA', width: 16 }),
      ],
    }),
    ...rows.map((row, index) => new TableRow({
      children: [
        buildCell(String(index + 1), { alignment: AlignmentType.CENTER, width: 6 }),
        buildCell(row.clientName, { alignment: AlignmentType.RIGHT, width: 23 }),
        buildCell(row.caseNumber, { alignment: AlignmentType.CENTER, ltr: true, width: 16 }),
        buildCell(row.opponentName, { alignment: AlignmentType.RIGHT, width: 23 }),
        buildCell(row.sessionDate, { alignment: AlignmentType.CENTER, width: 16 }),
        buildCell(row.nextSession, { alignment: AlignmentType.CENTER, width: 16 }),
      ],
    })),
  ],
  width: { size: 100, type: WidthType.PERCENTAGE },
});

export const exportCourtSessionsWord = async ({
  exportDate,
  getNextSession,
  mode,
  sessions,
}: ExportCourtSessionsWordParams) => {
  let dateStart: string;
  let dateEnd: string;
  let fileName: string;
  let periodLabel: string;
  let title: string;

  if (mode === 'day') {
    dateStart = format(exportDate, 'yyyy-MM-dd');
    dateEnd = dateStart;
    title = 'جدول جلسات يومية';
    periodLabel = formatArabicDate(exportDate, true);
    fileName = `جلسة_يوم_${format(exportDate, 'yyyy-MM-dd')}.docx`;
  } else {
    const weekStart = startOfWeek(exportDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(exportDate, { weekStartsOn: 1 });
    dateStart = format(weekStart, 'yyyy-MM-dd');
    dateEnd = format(weekEnd, 'yyyy-MM-dd');
    title = 'جدول الجلسات الأسبوعي';
    periodLabel = `من ${formatArabicDate(weekStart)} إلى ${formatArabicDate(weekEnd)}`;
    fileName = 'جدول_الجلسات_الأسبوع.docx';
  }

  const filteredSessions = sessions.filter(session => session.session_date >= dateStart && session.session_date <= dateEnd);

  if (filteredSessions.length === 0) {
    throw new Error('لا توجد جلسات في هذه الفترة');
  }

  const groupedByCourt = filteredSessions.reduce<Record<string, SessionRecord[]>>((acc, session) => {
    const courtName = session.cases?.court || 'محكمة غير محددة';
    acc[courtName] = acc[courtName] || [];
    acc[courtName].push(session);
    return acc;
  }, {});

  const sortedCourts = Object.entries(groupedByCourt).sort(([a], [b]) => a.localeCompare(b, 'ar'));

  const children: Array<Paragraph | Table> = [
    buildParagraph(title, {
      alignment: AlignmentType.CENTER,
      bold: true,
      size: 34,
      spacingAfter: 120,
    }),
    buildParagraph(periodLabel, {
      alignment: AlignmentType.CENTER,
      color: '666666',
      size: 22,
      spacingAfter: 80,
    }),
    buildParagraph(`عدد الجلسات: ${filteredSessions.length} | عدد المحاكم: ${sortedCourts.length}`, {
      alignment: AlignmentType.CENTER,
      color: '555555',
      size: 20,
      spacingAfter: 220,
    }),
  ];

  sortedCourts.forEach(([courtName, courtSessions], courtIndex) => {
    const rows = courtSessions.map(session => {
      const nextSessionDate = getNextSession(session.case_id, session.session_date);
      return {
        caseNumber: session.cases?.case_number || '—',
        clientName: session.cases?.clients?.full_name || '—',
        nextSession: nextSessionDate ? formatArabicDate(new Date(`${nextSessionDate}T00:00:00`)) : '—',
        opponentName: session.cases?.opposing_party || '—',
        sessionDate: formatArabicDate(new Date(`${session.session_date}T00:00:00`)),
      };
    });

    children.push(buildCourtTitleTable(courtName, courtSessions.length));
    children.push(buildSessionsTable(rows));

    if (courtIndex < sortedCourts.length - 1) {
      children.push(new Paragraph({ spacing: { after: 180 } }));
    }
  });

  children.push(
    buildParagraph(`تم إنشاء الملف بتاريخ ${formatArabicDate(new Date())}`, {
      alignment: AlignmentType.CENTER,
      color: '777777',
      size: 18,
      spacingAfter: 0,
    }),
  );

  const doc = new Document({
    sections: [
      {
        children,
        properties: {
          page: {
            margin: { bottom: 720, left: 720, right: 720, top: 720 },
            size: { orientation: PageOrientation.LANDSCAPE },
          },
        },
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
};
