import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { CalendarDays, Plus, Search, ChevronsUpDown, Check, FolderOpen, Pencil, Trash2, FileDown, CalendarRange } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const CourtSessions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [sessionsRes, casesRes] = await Promise.all([
      supabase
        .from('court_sessions')
        .select('*, cases(title, case_number, court, opposing_party, clients(full_name))')
        .order('session_date', { ascending: true }),
      supabase
        .from('cases')
        .select('id, title, case_number, court, opposing_party, clients(full_name)')
        .eq('status', 'active'),
    ]);
    if (sessionsRes.data) setSessions(sessionsRes.data);
    if (casesRes.data) setCases(casesRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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
    setNotes(session.notes || '');
    setCaseNumber('');
    setDialogOpen(true);
  };

  const openAddSession = () => {
    setEditingSession(null);
    setSelectedCaseId('');
    setSessionDate(undefined);
    setNotes('');
    setCaseNumber('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!sessionDate || !user) {
      toast.error('يرجى اختيار تاريخ الجلسة');
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
        const { error } = await supabase.from('court_sessions').update({
          session_date: format(sessionDate, 'yyyy-MM-dd'),
          notes: notes || null,
        }).eq('id', editingSession.id);
        if (error) throw error;
        toast.success('تم تعديل الجلسة');
      } else {
        const { error } = await supabase.from('court_sessions').insert({
          case_id: selectedCaseId,
          session_date: format(sessionDate, 'yyyy-MM-dd'),
          notes: notes || null,
          user_id: user.id,
        });
        if (error) throw error;
        toast.success('تمت إضافة الجلسة');
      }
      setDialogOpen(false);
      setEditingSession(null);
      setSelectedCaseId('');
      setSessionDate(undefined);
      setNotes('');
      setCaseNumber('');
      fetchData();
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

  // ---- PDF Export Logic ----
  const getNextSession = useCallback((caseId: string, afterDate: string): string | null => {
    const future = sessions
      .filter(s => s.case_id === caseId && s.session_date > afterDate)
      .sort((a, b) => a.session_date.localeCompare(b.session_date));
    return future.length > 0 ? future[0].session_date : null;
  }, [sessions]);

  const handleExportPDF = useCallback(async (mode: 'day' | 'week') => {
    let dateStart: string;
    let dateEnd: string;
    let periodLabel: string;

    let docTitle: string;

    if (mode === 'day') {
      dateStart = format(exportDate, 'yyyy-MM-dd');
      dateEnd = dateStart;
      periodLabel = new Date(exportDate).toLocaleDateString('ar-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      docTitle = `جلسة يوم ${periodLabel}`;
    } else {
      const ws = startOfWeek(exportDate, { weekStartsOn: 1 });
      const we = endOfWeek(exportDate, { weekStartsOn: 1 });
      dateStart = format(ws, 'yyyy-MM-dd');
      dateEnd = format(we, 'yyyy-MM-dd');
      periodLabel = `من ${new Date(ws).toLocaleDateString('ar-MA', { day: 'numeric', month: 'long', year: 'numeric' })} إلى ${new Date(we).toLocaleDateString('ar-MA', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      docTitle = 'جدول الجلسات لهذا الأسبوع';
    }

    const filtered = sessions.filter(s => s.session_date >= dateStart && s.session_date <= dateEnd);
    if (filtered.length === 0) {
      toast.error('لا توجد جلسات في هذه الفترة');
      return;
    }

    // Group by court
    const byCourt: Record<string, any[]> = {};
    for (const s of filtered) {
      const court = s.cases?.court || 'غير محددة';
      if (!byCourt[court]) byCourt[court] = [];
      byCourt[court].push(s);
    }

    // Build print HTML
    let rowCounter = 0;
    const courtSections = Object.entries(byCourt).map(([court, items], courtIdx) => {
      const rows = items.map((s, i) => {
        rowCounter++;
        const nextDate = getNextSession(s.case_id, s.session_date);
        const formattedDate = new Date(s.session_date + 'T00:00:00').toLocaleDateString('ar-MA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        const formattedNext = nextDate ? new Date(nextDate + 'T00:00:00').toLocaleDateString('ar-MA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
        return `<tr>
          <td class="num-cell">${i + 1}</td>
          <td class="name-cell">${s.cases?.clients?.full_name || '—'}</td>
          <td class="case-num-cell" style="direction:ltr;text-align:center">${s.cases?.case_number || '—'}</td>
          <td class="name-cell">${s.cases?.opposing_party || '—'}</td>
          <td class="date-cell">${formattedDate}</td>
          <td class="date-cell">${formattedNext}</td>
        </tr>`;
      }).join('');

      return `
        <div class="court-section">
          <div class="court-header">
            <div class="court-icon">⚖</div>
            <h2>${court}</h2>
            <span class="court-count">${items.length} جلسة</span>
          </div>
          <table>
            <thead>
              <tr>
                <th class="num-col">#</th>
                <th>الموكل</th>
                <th class="case-col">رقم الملف</th>
                <th>المدعى عليه</th>
                <th class="date-col">تاريخ الجلسة</th>
                <th class="date-col">الجلسة المقبلة</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }).join('');

    const totalSessions = Object.values(byCourt).reduce((s, a) => s + a.length, 0);
    const totalCourts = Object.keys(byCourt).length;

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>${docTitle}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');
  @page { size: A4 landscape; margin: 12mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'IBM Plex Sans Arabic', 'Traditional Arabic', sans-serif; font-size: 13px; color: #000; padding: 0; direction: rtl; background: #fff; }
  .doc-header { border-bottom: 3px double #000; padding: 22px 36px 16px; position: relative; }
  .doc-header h1 { font-size: 24px; font-weight: 700; color: #000; margin-bottom: 3px; }
  .doc-header .period { font-size: 13px; color: #333; }
  .doc-header .stats { position: absolute; left: 36px; top: 50%; transform: translateY(-50%); display: flex; gap: 14px; }
  .stat-box { text-align: center; border: 1.5px solid #000; border-radius: 6px; padding: 7px 14px; min-width: 65px; }
  .stat-box .num { font-size: 20px; font-weight: 700; display: block; line-height: 1.2; color: #000; }
  .stat-box .label { font-size: 10px; color: #444; }
  .content { padding: 20px 36px; }
  .court-section { margin-bottom: 22px; page-break-inside: avoid; }
  .court-header { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-bottom: 2px solid #000; margin-bottom: 0; }
  .court-icon { font-size: 15px; width: 26px; height: 26px; border: 1.5px solid #000; border-radius: 5px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .court-header h2 { font-size: 14px; font-weight: 700; color: #000; flex: 1; }
  .court-count { font-size: 10px; border: 1px solid #000; padding: 2px 8px; border-radius: 12px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; }
  th { font-weight: 700; font-size: 11px; color: #000; padding: 8px 10px; text-align: right; border: 1px solid #000; border-bottom: 2px solid #000; white-space: nowrap; }
  td { padding: 7px 10px; font-size: 12px; border: 1px solid #777; color: #000; }
  .num-col { width: 32px; text-align: center; }
  .num-cell { text-align: center; font-weight: 600; color: #444; font-size: 11px; }
  .name-cell { font-weight: 500; }
  .case-num-cell { font-family: monospace; font-size: 12px; font-weight: 500; }
  .case-col { width: 130px; }
  .date-col { width: 150px; }
  .date-cell { font-size: 11.5px; color: #111; white-space: nowrap; }
  .doc-footer { margin-top: 24px; padding: 10px 36px; border-top: 2px solid #000; display: flex; justify-content: space-between; font-size: 10px; color: #444; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="doc-header">
    <h1>${docTitle}</h1>
    <p class="period">${periodLabel}</p>
    <div class="stats">
      <div class="stat-box"><span class="num">${totalSessions}</span><span class="label">جلسة</span></div>
      <div class="stat-box"><span class="num">${totalCourts}</span><span class="label">محكمة</span></div>
    </div>
  </div>
  <div class="content">
    ${courtSections}
  </div>
  <div class="doc-footer">
    <span>${docTitle} — ${periodLabel}</span>
    <span>تم الإنشاء: ${new Date().toLocaleDateString('ar-MA', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
  </div>
</body>
</html>`;

    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    const { default: html2pdf } = await import('html2pdf.js');
    const fileName = mode === 'week'
      ? 'جدول_الجلسات_الأسبوع.pdf'
      : `جلسة_يوم_${format(exportDate, 'yyyy-MM-dd')}.pdf`;

    html2pdf().set({
      margin: 0,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    }).from(container.firstElementChild).save().then(() => {
      document.body.removeChild(container);
    });
    setExportMode(null);
  }, [sessions, exportDate, getNextSession]);

  const renderSessionTable = (items: any[], title: string) => (
    items.length > 0 && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title} ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">الموكل</TableHead>
                  <TableHead className="text-right">الخصم</TableHead>
                  <TableHead className="text-right">رقم الملف</TableHead>
                  <TableHead className="text-right">المحكمة</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right w-[80px]">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(s => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/cases/${s.case_id}`)}>
                    <TableCell className="font-mono text-sm whitespace-nowrap">
                      {new Date(s.session_date + 'T00:00:00').toLocaleDateString('ar-MA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{s.cases?.clients?.full_name || '—'}</TableCell>
                    <TableCell className="text-sm">{s.cases?.opposing_party || '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{s.cases?.case_number || '—'}</TableCell>
                    <TableCell className="text-sm">{s.cases?.court || '—'}</TableCell>
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6" /> يومية الجلسات
          </h1>
          <p className="text-sm text-muted-foreground">إدارة مواعيد الجلسات لجميع الملفات</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Export PDF */}
          <Popover open={exportMode !== null} onOpenChange={(open) => { if (!open) setExportMode(null); }}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setExportMode('day')}>
                <FileDown className="h-4 w-4" /> تحميل PDF
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4 pointer-events-auto" align="end">
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">تحميل جدول الجلسات</p>
                <div className="flex gap-2">
                  <Button
                    variant={exportMode === 'day' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => setExportMode('day')}
                  >
                    <CalendarDays className="h-3.5 w-3.5" /> يوم
                  </Button>
                  <Button
                    variant={exportMode === 'week' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => setExportMode('week')}
                  >
                    <CalendarRange className="h-3.5 w-3.5" /> أسبوع
                  </Button>
                </div>
                <Calendar
                  mode="single"
                  selected={exportDate}
                  onSelect={(d) => d && setExportDate(d)}
                  className="p-2 pointer-events-auto"
                />
                {exportMode === 'week' && (
                  <p className="text-xs text-muted-foreground text-center">
                    الأسبوع: {format(startOfWeek(exportDate, { weekStartsOn: 1 }), 'dd/MM')} — {format(endOfWeek(exportDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}
                  </p>
                )}
                <Button className="w-full gap-1" size="sm" onClick={() => handleExportPDF(exportMode || 'day')}>
                  <FileDown className="h-4 w-4" /> تحميل
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Filter by date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Search className="h-4 w-4" />
                {filterDate ? format(filterDate, 'dd/MM/yyyy') : 'تصفية بالتاريخ'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={filterDate}
                onSelect={(d) => setFilterDate(d)}
                className={cn("p-3 pointer-events-auto")}
              />
              {filterDate && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setFilterDate(undefined)}>
                    مسح التصفية
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Button size="sm" onClick={openAddSession} className="gap-1">
            <Plus className="h-4 w-4" /> إضافة جلسة
          </Button>
        </div>
      </div>

      {/* Sessions */}
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
                        {selectedCase.clients?.full_name || selectedCase.title} {selectedCase.case_number ? `- ${selectedCase.case_number}` : ''}
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
                                {c.case_number && `${c.case_number} • `}{c.court || ''}
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
                  className="font-mono"
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
