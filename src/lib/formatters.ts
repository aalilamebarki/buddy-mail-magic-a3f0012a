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

/**
 * Format a Moroccan phone number to international format (+212...).
 * Converts 06XXXXXXXX / 07XXXXXXXX → +2126XXXXXXXX / +2127XXXXXXXX
 * Handles spaces, dashes, and dots as separators.
 * If already in +212 format, normalizes it.
 */
export const formatPhoneMA = (phone: string): string => {
  // Strip all non-digit characters except leading +
  const cleaned = phone.replace(/[\s\-\.\(\)]/g, '');

  // Already international +212...
  if (/^\+212\d{9}$/.test(cleaned)) return cleaned;

  // 00212... format
  if (/^00212\d{9}$/.test(cleaned)) return '+' + cleaned.slice(2);

  // Local 0X format (06, 07, 05, etc.)
  if (/^0[5-7]\d{8}$/.test(cleaned)) return '+212' + cleaned.slice(1);

  // Return as-is if unrecognized
  return phone.trim();
};
