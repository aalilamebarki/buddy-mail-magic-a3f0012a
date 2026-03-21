/**
 * محلل الحافظة الذكي لبوابة محاكم
 * Smart Clipboard Parser for Mahakim Portal
 * 
 * يقوم بتحليل النص الملصق من بوابة محاكم واستخراج:
 * - بيانات الملف (المحكمة، القاضي، الشعبة، الحالة)
 * - جدول الإجراءات (التاريخ، النوع، القرار، الجلسة المقبلة)
 * 
 * يدعم عدة صيغ للصق: HTML، نص عادي، بيانات جدولية
 */

/** نتيجة تحليل الحافظة */
export interface ParsedMahakimData {
  /** بيانات الملف الأساسية */
  caseInfo: {
    courtName?: string;
    subject?: string;
    judgeName?: string;
    department?: string;
    caseStatus?: string;
    caseNumber?: string;
  };
  /** جدول الإجراءات المستخرجة */
  procedures: ParsedProcedure[];
  /** أقرب تاريخ جلسة مقبلة */
  nextSessionDate?: string;
  /** عدد الإجراءات المستخرجة */
  totalExtracted: number;
  /** هل التحليل ناجح */
  success: boolean;
  /** رسالة خطأ إن وجدت */
  error?: string;
}

/** إجراء مستخرج من الحافظة */
export interface ParsedProcedure {
  actionDate: string;
  actionType: string;
  decision: string;
  nextSessionDate: string;
}

/**
 * أنماط التعرف على بيانات الملف من النص الملصق
 * Patterns to identify case metadata from pasted text
 */
const FIELD_PATTERNS = {
  // المحكمة — عادة تظهر في أعلى الصفحة
  courtName: [
    /(?:المحكمة|محكمة)\s*[:\s]*(.+?)(?:\n|$)/,
    /(?:الابتدائية|الاستئناف|التجارية|الإدارية)\s+(?:ب|في)?\s*(.+?)(?:\n|$)/,
  ],
  // الموضوع
  subject: [
    /(?:الموضوع|موضوع\s*القضية|نوع\s*القضية)\s*[:\s]*(.+?)(?:\n|$)/,
    /(?:طبيعة\s*القضية)\s*[:\s]*(.+?)(?:\n|$)/,
  ],
  // القاضي المقرر
  judgeName: [
    /(?:القاضي|المقرر|القاضي\s*المقرر|المستشار\s*المقرر)\s*[:\s]*(.+?)(?:\n|$)/,
  ],
  // الشعبة / الغرفة
  department: [
    /(?:الشعبة|الغرفة|القسم|الهيئة)\s*[:\s]*(.+?)(?:\n|$)/,
  ],
  // حالة الملف
  caseStatus: [
    /(?:الحالة|حالة\s*الملف|وضعية\s*الملف)\s*[:\s]*(.+?)(?:\n|$)/,
  ],
  // رقم الملف
  caseNumber: [
    /(?:رقم\s*الملف|ملف\s*(?:رقم|عدد))\s*[:\s]*(.+?)(?:\n|$)/,
    /(\d{1,6}\s*\/\s*\d{4}\s*\/\s*\d{4})/,
  ],
};

/**
 * تحليل صف جدول إجراءات من نص
 * Parse a procedure row from tab-separated or space-separated text
 */
function parseProcedureRow(cells: string[]): ParsedProcedure | null {
  if (cells.length < 2) return null;

  // تنظيف الخلايا
  const cleaned = cells.map(c => c.trim()).filter(Boolean);
  if (cleaned.length < 2) return null;

  // البحث عن خلية تحتوي على تاريخ (dd/mm/yyyy أو yyyy-mm-dd)
  const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
  
  let actionDate = '';
  let actionType = '';
  let decision = '';
  let nextSessionDate = '';

  // محاولة تحديد الحقول بناءً على عدد الخلايا
  if (cleaned.length >= 4) {
    // 4+ خلايا: تاريخ | إجراء | قرار | جلسة مقبلة
    actionDate = cleaned[0];
    actionType = cleaned[1];
    decision = cleaned[2];
    nextSessionDate = cleaned[3];
  } else if (cleaned.length === 3) {
    actionDate = cleaned[0];
    actionType = cleaned[1];
    // الخلية الثالثة قد تكون قرار أو تاريخ جلسة
    if (datePattern.test(cleaned[2])) {
      nextSessionDate = cleaned[2];
    } else {
      decision = cleaned[2];
    }
  } else if (cleaned.length === 2) {
    actionDate = cleaned[0];
    actionType = cleaned[1];
  }

  // التحقق من أن التاريخ صالح
  if (!datePattern.test(actionDate) && !actionDate.match(/\d/)) {
    return null;
  }

  return { actionDate, actionType, decision, nextSessionDate };
}

/**
 * استخراج الإجراءات من نص HTML ملصق
 * Extract procedures from pasted HTML content
 */
