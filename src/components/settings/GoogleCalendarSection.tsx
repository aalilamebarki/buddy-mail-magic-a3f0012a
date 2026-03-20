import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { CalendarDays, Link2, Unlink, RefreshCw, CheckCircle2 } from 'lucide-react';

const GoogleCalendarSection = () => {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    checkConnection();
  }, [user]);

  const checkConnection = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('google_calendar_tokens')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    setConnected(!!data);
    setLoading(false);
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('يجب تسجيل الدخول أولاً'); return; }

      const res = await supabase.functions.invoke('google-calendar-auth', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error || !res.data?.url) {
        toast.error('فشل في بدء عملية الربط');
        return;
      }

      // Open OAuth in new window
      const popup = window.open(res.data.url, 'google-calendar-auth', 'width=600,height=700');

      // Poll for completion
      const pollInterval = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(pollInterval);
          await checkConnection();
          setConnecting(false);
          // Re-check if connected
          const { data } = await supabase
            .from('google_calendar_tokens')
            .select('id')
            .eq('user_id', user!.id)
            .maybeSingle();
          if (data) {
            setConnected(true);
            toast.success('تم ربط Google Calendar بنجاح!');
          }
        }
      }, 1000);
    } catch {
      toast.error('حدث خطأ غير متوقع');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setDisconnecting(true);
    const { error } = await supabase
      .from('google_calendar_tokens')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      toast.error('فشل في فصل الربط');
    } else {
      setConnected(false);
      toast.success('تم فصل Google Calendar');
    }
    setDisconnecting(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('يجب تسجيل الدخول'); return; }

      const res = await supabase.functions.invoke('google-calendar-sync', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) {
        toast.error(res.error.message || 'فشل في المزامنة');
      } else {
        const d = res.data;
        toast.success(`تمت مزامنة ${d.synced} جلسة${d.errors > 0 ? ` (${d.errors} أخطاء)` : ''}`);
      }
    } catch {
      toast.error('حدث خطأ في المزامنة');
    }
    setSyncing(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          جاري التحقق من حالة الربط...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          ربط تقويم Google لمزامنة جلسات المحكمة تلقائياً
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">حالة الربط:</span>
            {connected ? (
              <Badge className="bg-green-100 text-green-800 gap-1">
                <CheckCircle2 className="h-3 w-3" /> مربوط
              </Badge>
            ) : (
              <Badge variant="secondary">غير مربوط</Badge>
            )}
          </div>
        </div>

        {connected ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleSync} disabled={syncing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'جاري المزامنة...' : 'مزامنة الجلسات الآن'}
            </Button>
            <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting} className="gap-2 text-destructive hover:text-destructive">
              <Unlink className="h-4 w-4" />
              {disconnecting ? 'جاري الفصل...' : 'فصل الربط'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              اربط حسابك في Google لمزامنة جميع جلسات المحكمة المقبلة مع تقويمك الشخصي. كل محامي يربط تقويمه بشكل مستقل.
            </p>
            <Button onClick={handleConnect} disabled={connecting} className="gap-2">
              <Link2 className="h-4 w-4" />
              {connecting ? 'جاري الربط...' : 'ربط Google Calendar'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GoogleCalendarSection;
