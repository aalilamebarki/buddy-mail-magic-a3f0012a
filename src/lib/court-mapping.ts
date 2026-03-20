/**
 * ══════════════════════════════════════════════════════════════════
 * Moroccan Judicial Hierarchy — Court Mapping
 * 
 * Strict mapping of Appellate Courts → Primary Courts following
 * the real Mahakim.ma portal structure.
 * ══════════════════════════════════════════════════════════════════
 */

export type CourtCategory = 'civil' | 'commercial' | 'administrative';

export interface PrimaryCourt {
  label: string;
  /** Text used to match in the Mahakim portal dropdown */
  portalLabel: string;
}

export interface AppellateCourt {
  label: string;
  portalLabel: string;
  category: CourtCategory;
  primaryCourts: PrimaryCourt[];
}

/* ── Code prefix → category mapping ── 
 * Based on official Mahakim.ma codification:
 * 11xx-17xx: مدني ابتدائي (رئاسة، مدني، أكرية، عقار، اجتماعي، أحوال شخصية، قرب)
 * 21xx-29xx: زجري (جنحي، أحداث، تحقيق، سير، استئنافي جنحي، شكاية مباشرة)
 * 31xx-32xx: شكايات ومحاضر
 * 41xx: تنفيذ زجري
 * 61xx-68xx: تنفيذات وتبليغات مدنية
 * 71xx: محاكم إدارية ابتدائية
 * 72xx: محاكم استئناف إدارية
 * 73xx-76xx: تبليغات وتنفيذات إدارية
 * 81xx: تجاري - مؤسسة الرئيس (استعجالي)
 * 82xx: تجاري - شعبة الموضوع
 * 83xx: تجاري - صعوبات المقاولة
 * 84xx: تجاري - تبليغات
 * 85xx: تجاري - تنفيذات
 */
const COMMERCIAL_PREFIXES = ['81', '82', '83', '84', '85'];
const ADMINISTRATIVE_PREFIXES = ['71', '72', '73', '74', '75', '76'];

/**
 * Determines court category from a 4-digit case code.
 * Commercial: 81xx-85xx
 * Administrative: 71xx-76xx
 * Civil/Penal/Family: everything else (11xx-68xx)
 */
export function getCategoryFromCode(code: string): CourtCategory {
  if (!code || code.length < 2) return 'civil';
  const prefix = code.substring(0, 2);
  if (COMMERCIAL_PREFIXES.includes(prefix)) return 'commercial';
  if (ADMINISTRATIVE_PREFIXES.includes(prefix)) return 'administrative';
  return 'civil';
}

/**
 * Determines if a code represents an appellate-level case at a primary court.
 * E.g. 1251 = مدني مستأنف, 2801 = جنحي مستأنف
 * These are heard at the primary court but in its appellate capacity.
 */
export function isAppellateLevelCode(code: string): boolean {
  if (!code || code.length !== 4) return false;
  const num = parseInt(code);
  // Civil appellate at primary: 12xx (1220+), 13xx (1351+), 14xx (1451+), 15xx (1551+), 16xx (1651+)
  if (num >= 1220 && num <= 1258) return true;
  if (num >= 1351 && num <= 1353) return true;
  if (num >= 1451 && num <= 1456) return true;
  if (num >= 1551 && num <= 1555) return true;
  if (num >= 1651 && num <= 1653) return true;
  // Criminal appellate at primary: 28xx
  if (num >= 2801 && num <= 2824) return true;
  // Commercial appellate codes: 82xx (8223-8232)
  if (num >= 8223 && num <= 8232) return true;
  return false;
}

/**
 * Get detailed sub-category label for a case code.
 */
