import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Plus, X, ChevronsUpDown, Check, UserPlus, UserRoundPlus, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useClients } from '@/hooks/useClients';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CaseNumberInput } from '@/components/cases/CaseNumberInput';
import { getCategoryFromCode, COURT_HIERARCHY, filterAppellateByCode, validateHierarchy, findAppellateByPrimary, buildFlatCourtList, type AppellateCourt, type FlatCourtEntry } from '@/lib/court-mapping';

/* ─── Types ─── */
export interface Opponent {
  name: string;
  address: string;
  phone: string;
}

export interface PresenceParty {
  name: string;
  address: string;
  phone: string;
}

export interface CaseForm {
  title: string;
  case_type: string;
  description: string;
  client_id: string;
  court: string;
  case_number_raw: string;
}

/* ─── Constants ─── */
const emptyForm: CaseForm = { title: '', case_type: '', description: '', client_id: '', court: '', case_number_raw: '' };
const emptyOpponent: Opponent = { name: '', address: '', phone: '' };
const NIYABA = 'النيابة العامة';
const HIDDEN_ADDRESS_PARTIES = [NIYABA, 'قاضي التوثيق', 'قاضي شؤون القاصرين'];
export const caseTypes = ['مدني', 'جنائي', 'تجاري', 'إداري', 'عقاري', 'أسري', 'شغل', 'آخر'];

const isNiyaba = (name: string) => HIDDEN_ADDRESS_PARTIES.includes(name.trim());

const categoryLabels: Record<string, string> = {
  civil: 'مدني / جنائي / أسري',
  commercial: 'تجاري',
  administrative: 'إداري',
};

/* ─── Props ─── */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (caseId: string) => void;
  preselectedClientId?: string;
  editingCase?: any;
}

