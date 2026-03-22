import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Check, UserPlus, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useClients } from '@/hooks/useClients';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CaseNumberInput } from '@/components/cases/CaseNumberInput';
import { getCategoryFromCode, buildFlatCourtList, type FlatCourtEntry } from '@/lib/court-mapping';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (caseId: string) => void;
}

const ImportCaseDialog = ({ open, onOpenChange, onImported }: Props) => {
  const { clients, setClients } = useClients();

  const [caseNumberRaw, setCaseNumberRaw] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [courtPopoverOpen, setCourtPopoverOpen] = useState(false);
  const [courtSearchTerm, setCourtSearchTerm] = useState('');
  const [selectedCourt, setSelectedCourt] = useState<FlatCourtEntry | null>(null);
  const [saving, setSaving] = useState(false);

  // Parse case number
  const parts = useMemo(() => {
    const p = caseNumberRaw.split('/');
    return { numero: p[0]?.trim() || '', code: p[1]?.trim() || '', annee: p[2]?.trim() || '' };
  }, [caseNumberRaw]);

  const isValidNumber = parts.numero && parts.code.length === 4 && parts.annee.length === 4;

  // Court list filtered by code category
  const flatCourtList = useMemo(() => {
    let list = buildFlatCourtList(parts.code.length === 4 ? parts.code : undefined);
    if (courtSearchTerm) {
      const q = courtSearchTerm.toLowerCase();
      list = list.filter(c => c.label.toLowerCase().includes(q) || c.portalLabel.toLowerCase().includes(q) || (c.parentLabel || '').toLowerCase().includes(q));
    }
    return list;
  }, [parts.code, courtSearchTerm]);

  // Client filtering
  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter(c => c.full_name.toLowerCase().includes(q));
  }, [clients, clientSearch]);

  const selectedClientLabel = clientId ? clients.find(c => c.id === clientId)?.full_name : '';

  // Quick add client
  const handleAddQuickClient = async (name: string) => {
    if (!name.trim()) return;
    const { data, error } = await supabase.from('clients').insert({ full_name: name.trim() }).select('*').single();
    if (error) { toast.error('خطأ في إضافة الموكل'); return; }
    setClients(prev => [...prev, data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setClientId(data.id);
    setClientSearch('');
    setClientPopoverOpen(false);
    toast.success('تم إضافة الموكل');
  };

  // Import
  const handleImport = async () => {
    if (!isValidNumber) { toast.error('رقم الملف غير مكتمل (رقم/رمز/سنة)'); return; }
    if (!clientId) { toast.error('يجب اختيار الموكل'); return; }
    if (!selectedCourt) { toast.error('يجب اختيار المحكمة'); return; }

    setSaving(true);
    try {
      const clientName = clients.find(c => c.id === clientId)?.full_name || '';
      const title = `ملف ${clientName} - ${selectedCourt.label}`;

      const { data, error } = await supabase.from('cases').insert({
        title,
        client_id: clientId,
        court: selectedCourt.label,
        court_level: selectedCourt.level,
        case_number: caseNumberRaw.trim(),
        case_type: getCategoryLabel(parts.code),
        status: 'active',
      }).select('id').single();

      if (error) throw error;

      toast.success('تم استيراد الملف بنجاح ✅');
      toast.info('جاري جلب البيانات والأطراف والجلسة تلقائياً...', { duration: 5000 });

      onOpenChange(false);
      onImported(data.id);

      // Reset
      setCaseNumberRaw('');
      setClientId('');
      setSelectedCourt(null);
      setClientSearch('');
      setCourtSearchTerm('');
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ في الاستيراد');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            استيراد ملف سريع
          </DialogTitle>
          <DialogDescription>
            أدخل رقم الملف والموكل والمحكمة فقط — النظام سيجلب الأطراف والإجراءات والجلسة المقبلة تلقائياً
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Case Number */}
          <div className="space-y-2">
            <Label>رقم الملف *</Label>
            <CaseNumberInput value={caseNumberRaw} onChange={setCaseNumberRaw} />
          </div>

          {/* Client */}
          <div>
            <Label>الموكل *</Label>
            <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal mt-1">
                  {selectedClientLabel || 'ابحث عن الموكل أو أضف جديد...'}
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="ابحث باسم الموكل..." value={clientSearch} onValueChange={setClientSearch} />
                  <CommandList>
                    <CommandEmpty className="p-2">
                      <Button variant="ghost" className="w-full justify-start gap-2 text-primary" onClick={() => handleAddQuickClient(clientSearch)}>
                        <UserPlus className="h-4 w-4" /> إضافة "{clientSearch}" كموكل جديد
                      </Button>
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredClients.map(c => (
                        <CommandItem key={c.id} value={c.id} onSelect={() => { setClientId(c.id); setClientPopoverOpen(false); setClientSearch(''); }}>
                          <Check className={cn("ml-2 h-4 w-4", clientId === c.id ? "opacity-100" : "opacity-0")} />
                          {c.full_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    {clientSearch && filteredClients.length > 0 && (
                      <CommandGroup>
                        <CommandItem onSelect={() => handleAddQuickClient(clientSearch)}>
                          <UserPlus className="ml-2 h-4 w-4 text-primary" />
                          <span className="text-primary">إضافة "{clientSearch}" كموكل جديد</span>
                        </CommandItem>
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Court */}
          <div>
            <Label>المحكمة *</Label>
            <Popover open={courtPopoverOpen} onOpenChange={setCourtPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal mt-1">
                  {selectedCourt?.label || 'اختر المحكمة...'}
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="ابحث عن المحكمة..." value={courtSearchTerm} onValueChange={setCourtSearchTerm} />
                  <CommandList>
                    <CommandEmpty>لا توجد نتائج</CommandEmpty>
                    <CommandGroup>
                      {flatCourtList.map((entry, i) => (
                        <CommandItem
                          key={`${entry.label}-${i}`}
                          value={entry.label}
                          onSelect={() => { setSelectedCourt(entry); setCourtPopoverOpen(false); setCourtSearchTerm(''); }}
                          className={entry.level === 'ابتدائية' ? 'pr-6' : ''}
                        >
                          <Check className={cn("ml-2 h-4 w-4", selectedCourt?.label === entry.label ? "opacity-100" : "opacity-0")} />
                          <div>
                            <span>{entry.label}</span>
                            {entry.parentLabel && <span className="text-xs text-muted-foreground mr-2">({entry.parentLabel})</span>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleImport} disabled={saving || !isValidNumber || !clientId || !selectedCourt} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            استيراد وجلب تلقائي
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function getCategoryLabel(code: string): string {
  if (!code || code.length < 2) return '';
  const cat = getCategoryFromCode(code);
  if (cat === 'commercial') return 'تجاري';
  if (cat === 'administrative') return 'إداري';
  const prefix = code.substring(0, 2);
  if (['21', '22', '23', '24', '28', '29'].includes(prefix)) return 'جنائي';
  if (['16'].includes(prefix)) return 'أسري';
  if (['15'].includes(prefix)) return 'شغل';
  if (['14'].includes(prefix)) return 'عقاري';
  return 'مدني';
}

export default ImportCaseDialog;
