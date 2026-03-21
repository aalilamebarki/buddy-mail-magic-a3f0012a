import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Activity, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

interface SyncStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  avgDuration: number | null;
}

interface SyncJob {
  status: string;
  created_at: string;
  completed_at: string | null;
}

/** بناء بيانات الرسم البياني اليومي من وظائف المزامنة */
function buildDailyChartData(jobs: SyncJob[]) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();

  // تهيئة كل يوم بصفر
  const days: Record<number, { day: number; label: string; completed: number; failed: number }> = {};
  for (let d = 1; d <= Math.min(daysInMonth, today); d++) {
    days[d] = { day: d, label: `${d}`, completed: 0, failed: 0 };
  }

  // تعبئة البيانات
  for (const job of jobs) {
    const d = new Date(job.created_at).getDate();
    if (!days[d]) continue;
    if (job.status === 'completed') days[d].completed++;
    else if (job.status === 'failed') days[d].failed++;
  }

  return Object.values(days);
}

const chartConfig = {
  completed: { label: 'ناجحة', color: 'hsl(var(--chart-2))' },
  failed: { label: 'فاشلة', color: 'hsl(var(--chart-5))' },
};

const SyncStatsSection = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    if (!user) return;
    setLoading(true);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('mahakim_sync_jobs')
      .select('status, created_at, completed_at')
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth.toISOString());

    setJobs((data as SyncJob[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, [user]);

  // حساب الإحصائيات من البيانات المُجلَبة
  const stats = useMemo<SyncStats>(() => {
    const completed = jobs.filter(j => j.status === 'completed');
    const durations = completed
      .filter(j => j.completed_at)
      .map(j => (new Date(j.completed_at!).getTime() - new Date(j.created_at).getTime()) / 1000);

    return {
      total: jobs.length,
      completed: completed.length,
      failed: jobs.filter(j => j.status === 'failed').length,
      pending: jobs.filter(j => j.status === 'pending' || j.status === 'scraping').length,
      avgDuration: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    };
  }, [jobs]);

  const chartData = useMemo(() => buildDailyChartData(jobs), [jobs]);

  const statCards = [
    { label: 'إجمالي المزامنات', value: stats.total, icon: Activity, color: 'text-primary' },
    { label: 'ناجحة', value: stats.completed, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'فاشلة', value: stats.failed, icon: XCircle, color: 'text-destructive' },
    { label: 'قيد التنفيذ', value: stats.pending, icon: Clock, color: 'text-yellow-600' },
  ];

  return (
    <div className="space-y-4">
      {/* بطاقات الإحصائيات */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-muted-foreground" />
            إحصائيات المزامنة — الشهر الحالي
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={fetchStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {statCards.map(s => (
              <div key={s.label} className="rounded-lg border bg-muted/30 p-4 text-center space-y-1">
                <s.icon className={`h-5 w-5 mx-auto ${s.color}`} />
                <p className="text-2xl font-bold text-foreground">{loading ? '—' : s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          {stats.avgDuration !== null && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                متوسط مدة المزامنة: {stats.avgDuration} ثانية
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* الرسم البياني اليومي */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">التوزيع اليومي للمزامنات</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 || stats.total === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">لا توجد بيانات كافية لعرض الرسم البياني</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="completed" stackId="a" fill="var(--color-completed)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="failed" stackId="a" fill="var(--color-failed)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SyncStatsSection;
