/**
 * محلل النص الملصوق من صفحة محاكم
 * يحلل النص المنسوخ (Ctrl+A, Ctrl+C) من صفحة تفاصيل ملف على mahakim.ma
 * ويستخرج الإجراءات والمعلومات الأساسية
 */

export interface ParsedCaseInfo {
  judge?: string;
  department?: string;
  status?: string;
  court?: string;
  subject?: string;
  caseType?: string;
  registrationDate?: string;
  plaintiff?: string;
  defendant?: string;
  parties?: string;
  next_hearing?: string;
  next_session_date?: string;
}

export interface ParsedProcedure {
  action_date: string | null;
  action_type: string;
  decision: string | null;
  next_session_date: string | null;
}

export interface PasteParseResult {
  caseInfo: ParsedCaseInfo;
  procedures: ParsedProcedure[];
  allLabels: Record<string, string>;
  rawText: string;
  detectedCaseNumber?: string;
}

const labelMap: Record<string, keyof ParsedCaseInfo> = {
  'القاضي': 'judge',
  'القاضي المقرر': 'judge',
  'القاضي المكلف': 'judge',
  'قاضي التحقيق': 'judge',
  'الهيئة': 'department',
  'الشعبة': 'department',
  'القسم': 'department',
  'الغرفة': 'department',
  'الحالة': 'status',
  'حالة الملف': 'status',
  'الوضعية': 'status',
  'المحكمة': 'court',
  'الموضوع': 'subject',
  'نوع القضية': 'caseType',
  'طبيعة القضية': 'caseType',
  'تاريخ التسجيل': 'registrationDate',
  'تاريخ الإيداع': 'registrationDate',
  'المدعي': 'plaintiff',
  'المستأنف': 'plaintiff',
  'المدعى عليه': 'defendant',
  'المدعى عليهم': 'defendant',
  'المستأنف عليه': 'defendant',
  'الأطراف': 'parties',
  'الجلسة المقبلة': 'next_hearing',
  'تاريخ الجلسة المقبلة': 'next_session_date',
  'جلسة مقبلة': 'next_session_date',
};

const dateRegex = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/;

export function parseMahakimPaste(text: string): PasteParseResult {
  const rawText = text.substring(0, 10000);
  const caseInfo: ParsedCaseInfo = {};
  const allLabels: Record<string, string> = {};
  const procedures: ParsedProcedure[] = [];

  // 1. Extract key-value pairs from text
  const lines = text.split(/\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 3 || trimmed.length > 500) continue;

    // Try colon-separated pairs
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0 && colonIdx < 60) {
      const label = trimmed.substring(0, colonIdx).trim();
      const value = trimmed.substring(colonIdx + 1).trim();
      if (label && value && value.length > 1 && label.length < 50) {
        allLabels[label] = value;
        for (const [key, field] of Object.entries(labelMap)) {
          if (label.includes(key)) {
            caseInfo[field] = value;
          }
        }
      }
    }
  }

  // 2. Extract procedures from tab-separated table rows
  // Mahakim tables when copied become tab-separated text
  const tableLines: string[][] = [];
  for (const line of lines) {
    const cells = line.split('\t').map(c => c.trim()).filter(c => c.length > 0);
    if (cells.length >= 2) {
      tableLines.push(cells);
    }
  }

  // Find procedure table: look for rows with dates
  let headerIdx = -1;
  let colMap = { date: -1, type: -1, decision: -1, nextDate: -1 };

  for (let i = 0; i < tableLines.length; i++) {
    const row = tableLines[i];
    const hasDateKeyword = row.some(c => c.includes('تاريخ') && !c.includes('المقبل'));
    const hasActionKeyword = row.some(c => c.includes('إجراء') || c.includes('نوع') || c.includes('عملية'));
    
    if (hasDateKeyword || hasActionKeyword) {
      headerIdx = i;
      for (let j = 0; j < row.length; j++) {
        const h = row[j].toLowerCase();
        if (h.includes('تاريخ') && !h.includes('مقبل') && colMap.date === -1) colMap.date = j;
        else if (h.includes('إجراء') || h.includes('نوع') || h.includes('عملية')) colMap.type = j;
        else if (h.includes('قرار') || h.includes('منطوق') || h.includes('حكم')) colMap.decision = j;
        else if (h.includes('مقبل') || h.includes('القادم') || h.includes('التالي')) colMap.nextDate = j;
      }
      break;
    }
  }

  // Parse data rows after header
  const startRow = headerIdx >= 0 ? headerIdx + 1 : 0;
  for (let i = startRow; i < tableLines.length; i++) {
    const cells = tableLines[i];
    if (cells.length < 2) continue;

    const proc: ParsedProcedure = { action_date: null, action_type: '', decision: null, next_session_date: null };

    if (headerIdx >= 0) {
      // Use column mapping
      if (colMap.date >= 0 && colMap.date < cells.length) proc.action_date = cells[colMap.date];
      if (colMap.type >= 0 && colMap.type < cells.length) proc.action_type = cells[colMap.type];
      if (colMap.decision >= 0 && colMap.decision < cells.length) proc.decision = cells[colMap.decision];
      if (colMap.nextDate >= 0 && colMap.nextDate < cells.length) proc.next_session_date = cells[colMap.nextDate];
    } else {
      // Heuristic: find dates and text
      let dateCount = 0;
      for (const cell of cells) {
        if (dateRegex.test(cell)) {
          if (dateCount === 0) proc.action_date = cell;
          else proc.next_session_date = cell;
          dateCount++;
        } else if (!proc.action_type && cell.length > 2) {
          proc.action_type = cell;
        } else if (proc.action_type && !proc.decision && cell.length > 1) {
          proc.decision = cell;
        }
      }
    }

    if (proc.action_type || proc.action_date) {
      procedures.push(proc);
    }
  }

  // 3. Detect case number from text
  let detectedCaseNumber: string | undefined;
  const cnPatterns = [
    /(\d{1,6})\s*\/\s*(\d{4})\s*\/\s*(\d{4})/,
    /(\d{1,6})\s*\/\s*(\d{2,4})\s*\/\s*(\d{2,4})/,
  ];
  for (const pattern of cnPatterns) {
    const match = text.match(pattern);
    if (match) {
      detectedCaseNumber = match[0].replace(/\s/g, '');
      break;
    }
  }

  return { caseInfo, procedures, allLabels, rawText, detectedCaseNumber };
}
