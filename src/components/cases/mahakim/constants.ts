/**
 * ثوابت مكونات مزامنة محاكم
 * Constants for Mahakim sync UI — status labels, provider options
 */

import { Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { createElement } from 'react';
import type { StatusConfig, ProviderOption } from './types';

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

/** خيارات مزودي الجلب مع وصف مختصر */
export const PROVIDER_OPTIONS: Record<string, ProviderOption> = {
  auto: { label: 'تلقائي', desc: 'يجرب Firecrawl أولاً ثم ScrapingBee' },
  firecrawl: { label: 'Firecrawl', desc: 'متصفح Playwright — أسرع' },
  scrapingbee: { label: 'ScrapingBee', desc: 'بروكسي مغربي — أكثر استقراراً' },
};
