import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** optional secondary text shown below the label */
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  /** Extra content rendered after the list (e.g. "Add new" button) */
  footer?: React.ReactNode;
}

/**
 * A Select-like component with built-in fuzzy search.
 * Uses Popover + Command (cmdk) under the hood.
 * Designed for RTL (Arabic) interfaces.
 */
const SearchableSelect = ({
  options,
  value,
  onValueChange,
  placeholder = 'اختر...',
  searchPlaceholder = 'ابحث...',
  emptyMessage = 'لا توجد نتائج',
  className,
  triggerClassName,
  disabled,
  footer,
}: SearchableSelectProps) => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const selected = options.find(o => o.value === value);

  // Simple fuzzy: includes + levenshtein tolerance
  const filtered = React.useMemo(() => {
    if (!search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter(o => {
      const label = o.label.toLowerCase();
      const sub = (o.sublabel || '').toLowerCase();
      return label.includes(q) || sub.includes(q) || fuzzyMatch(label, q) || fuzzyMatch(sub, q);
    });
  }, [options, search]);

  const handleSelect = (val: string) => {
    onValueChange(val);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            triggerClassName,
          )}
        >
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          <span className="truncate flex-1 text-right">{selected?.label || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('w-[--radix-popover-trigger-width] p-0', className)}
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {filtered.map(option => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      'h-4 w-4 ml-2 shrink-0',
                      value === option.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{option.label}</p>
                    {option.sublabel && (
                      <p className="text-xs text-muted-foreground truncate">{option.sublabel}</p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {footer}
        </Command>
      </PopoverContent>
    </Popover>
  );
};

/** Simple fuzzy match using character-by-character inclusion */
function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  let qi = 0;
  for (let i = 0; i < text.length && qi < query.length; i++) {
    if (text[i] === query[qi]) qi++;
  }
  return qi === query.length;
}

export { SearchableSelect };
