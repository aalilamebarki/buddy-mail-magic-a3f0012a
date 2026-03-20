import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { RefreshCw, CheckCircle2, Unlink } from 'lucide-react';

const GoogleCalendarIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M36 8H12a4 4 0 0 0-4 4v24a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4V12a4 4 0 0 0-4-4Z" fill="#fff"/>
    <path d="M36 8H12a4 4 0 0 0-4 4v4h32v-4a4 4 0 0 0-4-4Z" fill="#4285F4"/>
    <rect x="16" y="5" width="3" height="8" rx="1.5" fill="#1A73E8"/>
    <rect x="29" y="5" width="3" height="8" rx="1.5" fill="#1A73E8"/>
    <rect x="13" y="22" width="6" height="5" rx="1" fill="#EA4335"/>
    <rect x="21" y="22" width="6" height="5" rx="1" fill="#FBBC04"/>
    <rect x="29" y="22" width="6" height="5" rx="1" fill="#34A853"/>
    <rect x="13" y="30" width="6" height="5" rx="1" fill="#4285F4"/>
    <rect x="21" y="30" width="6" height="5" rx="1" fill="#EA4335"/>
    <rect x="29" y="30" width="6" height="5" rx="1" fill="#FBBC04"/>
  </svg>
);

const CALLBACK_STATUS_PARAM = 'googleCalendar';

const GoogleCalendarQuickAction = () => {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [open, setOpen] = useState(false);

  const checkConnection = async () => {
    if (!user) {
      setConnected(false);
      setLoading(false);
      return false;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('google_calendar_tokens')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const isConnected = !error && !!data;
    setConnected(isConnected);
    setLoading(false);
    return isConnected;
  };

  useEffect(() => {
    if (user) {
      void checkConnection();
    }

    const url = new URL(window.location.href);
    const callbackStatus = url.searchParams.get(CALLBACK_STATUS_PARAM);

    if (callbackStatus === 'connected') {
      void checkConnection().then(() => {
        setConnected(true);
        setConnecting(false);
        setOpen(false);
        toast.success('تم ربط Google Calendar بنجاح!');
      });

      url.searchParams.delete(CALLBACK_STATUS_PARAM);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    if (callbackStatus === 'error') {
      setConnecting(false);
      toast.error('تعذر إكمال ربط Google Calendar');
      url.searchParams.delete(CALLBACK_STATUS_PARAM);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'google-calendar-connected') {
        await checkConnection();
        setConnected(true);
        setConnecting(false);
        setOpen(false);
        toast.success('تم ربط Google Calendar بنجاح!');
      }

      if (event.data?.type === 'google-calendar-error') {
        setConnecting(false);
        toast.error('تعذر إكمال ربط Google Calendar');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('يجب تسجيل الدخول أولاً');
        setConnecting(false);
        return;
      }

      const redirectTo = `${window.location.origin}/dashboard/court-sessions`;
      const res = await supabase.functions.invoke('google-calendar-auth', {
        body: { redirectTo },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error || !res.data?.url) {
        toast.error('فشل في بدء عملية الربط');
        setConnecting(false);
        return;
      }

      const authWindow = window.open(res.data.url, '_blank');

      if (!authWindow) {
        setConnecting(false);
        toast.error('تعذر فتح صفحة Google. اسمح بفتح النوافذ المنبثقة ثم أعد المحاولة');
        return;
      }

      const pollInterval = window.setInterval(async () => {
        if (authWindow.closed) {
          window.clearInterval(pollInterval);
          setConnecting(false);
          await checkConnection();
        }
      }, 1200);
    } catch {
      toast.error('حدث خطأ غير متوقع');
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('يجب تسجيل الدخول');
        setSyncing(false);
        return;
      }

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
                size="sm"
                className={cn(
                  'relative gap-2 px-2.5 sm:px-3 h-9',
                  connected
                    ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20 hover:bg-green-50 dark:hover:bg-green-950/30'
                    : 'hover:border-primary/30'
                )}
              >
                <GoogleCalendarIcon className="h-5 w-5 shrink-0" />
                <span className="text-[11px] sm:text-xs font-semibold leading-tight">
                  {connected ? 'التقويم مربوط' : 'ربط التقويم'}
                </span>
                {connected && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background animate-pulse" />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {connected ? 'Google Calendar مربوط ✓' : 'ربط مع Google Calendar'}
          </TooltipContent>
        </Tooltip>

        <PopoverContent className="w-72 p-0" align="end">
          <div className="p-3 border-b border-border flex items-center gap-2">
            <GoogleCalendarIcon className="h-5 w-5" />
            <span className="text-sm font-semibold flex-1">Google Calendar</span>
            {connected ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px] gap-1 px-1.5">
                <CheckCircle2 className="h-3 w-3" /> مربوط
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] px-1.5">غير مربوط</Badge>
            )}
          </div>

          <div className="p-3 space-y-2">
            {connected ? (
              <>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  مزامنة جلسات المحكمة تلقائياً مع تقويمك
                </p>
                <Button
                  size="sm"
                  className="w-full gap-1.5 h-8"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'جاري المزامنة...' : 'مزامنة الآن'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-7"
                  onClick={handleDisconnect}
                >
                  <Unlink className="h-3 w-3" />
                  فصل الربط
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  سيتم فتح Google في تبويب مستقل ثم العودة تلقائياً بعد نجاح الربط
                </p>
                <Button
                  size="sm"
                  className="w-full gap-2 h-9 bg-[#4285F4] hover:bg-[#3367D6] text-white"
                  onClick={handleConnect}
                  disabled={connecting}
                >
                  <GoogleCalendarIcon className="h-4 w-4" />
                  {connecting ? 'جاري فتح Google...' : 'متابعة ربط Google Calendar'}
                </Button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default GoogleCalendarQuickAction;
