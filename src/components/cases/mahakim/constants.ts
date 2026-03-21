/**
 * ثوابت مكونات مزامنة محاكم
 * Constants for Mahakim sync UI — status labels
 */

import { Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { createElement } from 'react';
import type { StatusConfig } from './types';

/** خريطة حالات المزامنة مع الأيقونات والألوان */
export const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending: {
    label: 'في الانتظار',
    icon: createElement(Clock, { className: 'h-3.5 w-3.5' }),
    color: 'text-amber-600',
  },
  scraping: {
    label: 'جاري الجلب...',
    icon: createElement(Loader2, { className: 'h-3.5 w-3.5 animate-spin' }),
    color: 'text-blue-600',
  },
  completed: {
    label: 'تم بنجاح',
    icon: createElement(CheckCircle2, { className: 'h-3.5 w-3.5' }),
    color: 'text-emerald-600',
  },
  failed: {
    label: 'فشل',
    icon: createElement(XCircle, { className: 'h-3.5 w-3.5' }),
    color: 'text-destructive',
  },
};
