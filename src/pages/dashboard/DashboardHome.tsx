import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Gavel, Users, DollarSign, FileText, TrendingUp, Clock, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

const stats = [
  { icon: Gavel, label: 'القضايا الجارية', value: '—', color: 'text-blue-600' },
  { icon: Users, label: 'الموكلين', value: '—', color: 'text-green-600' },
  { icon: DollarSign, label: 'الإيرادات (الشهر)', value: '—', color: 'text-emerald-600' },
  { icon: FileText, label: 'المقالات المنشورة', value: '—', color: 'text-purple-600' },
];

const DashboardHome = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);

  const fetchSessions = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('court_sessions')
      .select('*, cases(title, case_number, court, opposing_party, clients(full_name))')
      .gte('session_date', today)
      .order('session_date', { ascending: true })
      .limit(5);
    if (data) setUpcomingSessions(data);
  };

  useEffect(() => { fetchSessions(); }, []);

  // Realtime: auto-refresh when new sessions are inserted (e.g. from mahakim sync)
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-sessions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'court_sessions' }, () => {
        fetchSessions();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">مرحباً 👋</h1>
        <p className="text-muted-foreground">لوحة التحكم الخاصة بك</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              الجلسات القادمة
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/court-sessions')}>
              عرض الكل
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد جلسات قادمة</p>
            ) : (
              <div className="space-y-3">
                {upcomingSessions.map(s => {
                  const isToday = s.session_date === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/dashboard/cases/${s.case_id}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{s.cases?.clients?.full_name || s.cases?.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.cases?.court} {s.cases?.case_number ? <span dir="ltr">{`• ${s.cases.case_number}`}</span> : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {new Date(s.session_date + 'T00:00:00').toLocaleDateString('ar-MA', { month: 'short', day: 'numeric' })}
                        </span>
                        {isToday && <Badge className="bg-primary text-primary-foreground text-xs">اليوم</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              آخر النشاطات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">لا توجد نشاطات حديثة</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardHome;