function parseFromHTML(html: string): ParsedProcedure[] {
  const procedures: ParsedProcedure[] = [];
  
  // إنشاء DOM مؤقت لتحليل HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // البحث عن جداول
  const tables = doc.querySelectorAll('table');
  
  for (const table of tables) {
    const rows = table.querySelectorAll('tr');
    let isHeaderSkipped = false;
    
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll('td, th'));
      const cellTexts = cells.map(c => (c.textContent || '').trim());
      
      // تخطي صف العنوان
      if (!isHeaderSkipped) {
        const headerKeywords = ['تاريخ', 'إجراء', 'قرار', 'الجلسة', 'نوع'];
        if (cellTexts.some(t => headerKeywords.some(k => t.includes(k)))) {
          isHeaderSkipped = true;
          continue;
        }
      }
      
      const proc = parseProcedureRow(cellTexts);
      if (proc) {
        procedures.push(proc);
        isHeaderSkipped = true;
      }
    }
  }
  
  return procedures;
}

/**
 * استخراج الإجراءات من نص عادي
 * Extract procedures from plain text (tab-separated or formatted)
 */
function parseFromText(text: string): ParsedProcedure[] {
  const procedures: ParsedProcedure[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  const datePattern = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/;
  let foundProcedureSection = false;
  
  for (const line of lines) {
    // البحث عن بداية قسم الإجراءات
    if (line.includes('تاريخ الإجراء') || line.includes('نوع الإجراء') || line.includes('الإجراءات')) {
      foundProcedureSection = true;
      continue;
    }
    
    // إذا وجدنا قسم الإجراءات أو السطر يحتوي على تاريخ
    if (foundProcedureSection || datePattern.test(line)) {
      // تقسيم بالتاب أو عدة مسافات
      const cells = line.split(/\t+/).length > 1 
        ? line.split(/\t+/)
        : line.split(/\s{2,}/);
      
      const proc = parseProcedureRow(cells);
      if (proc) {
        procedures.push(proc);
        foundProcedureSection = true;
      }
    }
  }
  
  return procedures;
}

/**
 * استخراج بيانات الملف من النص
 * Extract case metadata from text content
 */
function extractCaseInfo(text: string): ParsedMahakimData['caseInfo'] {
  const info: ParsedMahakimData['caseInfo'] = {};
  
  for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const value = match[1].trim();
        if (value.length > 1 && value.length < 200) {
          info[field as keyof typeof info] = value;
          break;
        }
      }
    }
  }
  
  return info;
}

/**
 * تحديد أقرب تاريخ جلسة مقبلة
 * Find the nearest future session date from procedures
 */
function findNextSessionDate(procedures: ParsedProcedure[]): string | undefined {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const datePattern = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/;
  let nearest: Date | null = null;
  let nearestStr = '';
  
  for (const proc of procedures) {
    if (!proc.nextSessionDate) continue;
    const match = proc.nextSessionDate.match(datePattern);
    if (!match) continue;
    
    let [, day, month, year] = match;
    let y = parseInt(year);
    if (y < 100) y += 2000;
    const d = new Date(y, parseInt(month) - 1, parseInt(day));
    
    if (d >= today && (!nearest || d < nearest)) {
      nearest = d;
      nearestStr = `${y}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
  return nearestStr || undefined;
}

/**
 * تطبيع التاريخ إلى صيغة yyyy-mm-dd
 * Normalize date string to yyyy-mm-dd format
 */
export function normalizeDateStr(dateStr: string): string {
  if (!dateStr) return '';
  const match = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (!match) return dateStr;
  let [, day, month, year] = match;
  let y = parseInt(year);
  if (y < 100) y += 2000;
  return `${y}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * الدالة الرئيسية لتحليل محتوى الحافظة
 * Main function to parse clipboard content from Mahakim portal
 * 
 * @param text النص الملصق (قد يكون HTML أو نص عادي)
 * @param html محتوى HTML من الحافظة (اختياري)
 */
export function parseMahakimClipboard(text: string, html?: string): ParsedMahakimData {
  if (!text && !html) {
    return {
      caseInfo: {},
      procedures: [],
      totalExtracted: 0,
      success: false,
      error: 'لم يتم العثور على محتوى للتحليل',
    };
  }
  
  let procedures: ParsedProcedure[] = [];
  
  // محاولة التحليل من HTML أولاً (أدق)
  if (html) {
    procedures = parseFromHTML(html);
  }
  
  // إذا لم نجد شيئاً من HTML، نحاول النص العادي
  if (procedures.length === 0 && text) {
    procedures = parseFromText(text);
  }
  
  // استخراج بيانات الملف
  const fullText = text || '';
  const caseInfo = extractCaseInfo(fullText);
  
  // تحديد الجلسة المقبلة
  const nextSessionDate = findNextSessionDate(procedures);
  
  const success = procedures.length > 0 || Object.keys(caseInfo).some(k => caseInfo[k as keyof typeof caseInfo]);
  
  return {
    caseInfo,
    procedures,
    nextSessionDate,
    totalExtracted: procedures.length,
    success,
    error: success ? undefined : 'لم يتم التعرف على بيانات من المحتوى الملصق. تأكد من نسخ صفحة نتائج الملف من بوابة محاكم.',
  };
}
