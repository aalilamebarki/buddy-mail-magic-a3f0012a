/**
 * Unified formatting utilities for the entire project.
 * Arabic locale with Western (Latin) numerals.
 */

const LOCALE = 'ar-u-nu-latn';

/** Format a date string or Date to Arabic weekday + date with Latin numerals */
export const formatDateArabic = (
  date: string | Date,
  options: Intl.DateTimeFormatOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }
): string => {
  const d = typeof date === 'string' ? new Date(date.includes('T') ? date : date + 'T00:00:00') : date;
  return d.toLocaleDateString(LOCALE, options);
};

/** Format date for full display (long weekday + full month) */
export const formatDateFull = (date: string | Date): string => {
  return formatDateArabic(date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

/** Format date + time */
export const formatDateTime = (date: string | Date): string => {
  return formatDateArabic(date, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Format date short (no weekday) */
export const formatDateShort = (date: string | Date): string => {
  return formatDateArabic(date, { year: 'numeric', month: 'short', day: 'numeric' });
};

/** Get session status badge info */
export const getSessionStatus = (sessionDate: string): { label: string; type: 'today' | 'upcoming' | 'past' } => {
  const today = new Date().toISOString().split('T')[0];
  if (sessionDate === today) return { label: 'اليوم', type: 'today' };
  if (sessionDate > today) return { label: 'قادمة', type: 'upcoming' };
  return { label: 'منتهية', type: 'past' };
};

/** Format case number for display with LTR direction indicator */
export const formatCaseNumber = (caseNumber: string | null | undefined): string => {
  return caseNumber || '—';
};
