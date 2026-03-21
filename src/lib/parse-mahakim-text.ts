/**
 * Client-side parser for mahakim.ma portal content
 * 
 * The lawyer copies all visible content from the mahakim.ma case page
 * and pastes it here. We extract:
 * - Case info (judge, department, status, court)
 * - Procedures table (action_date, action_type, decision, next_session_date)
 */

export interface ParsedCaseInfo {
  judge?: string;
  department?: string;
  status?: string;
  court?: string;
  subject?: string;
  parties?: string;
}

export interface ParsedProcedure {
  action_date: string | null;
  action_type: string;
  decision: string | null;
  next_session_date: string | null;
}

export interface ParsedMahakimData {
  caseInfo: ParsedCaseInfo;
  procedures: ParsedProcedure[];
  rawText: string;
  parseMethod: 'text' | 'html';
}

// Common Arabic labels used in mahakim.ma
const LABEL_MAP: Record<string, keyof ParsedCaseInfo> = {
  'القاضي': 'judge',
  'القاضي المقرر': 'judge',
  'القاضي المكلف': 'judge',
  'الهيئة': 'department',
  'الشعبة': 'department',
  'القسم': 'department',
  'الغرفة': 'department',
  'الحالة': 'status',
  'حالة الملف': 'status',
  'المحكمة': 'court',
  'الموضوع': 'subject',
  'موضوع الدعوى': 'subject',
  'الأطراف': 'parties',
  'المدعي': 'parties',
};

// Date patterns: dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd
const DATE_REGEX = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})|(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/;

function normalizeDate(raw: string): string | null {
  if (!raw) return null;
  const match = raw.match(DATE_REGEX);
  if (!match) return null;
  
  if (match[4]) {
    // yyyy-mm-dd format
    return `${match[4]}-${match[5].padStart(2, '0')}-${match[6].padStart(2, '0')}`;
  }
  // dd/mm/yyyy or dd-mm-yyyy
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3];
  return `${year}-${month}-${day}`;
}

function extractDateFromText(text: string): string | null {
  const match = text.match(DATE_REGEX);
  if (!match) return null;
  return normalizeDate(match[0]);
}

/**
 * Parse plain text pasted from mahakim.ma
 */
export function parseMahakimText(rawText: string): ParsedMahakimData {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const caseInfo: ParsedCaseInfo = {};
  const procedures: ParsedProcedure[] = [];

  // Phase 1: Extract case info from label:value pairs
  for (const line of lines) {
    // Try "label : value" or "label: value" or "label\tvalue"
    const colonMatch = line.match(/^(.+?)\s*[:：]\s*(.+)$/);
    const tabMatch = line.match(/^(.+?)\t+(.+)$/);
    const match = colonMatch || tabMatch;
    
    if (match) {
      const label = match[1].trim();
      const value = match[2].trim();
      
      for (const [arabicLabel, field] of Object.entries(LABEL_MAP)) {
        if (label.includes(arabicLabel)) {
          caseInfo[field] = value;
          break;
        }
      }
    }
  }

  // Phase 2: Extract procedures from table-like data
  // Look for rows that contain dates and Arabic text (procedure entries)
  // Common table format: Date | Action Type | Decision | Next Session Date
  
  // Strategy: Find lines that start with or contain a date pattern
  // and group adjacent tab/multi-space separated values
  
  const tableRows: string[][] = [];
  
  for (const line of lines) {
    // Split by tabs or multiple spaces (table columns)
    const cells = line.split(/\t+|\s{3,}/).map(c => c.trim()).filter(Boolean);
    
    // A procedure row typically has 2-5 cells and at least one date
    if (cells.length >= 2 && cells.some(c => DATE_REGEX.test(c))) {
      tableRows.push(cells);
    }
  }

  // If we found table rows, parse them as procedures
  for (const row of tableRows) {
    // Skip header rows
    if (row.some(c => c === 'التاريخ' || c === 'الإجراء' || c === 'تاريخ الإجراء')) {
      continue;
    }

    const proc: ParsedProcedure = {
      action_date: null,
      action_type: '',
      decision: null,
      next_session_date: null,
    };

    // First date found is usually action_date
    let dateCount = 0;
    for (const cell of row) {
      const date = extractDateFromText(cell);
      if (date) {
        if (dateCount === 0) {
          proc.action_date = cell;
        } else {
          proc.next_session_date = cell;
        }
        dateCount++;
      } else if (!proc.action_type && cell.length > 2) {
        proc.action_type = cell;
      } else if (proc.action_type && !proc.decision && cell.length > 1) {
        proc.decision = cell;
      }
    }

    if (proc.action_type || proc.action_date) {
      procedures.push(proc);
    }
  }

  // Phase 3: If no table found, try line-by-line parsing
  // Some portal layouts show procedures as sequential lines
  if (procedures.length === 0) {
    let currentProc: Partial<ParsedProcedure> | null = null;
    
    for (const line of lines) {
      const date = extractDateFromText(line);
      if (date && !line.includes('القاضي') && !line.includes('المحكمة')) {
        // Start a new procedure
        if (currentProc && (currentProc.action_type || currentProc.action_date)) {
          procedures.push({
            action_date: currentProc.action_date || null,
            action_type: currentProc.action_type || '',
            decision: currentProc.decision || null,
            next_session_date: currentProc.next_session_date || null,
          });
        }
        currentProc = { action_date: line };
      } else if (currentProc && !currentProc.action_type && line.length > 3) {
        currentProc.action_type = line;
      } else if (currentProc && currentProc.action_type && !currentProc.decision && line.length > 2) {
        currentProc.decision = line;
      }
    }
    
    // Push last procedure
    if (currentProc && (currentProc.action_type || currentProc.action_date)) {
      procedures.push({
        action_date: currentProc.action_date || null,
        action_type: currentProc.action_type || '',
        decision: currentProc.decision || null,
        next_session_date: currentProc.next_session_date || null,
      });
    }
  }

  return {
    caseInfo,
    procedures,
    rawText: rawText.substring(0, 10000),
    parseMethod: 'text',
  };
}