const CreateCaseDialog = ({ open, onOpenChange, onCreated, preselectedClientId, editingCase }: Props) => {
  const { clients, setClients } = useClients();
  const { user } = useAuth();

  const [form, setForm] = useState<CaseForm>(emptyForm);
  const [opponents, setOpponents] = useState<Opponent[]>([{ ...emptyOpponent }]);
  const [presenceParties, setPresenceParties] = useState<PresenceParty[]>([]);
  const [againstAllInterested, setAgainstAllInterested] = useState(false);
  const [saving, setSaving] = useState(false);

  // Court selection — single flat dropdown
  const [courtLevel, setCourtLevel] = useState('');
  const [courtPopoverOpen, setCourtPopoverOpen] = useState(false);
  const [courtSearchTerm, setCourtSearchTerm] = useState('');
  const [selectedAppellateIdx, setSelectedAppellateIdx] = useState<number>(-1);

  // Client
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  // Reset form on open
  useEffect(() => {
    if (!open) return;
    if (editingCase) {
      setForm({
        title: editingCase.title || '',
        case_type: editingCase.case_type || '',
        description: editingCase.description || '',
        client_id: editingCase.client_id || '',
        court: editingCase.court || '',
        case_number_raw: editingCase.case_number || '',
      });
      supabase.from('case_opponents').select('*').eq('case_id', editingCase.id).order('sort_order').then(({ data }) => {
        if (data && data.length > 0) {
          const opps = data.filter((o: any) => o.party_type !== 'presence');
          const pres = data.filter((o: any) => o.party_type === 'presence');
          const isAll = opps.length === 1 && opps[0].name === 'كل من له المصلحة';
          setAgainstAllInterested(isAll);
          setOpponents(isAll ? [{ ...emptyOpponent }] : opps.map((o: any) => ({ name: o.name, address: o.address || '', phone: o.phone || '' })));
          setPresenceParties(pres.map((o: any) => ({ name: o.name, address: o.address || '', phone: o.phone || '' })));
        } else {
          setOpponents([{ name: editingCase.opposing_party || '', address: editingCase.opposing_party_address || '', phone: editingCase.opposing_party_phone || '' }]);
          setPresenceParties([]);
          setAgainstAllInterested(false);
        }
      });
      // Auto-detect court level from existing court
      if (editingCase.court) {
        const parentIdx = findAppellateByPrimary(editingCase.court);
        if (parentIdx >= 0) {
          setCourtLevel('ابتدائية');
          setSelectedAppellateIdx(parentIdx);
        } else {
          const acIdx = COURT_HIERARCHY.findIndex(ac => ac.label === editingCase.court);
          if (acIdx >= 0) {
            setCourtLevel('استئناف');
            setSelectedAppellateIdx(acIdx);
          } else if (editingCase.court === 'محكمة النقض') {
            setCourtLevel('نقض');
          }
        }
      }
    } else {
      setForm({ ...emptyForm, client_id: preselectedClientId || '' });
      setOpponents([{ ...emptyOpponent }]);
      setPresenceParties([]);
      setAgainstAllInterested(false);
      setCourtLevel('');
      setSelectedAppellateIdx(-1);
    }
    setCourtSearchTerm('');
  }, [open, editingCase, preselectedClientId]);

  const updateField = (field: keyof CaseForm, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  /* ─── Derived: case code and category ─── */
  const parsedCode = useMemo(() => {
    const parts = form.case_number_raw.split('/');
    return parts[1]?.trim() || '';
  }, [form.case_number_raw]);

  const codeCategory = useMemo(() => {
    return parsedCode.length === 4 ? getCategoryFromCode(parsedCode) : null;
  }, [parsedCode]);

  /** Flat court list — single searchable dropdown */
  const flatCourtList = useMemo(() => {
    let list = buildFlatCourtList(parsedCode.length === 4 ? parsedCode : undefined);
    if (courtSearchTerm) {
      const q = courtSearchTerm.toLowerCase();
      list = list.filter(c => c.label.toLowerCase().includes(q) || c.portalLabel.toLowerCase().includes(q) || (c.parentLabel || '').toLowerCase().includes(q));
    }
    return list;
  }, [parsedCode, courtSearchTerm]);

  /** Hierarchy validation — mismatch between code and selected court */
  const hierarchyError = useMemo(() => {
    if (selectedAppellateIdx >= 0 && parsedCode.length === 4) {
      return validateHierarchy(parsedCode, selectedAppellateIdx);
    }
    return null;
  }, [parsedCode, selectedAppellateIdx]);

  /* ─── Opponents ─── */
  const updateOpponent = (i: number, field: keyof Opponent, value: string) =>
    setOpponents(prev => prev.map((o, idx) => idx === i ? { ...o, [field]: value } : o));
  const addOpponent = () => setOpponents(prev => [...prev, { ...emptyOpponent }]);
  const removeOpponent = (i: number) => { if (opponents.length > 1) setOpponents(prev => prev.filter((_, idx) => idx !== i)); };

  /* ─── Presence ─── */
  const updatePresenceParty = (i: number, field: keyof PresenceParty, value: string) =>
    setPresenceParties(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  const addPresenceParty = () => setPresenceParties(prev => [...prev, { name: '', address: '', phone: '' }]);
  const removePresenceParty = (i: number) => setPresenceParties(prev => prev.filter((_, idx) => idx !== i));
  /* ─── Client filtering ─── */
  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter(c => c.full_name.toLowerCase().includes(q));
  }, [clients, clientSearch]);

  const selectedClientLabel = form.client_id ? clients.find(c => c.id === form.client_id)?.full_name : '';

  const handleAddQuickClient = async () => {
    if (!newClientName.trim()) { toast.error('اسم الموكل مطلوب'); return; }
    const { data, error } = await supabase.from('clients').insert({ full_name: newClientName.trim() }).select('*').single();
    if (error) { toast.error('خطأ في إضافة الموكل'); return; }
    setClients(prev => [...prev, data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    updateField('client_id', data.id);
    setNewClientName('');
    setAddClientDialogOpen(false);
    toast.success('تم إضافة الموكل');
  };

  /* ─── Save ─── */
  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('عنوان الملف مطلوب'); return; }
    if (!form.client_id) { toast.error('يجب اختيار الموكل'); return; }
    if (!form.court.trim()) { toast.error('المحكمة مطلوبة'); return; }
    if (!form.case_type) { toast.error('نوع الملف مطلوب'); return; }
    if (hierarchyError) { toast.error(hierarchyError); return; }

    const ALL_INTERESTED = 'كل من له المصلحة';
    const hasNiyabaPresence = presenceParties.some(p => isNiyaba(p.name));
    const validOpponents = againstAllInterested ? [] : opponents.filter(o => o.name.trim());

    if (!againstAllInterested && !hasNiyabaPresence && validOpponents.length === 0) {
      toast.error('يجب إضافة خصم واحد على الأقل أو تفعيل "كل من له المصلحة"');
      return;
    }

    const names = validOpponents.map(o => o.name.trim());
    if (new Set(names).size !== names.length) { toast.error('لقد سبق إدخال هذا المدعى عليه'); return; }

    for (const opp of validOpponents) {
      if (!isNiyaba(opp.name) && !opp.address.trim()) {
        toast.error(`عنوان الخصم "${opp.name}" مطلوب`);
        return;
      }
    }

    for (const p of presenceParties.filter(p => p.name.trim())) {
      if (!isNiyaba(p.name) && !p.address.trim()) {
        toast.error(`عنوان الطرف بحضور "${p.name}" مطلوب`);
        return;
      }
    }

    setSaving(true);
    try {
      let opposingSummary: string | null = null;
      let oppAddress: string | null = null;
      let oppPhone: string | null = null;
      if (againstAllInterested) {
        opposingSummary = ALL_INTERESTED;
      } else if (validOpponents.length > 0) {
        opposingSummary = validOpponents.length > 1 ? `${validOpponents[0].name.trim()} ومن معه` : validOpponents[0].name.trim();
        oppAddress = validOpponents[0].address.trim() || null;
        oppPhone = validOpponents[0].phone.trim() || null;
      } else if (hasNiyabaPresence) {
        opposingSummary = NIYABA;
      }

      const cnParts = form.case_number_raw.split('/');
      const hasFullNumber = cnParts.length === 3 && cnParts[0].trim() && cnParts[1].trim().length === 4 && cnParts[2].trim().length === 4;
      const caseNum = hasFullNumber ? form.case_number_raw.trim() : null;
      const payload = {
        title: form.title.trim(),
        case_type: form.case_type,
        description: form.description.trim() || null,
        client_id: form.client_id,
        opposing_party: opposingSummary,
        opposing_party_address: oppAddress,
        opposing_party_phone: oppPhone,
        court: form.court.trim(),
        court_level: courtLevel || 'ابتدائية',
        case_number: caseNum,
      };

      let caseId: string;
      if (editingCase) {
        const { error } = await supabase.from('cases').update(payload).eq('id', editingCase.id);
        if (error) throw error;
        caseId = editingCase.id;
        await supabase.from('case_opponents').delete().eq('case_id', caseId);
      } else {
        const { data, error } = await supabase.from('cases').insert(payload).select('id').single();
        if (error) throw error;
        caseId = data.id;
      }

      const validPresence = presenceParties.filter(p => p.name.trim());
      const opponentsPayload = againstAllInterested
        ? [{ case_id: caseId, name: ALL_INTERESTED, address: null, phone: null, sort_order: 0, party_type: 'opponent' }]
        : validOpponents.map((o, i) => ({ case_id: caseId, name: o.name.trim(), address: o.address.trim() || null, phone: o.phone.trim() || null, sort_order: i, party_type: 'opponent' }));
      const presencePayload = validPresence.map((p, i) => ({ case_id: caseId, name: p.name.trim(), address: p.address.trim() || null, phone: p.phone.trim() || null, sort_order: i, party_type: 'presence' }));
      const { error: oppError } = await supabase.from('case_opponents').insert([...opponentsPayload, ...presencePayload]);
      if (oppError) throw oppError;

      toast.success(editingCase ? 'تم تحديث الملف' : 'تم إنشاء الملف بنجاح');
      onOpenChange(false);
      onCreated(caseId);

      if (!editingCase && caseNum) {
        toast.info('جاري جلب بيانات الملف من بوابة محاكم تلقائياً...', { duration: 5000 });
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  /** Handle selecting a court from the flat list */
  const handleSelectCourt = (entry: FlatCourtEntry) => {
    updateField('court', entry.label);
    setCourtLevel(entry.level);
    setSelectedAppellateIdx(entry.appellateIdx);
    setCourtPopoverOpen(false);
    setCourtSearchTerm('');
  };

  const selectedAppellate = selectedAppellateIdx >= 0 ? COURT_HIERARCHY[selectedAppellateIdx] : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingCase ? 'تعديل الملف' : 'إنشاء ملف جديد'}</DialogTitle>
            <DialogDescription>{editingCase ? 'قم بتعديل بيانات الملف' : 'أدخل بيانات الملف الجديد'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Client */}
            <div>
              <Label>الموكل *</Label>
              <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedClientLabel || 'ابحث عن الموكل أو أضف جديد...'}
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="ابحث باسم الموكل..." value={clientSearch} onValueChange={setClientSearch} />
                    <CommandList>
                      <CommandEmpty className="p-2">
                        <Button variant="ghost" className="w-full justify-start gap-2 text-primary" onClick={() => { setNewClientName(clientSearch); setAddClientDialogOpen(true); setClientPopoverOpen(false); }}>
                          <UserPlus className="h-4 w-4" /> إضافة "{clientSearch}" كموكل جديد
                        </Button>
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredClients.map(c => (
                          <CommandItem key={c.id} value={c.id} onSelect={() => { updateField('client_id', c.id); setClientPopoverOpen(false); setClientSearch(''); }}>
                            <Check className={cn("ml-2 h-4 w-4", form.client_id === c.id ? "opacity-100" : "opacity-0")} />
                            {c.full_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      {clientSearch && filteredClients.length > 0 && (
                        <CommandGroup>
                          <CommandItem onSelect={() => { setNewClientName(clientSearch); setAddClientDialogOpen(true); setClientPopoverOpen(false); }}>
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

            {/* Title */}
            <div>
              <Label>عنوان الملف *</Label>
              <Input value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="مثال: نزاع عقاري - الدار البيضاء" />
            </div>

            {/* Case Number */}
            <div className="space-y-2">
              <Label>رقم الملف</Label>
              <CaseNumberInput
                value={form.case_number_raw}
                onChange={v => {
                  updateField('case_number_raw', v);
                  // Reset appellate selection when code changes
                  setSelectedAppellateIdx(-1);
                  updateField('court', courtLevel === 'نقض' ? 'محكمة النقض' : '');
                }}
                placeholder="رقم/رمز/سنة — مثال: 1/1401/2025"
              />
              <p className="text-[10px] text-muted-foreground">
                اكتب الرقم ثم / ثم الرمز (4 أرقام) ثم السنة — السلاش يُضاف تلقائياً بعد الرمز
              </p>
              {/* Show detected category */}
              {codeCategory && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {categoryLabels[codeCategory]} — سيتم تصفية المحاكم تلقائياً
                </Badge>
              )}
            </div>

            {/* Case Type */}
            <div>
              <Label>نوع الملف *</Label>
              <Select value={form.case_type} onValueChange={v => updateField('case_type', v)}>
                <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                <SelectContent>
                  {caseTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Opponents */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">المدعى عليهم (الخصوم) {!againstAllInterested && '*'}</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={againstAllInterested} onChange={e => setAgainstAllInterested(e.target.checked)} className="rounded border-border" />
                  <span className="text-xs text-muted-foreground">كل من له المصلحة</span>
                </label>
              </div>

              {againstAllInterested ? (
                <div className="border rounded-lg p-3 bg-muted/30 text-center">
                  <p className="text-sm text-muted-foreground">ضد: <strong className="text-foreground">كل من له المصلحة</strong></p>
                </div>
              ) : (
                <>
                  {opponents.map((opp, index) => {
                    const niyaba = isNiyaba(opp.name);
                    return (
                      <div key={index} className="relative border rounded-lg p-3 space-y-2 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-medium">خصم {index + 1}</span>
                          {opponents.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeOpponent(index)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs">الخصم (ضد) *</Label>
                          <Input
                            value={opp.name}
                            onChange={e => updateOpponent(index, 'name', e.target.value)}
                            onBlur={() => {
                              const name = opp.name.trim();
                              if (name && opponents.some((o, i) => i !== index && o.name.trim() === name)) {
                                toast.error('لقد سبق إدخال هذا المدعى عليه');
                              }
                            }}
                            placeholder="اسم الطرف المقابل"
                          />
                        </div>
                        {!niyaba && (
                          <>
                            <div>
                              <Label className="text-xs">عنوان الخصم *</Label>
                              <Input value={opp.address} onChange={e => updateOpponent(index, 'address', e.target.value)} placeholder="عنوان الطرف المقابل" />
                            </div>
                            <div>
                              <Label className="text-xs">هاتف الخصم</Label>
                              <Input value={opp.phone} onChange={e => updateOpponent(index, 'phone', e.target.value)} placeholder="اختياري" />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  <Button type="button" variant="outline" className="w-full border-dashed text-muted-foreground" onClick={addOpponent}>
                    <Plus className="h-4 w-4 ml-1" /> أضف مدعى عليه آخر
                  </Button>
                </>
              )}
            </div>

            {/* Presence Parties */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">بحضور (أطراف مدخلة في الدعوى)</Label>
              {presenceParties.map((party, index) => {
                const niyaba = isNiyaba(party.name);
                return (
                  <div key={index} className="relative border rounded-lg p-3 space-y-2 bg-accent/20 border-accent/40">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">طرف {index + 1}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removePresenceParty(index)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">الاسم *</Label>
                      <Input value={party.name} onChange={e => updatePresenceParty(index, 'name', e.target.value)} placeholder="مثال: النيابة العامة، قاضي التوثيق..." />
                    </div>
                    {!niyaba && (
                      <>
                        <div>
                          <Label className="text-xs">العنوان *</Label>
                          <Input value={party.address} onChange={e => updatePresenceParty(index, 'address', e.target.value)} placeholder="عنوان الطرف" />
                        </div>
                        <div>
                          <Label className="text-xs">الهاتف</Label>
                          <Input value={party.phone} onChange={e => updatePresenceParty(index, 'phone', e.target.value)} placeholder="اختياري" />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              <Button type="button" variant="outline" className="w-full border-dashed text-muted-foreground" onClick={addPresenceParty}>
                <UserRoundPlus className="h-4 w-4 ml-1" /> أضف طرف بحضور
              </Button>
            </div>

            {/* ═══ Court Selection — Hierarchical Parent-Child ═══ */}
            <div className="space-y-3">
              <Label>المحكمة *</Label>
              
              {/* Court Level Buttons */}
              <div className="flex gap-2">
                {['ابتدائية', 'استئناف', 'نقض'].map(level => (
                  <Button
                    key={level}
                    type="button"
                    variant={courtLevel === level ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setCourtLevel(level);
                      setCourtSubType('');
                      setCourtSearchTerm('');
                      setSelectedAppellateIdx(-1);
                      setAppellateSearchTerm('');
                      updateField('court', level === 'نقض' ? 'محكمة النقض' : '');
                    }}
                    className="flex-1"
                  >
                    {level}
                  </Button>
                ))}
              </div>

              {/* Hierarchy mismatch warning */}
              {hierarchyError && (
                <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/30">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{hierarchyError}</p>
                </div>
              )}

              {/* Sub-type badges for ابتدائية */}
              {courtLevel === 'ابتدائية' && (
                <div className="flex flex-wrap gap-1">
                  {[
                    { value: 'ابتدائية', label: 'المحاكم الابتدائية' },
                    { value: 'مركز قضائي', label: 'المراكز القضائية' },
                    { value: 'ابتدائية مصنفة', label: 'المحاكم المصنفة' },
                  ].map(sub => (
                    <Badge
                      key={sub.value}
                      variant={courtSubType === sub.value ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => { setCourtSubType(sub.value); updateField('court', ''); setCourtSearchTerm(''); }}
                    >
                      {sub.label}
                    </Badge>
                  ))}
                </div>
              )}

              {/* نقض — auto-selected */}
              {courtLevel === 'نقض' && (
                <div className="border rounded-lg p-3 bg-muted/30 text-center">
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">محكمة النقض</strong> - الرباط</p>
                </div>
              )}

              {/* ═══ Step 1: Select Appellate Court (Parent) ═══ */}
              {courtLevel === 'استئناف' && (
                <Popover open={appellatePopoverOpen} onOpenChange={setAppellatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {selectedAppellate?.label || form.court || 'اختر محكمة الاستئناف...'}
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="ابحث عن محكمة الاستئناف..." value={appellateSearchTerm} onValueChange={setAppellateSearchTerm} />
                      <CommandList>
                        <CommandEmpty>
                          <p className="text-sm text-muted-foreground py-4 text-center">لا توجد نتائج</p>
                        </CommandEmpty>
                        <CommandGroup heading={codeCategory ? `${categoryLabels[codeCategory]} فقط` : 'جميع محاكم الاستئناف'}>
                          {filteredAppellateCourts.map(ac => {
                            const globalIdx = COURT_HIERARCHY.indexOf(ac);
                            return (
                              <CommandItem key={globalIdx} value={String(globalIdx)} onSelect={() => handleSelectAppellate(globalIdx)}>
                                <Check className={cn("ml-2 h-4 w-4", selectedAppellateIdx === globalIdx ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col">
                                  <span className="text-sm">{ac.label}</span>
                                  <span className="text-[10px] text-muted-foreground">{ac.primaryCourts.length} محكمة ابتدائية تابعة</span>
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}

              {/* ═══ Step 2 (ابتدائية): Select Appellate Parent, then pick child ═══ */}
              {courtLevel === 'ابتدائية' && (courtSubType || true) && (
                <>
                  {/* Step A: Pick parent appellate */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">الدائرة القضائية (محكمة الاستئناف الأم)</Label>
                    <Popover open={appellatePopoverOpen} onOpenChange={setAppellatePopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" size="sm" className="w-full justify-between font-normal text-xs">
                          {selectedAppellate?.label || 'اختر الدائرة القضائية...'}
                          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput placeholder="ابحث..." value={appellateSearchTerm} onValueChange={setAppellateSearchTerm} />
                          <CommandList>
                            <CommandEmpty><p className="text-sm text-muted-foreground py-4 text-center">لا توجد نتائج</p></CommandEmpty>
                            <CommandGroup heading={codeCategory ? `${categoryLabels[codeCategory]}` : 'جميع الدوائر'}>
                              {filteredAppellateCourts.map(ac => {
                                const globalIdx = COURT_HIERARCHY.indexOf(ac);
                                return (
                                  <CommandItem key={globalIdx} value={String(globalIdx)} onSelect={() => handleSelectAppellate(globalIdx)}>
                                    <Check className={cn("ml-2 h-4 w-4", selectedAppellateIdx === globalIdx ? "opacity-100" : "opacity-0")} />
                                    <div className="flex flex-col">
                                      <span className="text-xs">{ac.label}</span>
                                      <span className="text-[10px] text-muted-foreground">{ac.primaryCourts.length} محكمة تابعة</span>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Step B: Pick child primary court */}
                  {selectedAppellateIdx >= 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground">المحكمة الابتدائية التابعة</Label>
                      <Popover open={courtPopoverOpen} onOpenChange={setCourtPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                            {form.court || 'اختر المحكمة الابتدائية...'}
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput placeholder="ابحث..." value={courtSearchTerm} onValueChange={setCourtSearchTerm} />
                            <CommandList>
                              <CommandEmpty><p className="text-sm text-muted-foreground py-4 text-center">لا توجد نتائج</p></CommandEmpty>
                              <CommandGroup heading={selectedAppellate?.label}>
                                {filteredPrimaryCourts.map((pc, i) => (
                                  <CommandItem key={i} value={pc.label} onSelect={() => handleSelectPrimary(pc.label)}>
                                    <Check className={cn("ml-2 h-4 w-4", form.court === pc.label ? "opacity-100" : "opacity-0")} />
                                    <span className="text-sm">{pc.label}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {/* Fallback: if no appellate selected, show DB courts */}
                  {selectedAppellateIdx < 0 && courtSubType && (
                    <Popover open={courtPopoverOpen} onOpenChange={setCourtPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                          {form.court || 'ابحث عن المحكمة...'}
                          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput placeholder="ابحث باسم المحكمة أو المدينة..." value={courtSearchTerm} onValueChange={setCourtSearchTerm} />
                          <CommandList>
                            <CommandEmpty>
                              <div className="py-2 text-center space-y-2">
                                <p className="text-sm text-muted-foreground">لا توجد نتائج</p>
                                {courtSearchTerm.trim() && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={async () => {
                                      const courtType = courtSubType || 'ابتدائية';
                                      const { data, error } = await supabase.from('courts').insert({
                                        name: courtSearchTerm.trim(),
                                        city: '',
                                        court_type: courtType,
                                        addressee: 'السيد رئيس المحكمة الابتدائية',
                                      }).select().single();
                                      if (!error && data) {
                                        setCourtsDb(prev => [...prev, data]);
                                        updateField('court', data.name);
                                        setCourtPopoverOpen(false);
                                        setCourtSearchTerm('');
                                        toast.success('تمت إضافة المحكمة بنجاح');
                                      } else {
                                        toast.error('خطأ في إضافة المحكمة');
                                      }
                                    }}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    إضافة "{courtSearchTerm.trim()}"
                                  </Button>
                                )}
                              </div>
                            </CommandEmpty>
                            <CommandGroup>
                              {filteredCourts.map(c => (
                                <CommandItem key={c.id} value={c.id} onSelect={() => { updateField('court', c.name); const parentIdx = findAppellateByPrimary(c.name); if (parentIdx >= 0) setSelectedAppellateIdx(parentIdx); setCourtPopoverOpen(false); setCourtSearchTerm(''); }}>
                                  <Check className={cn("ml-2 h-4 w-4", form.court === c.name ? "opacity-100" : "opacity-0")} />
                                  <div className="flex flex-col">
                                    <span className="text-sm">{c.name}</span>
                                    <span className="text-xs text-muted-foreground">{c.city}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label>ملاحظات</Label>
              <Textarea value={form.description} onChange={e => updateField('description', e.target.value)} placeholder="وصف مختصر للملف..." rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving || !!hierarchyError}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Client Dialog */}
      <Dialog open={addClientDialogOpen} onOpenChange={setAddClientDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة موكل جديد</DialogTitle>
            <DialogDescription>أدخل اسم الموكل لإضافته بسرعة</DialogDescription>
          </DialogHeader>
          <div>
            <Label>الاسم الكامل *</Label>
            <Input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="اسم الموكل" autoFocus />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddClientDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleAddQuickClient}>إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreateCaseDialog;
