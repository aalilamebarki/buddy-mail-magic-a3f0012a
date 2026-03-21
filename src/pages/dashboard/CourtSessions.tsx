import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarDays, Plus, Search, ChevronsUpDown, Check, FolderOpen, Pencil, Trash2, FileDown, CalendarRange, List } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSessions, type SessionRecord } from '@/hooks/useSessions';
import { useCases } from '@/hooks/useCases';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { exportCourtSessionsWord } from '@/lib/export-court-sessions-docx';
import CalendarView from '@/components/sessions/CalendarView';
import GoogleCalendarQuickAction from '@/components/sessions/GoogleCalendarQuickAction';

const CourtSessions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sessions, setSessions, loading: sessionsLoading, refetch: refetchSessions } = useSessions();
  const { cases, loading: casesLoading, refetch: refetchCases } = useCases({ status: 'active' });
  const loading = sessionsLoading || casesLoading;
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');

  const fetchData = () => { refetchSessions(); refetchCases(); };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [casePopoverOpen, setCasePopoverOpen] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [caseNumber, setCaseNumber] = useState('');
  const [exportMode, setExportMode] = useState<'day' | 'week' | null>(null);
  const [exportDate, setExportDate] = useState<Date>(new Date());

  // Form state
  const [editingSession, setEditingSession] = useState<any>(null);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [sessionDate, setSessionDate] = useState<Date | undefined>(undefined);
  const [requiredAction, setRequiredAction] = useState('');
  const [actionPopoverOpen, setActionPopoverOpen] = useState(false);
  const [actionSearch, setActionSearch] = useState('');
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  const [courtRoom, setCourtRoom] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch required actions from DB
  const fetchActions = useCallback(async () => {
    const { data } = await supabase
      .from('required_actions')
      .select('label')
      .order('label');
    if (data) setActionOptions(data.map(d => d.label));
  }, []);

  useEffect(() => { fetchActions(); }, [fetchActions]);

  const filteredActions = useMemo(() => {
    if (!actionSearch) return actionOptions;
    // Normalize Arabic: remove ال, diacritics, normalize hamza forms
    const normalize = (s: string) =>
      s.replace(/[\u0610-\u065F\u06D6-\u06ED]/g, '') // strip tashkeel
       .replace(/^ال/g, '').replace(/ ال/g, ' ')      // strip ال
       .replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي') // normalize
       .toLowerCase().trim();
    const words = normalize(actionSearch).split(/\s+/).filter(Boolean);
    return actionOptions.filter(a => {
      const norm = normalize(a);
      return words.every(w => norm.includes(w));
    });
  }, [actionOptions, actionSearch]);

  const filteredCases = useMemo(() => {
    if (!caseSearch) return cases;
    const q = caseSearch.toLowerCase();
    return cases.filter(c =>
      c.title?.toLowerCase().includes(q) ||
      c.case_number?.toLowerCase().includes(q) ||
      c.clients?.full_name?.toLowerCase().includes(q) ||
      c.opposing_party?.toLowerCase().includes(q)
    );
  }, [cases, caseSearch]);

  const displayedSessions = useMemo(() => {
    if (!filterDate) return sessions;
    const target = format(filterDate, 'yyyy-MM-dd');
    return sessions.filter(s => s.session_date === target);
  }, [sessions, filterDate]);

  const upcomingSessions = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return displayedSessions.filter(s => s.session_date >= today);
  }, [displayedSessions]);

  const pastSessions = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return displayedSessions.filter(s => s.session_date < today);
  }, [displayedSessions]);

  const selectedCase = cases.find(c => c.id === selectedCaseId);
  const needsCaseNumber = selectedCase && !selectedCase.case_number;

  const openEditSession = (session: any) => {
    setEditingSession(session);
    setSelectedCaseId(session.case_id);
    setSessionDate(new Date(session.session_date + 'T00:00:00'));
    setRequiredAction(session.required_action || '');
    setNotes(session.notes || '');
    setSessionTime(session.session_time || '');
    setCourtRoom(session.court_room || '');
    setCaseNumber('');
    setDialogOpen(true);
  };

  const openAddSession = () => {
    setEditingSession(null);
    setSelectedCaseId('');
    setSessionDate(undefined);
    setRequiredAction('');
    setNotes('');
    setSessionTime('');
    setCourtRoom('');
    setCaseNumber('');
    setDialogOpen(true);
  };

  const syncToGoogleCalendar = async () => {
    try {
      const { data: tokenRow } = await supabase
        .from('google_calendar_tokens')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (!tokenRow) return; // not connected, skip silently

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await supabase.functions.invoke('google-calendar-sync', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.error && res.data?.synced > 0) {
        toast.success('تمت مزامنة الجلسة مع Google Calendar', { icon: '📅' });
      }
    } catch {
      // Silent fail - don't block the main flow
    }
  };

  const handleSave = async () => {
    if (!sessionDate || !user) {
      toast.error('يرجى اختيار تاريخ الجلسة');
      return;
    }
    if (!requiredAction.trim()) {
      toast.error('يرجى تحديد المطلوب في هذه الجلسة');
      return;
    }
    if (!editingSession && !selectedCaseId) {
      toast.error('يرجى اختيار الملف');
      return;
    }
    if (!editingSession) {
      const finalCaseNumber = selectedCase?.case_number || caseNumber.trim();
      if (!finalCaseNumber) {
        toast.error('رقم الملف مطلوب');
        return;
      }
    }
    setSaving(true);
    try {
      if (!editingSession && needsCaseNumber && caseNumber.trim()) {
        await supabase.from('cases').update({ case_number: caseNumber.trim() }).eq('id', selectedCaseId);
      }
      if (editingSession) {
        const updatedFields = {
          session_date: format(sessionDate, 'yyyy-MM-dd'),
          required_action: requiredAction.trim(),
          notes: notes || null,
          session_time: sessionTime || null,
          court_room: courtRoom || null,
        };
        const { error } = await supabase.from('court_sessions').update(updatedFields).eq('id', editingSession.id);
        if (error) throw error;
        // Optimistic update — patch local state
        setSessions(prev => prev.map(s =>
          s.id === editingSession.id ? { ...s, ...updatedFields } : s
        ));
        toast.success('تم تعديل الجلسة');
      } else {
        const newSession = {
          case_id: selectedCaseId,
          session_date: format(sessionDate, 'yyyy-MM-dd'),
          required_action: requiredAction.trim(),
          notes: notes || null,
          session_time: sessionTime || null,
          court_room: courtRoom || null,
          user_id: user.id,
        };
        const { data, error } = await supabase.from('court_sessions')
          .insert(newSession)
          .select('*, cases(title, case_number, court, opposing_party, clients(full_name))')
          .single();
        if (error) throw error;
        // Optimistic insert — add to local state
        if (data) setSessions(prev => [...prev, data as SessionRecord].sort((a, b) => a.session_date.localeCompare(b.session_date)));
        toast.success('تمت إضافة الجلسة');
      }
      // Auto-save custom action if not in options
      const trimmedAction = requiredAction.trim();
      if (trimmedAction && !actionOptions.includes(trimmedAction) && user) {
        setActionOptions(prev => [...prev, trimmedAction].sort((a, b) => a.localeCompare(b, 'ar')));
        supabase.from('required_actions').insert({ label: trimmedAction, user_id: user.id }).single();
      }
      setDialogOpen(false);
      setEditingSession(null);
      setSelectedCaseId('');
      setSessionDate(undefined);
      setRequiredAction('');
      setNotes('');
      setSessionTime('');
      setCourtRoom('');
      setCaseNumber('');

      // Auto-sync to Google Calendar in background
      syncToGoogleCalendar();
    } catch {
      toast.error('خطأ في حفظ الجلسة');
    }
    setSaving(false);
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('هل تريد حذف هذه الجلسة؟')) return;
    const { error } = await supabase.from('court_sessions').delete().eq('id', sessionId);
    if (error) { toast.error('خطأ في حذف الجلسة'); return; }
    toast.success('تم حذف الجلسة');
    fetchData();
  };

  const getSessionBadge = (date: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (date === today) return <Badge className="bg-primary text-primary-foreground">اليوم</Badge>;
    if (date > today) return <Badge variant="outline" className="text-emerald-600 border-emerald-300">قادمة</Badge>;
    return <Badge variant="secondary">منتهية</Badge>;
  };

  // ---- Word Export Logic ----

  const handleExportWord = useCallback(async (mode: 'day' | 'week') => {
    try {
      await exportCourtSessionsWord({
        exportDate,
        mode,
        sessions,
      });
      toast.success('تم تحميل ملف Word بنجاح');
      setExportMode(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر إنشاء ملف Word';
      toast.error(message);
    }
  }, [sessions, exportDate]);

  const renderSessionTable = (items: any[], title: string) => (
    items.length > 0 && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title} ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full">
            <Table className="min-w-[960px]">
              <TableHeader>
                 <TableRow>
                   <TableHead className="text-right">التاريخ</TableHead>
                   <TableHead className="text-right">الساعة</TableHead>
                   <TableHead className="text-right">القاعة</TableHead>
                   <TableHead className="text-right">الموكل</TableHead>
                   <TableHead className="text-right">الخصم</TableHead>
                   <TableHead className="text-right">رقم الملف</TableHead>
                   <TableHead className="text-right">المحكمة</TableHead>
                   <TableHead className="text-right">المطلوب</TableHead>
                   <TableHead className="text-right">ملاحظات</TableHead>
                   <TableHead className="text-right">الحالة</TableHead>
                   <TableHead className="text-right w-[80px]">إجراءات</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {items.map(s => (
                   <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/cases/${s.case_id}`)}>
                     <TableCell className="text-sm whitespace-nowrap">
                       {new Date(s.session_date + 'T00:00:00').toLocaleDateString('ar-u-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                     </TableCell>
                     <TableCell className="text-sm font-medium" dir="ltr">{s.session_time || '—'}</TableCell>
                     <TableCell className="text-sm">{s.court_room || '—'}</TableCell>
                     <TableCell className="text-sm font-medium">{s.cases?.clients?.full_name || '—'}</TableCell>
                     <TableCell className="text-sm">{s.cases?.opposing_party || '—'}</TableCell>
                     <TableCell className="text-sm" dir="ltr">{s.cases?.case_number || '—'}</TableCell>
                     <TableCell className="text-sm">{s.cases?.court || '—'}</TableCell>
                     <TableCell className="text-sm">{s.required_action || '—'}</TableCell>
                     <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{s.notes || '—'}</TableCell>
                     <TableCell>{getSessionBadge(s.session_date)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSession(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => handleDeleteSession(s.id, e)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    )
  );

  if (loading) return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="h-6 w-6" /> يومية الجلسات
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">إدارة مواعيد الجلسات لجميع الملفات</p>
          </div>
          <Button size="sm" onClick={openAddSession} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">إضافة جلسة</span><span className="sm:hidden">جلسة</span>
          </Button>
        </div>

        {/* Toolbar - single row, scrollable on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {/* View toggle */}
          <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 shrink-0">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="gap-1 h-8 text-xs px-2.5"
              onClick={() => setViewMode('table')}
            >
              <List className="h-3.5 w-3.5" /> جدول
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              className="gap-1 h-8 text-xs px-2.5"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarRange className="h-3.5 w-3.5" /> تقويم
            </Button>
          </div>

          {/* Filter by date - always visible */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-8 text-xs shrink-0">
                <Search className="h-3.5 w-3.5" />
                {filterDate ? format(filterDate, 'dd/MM/yyyy') : 'تصفية'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={filterDate} onSelect={(d) => setFilterDate(d)} className={cn("p-3 pointer-events-auto")} />
              {filterDate && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setFilterDate(undefined)}>مسح التصفية</Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Export Word */}
          <Popover open={exportMode !== null} onOpenChange={(open) => { if (!open) setExportMode(null); }}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-8 text-xs shrink-0" onClick={() => setExportMode('day')}>
                <FileDown className="h-3.5 w-3.5" /> تصدير
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4 pointer-events-auto" align="end">
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">تصدير جدول الجلسات إلى Word</p>
                <div className="flex gap-2">
                  <Button variant={exportMode === 'day' ? 'default' : 'outline'} size="sm" className="flex-1 gap-1" onClick={() => setExportMode('day')}>
                    <CalendarDays className="h-3.5 w-3.5" /> يوم
                  </Button>
                  <Button variant={exportMode === 'week' ? 'default' : 'outline'} size="sm" className="flex-1 gap-1" onClick={() => setExportMode('week')}>
                    <CalendarRange className="h-3.5 w-3.5" /> أسبوع
                  </Button>
                </div>
                <Calendar mode="single" selected={exportDate} onSelect={(d) => d && setExportDate(d)} className="p-2 pointer-events-auto" />
                {exportMode === 'week' && (
                  <p className="text-xs text-muted-foreground text-center">
                    الأسبوع: {format(startOfWeek(exportDate, { weekStartsOn: 1 }), 'dd/MM')} — {format(endOfWeek(exportDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}
                  </p>
                )}
                <Button className="w-full gap-1" size="sm" onClick={() => handleExportWord(exportMode || 'day')}>
                  <FileDown className="h-4 w-4" /> تحميل ملف Word
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Spacer */}
          <div className="flex-1 min-w-[8px]" />

          {/* Google Calendar */}
          <GoogleCalendarQuickAction />
        </div>
      </div>

      {/* Content */}
      {viewMode === 'calendar' ? (
        <CalendarView sessions={sessions} />
      ) : (
        <>
          {displayedSessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">لا توجد جلسات {filterDate ? 'في هذا التاريخ' : 'بعد'}</p>
                <Button variant="outline" className="mt-3" onClick={() => setDialogOpen(true)}>إضافة أول جلسة</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {renderSessionTable(upcomingSessions, 'الجلسات القادمة')}
              {renderSessionTable(pastSessions, 'الجلسات السابقة')}
            </div>
          )}
        </>
      )}

      {/* Session Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingSession(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSession ? 'تعديل الجلسة' : 'إضافة جلسة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Case selector - only for new sessions */}
            {!editingSession && <div className="space-y-2">
              <Label>الملف *</Label>
              <Popover open={casePopoverOpen} onOpenChange={setCasePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedCase ? (
                      <span className="truncate">
                        {selectedCase.clients?.full_name || selectedCase.title} {selectedCase.case_number ? <span dir="ltr">{`- ${selectedCase.case_number}`}</span> : ''}
                      </span>
                    ) : 'اختر الملف...'}
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 pointer-events-auto" align="start">
                  <Command>
                    <CommandInput placeholder="ابحث بالاسم أو الرقم..." value={caseSearch} onValueChange={setCaseSearch} />
                    <CommandList>
                      <CommandEmpty>لا توجد نتائج</CommandEmpty>
                      <CommandGroup>
                        {filteredCases.map(c => (
                          <CommandItem key={c.id} value={c.id} onSelect={() => { setSelectedCaseId(c.id); setCasePopoverOpen(false); }}>
                            <Check className={cn("h-4 w-4 ml-2", selectedCaseId === c.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{c.clients?.full_name || c.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {c.case_number && <span dir="ltr">{`${c.case_number} • `}</span>}{c.court || ''}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>}

            {/* Case number - show if missing */}
            {!editingSession && needsCaseNumber && (
              <div className="space-y-2">
                <Label>رقم الملف *</Label>
                <Input
                  value={caseNumber}
                  onChange={e => setCaseNumber(e.target.value)}
                  placeholder="مثال: 123/1234/2025"
                  className=""
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">هذا الملف لا يحتوي على رقم بعد. أدخل الرقم الكامل (رقم/رمز/سنة)</p>
              </div>
            )}
            {/* Date picker */}
            <div className="space-y-2">
              <Label>تاريخ الجلسة *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start font-normal", !sessionDate && "text-muted-foreground")}>
                    <CalendarDays className="h-4 w-4 ml-2" />
                    {sessionDate ? format(sessionDate, 'PPP', { locale: ar }) : 'اختر التاريخ'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={sessionDate}
                    onSelect={setSessionDate}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* المطلوب */}
            <div className="space-y-2">
              <Label>المطلوب في هذه الجلسة *</Label>
              <Popover open={actionPopoverOpen} onOpenChange={setActionPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {requiredAction || <span className="text-muted-foreground">اختر المطلوب...</span>}
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 pointer-events-auto" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="ابحث أو اكتب مطلوباً جديداً..." value={actionSearch} onValueChange={setActionSearch} />
                    <CommandList>
                      {filteredActions.length === 0 && !actionSearch.trim() && (
                        <CommandEmpty>لا توجد نتائج</CommandEmpty>
                      )}
                      {actionSearch.trim() && !actionOptions.includes(actionSearch.trim()) && (
                        <CommandGroup heading="إضافة جديد">
                          <CommandItem
                            value={`__add__${actionSearch.trim()}`}
                            onSelect={() => {
                              setRequiredAction(actionSearch.trim());
                              setActionSearch('');
                              setActionPopoverOpen(false);
                            }}
                          >
                            <Plus className="h-4 w-4 ml-2" />
                            إضافة: <span className="font-medium mr-1">{actionSearch.trim()}</span>
                          </CommandItem>
                        </CommandGroup>
                      )}
                      <CommandGroup>
                        {filteredActions.map(action => (
                          <CommandItem
                            key={action}
                            value={action}
                            onSelect={() => {
                              setRequiredAction(action);
                              setActionSearch('');
                              setActionPopoverOpen(false);
                            }}
                          >
                            <Check className={cn("h-4 w-4 ml-2", requiredAction === action ? "opacity-100" : "opacity-0")} />
                            {action}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Time & Room */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>ساعة الجلسة</Label>
                <Input type="time" value={sessionTime} onChange={e => setSessionTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>القاعة</Label>
                <Input value={courtRoom} onChange={e => setCourtRoom(e.target.value)} placeholder="رقم أو اسم القاعة" />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات اختيارية..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
export default CourtSessions;
