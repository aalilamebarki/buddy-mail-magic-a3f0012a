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
      periodLabel = new Date(exportDate).toLocaleDateString('ar-u-nu-latn', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      docTitle = `جلسة يوم ${periodLabel}`;
    } else {
      const ws = startOfWeek(exportDate, { weekStartsOn: 1 });
      const we = endOfWeek(exportDate, { weekStartsOn: 1 });
      dateStart = format(ws, 'yyyy-MM-dd');
      dateEnd = format(we, 'yyyy-MM-dd');
      periodLabel = `من ${new Date(ws).toLocaleDateString('ar-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })} إلى ${new Date(we).toLocaleDateString('ar-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })}`;
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
        const formattedDate = new Date(s.session_date + 'T00:00:00').toLocaleDateString('ar-u-nu-latn', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        const formattedNext = nextDate ? new Date(nextDate + 'T00:00:00').toLocaleDateString('ar-u-nu-latn', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
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
        <div class="court-block">
          <div class="court-title">⚖ ${court} — ${items.length} جلسة</div>
          <table>
            <thead>
              <tr>
                <th style="width:28px;text-align:center">#</th>
                <th>الموكل</th>
                <th style="width:120px">رقم الملف</th>
                <th>المدعى عليه</th>
                <th style="width:140px">تاريخ الجلسة</th>
                <th style="width:140px">الجلسة المقبلة</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }).join('');

    const totalSessions = Object.values(byCourt).reduce((s, a) => s + a.length, 0);
    const totalCourts = Object.keys(byCourt).length;

    // --- Generate PDF using jsPDF with Arabic font ---
    toast.info('جاري إنشاء PDF...');

    const { default: jsPDF } = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    // jspdf-autotable adds itself to jsPDF prototype via side effect

    // Fetch Amiri Arabic font (local file)
    const fontUrl = '/fonts/Amiri-Regular.ttf';
    const fontResponse = await fetch(fontUrl);
    if (!fontResponse.ok) {
      toast.error('خطأ في تحميل الخط العربي');
      return;
    }
    const fontBuffer = await fontResponse.arrayBuffer();
    const uint8Array = new Uint8Array(fontBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const fontBase64 = btoa(binary);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal', 'Identity-H');
    doc.setFont('Amiri');
    doc.setLanguage('ar');
    doc.setR2L(true);

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Title
    doc.setFontSize(20);
    doc.text(docTitle, pageW / 2, 18, { align: 'center' } as any);
    doc.setFontSize(11);
    doc.setTextColor(80);
    doc.text(periodLabel, pageW / 2, 26, { align: 'center' } as any);

    // Stats line
    doc.setFontSize(10);
    doc.setTextColor(0);
    const statsText = `${totalSessions} جلسة  |  ${totalCourts} محكمة`;
    doc.text(statsText, pageW / 2, 33, { align: 'center' } as any);

    // Separator line
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(15, 36, pageW - 15, 36);

    let currentY = 42;

    // Court sections
    for (const [court, items] of Object.entries(byCourt)) {
      if (currentY + 20 > pageH - 15) {
        doc.addPage();
        currentY = 15;
      }

      // Court header bar
      doc.setFillColor(0, 0, 0);
      doc.rect(15, currentY, pageW - 30, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.text(`${court} — ${(items as any[]).length} جلسة`, pageW - 20, currentY + 5.5, { align: 'right' });
      doc.setTextColor(0);
      currentY += 10;

      // Table data
      const tableHead = [['#', 'الموكل', 'رقم الملف', 'المدعى عليه', 'تاريخ الجلسة', 'الجلسة المقبلة']];
      const tableBody = (items as any[]).map((s: any, i: number) => {
        const nextDate = getNextSession(s.case_id, s.session_date);
        const fmtDate = new Date(s.session_date + 'T00:00:00').toLocaleDateString('ar-u-nu-latn', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        const fmtNext = nextDate ? new Date(nextDate + 'T00:00:00').toLocaleDateString('ar-u-nu-latn', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
        return [
          String(i + 1),
          s.cases?.clients?.full_name || '—',
          s.cases?.case_number || '—',
          s.cases?.opposing_party || '—',
          fmtDate,
          fmtNext,
        ];
      });

      autoTableModule.default(doc, {
        head: tableHead,
        body: tableBody,
        startY: currentY,
        margin: { left: 15, right: 15 },
        styles: {
          font: 'Amiri',
          fontStyle: 'normal',
          fontSize: 9,
          halign: 'right',
          cellPadding: 2.5,
          lineColor: [150, 150, 150],
          lineWidth: 0.2,
          textColor: [0, 0, 0],
        },
        headStyles: {
          fillColor: [230, 230, 230],
          textColor: [0, 0, 0],
          fontStyle: 'normal',
          fontSize: 9,
          halign: 'right',
          lineColor: [100, 100, 100],
          lineWidth: 0.3,
        },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          2: { halign: 'center', cellWidth: 35 },
          4: { cellWidth: 45 },
          5: { cellWidth: 45 },
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // Footer
    const footerY = pageH - 8;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.setLineWidth(0.3);
    doc.line(15, footerY - 3, pageW - 15, footerY - 3);
    doc.text(docTitle, pageW - 15, footerY, { align: 'right' });
    const genDate = new Date().toLocaleDateString('ar-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.text(genDate, 15, footerY, { align: 'left' });

    const fileName = mode === 'week'
      ? 'جدول_الجلسات_الأسبوع.pdf'
      : `جلسة_يوم_${format(exportDate, 'yyyy-MM-dd')}.pdf`;

    doc.save(fileName);
    toast.success('تم تحميل PDF بنجاح');
    setExportMode(null);
  }, [sessions, exportDate, getNextSession]);

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
                      {new Date(s.session_date + 'T00:00:00').toLocaleDateString('ar-u-nu-latn', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{s.cases?.clients?.full_name || '—'}</TableCell>
                    <TableCell className="text-sm">{s.cases?.opposing_party || '—'}</TableCell>
                    <TableCell className="font-mono text-sm" dir="ltr">{s.cases?.case_number || '—'}</TableCell>
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