export function getCodeSubCategory(code: string): string {
  if (!code || code.length !== 4) return '';
  const prefix = code.substring(0, 2);
  switch (prefix) {
    case '11': return 'مؤسسة الرئيس وغرفة المشورة';
    case '12': return parseInt(code) >= 1220 ? 'المدني المستأنف' : 'المدني';
    case '13': return parseInt(code) >= 1351 ? 'الأكرية المستأنفة' : 'الأكرية';
    case '14': return parseInt(code) >= 1451 ? 'العقار المستأنف' : 'العقار';
    case '15': return parseInt(code) >= 1551 ? 'الاجتماعي المستأنف' : 'الاجتماعي';
    case '16': return 'الأحوال الشخصية / قضاء الأسرة';
    case '17': return 'قضاء القرب';
    case '21': return 'الجنحي العادي والتلبسي';
    case '22': return 'الجنحي أحداث';
    case '23': return 'التحقيق';
    case '24': return 'جنح وحوادث السير';
    case '28': return 'الجنحي الاستئنافي';
    case '29': return 'شكاية مباشرة';
    case '31': return 'الشكايات';
    case '32': return 'المحاضر';
    case '41': return 'التنفيذ الزجري';
    case '61': case '62': case '63': return 'تنفيذات مدنية';
    case '64': case '65': case '66': case '67': case '68': return 'تبليغات';
    case '71': return 'المحاكم الإدارية';
    case '72': return 'محاكم الاستئناف الإدارية';
    case '73': case '74': return 'تبليغات وتنفيذات إدارية ابتدائية';
    case '75': case '76': return 'تبليغات وتنفيذات إدارية استئنافية';
    case '81': return 'الاستعجالي التجاري (مؤسسة الرئيس)';
    case '82': return 'شعبة الموضوع التجاري';
    case '83': return 'صعوبات المقاولة';
    case '84': return 'تبليغات تجارية';
    case '85': return 'تنفيذات تجارية';
    default: return '';
  }
}


/* ══════════════════════════════════════════════════════════════════
   FULL COURT HIERARCHY
   ══════════════════════════════════════════════════════════════════ */

