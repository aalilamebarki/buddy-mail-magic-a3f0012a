import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Trash2, Pencil, FolderOpen, User, ChevronsUpDown, Check, UserPlus, X, UserRoundPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Opponent {
  name: string;
  address: string;
  phone: string;
}

interface CaseForm {
  title: string;
  case_type: string;
  description: string;
  client_id: string;
  court: string;
}

const emptyForm: CaseForm = { title: '', case_type: '', description: '', client_id: '', court: '' };
const emptyOpponent: Opponent = { name: '', address: '', phone: '' };

const NIYABA = 'النيابة العامة';
const HIDDEN_ADDRESS_PARTIES = [NIYABA, 'قاضي التوثيق', 'قاضي شؤون القاصرين'];

interface PresenceParty {
  name: string;
  address: string;
  phone: string;
}

const caseTypes = ['مدني', 'جنائي', 'تجاري', 'إداري', 'عقاري', 'أسري', 'شغل', 'آخر'];

const Cases = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedClientId = searchParams.get('client_id');

  const [cases, setCases] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCase, setDeletingCase] = useState<any>(null);
  const [form, setForm] = useState<CaseForm>(emptyForm);
  const [opponents, setOpponents] = useState<Opponent[]>([{ ...emptyOpponent }]);
  const [presenceParties, setPresenceParties] = useState<PresenceParty[]>([]);
  const [againstAllInterested, setAgainstAllInterested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterClientId, setFilterClientId] = useState<string>(preselectedClientId || '');
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [courtLevel, setCourtLevel] = useState<string>('');
  const [courtSubType, setCourtSubType] = useState<string>('');
  const [courtsDb, setCourtsDb] = useState<any[]>([]);
  const [courtPopoverOpen, setCourtPopoverOpen] = useState(false);
  const [courtSearchTerm, setCourtSearchTerm] = useState('');

  const fetchData = async () => {
    const [casesRes, clientsRes, courtsRes] = await Promise.all([
      supabase.from('cases').select('*, clients(full_name)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, full_name').order('full_name'),
      supabase.from('courts').select('*').order('name'),
    ]);
    if (casesRes.data) setCases(casesRes.data);
    if (clientsRes.data) setClients(clientsRes.data);
    if (courtsRes.data) setCourtsDb(courtsRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (preselectedClientId) setFilterClientId(preselectedClientId);
  }, [preselectedClientId]);

  const getClientName = (c: any) => c.clients?.full_name || '—';

  const getOpposingLabel = (c: any) => {
    const name = c.opposing_party || '—';
    // Check if there are additional opponents (stored as comma-hint in opposing_party)
    if (name.includes(' ومن معه')) return name;
    return name;
  };

  const filtered = cases.filter(c => {
    const matchesSearch = !search || c.title?.includes(search) || c.case_number?.includes(search) || getClientName(c).includes(search);
    const matchesClient = !filterClientId || c.client_id === filterClientId;
    return matchesSearch && matchesClient;
  });

  const openNew = () => {
    setEditingCase(null);
    setForm({ ...emptyForm, client_id: filterClientId || '' });
    setOpponents([{ ...emptyOpponent }]);
    setPresenceParties([]);
    setAgainstAllInterested(false);
    setCourtLevel('');
    setCourtSubType('');
    setCourtSearchTerm('');
    setDialogOpen(true);
  };

  const determineCourtLevel = (courtName: string) => {
    const court = courtsDb.find(c => c.name === courtName);
    if (!court) return;
    if (['ابتدائية', 'مركز قضائي', 'ابتدائية مصنفة'].includes(court.court_type)) {
      setCourtLevel('ابتدائية');
      setCourtSubType(court.court_type);
    } else if (['استئناف', 'استئناف تجارية', 'استئناف إدارية'].includes(court.court_type)) {
      setCourtLevel('استئناف');
      setCourtSubType('');
    } else if (court.court_type === 'نقض') {
      setCourtLevel('نقض');
      setCourtSubType('');
    } else {
      setCourtLevel('ابتدائية');
      setCourtSubType('');
    }
  };

  const filteredCourts = useMemo(() => {
    const _fuzzy = (name: string, query: string): boolean => {
      const n = name.toLowerCase();
      const q = query.toLowerCase();
      if (n.includes(q)) return true;
      const words = q.split(/\s+/).filter(Boolean);
      if (words.length > 1) return words.every(w => _fuzzy(name, w));
      let j = 0;
      for (let i = 0; i < n.length && j < q.length; i++) { if (n[i] === q[j]) j++; }
      return j === q.length;
    };
    let filtered = courtsDb;
    if (courtLevel === 'ابتدائية') {
      if (courtSubType) {
        filtered = courtsDb.filter(c => c.court_type === courtSubType);
      } else {
        filtered = courtsDb.filter(c => ['ابتدائية', 'مركز قضائي', 'ابتدائية مصنفة'].includes(c.court_type));
      }
    } else if (courtLevel === 'استئناف') {
      filtered = courtsDb.filter(c => ['استئناف', 'استئناف تجارية', 'استئناف إدارية'].includes(c.court_type));
    } else if (courtLevel === 'نقض') {
      filtered = courtsDb.filter(c => c.court_type === 'نقض');
    }
    if (courtSearchTerm) {
      filtered = filtered.filter(c => _fuzzy(c.name, courtSearchTerm) || _fuzzy(c.city, courtSearchTerm));
    }
    return filtered;
  }, [courtsDb, courtLevel, courtSubType, courtSearchTerm]);

  const openEdit = async (c: any) => {
    setEditingCase(c);
    setForm({
      title: c.title || '',
      case_type: c.case_type || '',
      description: c.description || '',
      client_id: c.client_id || '',
      court: c.court || '',
    });
    // Fetch opponents and presence parties
    const { data } = await supabase.from('case_opponents').select('*').eq('case_id', c.id).order('sort_order');
    if (data && data.length > 0) {
      const opps = data.filter((o: any) => o.party_type !== 'presence');
      const pres = data.filter((o: any) => o.party_type === 'presence');
      // Check if "كل من له المصلحة" mode
      const isAllInterested = opps.length === 1 && opps[0].name === 'كل من له المصلحة';
      setAgainstAllInterested(isAllInterested);
      setOpponents(isAllInterested ? [{ ...emptyOpponent }] : opps.length > 0 ? opps.map((o: any) => ({ name: o.name, address: o.address || '', phone: o.phone || '' })) : [{ ...emptyOpponent }]);
      setPresenceParties(pres.map((o: any) => ({ name: o.name, address: o.address || '', phone: o.phone || '' })));
    } else {
      setAgainstAllInterested(false);
      setOpponents([{
        name: c.opposing_party || '',
        address: c.opposing_party_address || '',
        phone: c.opposing_party_phone || '',
      }]);
      setPresenceParties([]);
    }
    // Determine court level from saved court name
    if (c.court) {
      const courtRecord = courtsDb.find(ct => ct.name === c.court);
      if (courtRecord) {
        if (['ابتدائية', 'مركز قضائي', 'ابتدائية مصنفة'].includes(courtRecord.court_type)) {
          setCourtLevel('ابتدائية');
          setCourtSubType(courtRecord.court_type);
        } else if (['استئناف', 'استئناف تجارية', 'استئناف إدارية'].includes(courtRecord.court_type)) {
          setCourtLevel('استئناف');
          setCourtSubType('');
        } else if (courtRecord.court_type === 'نقض') {
          setCourtLevel('نقض');
          setCourtSubType('');
        }
      } else {
        setCourtLevel('');
        setCourtSubType('');
      }
    } else {
      setCourtLevel('');
      setCourtSubType('');
    }
    setCourtSearchTerm('');
    setDialogOpen(true);
  };

  const openDelete = (c: any) => {
    setDeletingCase(c);
    setDeleteDialogOpen(true);
  };

  const isNiyaba = (name: string) => HIDDEN_ADDRESS_PARTIES.includes(name.trim());

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('عنوان الملف مطلوب'); return; }
    if (!form.client_id) { toast.error('يجب اختيار الموكل'); return; }
    if (!form.court.trim()) { toast.error('المحكمة مطلوبة'); return; }
    if (!form.case_type) { toast.error('نوع الملف مطلوب'); return; }

    const ALL_INTERESTED = 'كل من له المصلحة';
    // If "كل من له المصلحة" is checked, opponents are replaced by that single entry
    const hasNiyabaPresence = presenceParties.some(p => isNiyaba(p.name));
    const validOpponents = againstAllInterested ? [] : opponents.filter(o => o.name.trim());
    if (!againstAllInterested && !hasNiyabaPresence && validOpponents.length === 0) {
      toast.error('يجب إضافة خصم واحد على الأقل أو تفعيل "كل من له المصلحة"');
      return;
    }

    // Check duplicates
    const names = validOpponents.map(o => o.name.trim());
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) { toast.error('لقد سبق إدخال هذا المدعى عليه'); return; }

    for (const opp of validOpponents) {
      if (!isNiyaba(opp.name) && !opp.address.trim()) {
        toast.error(`عنوان الخصم "${opp.name}" مطلوب`);
        return;
      }
    }

    const validPresenceCheck = presenceParties.filter(p => p.name.trim());
    for (const p of validPresenceCheck) {
      if (!isNiyaba(p.name) && !p.address.trim()) {
        toast.error(`عنوان الطرف بحضور "${p.name}" مطلوب`);
        return;
      }
    }

    setSaving(true);
    try {
      // Build opposing_party summary for the cases table
      let opposingSummary: string | null = null;
      let oppAddress: string | null = null;
      let oppPhone: string | null = null;
      if (againstAllInterested) {
        opposingSummary = ALL_INTERESTED;
      } else if (validOpponents.length > 0) {
        const firstOpponent = validOpponents[0].name.trim();
        opposingSummary = validOpponents.length > 1 ? `${firstOpponent} ومن معه` : firstOpponent;
        oppAddress = validOpponents[0].address.trim() || null;
        oppPhone = validOpponents[0].phone.trim() || null;
      } else if (hasNiyabaPresence) {
        opposingSummary = NIYABA;
      }

      const payload = {
        title: form.title.trim(),
        case_type: form.case_type,
        description: form.description.trim() || null,
        client_id: form.client_id,
        opposing_party: opposingSummary,
        opposing_party_address: oppAddress,
        opposing_party_phone: oppPhone,
        court: form.court.trim(),
      };

      let caseId: string;
      if (editingCase) {
        const { error } = await supabase.from('cases').update(payload).eq('id', editingCase.id);
        if (error) throw error;
        caseId = editingCase.id;
        // Delete old opponents
        await supabase.from('case_opponents').delete().eq('case_id', caseId);
      } else {
        const { data, error } = await supabase.from('cases').insert(payload).select('id').single();
        if (error) throw error;
        caseId = data.id;
      }

      // Insert opponents
      const validPresence = presenceParties.filter(p => p.name.trim());
      const opponentsPayload = againstAllInterested
        ? [{ case_id: caseId, name: ALL_INTERESTED, address: null, phone: null, sort_order: 0, party_type: 'opponent' }]
        : validOpponents.map((o, i) => ({
            case_id: caseId,
            name: o.name.trim(),
            address: o.address.trim() || null,
            phone: o.phone.trim() || null,
            sort_order: i,
            party_type: 'opponent',
          }));
      const presencePayload = validPresence.map((p, i) => ({
        case_id: caseId,
        name: p.name.trim(),
        address: p.address.trim() || null,
        phone: p.phone.trim() || null,
        sort_order: i,
        party_type: 'presence',
      }));
      const allParties = [...opponentsPayload, ...presencePayload];
      const { error: oppError } = await supabase.from('case_opponents').insert(allParties);
      if (oppError) throw oppError;

      toast.success(editingCase ? 'تم تحديث الملف' : 'تم إنشاء الملف بنجاح');
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCase) return;
    const { error } = await supabase.from('cases').delete().eq('id', deletingCase.id);
    if (error) {
      toast.error('خطأ في حذف الملف');
    } else {
      setCases(prev => prev.filter(c => c.id !== deletingCase.id));
      toast.success('تم حذف الملف وجميع مستنداته ✅');
    }
    setDeleteDialogOpen(false);
    setDeletingCase(null);
  };

  const updateField = (field: keyof CaseForm, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const updateOpponent = (index: number, field: keyof Opponent, value: string) => {
    setOpponents(prev => prev.map((o, i) => i === index ? { ...o, [field]: value } : o));
  };

  const addOpponent = () => {
    setOpponents(prev => [...prev, { ...emptyOpponent }]);
  };

  const removeOpponent = (index: number) => {
    if (opponents.length <= 1) return;
    setOpponents(prev => prev.filter((_, i) => i !== index));
  };

  const updatePresenceParty = (index: number, field: keyof PresenceParty, value: string) => {
    setPresenceParties(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const addPresenceParty = () => {
    setPresenceParties(prev => [...prev, { name: '', address: '', phone: '' }]);
  };

  const removePresenceParty = (index: number) => {
    setPresenceParties(prev => prev.filter((_, i) => i !== index));
  };
  const fuzzyMatch = (name: string, query: string): boolean => {
    const n = name.toLowerCase();
    const q = query.toLowerCase();
    // First try simple includes
    if (n.includes(q)) return true;
    // Try matching each word of query independently
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      return words.every(w => fuzzyMatch(name, w));
    }
    // Subsequence match with max 1 skip tolerance per 3 chars
    let ni = 0;
    let matched = 0;
    for (let qi = 0; qi < q.length && ni < n.length; ni++) {
      if (n[qi] === q[qi] || n[ni] === q[qi]) {
        if (n[ni] === q[qi]) { matched++; qi++; }
      }
    }
    if (matched >= q.length) return true;
    // Levenshtein-based: allow ~30% errors
    const maxDist = Math.max(1, Math.floor(q.length * 0.4));
    return levenshteinDistance(n, q) <= maxDist || 
      // Also check if any word in the name is close to query
      n.split(/\s+/).some(w => levenshteinDistance(w, q) <= maxDist);
  };

  const levenshteinDistance = (a: string, b: string): number => {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
      const row = new Array(n + 1).fill(0);
      row[0] = i;
      return row;
    });
    for (let j = 1; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  };

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    return clients.filter(c => fuzzyMatch(c.full_name, clientSearch.trim()));
  }, [clients, clientSearch]);

  const selectedClientLabel = form.client_id ? clients.find(c => c.id === form.client_id)?.full_name : '';

  const handleAddQuickClient = async () => {
    if (!newClientName.trim()) { toast.error('اسم الموكل مطلوب'); return; }
    const { data, error } = await supabase.from('clients').insert({ full_name: newClientName.trim() }).select('id, full_name').single();
    if (error) { toast.error('خطأ في إضافة الموكل'); return; }
    setClients(prev => [...prev, data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    updateField('client_id', data.id);
    setNewClientName('');
    setAddClientDialogOpen(false);
    toast.success('تم إضافة الموكل');
  };

  const selectedClientName = filterClientId ? clients.find(c => c.id === filterClientId)?.full_name : null;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">الملفات</h1>
          <p className="text-sm text-muted-foreground">
            {selectedClientName ? `ملفات الموكل: ${selectedClientName}` : 'إدارة جميع الملفات'}
          </p>
        </div>
        <div className="flex gap-2">
          {filterClientId && (
            <Button variant="outline" onClick={() => setFilterClientId('')} className="gap-2">
              <User className="h-4 w-4" /> عرض الكل
            </Button>
          )}
          <Button onClick={openNew} className="gap-2 w-full sm:w-auto"><Plus className="h-4 w-4" /> ملف جديد</Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث بالعنوان أو رقم الملف أو اسم الموكل..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
        </div>
        <Select value={filterClientId || 'all'} onValueChange={(v) => setFilterClientId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="كل الموكلين" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الموكلين</SelectItem>
            {clients.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: card view */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground">لا توجد ملفات</p>
            <Button variant="outline" onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> إنشاء ملف</Button>
          </div>
        ) : (
          filtered.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/dashboard/cases/${c.id}`)}>
              <CardContent className="pt-4 pb-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground text-sm truncate">لفائدة: {getClientName(c)}</p>
                    <p className="text-xs text-muted-foreground">ضد: {getOpposingLabel(c)}</p>
                    {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.case_type && <Badge variant="secondary" className="text-xs">{c.case_type}</Badge>}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); openDelete(c); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{c.court || '—'}</span>
                  <span>{new Date(c.created_at).toLocaleDateString('ar-MA')}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop: table view */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العنوان</TableHead>
                  <TableHead>لفائدة</TableHead>
                  <TableHead>ضد</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المحكمة</TableHead>
                  <TableHead>رقم الملف</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead className="w-24">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا توجد ملفات</TableCell></TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/cases/${c.id}`)}>
                      <TableCell className="font-medium">{c.title}</TableCell>
                      <TableCell>{getClientName(c)}</TableCell>
                      <TableCell>{getOpposingLabel(c)}</TableCell>
                      <TableCell>{c.case_type || '—'}</TableCell>
                      <TableCell>{c.court || '—'}</TableCell>
                      <TableCell className="font-mono" dir="ltr">{c.case_number || '—'}</TableCell>
                      <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                      <TableCell>{new Date(c.created_at).toLocaleDateString('ar-MA')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); openDelete(c); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCase ? 'تعديل الملف' : 'إنشاء ملف جديد'}</DialogTitle>
            <DialogDescription>{editingCase ? 'قم بتعديل بيانات الملف' : 'أدخل بيانات الملف الجديد'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الموكل *</Label>
              <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedClientLabel || 'ابحث عن الموكل أو أضف جديد...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                            <Check className={cn("mr-2 h-4 w-4", form.client_id === c.id ? "opacity-100" : "opacity-0")} />
                            {c.full_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      {clientSearch && filteredClients.length > 0 && (
                        <CommandGroup>
                          <CommandItem onSelect={() => { setNewClientName(clientSearch); setAddClientDialogOpen(true); setClientPopoverOpen(false); }}>
                            <UserPlus className="mr-2 h-4 w-4 text-primary" />
                            <span className="text-primary">إضافة "{clientSearch}" كموكل جديد</span>
                          </CommandItem>
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>عنوان الملف *</Label>
              <Input value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="مثال: نزاع عقاري - الدار البيضاء" />
            </div>
            <div>
              <Label>نوع الملف *</Label>
              <Select value={form.case_type} onValueChange={(v) => updateField('case_type', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  {caseTypes.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Against All Interested Toggle + Opponents Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">المدعى عليهم (الخصوم) {!againstAllInterested && '*'}</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={againstAllInterested}
                    onChange={e => setAgainstAllInterested(e.target.checked)}
                    className="rounded border-border"
                  />
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
                              <Input
                                value={opp.address}
                                onChange={e => updateOpponent(index, 'address', e.target.value)}
                                placeholder="عنوان الطرف المقابل"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">هاتف الخصم</Label>
                              <Input
                                value={opp.phone}
                                onChange={e => updateOpponent(index, 'phone', e.target.value)}
                                placeholder="اختياري"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-dashed text-muted-foreground"
                    onClick={addOpponent}
                  >
                    <Plus className="h-4 w-4 ml-1" /> أضف مدعى عليه آخر
                  </Button>
                </>
              )}
            </div>

            {/* Presence Parties Section (بحضور) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">بحضور (أطراف مدخلة في الدعوى)</Label>
              </div>
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
                      <Input
                        value={party.name}
                        onChange={e => updatePresenceParty(index, 'name', e.target.value)}
                        placeholder="مثال: النيابة العامة، قاضي التوثيق، قاضي شؤون القاصرين..."
                      />
                    </div>
                    {!niyaba && (
                      <>
                        <div>
                          <Label className="text-xs">العنوان *</Label>
                          <Input
                            value={party.address}
                            onChange={e => updatePresenceParty(index, 'address', e.target.value)}
                            placeholder="عنوان الطرف"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">الهاتف</Label>
                          <Input
                            value={party.phone}
                            onChange={e => updatePresenceParty(index, 'phone', e.target.value)}
                            placeholder="اختياري"
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed text-muted-foreground"
                onClick={addPresenceParty}
              >
                <UserRoundPlus className="h-4 w-4 ml-1" /> أضف طرف بحضور
              </Button>
            </div>

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
                      if (level === 'نقض') {
                        updateField('court', 'محكمة النقض');
                      } else {
                        updateField('court', '');
                      }
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
                      onClick={() => {
                        setCourtSubType(sub.value);
                        updateField('court', '');
                        setCourtSearchTerm('');
                      }}
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
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                                  const newCourt = {
                                    name: courtSearchTerm.trim(),
                                    city: '',
                                    court_type: courtType,
                                    addressee: courtLevel === 'استئناف' ? 'السيد الرئيس الأول لمحكمة الاستئناف' : 'السيد رئيس المحكمة الابتدائية',
                                  };
                                  const { data, error } = await supabase.from('courts').insert(newCourt).select().single();
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
                              <Check className={cn("mr-2 h-4 w-4", form.court === c.name ? "opacity-100" : "opacity-0")} />
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
            <div>
              <Label>ملاحظات</Label>
              <Textarea value={form.description} onChange={e => updateField('description', e.target.value)} placeholder="وصف مختصر للملف..." rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الملف</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف هذا الملف وجميع المستندات المرتبطة به نهائياً. هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Add Client Dialog */}
      <Dialog open={addClientDialogOpen} onOpenChange={setAddClientDialogOpen}>
        <DialogContent className="max-w-sm">
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
    </div>
  );
};

export default Cases;
