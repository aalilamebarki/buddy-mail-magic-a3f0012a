import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { CalendarDays, RefreshCw, Link2, CheckCircle2, Unlink } from 'lucide-react';

const GoogleCalendarQuickAction = () => {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user) checkConnection();
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
        setConnecting(false);
        return;
      }

      const popup = window.open(res.data.url, 'google-calendar-auth', 'width=600,height=700');

      const pollInterval = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(pollInterval);
          setConnecting(false);
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

  const handleDisconnect = async () => {
    if (!user) return;
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
  };

  if (loading) return null;

  return (
    <TooltipProvider>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={`relative h-9 w-9 ${connected ? 'border-green-500/50 text-green-600 hover:text-green-700' : ''}`}
              >
                <CalendarDays className="h-4 w-4" />
                {connected && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {connected ? 'Google Calendar مربوط' : 'ربط Google Calendar'}
          </TooltipContent>
        </Tooltip>

        <PopoverContent className="w-64 p-3" align="end">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Google Calendar</span>
              {connected ? (
                <Badge className="bg-green-100 text-green-800 text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3" /> مربوط
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">غير مربوط</Badge>
              )}
            </div>

            {connected ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">مزامنة جلساتك مع تقويم Google</p>
                <Button size="sm" className="w-full gap-1.5" onClick={handleSync} disabled={syncing}>
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'جاري المزامنة...' : 'مزامنة الآن'}
                </Button>
                <Button variant="ghost" size="sm" className="w-full gap-1.5 text-destructive hover:text-destructive text-xs" onClick={handleDisconnect}>
                  <Unlink className="h-3 w-3" />
                  فصل الربط
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">اربط تقويمك لمزامنة جلسات المحكمة تلقائياً</p>
                <Button size="sm" className="w-full gap-1.5" onClick={handleConnect} disabled={connecting}>
                  <Link2 className="h-3.5 w-3.5" />
                  {connecting ? 'جاري الربط...' : 'ربط Google Calendar'}
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
};

export default GoogleCalendarQuickAction;
