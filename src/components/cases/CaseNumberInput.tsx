import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getCategoryFromCode, getCodeSubCategory } from '@/lib/court-mapping';

const categoryLabels: Record<string, string> = {
  civil: 'مدني / جنائي / أسري',
  commercial: 'تجاري',
  administrative: 'إداري',
};

interface CaseNumberInputProps {
  value: string; // composite "numero/code/annee"
  onChange: (composite: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  showCategory?: boolean;
}

/**
 * Smart single-field case number input.
 * User types: numero/code/year (e.g. 1/1401/2025)
 * Auto-inserts "/" after code reaches 4 digits.
 * Display format: numero/code/annee (LTR)
 */
export function CaseNumberInput({ value, onChange, placeholder, autoFocus, showCategory = true }: CaseNumberInputProps) {
  const [rawInput, setRawInput] = useState(value || '');

  // Sync external value changes
  useEffect(() => {
    setRawInput(value || '');
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;
    
    // Only allow digits and slashes
    input = input.replace(/[^\d/]/g, '');
    
    // Split by slash
    const parts = input.split('/');
    
    // Limit to 3 parts max
    if (parts.length > 3) {
      parts.length = 3;
      input = parts.join('/');
    }
    
    // Auto-insert slash after code (4 digits in second segment)
    if (parts.length === 2 && parts[1].length === 4 && !input.endsWith('/')) {
      // Check if user just typed the 4th digit of code
      const prevParts = rawInput.split('/');
      if (prevParts.length === 2 && prevParts[1].length === 3) {
        input = input + '/';
      }
    }
    
    // Enforce: code max 4 digits, year max 4 digits
    if (parts.length >= 2) {
      parts[1] = parts[1].slice(0, 4);
    }
    if (parts.length >= 3) {
      parts[2] = parts[2].slice(0, 4);
    }
    
    const reconstructed = parts.join('/');
    setRawInput(reconstructed);
    onChange(reconstructed);
  }, [onChange, rawInput]);

  // Parse for display
  const parts = rawInput.split('/');
  const code = parts[1] || '';
  const category = code.length === 4 ? getCategoryFromCode(code) : null;

  return (
    <div className="space-y-1.5">
      <Input
        value={rawInput}
        onChange={handleChange}
        placeholder={placeholder || '1/1401/2025'}
        className="text-center font-mono text-base tracking-wider"
        dir="ltr"
        autoFocus={autoFocus}
      />
      {showCategory && category && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          النوع المكتشف: <Badge variant="outline" className="text-[10px] px-1.5 py-0">{categoryLabels[category]}</Badge>
        </p>
      )}
    </div>
  );
}
