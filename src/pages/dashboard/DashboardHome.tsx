import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Gavel, Users, Clock, CalendarDays, AlertTriangle, CalendarRange, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

const DashboardHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: upcomingSessions = [] } = useQuery({
    queryKey: ['dashboard_upcoming_sessions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('court_sessions')
        .select('*, cases(title, case_number, court, opposing_party, clients(full_name))')
        .gte('session_date', today)
        .order('session_date', { ascending: true })
        .limit(5);
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: statsData = { activeCases: 0, clients: 0, todaySessions: 0, needsAttention: 0 } } = useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const [casesRes, clientsRes, todayRes, staleRes] = await Promise.all([
        supabase.from('cases').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('court_sessions').select('id', { count: 'exact', head: true }).eq('session_date', today),
        supabase.from('cases').select('id', { count: 'exact', head: true }).eq('status', 'active').or(`last_synced_at.is.null,last_synced_at.lt.${new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()}`),
      ]);
      return {
        activeCases: casesRes.count || 0,
        clients: clientsRes.count || 0,
        todaySessions: todayRes.count || 0,
        needsAttention: staleRes.count || 0,
      };
    },
    staleTime: 2 * 60 * 1000,
  });

  const stats = [
    { icon: CalendarDays, label: 'جلسات اليوم', value: statsData.todaySessions.toString(), color: 'text-primary', onClick: () => navigate('/dashboard/calendar') },
    { icon: Gavel, label: 'القضايا النشطة', value: statsData.activeCases.toString(), color: 'text-blue-600', onClick: () => navigate('/dashboard/cases') },
    { icon: Users, label: 'الموكلين', value: statsData.clients.toString(), color: 'text-green-600', onClick: () => navigate('/dashboard/clients') },
    { icon: AlertTriangle, label: 'تحتاج متابعة', value: statsData.needsAttention.toString(), color: 'text-amber-600', onClick: () => navigate('/dashboard/cases') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">مرحباً 👋</h1>
          <p className="text-muted-foreground">لوحة التحكم الخاصة بك</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/calendar')} className="gap-1">
          <CalendarRange className="h-4 w-4" /> التقويم
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <Card key={i} className="cursor-pointer hover:shadow-md transition-shadow" onClick={stat.onClick}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
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
                {upcomingSessions.map((s: any) => {
                  const isToday = s.session_date === today;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/dashboard/cases/${s.case_id}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{s.cases?.clients?.full_name || s.cases?.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {s.session_time && <span dir="ltr" className="font-mono">{s.session_time}</span>}
                          {s.court_room && <span>• {s.court_room}</span>}
                          {s.cases?.court && <span>• {s.cases.court}</span>}
                        </div>
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
