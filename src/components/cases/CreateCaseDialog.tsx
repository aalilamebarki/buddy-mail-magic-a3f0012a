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
import { Plus, X, ChevronsUpDown, Check, UserPlus, UserRoundPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useClients } from '@/hooks/useClients';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  case_numero: string;
  case_code: string;
  case_annee: string;
}

/* ─── Constants ─── */
const emptyForm: CaseForm = { title: '', case_type: '', description: '', client_id: '', court: '', case_numero: '', case_code: '', case_annee: '' };
const emptyOpponent: Opponent = { name: '', address: '', phone: '' };
const NIYABA = 'النيابة العامة';
const HIDDEN_ADDRESS_PARTIES = [NIYABA, 'قاضي التوثيق', 'قاضي شؤون القاصرين'];
export const caseTypes = ['مدني', 'جنائي', 'تجاري', 'إداري', 'عقاري', 'أسري', 'شغل', 'آخر'];

const isNiyaba = (name: string) => HIDDEN_ADDRESS_PARTIES.includes(name.trim());

/* ─── Props ─── */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after successful creation with the new case id */
  onCreated: (caseId: string) => void;
  /** Pre-select a client (e.g. from billing) */
  preselectedClientId?: string;
  /** Edit mode – pass existing case data */
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

  // Court
  const [courtLevel, setCourtLevel] = useState('');
  const [courtSubType, setCourtSubType] = useState('');
  const [courtsDb, setCourtsDb] = useState<any[]>([]);
  const [courtPopoverOpen, setCourtPopoverOpen] = useState(false);
  const [courtSearchTerm, setCourtSearchTerm] = useState('');

  // Client
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  // Fetch courts once
  useEffect(() => {
    supabase.from('courts').select('*').order('name').then(({ data }) => {
      if (data) setCourtsDb(data);
    });
  }, []);

  // Reset form on open
  useEffect(() => {
    if (!open) return;
    if (editingCase) {
      const parsed = editingCase.case_number ? editingCase.case_number.split('/') : ['', '', ''];
      setForm({
        title: editingCase.title || '',
        case_type: editingCase.case_type || '',
        description: editingCase.description || '',
        client_id: editingCase.client_id || '',
        court: editingCase.court || '',
        case_numero: parsed[0] || '',
        case_code: parsed[1] || '',
        case_annee: parsed[2] || '',
      });
      // Load opponents
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
      // Determine court level
      if (editingCase.court) {
        // Will be set after courtsDb loads
      }
    } else {
      setForm({ ...emptyForm, client_id: preselectedClientId || '' });
      setOpponents([{ ...emptyOpponent }]);
      setPresenceParties([]);
      setAgainstAllInterested(false);
    }
    setCourtLevel('');
    setCourtSubType('');
    setCourtSearchTerm('');
  }, [open, editingCase, preselectedClientId]);

  // Set court level when courtsDb is ready + editing
  useEffect(() => {
    if (!editingCase?.court || courtsDb.length === 0) return;
    const court = courtsDb.find(c => c.name === editingCase.court);
    if (!court) return;
    if (['ابتدائية', 'مركز قضائي', 'ابتدائية مصنفة'].includes(court.court_type)) {
      setCourtLevel('ابتدائية');
      setCourtSubType(court.court_type);
    } else if (['استئناف', 'استئناف تجارية', 'استئناف إدارية'].includes(court.court_type)) {
      setCourtLevel('استئناف');
    } else if (court.court_type === 'نقض') {
      setCourtLevel('نقض');
    }
  }, [courtsDb, editingCase]);

  const updateField = (field: keyof CaseForm, value: string) => setForm(prev => ({ ...prev, [field]: value }));

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

  /* ─── Court filtering ─── */
  const filteredCourts = useMemo(() => {
    let filtered = courtsDb;
    if (courtLevel === 'ابتدائية') {
      filtered = courtSubType
        ? courtsDb.filter(c => c.court_type === courtSubType)
        : courtsDb.filter(c => ['ابتدائية', 'مركز قضائي', 'ابتدائية مصنفة'].includes(c.court_type));
    } else if (courtLevel === 'استئناف') {
      filtered = courtsDb.filter(c => ['استئناف', 'استئناف تجارية', 'استئناف إدارية'].includes(c.court_type));
    } else if (courtLevel === 'نقض') {
      filtered = courtsDb.filter(c => c.court_type === 'نقض');
    }
    if (courtSearchTerm) {
      const q = courtSearchTerm.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q));
    }
    return filtered;
  }, [courtsDb, courtLevel, courtSubType, courtSearchTerm]);

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

      const caseNum = (form.case_numero.trim() && form.case_code.trim() && form.case_annee.trim())
        ? `${form.case_numero.trim()}/${form.case_code.trim()}/${form.case_annee.trim()}`
        : null;
      const payload = {
        title: form.title.trim(),
        case_type: form.case_type,
        description: form.description.trim() || null,
        client_id: form.client_id,
        opposing_party: opposingSummary,
        opposing_party_address: oppAddress,
        opposing_party_phone: oppPhone,
        court: form.court.trim(),
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

      // Insert opponents & presence
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

      // Auto-sync is now handled by a database trigger (trg_auto_sync_mahakim)
      // No need to manually invoke the edge function
      if (!editingCase && caseNum) {
        toast.info('جاري جلب بيانات الملف من بوابة محاكم تلقائياً...', { duration: 5000 });
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

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

            {/* Case Number — 3 fields */}
            <div className="space-y-2">
              <Label>رقم الملف</Label>
              <div className="grid grid-cols-3 gap-2" dir="ltr">
                <div>
                  <Label className="text-[10px] text-muted-foreground">الرقم</Label>
                  <Input
                    value={form.case_numero}
                    onChange={e => updateField('case_numero', e.target.value.replace(/\D/g, ''))}
                    placeholder="1"
                    className="text-center font-mono"
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">الرمز (4 أرقام)</Label>
                  <Input
                    value={form.case_code}
                    onChange={e => updateField('case_code', e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="1401"
                    className={`text-center font-mono ${form.case_code.length > 0 && form.case_code.length !== 4 ? 'border-destructive' : ''}`}
                    dir="ltr"
                    maxLength={4}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">السنة (4 أرقام)</Label>
                  <Input
                    value={form.case_annee}
                    onChange={e => updateField('case_annee', e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="2025"
                    className={`text-center font-mono ${form.case_annee.length > 0 && form.case_annee.length !== 4 ? 'border-destructive' : ''}`}
                    dir="ltr"
                    maxLength={4}
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                إذا أدخلت رقم الملف كاملاً، سيتم جلب الإجراءات والجلسات تلقائياً من بوابة محاكم
              </p>
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

            {/* Court */}
            <div className="space-y-3">
              <Label>المحكمة *</Label>
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
                      updateField('court', level === 'نقض' ? 'محكمة النقض' : '');
                    }}
                    className="flex-1"
                  >
                    {level}
                  </Button>
                ))}
              </div>

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

              {courtLevel === 'نقض' ? (
                <div className="border rounded-lg p-3 bg-muted/30 text-center">
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">محكمة النقض</strong> - الرباط</p>
                </div>
              ) : courtLevel && (courtLevel === 'استئناف' || courtSubType) ? (
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
                                  const courtType = courtLevel === 'استئناف'
                                    ? (courtSearchTerm.includes('تجارية') ? 'استئناف تجارية' : courtSearchTerm.includes('إدارية') ? 'استئناف إدارية' : 'استئناف')
                                    : (courtSubType || 'ابتدائية');
                                  const { data, error } = await supabase.from('courts').insert({
                                    name: courtSearchTerm.trim(),
                                    city: '',
                                    court_type: courtType,
                                    addressee: courtLevel === 'استئناف' ? 'السيد الرئيس الأول لمحكمة الاستئناف' : 'السيد رئيس المحكمة الابتدائية',
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
                            <CommandItem key={c.id} value={c.id} onSelect={() => { updateField('court', c.name); setCourtPopoverOpen(false); setCourtSearchTerm(''); }}>
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
              ) : null}
            </div>

            {/* Notes */}
            <div>
              <Label>ملاحظات</Label>
              <Textarea value={form.description} onChange={e => updateField('description', e.target.value)} placeholder="وصف مختصر للملف..." rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
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
