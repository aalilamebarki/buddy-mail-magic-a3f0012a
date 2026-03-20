import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { RefreshCw, Link2, CheckCircle2, Unlink } from 'lucide-react';

const GoogleCalendarIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="40" y="40" width="120" height="120" rx="12" fill="#fff" stroke="#4285F4" strokeWidth="8"/>
    <rect x="40" y="40" width="120" height="36" rx="12" fill="#4285F4"/>
    <circle cx="80" cy="56" r="4" fill="#fff"/>
    <circle cx="120" cy="56" r="4" fill="#fff"/>
    <rect x="72" y="28" width="4" height="24" rx="2" fill="#4285F4"/>
    <rect x="124" y="28" width="4" height="24" rx="2" fill="#4285F4"/>
    <rect x="64" y="92" width="16" height="14" rx="2" fill="#EA4335"/>
    <rect x="92" y="92" width="16" height="14" rx="2" fill="#34A853"/>
    <rect x="120" y="92" width="16" height="14" rx="2" fill="#FBBC04"/>
    <rect x="64" y="118" width="16" height="14" rx="2" fill="#FBBC04"/>
    <rect x="92" y="118" width="16" height="14" rx="2" fill="#4285F4"/>
    <rect x="120" y="118" width="16" height="14" rx="2" fill="#EA4335"/>
  </svg>
);

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
                size="sm"
                className={cn(
                  "relative gap-1.5 px-2 sm:px-3 h-9",
                  connected
                    ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20 hover:bg-green-50 dark:hover:bg-green-950/30'
                    : 'hover:border-primary/30'
                )}
              >
                <GoogleCalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                <span className="hidden sm:inline text-xs font-medium">
                  {connected ? 'مربوط' : 'ربط التقويم'}
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
                  اربط تقويم Google لمزامنة جلساتك تلقائياً والحصول على تنبيهات
                </p>
                <Button
                  size="sm"
                  className="w-full gap-2 h-9 bg-[#4285F4] hover:bg-[#3367D6] text-white"
                  onClick={handleConnect}
                  disabled={connecting}
                >
                  <GoogleCalendarIcon className="h-4 w-4" />
                  {connecting ? 'جاري الربط...' : 'ربط Google Calendar'}
                </Button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
};

// Helper
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default GoogleCalendarQuickAction;
