import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSessions } from '@/hooks/useSessions';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ChevronRight, ChevronLeft, CalendarDays, Clock, MapPin, User, Gavel, List, CalendarRange, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewMode = 'month' | 'week' | 'day';

const SessionCalendar = () => {
  const navigate = useNavigate();
  const { sessions, loading } = useSessions();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    const map: Record<string, typeof sessions> = {};
    for (const s of sessions) {
      if (!map[s.session_date]) map[s.session_date] = [];
      map[s.session_date].push(s);
    }
    // Sort each day's sessions by time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        const parseTime = (t: string | null): number => {
          if (!t) return 9999;
          const m = t.match(/(\d{1,2}):(\d{2})/);
          return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 9999;
        };
        return parseTime(a.session_time) - parseTime(b.session_time);
      });
    }
    return map;
  }, [sessions]);

  const today = format(new Date(), 'yyyy-MM-dd');

  // Navigation
  const navigate_ = (dir: 1 | -1) => {
    if (viewMode === 'month') setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(new Date(currentDate.getTime() + dir * 86400000));
  };

  const goToday = () => setCurrentDate(new Date());

  // Calendar days for month view
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Week days
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const dayNames = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];

  // Title
  const headerTitle = useMemo(() => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: ar });
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'd', { locale: ar })} - ${format(end, 'd MMMM yyyy', { locale: ar })}`;
    }
    return format(currentDate, 'EEEE d MMMM yyyy', { locale: ar });
  }, [currentDate, viewMode]);

  // Sessions for the day view
  const daySessionsForDate = useCallback((date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    return sessionsByDate[key] || [];
  }, [sessionsByDate]);

  const renderSessionCard = (s: typeof sessions[0], compact = false) => {
    const isToday = s.session_date === today;
    const isPast = s.session_date < today;

    return (
      <div
        key={s.id}
        onClick={() => navigate(`/dashboard/cases/${s.case_id}`)}
        className={cn(
          "rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md",
          isToday && "border-primary/40 bg-primary/5",
          isPast && "opacity-60",
          !isToday && !isPast && "hover:border-primary/30"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              {s.session_time && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-muted px-2 py-0.5 rounded" dir="ltr">
                  <Clock className="h-3 w-3" /> {s.session_time}
                </span>
              )}
              {s.court_room && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  <MapPin className="h-3 w-3" /> {s.court_room}
                </span>
              )}
              {isToday && <Badge className="bg-primary text-primary-foreground text-[10px] h-5">اليوم</Badge>}
            </div>
            <p className="text-sm font-medium truncate">{s.cases?.clients?.full_name || s.cases?.title || '—'}</p>
            {!compact && (
              <>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {s.cases?.case_number && <span dir="ltr" className="font-mono">{s.cases.case_number}</span>}
                  {s.cases?.court && <span className="truncate">{s.cases.court}</span>}
                </div>
                {s.required_action && (
                  <p className="text-xs text-foreground/80 flex items-center gap-1">
                    <Gavel className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{s.required_action}</span>
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Month view
  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
      {dayNames.map(d => (
        <div key={d} className="bg-muted/50 p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
      ))}
      {monthDays.map(day => {
        const key = format(day, 'yyyy-MM-dd');
        const daySessions = sessionsByDate[key] || [];
        const isCurrentMonth = isSameMonth(day, currentDate);
        const isToday_ = isSameDay(day, new Date());

        return (
          <div
            key={key}
            className={cn(
              "bg-card min-h-[90px] p-1.5 transition-colors cursor-pointer hover:bg-muted/30",
              !isCurrentMonth && "bg-muted/20 opacity-50"
            )}
            onClick={() => { setCurrentDate(day); setViewMode('day'); }}
          >
            <div className={cn(
              "text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
              isToday_ && "bg-primary text-primary-foreground"
            )}>
              {format(day, 'd')}
            </div>
            <div className="space-y-0.5">
              {daySessions.slice(0, 3).map(s => (
                <div
                  key={s.id}
                  className={cn(
                    "text-[10px] leading-tight px-1 py-0.5 rounded truncate",
                    s.session_date < today ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary font-medium"
                  )}
                  onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/cases/${s.case_id}`); }}
                >
                  {s.session_time && <span className="font-mono ml-1">{s.session_time}</span>}
                  {s.cases?.clients?.full_name || s.cases?.title || '—'}
                </div>
              ))}
              {daySessions.length > 3 && (
                <div className="text-[10px] text-muted-foreground text-center">+{daySessions.length - 3}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Week view
  const renderWeekView = () => (
    <div className="grid grid-cols-7 gap-3">
      {weekDays.map(day => {
        const key = format(day, 'yyyy-MM-dd');
        const daySessions = sessionsByDate[key] || [];
        const isToday_ = isSameDay(day, new Date());

        return (
          <div key={key} className="space-y-2">
            <div
              className={cn(
                "text-center p-2 rounded-lg cursor-pointer hover:bg-muted/50",
                isToday_ && "bg-primary/10"
              )}
              onClick={() => { setCurrentDate(day); setViewMode('day'); }}
            >
              <div className="text-xs text-muted-foreground">{format(day, 'EEEE', { locale: ar })}</div>
              <div className={cn(
                "text-lg font-bold mx-auto w-8 h-8 flex items-center justify-center rounded-full",
                isToday_ && "bg-primary text-primary-foreground"
              )}>
                {format(day, 'd')}
              </div>
            </div>
            <div className="space-y-1.5 min-h-[200px]">
              {daySessions.map(s => renderSessionCard(s, true))}
              {daySessions.length === 0 && (
                <div className="text-center text-xs text-muted-foreground/50 py-8">—</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Day view
  const renderDayView = () => {
    const daySessions = daySessionsForDate(currentDate);
    return (
      <div className="space-y-3 max-w-2xl mx-auto">
        {daySessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">لا توجد جلسات في هذا اليوم</p>
            </CardContent>
          </Card>
        ) : (
          daySessions.map(s => renderSessionCard(s))
        )}
      </div>
    );
  };

  if (loading) return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6" /> تقويم الجلسات
          </h1>
          <p className="text-sm text-muted-foreground">عرض تفاعلي لمواعيد جميع الجلسات</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/court-sessions')} className="gap-1">
          <List className="h-4 w-4" /> عرض الجدول
        </Button>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === 'month' ? 'default' : 'ghost'}
                size="sm"
                className="gap-1 h-8 text-xs"
                onClick={() => setViewMode('month')}
              >
                <CalendarIcon className="h-3.5 w-3.5" /> شهري
              </Button>
              <Button
                variant={viewMode === 'week' ? 'default' : 'ghost'}
                size="sm"
                className="gap-1 h-8 text-xs"
                onClick={() => setViewMode('week')}
              >
                <CalendarRange className="h-3.5 w-3.5" /> أسبوعي
              </Button>
              <Button
                variant={viewMode === 'day' ? 'default' : 'ghost'}
                size="sm"
                className="gap-1 h-8 text-xs"
                onClick={() => setViewMode('day')}
              >
                <CalendarDays className="h-3.5 w-3.5" /> يومي
              </Button>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate_(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToday}>اليوم</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate_(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-sm font-semibold text-foreground min-w-[140px] text-center">{headerTitle}</h2>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardContent className="pt-4">
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'day' && renderDayView()}
        </CardContent>
      </Card>
    </div>
  );
};

export default SessionCalendar;