/**
 * Parse HTML content pasted from mahakim.ma (if the user copies from dev tools)
 */
export function parseMahakimHtml(html: string): ParsedMahakimData {
  // Create a temporary DOM to parse
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const caseInfo: ParsedCaseInfo = {};
  const procedures: ParsedProcedure[] = [];

  // Extract from table rows
  const tables = doc.querySelectorAll('table');
  for (const table of tables) {
    const rows = table.querySelectorAll('tr');
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td, th')).map(c => c.textContent?.trim() || '');
      
      if (cells.length >= 2 && cells.some(c => DATE_REGEX.test(c))) {
        const proc: ParsedProcedure = {
          action_date: null,
          action_type: '',
          decision: null,
          next_session_date: null,
        };

        let dateCount = 0;
        for (const cell of cells) {
          const date = extractDateFromText(cell);
          if (date) {
            if (dateCount === 0) proc.action_date = cell;
            else proc.next_session_date = cell;
            dateCount++;
          } else if (!proc.action_type && cell.length > 2) {
            proc.action_type = cell;
          } else if (proc.action_type && !proc.decision && cell.length > 1) {
            proc.decision = cell;
          }
        }

        if (proc.action_type || proc.action_date) {
          procedures.push(proc);
        }
      }
    }
  }

  // Extract label-value pairs from any element
  const labels = doc.querySelectorAll('label, span, td, th, div');
  for (const el of labels) {
    const text = el.textContent?.trim() || '';
    for (const [arabicLabel, field] of Object.entries(LABEL_MAP)) {
      if (text.includes(arabicLabel) && text.includes(':')) {
        const value = text.split(':').slice(1).join(':').trim();
        if (value && value.length > 1) {
          caseInfo[field] = value;
        }
      }
    }
  }

  // Fallback to text parsing if no tables found
  if (procedures.length === 0) {
    const textContent = doc.body?.textContent || '';
    return parseMahakimText(textContent);
  }

  return {
    caseInfo,
    procedures,
    rawText: (doc.body?.textContent || '').substring(0, 10000),
    parseMethod: 'html',
  };
}

/**
 * Auto-detect and parse - tries HTML first, falls back to text
 */
export function parseMahakimContent(content: string): ParsedMahakimData {
  const trimmed = content.trim();
  
  // If it looks like HTML
  if (trimmed.startsWith('<') || trimmed.includes('<table') || trimmed.includes('<div')) {
    const result = parseMahakimHtml(trimmed);
    if (result.procedures.length > 0 || Object.keys(result.caseInfo).length > 0) {
      return result;
    }
  }
  
  return parseMahakimText(trimmed);
}
