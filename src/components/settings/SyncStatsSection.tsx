import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Activity, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SyncStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  avgDuration: number | null;
}

const SyncStatsSection = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<SyncStats>({ total: 0, completed: 0, failed: 0, pending: 0, avgDuration: null });
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

    if (data) {
      const completed = data.filter(j => j.status === 'completed');
      const durations = completed
        .filter(j => j.completed_at)
        .map(j => (new Date(j.completed_at!).getTime() - new Date(j.created_at).getTime()) / 1000);

      setStats({
        total: data.length,
        completed: completed.length,
        failed: data.filter(j => j.status === 'failed').length,
        pending: data.filter(j => j.status === 'pending' || j.status === 'scraping').length,
        avgDuration: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
      });
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, [user]);

  const statCards = [
    { label: 'إجمالي المزامنات', value: stats.total, icon: Activity, color: 'text-primary' },
    { label: 'ناجحة', value: stats.completed, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'فاشلة', value: stats.failed, icon: XCircle, color: 'text-destructive' },
    { label: 'قيد التنفيذ', value: stats.pending, icon: Clock, color: 'text-yellow-600' },
  ];

  return (
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
  );
};

export default SyncStatsSection;