export const COURT_HIERARCHY: AppellateCourt[] = [
  // ═══════════════════════════════════════════════════════════
  // CIVIL / STANDARD APPELLATE COURTS (22)
  // Source: مرسوم 2.23.665 — الجدول رقم 1
  // ═══════════════════════════════════════════════════════════
  {
    label: 'محكمة الاستئناف بالرباط',
    portalLabel: 'الرباط',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بالرباط', portalLabel: 'الرباط' },
      { label: 'المحكمة الابتدائية بتمارة', portalLabel: 'تمارة' },
      { label: 'المحكمة الابتدائية بسلا', portalLabel: 'سلا' },
      { label: 'المحكمة الابتدائية بالخميسات', portalLabel: 'الخميسات' },
      { label: 'المحكمة الابتدائية بتيفلت', portalLabel: 'تيفلت' },
      { label: 'المحكمة الابتدائية بالرماني', portalLabel: 'الرماني' },
      { label: 'قسم قضاء الأسرة بالرباط', portalLabel: 'قسم قضاء الأسرة بالرباط' },
      { label: 'قسم قضاء الأسرة بسلا', portalLabel: 'قسم قضاء الأسرة بسلا' },
      { label: 'قسم قضاء الأسرة بالخميسات', portalLabel: 'قسم قضاء الأسرة بالخميسات' },
    ],
  },
  {
    label: 'محكمة الاستئناف بالقنيطرة',
    portalLabel: 'القنيطرة',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بالقنيطرة', portalLabel: 'القنيطرة' },
      { label: 'المحكمة الابتدائية بسيدي قاسم', portalLabel: 'سيدي قاسم' },
      { label: 'المحكمة الابتدائية بمشرع بلقصيري', portalLabel: 'مشرع بلقصيري' },
      { label: 'المحكمة الابتدائية بسيدي سليمان', portalLabel: 'سيدي سليمان' },
      { label: 'المحكمة الابتدائية بسوق أربعاء الغرب', portalLabel: 'سوق أربعاء الغرب' },
      { label: 'قسم قضاء الأسرة بالقنيطرة', portalLabel: 'قسم قضاء الأسرة بالقنيطرة' },
    ],
  },
  {
    label: 'محكمة الاستئناف بالدار البيضاء',
    portalLabel: 'الدار البيضاء',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية المدنية بالدار البيضاء', portalLabel: 'المدنية بالدار البيضاء' },
      { label: 'المحكمة الابتدائية الزجرية بالدار البيضاء', portalLabel: 'الزجرية بالدار البيضاء' },
      { label: 'المحكمة الاجتماعية بالدار البيضاء', portalLabel: 'الاجتماعية بالدار البيضاء' },
      { label: 'المحكمة الابتدائية بالمحمدية', portalLabel: 'المحمدية' },
      { label: 'المحكمة الابتدائية ببنسليمان', portalLabel: 'بنسليمان' },
      { label: 'المحكمة الابتدائية ببوزنيقة', portalLabel: 'بوزنيقة' },
      { label: 'قسم قضاء الأسرة بالدار البيضاء', portalLabel: 'قسم قضاء الأسرة بالدار البيضاء' },
    ],
  },
  {
    label: 'محكمة الاستئناف بالجديدة',
    portalLabel: 'الجديدة',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بالجديدة', portalLabel: 'الجديدة' },
      { label: 'المحكمة الابتدائية بسيدي بنور', portalLabel: 'سيدي بنور' },
      { label: 'قسم قضاء الأسرة بالجديدة', portalLabel: 'قسم قضاء الأسرة بالجديدة' },
    ],
  },
  {
    label: 'محكمة الاستئناف بفاس',
    portalLabel: 'فاس',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بفاس', portalLabel: 'فاس' },
      { label: 'المحكمة الابتدائية بتاونات', portalLabel: 'تاونات' },
      { label: 'المحكمة الابتدائية بصفرو', portalLabel: 'صفرو' },
      { label: 'المحكمة الابتدائية ببولمان', portalLabel: 'بولمان' },
      { label: 'قسم قضاء الأسرة بفاس', portalLabel: 'قسم قضاء الأسرة بفاس' },
    ],
  },
  {
    label: 'محكمة الاستئناف بتازة',
    portalLabel: 'تازة',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بتازة', portalLabel: 'تازة' },
      { label: 'المحكمة الابتدائية بجرسيف', portalLabel: 'جرسيف' },
      { label: 'قسم قضاء الأسرة بتازة', portalLabel: 'قسم قضاء الأسرة بتازة' },
    ],
  },
  {
    label: 'محكمة الاستئناف بمراكش',
    portalLabel: 'مراكش',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بمراكش', portalLabel: 'مراكش' },
      { label: 'المحكمة الابتدائية بتحناوت', portalLabel: 'تحناوت' },
      { label: 'المحكمة الابتدائية بشيشاوة', portalLabel: 'شيشاوة' },
      { label: 'المحكمة الابتدائية بامنتانوت', portalLabel: 'امنتانوت' },
      { label: 'المحكمة الابتدائية بقلعة السراغنة', portalLabel: 'قلعة السراغنة' },
      { label: 'المحكمة الابتدائية بابن جرير', portalLabel: 'ابن جرير' },
      { label: 'قسم قضاء الأسرة بمراكش', portalLabel: 'قسم قضاء الأسرة بمراكش' },
    ],
  },
  {
    label: 'محكمة الاستئناف بورزازات',
    portalLabel: 'ورزازات',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بورزازات', portalLabel: 'ورزازات' },
      { label: 'المحكمة الابتدائية بزاكورة', portalLabel: 'زاكورة' },
      { label: 'المحكمة الابتدائية بتنغير', portalLabel: 'تنغير' },
      { label: 'قسم قضاء الأسرة بورزازات', portalLabel: 'قسم قضاء الأسرة بورزازات' },
    ],
  },
  {
    label: 'محكمة الاستئناف بآسفي',
    portalLabel: 'آسفي',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بآسفي', portalLabel: 'آسفي' },
      { label: 'المحكمة الابتدائية باليوسفية', portalLabel: 'اليوسفية' },
      { label: 'المحكمة الابتدائية بالصويرة', portalLabel: 'الصويرة' },
      { label: 'قسم قضاء الأسرة بآسفي', portalLabel: 'قسم قضاء الأسرة بآسفي' },
    ],
  },
  {
    label: 'محكمة الاستئناف بمكناس',
    portalLabel: 'مكناس',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بمكناس', portalLabel: 'مكناس' },
      { label: 'المحكمة الابتدائية بأزرو', portalLabel: 'أزرو' },
      { label: 'المحكمة الابتدائية بالحاجب', portalLabel: 'الحاجب' },
      { label: 'المحكمة الابتدائية بإفران', portalLabel: 'إفران' },
      { label: 'قسم قضاء الأسرة بمكناس', portalLabel: 'قسم قضاء الأسرة بمكناس' },
    ],
  },
  {
    label: 'محكمة الاستئناف بالراشيدية',
    portalLabel: 'الراشيدية',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بالراشيدية', portalLabel: 'الراشيدية' },
      { label: 'المحكمة الابتدائية بأرفود', portalLabel: 'أرفود' },
      { label: 'المحكمة الابتدائية بميدلت', portalLabel: 'ميدلت' },
      { label: 'المحكمة الابتدائية بالريش', portalLabel: 'الريش' },
      { label: 'قسم قضاء الأسرة بالراشيدية', portalLabel: 'قسم قضاء الأسرة بالراشيدية' },
    ],
  },
  {
    label: 'محكمة الاستئناف بأكادير',
    portalLabel: 'أكادير',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بأكادير', portalLabel: 'أكادير' },
      { label: 'المحكمة الابتدائية بإنزكان', portalLabel: 'إنزكان' },
      { label: 'المحكمة الابتدائية ببيوكرى', portalLabel: 'بيوكرى' },
      { label: 'المحكمة الابتدائية بتارودانت', portalLabel: 'تارودانت' },
      { label: 'المحكمة الابتدائية بتيزنيت', portalLabel: 'تيزنيت' },
      { label: 'المحكمة الابتدائية بطاطا', portalLabel: 'طاطا' },
      { label: 'قسم قضاء الأسرة بأكادير', portalLabel: 'قسم قضاء الأسرة بأكادير' },
    ],
  },
  {
    label: 'محكمة الاستئناف بكلميم',
    portalLabel: 'كلميم',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بكلميم', portalLabel: 'كلميم' },
      { label: 'المحكمة الابتدائية بطانطان', portalLabel: 'طانطان' },
      { label: 'المحكمة الابتدائية بأسا الزاك', portalLabel: 'أسا الزاك' },
      { label: 'المحكمة الابتدائية بسيدي إفني', portalLabel: 'سيدي إفني' },
      { label: 'قسم قضاء الأسرة بكلميم', portalLabel: 'قسم قضاء الأسرة بكلميم' },
    ],
  },
  {
    label: 'محكمة الاستئناف بالعيون',
    portalLabel: 'العيون',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بالعيون', portalLabel: 'العيون' },
      { label: 'المحكمة الابتدائية ببوجدور', portalLabel: 'بوجدور' },
      { label: 'المحكمة الابتدائية بالسمارة', portalLabel: 'السمارة' },
      { label: 'المحكمة الابتدائية بالداخلة', portalLabel: 'الداخلة' },
      { label: 'قسم قضاء الأسرة بالعيون', portalLabel: 'قسم قضاء الأسرة بالعيون' },
    ],
  },
  {
    label: 'محكمة الاستئناف بطنجة',
    portalLabel: 'طنجة',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بطنجة', portalLabel: 'طنجة' },
      { label: 'المحكمة الابتدائية بأصيلة', portalLabel: 'أصيلة' },
      { label: 'المحكمة الابتدائية بالعرائش', portalLabel: 'العرائش' },
      { label: 'المحكمة الابتدائية بالقصر الكبير', portalLabel: 'القصر الكبير' },
      { label: 'قسم قضاء الأسرة بطنجة', portalLabel: 'قسم قضاء الأسرة بطنجة' },
    ],
  },
  {
    label: 'محكمة الاستئناف بتطوان',
    portalLabel: 'تطوان',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بتطوان', portalLabel: 'تطوان' },
      { label: 'المحكمة الابتدائية بالمضيق', portalLabel: 'المضيق' },
      { label: 'المحكمة الابتدائية بشفشاون', portalLabel: 'شفشاون' },
      { label: 'المحكمة الابتدائية بوزان', portalLabel: 'وزان' },
      { label: 'قسم قضاء الأسرة بتطوان', portalLabel: 'قسم قضاء الأسرة بتطوان' },
    ],
  },
  {
    label: 'محكمة الاستئناف بسطات',
    portalLabel: 'سطات',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بسطات', portalLabel: 'سطات' },
      { label: 'المحكمة الابتدائية ببن أحمد', portalLabel: 'بن أحمد' },
      { label: 'المحكمة الابتدائية ببرشيد', portalLabel: 'برشيد' },
      { label: 'قسم قضاء الأسرة بسطات', portalLabel: 'قسم قضاء الأسرة بسطات' },
    ],
  },
  {
    label: 'محكمة الاستئناف ببني ملال',
    portalLabel: 'بني ملال',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية ببني ملال', portalLabel: 'بني ملال' },
      { label: 'المحكمة الابتدائية بقصبة تادلة', portalLabel: 'قصبة تادلة' },
      { label: 'المحكمة الابتدائية بالفقيه بن صالح', portalLabel: 'الفقيه بن صالح' },
      { label: 'المحكمة الابتدائية بسوق السبت', portalLabel: 'سوق السبت أولاد النمة' },
      { label: 'المحكمة الابتدائية بأزيلال', portalLabel: 'أزيلال' },
      { label: 'المحكمة الابتدائية بدمنات', portalLabel: 'دمنات' },
      { label: 'المحكمة الابتدائية بخنيفرة', portalLabel: 'خنيفرة' },
      { label: 'قسم قضاء الأسرة ببني ملال', portalLabel: 'قسم قضاء الأسرة ببني ملال' },
    ],
  },
  {
    label: 'محكمة الاستئناف بخريبكة',
    portalLabel: 'خريبكة',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بخريبكة', portalLabel: 'خريبكة' },
      { label: 'المحكمة الابتدائية بوادي زم', portalLabel: 'وادي زم' },
      { label: 'المحكمة الابتدائية بأبي الجعد', portalLabel: 'أبي الجعد' },
      { label: 'قسم قضاء الأسرة بخريبكة', portalLabel: 'قسم قضاء الأسرة بخريبكة' },
    ],
  },
  {
    label: 'محكمة الاستئناف بوجدة',
    portalLabel: 'وجدة',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بوجدة', portalLabel: 'وجدة' },
      { label: 'المحكمة الابتدائية بجرادة', portalLabel: 'جرادة' },
      { label: 'المحكمة الابتدائية بتاوريرت', portalLabel: 'تاوريرت' },
      { label: 'المحكمة الابتدائية ببركان', portalLabel: 'بركان' },
      { label: 'المحكمة الابتدائية بفجيج', portalLabel: 'فجيج' },
      { label: 'قسم قضاء الأسرة بوجدة', portalLabel: 'قسم قضاء الأسرة بوجدة' },
    ],
  },
  {
    label: 'محكمة الاستئناف بالناظور',
    portalLabel: 'الناظور',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بالناظور', portalLabel: 'الناظور' },
      { label: 'المحكمة الابتدائية بالدريوش', portalLabel: 'الدريوش' },
      { label: 'قسم قضاء الأسرة بالناظور', portalLabel: 'قسم قضاء الأسرة بالناظور' },
    ],
  },
  {
    label: 'محكمة الاستئناف بالحسيمة',
    portalLabel: 'الحسيمة',
    category: 'civil',
    primaryCourts: [
      { label: 'المحكمة الابتدائية بالحسيمة', portalLabel: 'الحسيمة' },
      { label: 'المحكمة الابتدائية بتارجيست', portalLabel: 'تارجيست' },
      { label: 'قسم قضاء الأسرة بالحسيمة', portalLabel: 'قسم قضاء الأسرة بالحسيمة' },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // COMMERCIAL APPELLATE COURTS (5)
  // Source: مرسوم 2.23.665 — الجدول رقم 2
  // ═══════════════════════════════════════════════════════════
  {
    label: 'محكمة الاستئناف التجارية بالدار البيضاء',
    portalLabel: 'التجارية بالدار البيضاء',
    category: 'commercial',
    primaryCourts: [
      { label: 'المحكمة التجارية بالرباط', portalLabel: 'الرباط' },
      { label: 'المحكمة التجارية بالدار البيضاء', portalLabel: 'الدار البيضاء' },
    ],
  },
  {
    label: 'محكمة الاستئناف التجارية بفاس',
    portalLabel: 'التجارية بفاس',
    category: 'commercial',
    primaryCourts: [
      { label: 'المحكمة التجارية بفاس', portalLabel: 'فاس' },
      { label: 'المحكمة التجارية بوجدة', portalLabel: 'وجدة' },
    ],
  },
  {
    label: 'محكمة الاستئناف التجارية بمراكش',
    portalLabel: 'التجارية بمراكش',
    category: 'commercial',
    primaryCourts: [
      { label: 'المحكمة التجارية بمراكش', portalLabel: 'مراكش' },
      { label: 'المحكمة التجارية ببني ملال', portalLabel: 'بني ملال' },
    ],
  },
  {
    label: 'محكمة الاستئناف التجارية بطنجة',
    portalLabel: 'التجارية بطنجة',
    category: 'commercial',
    primaryCourts: [
      { label: 'المحكمة التجارية بطنجة', portalLabel: 'طنجة' },
    ],
  },
  {
    label: 'محكمة الاستئناف التجارية بأكادير',
    portalLabel: 'التجارية بأكادير',
    category: 'commercial',
    primaryCourts: [
      { label: 'المحكمة التجارية بأكادير', portalLabel: 'أكادير' },
      { label: 'المحكمة التجارية بالعيون', portalLabel: 'العيون' },
      { label: 'المحكمة التجارية بالداخلة', portalLabel: 'الداخلة' },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // ADMINISTRATIVE APPELLATE COURTS (5)
  // Source: مرسوم 2.23.665 — الجدول رقم 3
  // ═══════════════════════════════════════════════════════════
  {
    label: 'محكمة الاستئناف الإدارية بالرباط',
    portalLabel: 'الإدارية بالرباط',
    category: 'administrative',
    primaryCourts: [
      { label: 'المحكمة الإدارية بالرباط', portalLabel: 'الرباط' },
      { label: 'المحكمة الإدارية بالدار البيضاء', portalLabel: 'الدار البيضاء' },
    ],
  },
  {
    label: 'محكمة الاستئناف الإدارية بفاس',
    portalLabel: 'الإدارية بفاس',
    category: 'administrative',
    primaryCourts: [
      { label: 'المحكمة الإدارية بفاس', portalLabel: 'فاس' },
      { label: 'المحكمة الإدارية بوجدة', portalLabel: 'وجدة' },
    ],
  },
  {
    label: 'محكمة الاستئناف الإدارية بمراكش',
    portalLabel: 'الإدارية بمراكش',
    category: 'administrative',
    primaryCourts: [
      { label: 'المحكمة الإدارية بمراكش', portalLabel: 'مراكش' },
    ],
  },
  {
    label: 'محكمة الاستئناف الإدارية بطنجة',
    portalLabel: 'الإدارية بطنجة',
    category: 'administrative',
    primaryCourts: [
      { label: 'المحكمة الإدارية بطنجة', portalLabel: 'طنجة' },
    ],
  },
  {
    label: 'محكمة الاستئناف الإدارية بأكادير',
    portalLabel: 'الإدارية بأكادير',
    category: 'administrative',
    primaryCourts: [
      { label: 'المحكمة الإدارية بأكادير', portalLabel: 'أكادير' },
    ],
  },
];

/**
 * Filter appellate courts based on a case code.
 */
export function filterAppellateByCode(code: string): AppellateCourt[] {
  const category = getCategoryFromCode(code);
  return COURT_HIERARCHY.filter(ac => ac.category === category);
}

/**
 * Try to auto-detect appellate + primary court from a court name stored in the DB.
 */
export function detectCourtsFromName(courtName: string | null | undefined): {
  appealIdx: number;
  primaryIdx: number;
} {
  if (!courtName) return { appealIdx: -1, primaryIdx: -1 };
  const name = courtName.trim();

  for (let i = 0; i < COURT_HIERARCHY.length; i++) {
    const ac = COURT_HIERARCHY[i];
    if (name.includes(ac.label) || name.includes(ac.portalLabel)) {
      return { appealIdx: i, primaryIdx: -1 };
    }
    for (let j = 0; j < ac.primaryCourts.length; j++) {
      const pc = ac.primaryCourts[j];
      if (name.includes(pc.label) || name.includes(pc.portalLabel)) {
        return { appealIdx: i, primaryIdx: j };
      }
    }
  }
  return { appealIdx: -1, primaryIdx: -1 };
}

/**
 * Auto-resolve appellate court portal label and primary court portal label
 * from the court name stored in the case. Returns both for the sync engine.
 */
export function resolvePortalCourts(courtName: string | null | undefined, code?: string): {
  appealPortalLabel: string | null;
  primaryPortalLabel: string | null;
  appealLabel: string | null;
  primaryLabel: string | null;
} {
  const detected = detectCourtsFromName(courtName);
  if (detected.appealIdx < 0) return { appealPortalLabel: null, primaryPortalLabel: null, appealLabel: null, primaryLabel: null };

  const ac = COURT_HIERARCHY[detected.appealIdx];
  const pc = detected.primaryIdx >= 0 ? ac.primaryCourts[detected.primaryIdx] : null;

  return {
    appealPortalLabel: ac.portalLabel,
    primaryPortalLabel: pc?.portalLabel || null,
    appealLabel: ac.label,
    primaryLabel: pc?.label || null,
  };
}

/**
 * Validate that a case code matches the selected appellate court category.
 * Returns an error message if mismatched, or null if valid.
 */
export function validateHierarchy(code: string, appealIdx: number): string | null {
  if (!code || code.length !== 4 || appealIdx < 0) return null;
  const codeCategory = getCategoryFromCode(code);
  const courtCategory = COURT_HIERARCHY[appealIdx]?.category;
  if (!courtCategory) return null;

  if (codeCategory !== courtCategory) {
    const categoryLabels: Record<CourtCategory, string> = {
      civil: 'مدني/جنائي/أسري',
      commercial: 'تجاري',
      administrative: 'إداري',
    };
    return `عدم تطابق: الرمز ${code} يشير إلى ملف ${categoryLabels[codeCategory]}، لكن المحكمة المختارة ${categoryLabels[courtCategory]}`;
  }
  return null;
}

/**
 * Parse a composite case number string "numero/code/annee" into parts.
 */
export function parseCaseNumber(composite: string): { numero: string; code: string; annee: string } {
  const parts = composite.split('/');
  return {
    numero: parts[0]?.trim() || '',
    code: parts[1]?.trim() || '',
    annee: parts[2]?.trim() || '',
  };
}

/**
 * Compose case number from parts.
 */
export function composeCaseNumber(numero: string, code: string, annee: string): string {
  return `${numero}/${code}/${annee}`;
}
