/**
 * مكون اختيار مزود الجلب (Firecrawl / ScrapingBee / تلقائي)
 * Provider selector dropdown for choosing the scraping backend
 */

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, Globe } from 'lucide-react';
import { PROVIDER_OPTIONS } from './constants';
import type { ScrapeProvider } from './types';

interface ProviderSelectorProps {
  /** المزود المختار حالياً */
  value: ScrapeProvider;
  /** تحديث المزود المختار */
  onChange: (provider: ScrapeProvider) => void;
  /** هل فشلت المحاولة السابقة (لعرض اقتراح التبديل) */
  lastAttemptFailed?: boolean;
}

/** أيقونة المزود حسب الاسم */
const providerIcon = (key: string) => {
  if (key === 'auto') return <Zap className="h-3 w-3 text-primary" />;
  if (key === 'firecrawl') return <Globe className="h-3 w-3 text-orange-500" />;
  return <Globe className="h-3 w-3 text-yellow-500" />;
};

export const ProviderSelector = ({ value, onChange, lastAttemptFailed }: ProviderSelectorProps) => (
  <div className="space-y-2">
    <Label className="font-medium text-xs">طريقة الجلب</Label>
    <Select value={value} onValueChange={(v) => onChange(v as ScrapeProvider)}>
      <SelectTrigger className="h-9 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(PROVIDER_OPTIONS).map(([key, { label, desc }]) => (
          <SelectItem key={key} value={key} className="text-xs">
            <div className="flex items-center gap-2">
              {providerIcon(key)}
              <span>{label}</span>
              <span className="text-muted-foreground">— {desc}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {lastAttemptFailed && (
      <p className="text-[10px] text-amber-600">
        💡 فشلت المحاولة السابقة — تم اقتراح مزود بديل
      </p>
    )}
  </div>
);
