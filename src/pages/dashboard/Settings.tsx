import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, Globe, Shield, Send, AlertTriangle, CheckCircle2, Settings2 } from 'lucide-react';
import GoogleCalendarSection from '@/components/settings/GoogleCalendarSection';

const SettingsPage = () => {
  const [officeName, setOfficeName] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [officePhone, setOfficePhone] = useState('');
  const [officeEmail, setOfficeEmail] = useState('');
  const [savingOffice, setSavingOffice] = useState(false);

  // Email settings
  const [senderEmail, setSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [emailDomain, setEmailDomain] = useState('');
  const [domainVerified, setDomainVerified] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  // Notification preferences
  const [notifyReset, setNotifyReset] = useState(true);
  const [notifySignup, setNotifySignup] = useState(true);
  const [notifyCase, setNotifyCase] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await (supabase as any)
        .from('site_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (data) {
        setOfficeName(data.office_name || '');
        setOfficeAddress(data.office_address || '');
        setOfficePhone(data.office_phone || '');
        setOfficeEmail(data.office_email || '');
        setSenderEmail(data.sender_email || '');
        setSenderName(data.sender_name || '');
        setEmailDomain(data.email_domain || '');
        setDomainVerified(data.domain_verified || false);
        setNotifyReset(data.notify_reset ?? true);
        setNotifySignup(data.notify_signup ?? true);
        setNotifyCase(data.notify_case ?? true);
      }
    } catch (err) {
      console.log('Settings table not yet created');
    }
  };

  const saveOfficeSettings = async () => {
    setSavingOffice(true);
    try {
      const settings = {
        office_name: officeName,
        office_address: officeAddress,
        office_phone: officePhone,
        office_email: officeEmail,
      };

      const { data: existing } = await (supabase as any)
        .from('site_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        await (supabase as any).from('site_settings').update(settings).eq('id', existing.id);
      } else {
        await (supabase as any).from('site_settings').insert(settings);
      }

      toast.success('تم حفظ إعدادات المكتب');
    } catch {
      toast.error('حدث خطأ في الحفظ');
    }
    setSavingOffice(false);
  };

  const saveEmailSettings = async () => {
    setSavingEmail(true);
    try {
      const settings = {
        sender_email: senderEmail,
        sender_name: senderName,
        email_domain: emailDomain,
        notify_reset: notifyReset,
        notify_signup: notifySignup,
        notify_case: notifyCase,
      };

      const { data: existing } = await (supabase as any)
        .from('site_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        await (supabase as any).from('site_settings').update(settings).eq('id', existing.id);
      } else {
        await (supabase as any).from('site_settings').insert(settings);
      }

      toast.success('تم حفظ إعدادات البريد');
    } catch {
      toast.error('حدث خطأ في الحفظ');
    }
    setSavingEmail(false);
  };

  const sendTestEmail = async () => {
    if (!senderEmail && !officeEmail) {
      toast.error('يرجى إدخال بريد المرسل أولاً');
      return;
    }
    setTestingEmail(true);
    try {
      // Simulate test - in production this would call an edge function
      await new Promise(r => setTimeout(r, 1500));
      toast.info('لإرسال بريد تجريبي، يجب أولاً ربط نطاق بريد مخصص. اذهب إلى إعدادات النطاق أدناه.');
    } catch {
      toast.error('فشل إرسال البريد التجريبي');
    }
    setTestingEmail(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">الإعدادات</h1>
        <p className="text-sm text-muted-foreground">إعدادات المكتب والبريد الإلكتروني</p>
      </div>

      {/* Office Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            معلومات المكتب
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم المكتب</Label>
              <Input placeholder="مكتب المحاماة" value={officeName} onChange={e => setOfficeName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input placeholder="+212..." dir="ltr" value={officePhone} onChange={e => setOfficePhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>العنوان</Label>
            <Input placeholder="العنوان الكامل" value={officeAddress} onChange={e => setOfficeAddress(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>البريد الإلكتروني للمكتب</Label>
            <Input placeholder="email@example.com" dir="ltr" value={officeEmail} onChange={e => setOfficeEmail(e.target.value)} />
          </div>
          <Button onClick={saveOfficeSettings} disabled={savingOffice}>
            {savingOffice ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </CardContent>
      </Card>

      {/* Email Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-muted-foreground" />
            إعدادات البريد الإلكتروني
          </CardTitle>
          <CardDescription>
            تحكم في بريد المرسل الذي ستُرسل منه رسائل التحقق وإعادة التعيين
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sender Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم المرسل</Label>
                <Input
                  placeholder="مكتب محاماة ذكية"
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">الاسم الذي يظهر في صندوق البريد</p>
              </div>
              <div className="space-y-2">
                <Label>بريد المرسل</Label>
                <Input
                  placeholder="noreply@yourdomain.com"
                  dir="ltr"
                  value={senderEmail}
                  onChange={e => setSenderEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">البريد الذي سترسل منه الرسائل</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Domain Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base font-semibold">نطاق البريد</Label>
              </div>
              {domainVerified ? (
                <Badge className="bg-green-100 text-green-800 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> مفعّل
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> غير مربوط
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <Input
                placeholder="yourdomain.com"
                dir="ltr"
                value={emailDomain}
                onChange={e => setEmailDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                أدخل نطاقك هنا. عند ربط النطاق لاحقاً، ستُرسل جميع رسائل التحقق وإعادة التعيين من خلاله.
              </p>
            </div>

            {!domainVerified && emailDomain && (
              <div className="flex items-start gap-2 text-xs bg-amber-50 text-amber-800 rounded-lg p-3 border border-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">النطاق غير مربوط بعد</p>
                  <p>لتفعيل إرسال البريد من نطاقك، تحتاج لربط النطاق أولاً. حالياً يتم الإرسال من البريد الافتراضي للنظام.</p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Notification Preferences */}
          <div className="space-y-4">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              رسائل التنبيه
            </Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">إعادة تعيين كلمة المرور</p>
                  <p className="text-xs text-muted-foreground">إرسال رابط إعادة التعيين عبر البريد</p>
                </div>
                <Switch checked={notifyReset} onCheckedChange={setNotifyReset} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">تأكيد الحساب الجديد</p>
                  <p className="text-xs text-muted-foreground">رسالة تحقق عند إنشاء حساب جديد</p>
                </div>
                <Switch checked={notifySignup} onCheckedChange={setNotifySignup} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">تحديثات القضايا</p>
                  <p className="text-xs text-muted-foreground">إشعار الموكلين بتحديثات قضاياهم</p>
                </div>
                <Switch checked={notifyCase} onCheckedChange={setNotifyCase} />
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={saveEmailSettings} disabled={savingEmail}>
              {savingEmail ? 'جاري الحفظ...' : 'حفظ إعدادات البريد'}
            </Button>
            <Button variant="outline" onClick={sendTestEmail} disabled={testingEmail} className="gap-2">
              <Send className="h-4 w-4" />
              {testingEmail ? 'جاري الإرسال...' : 'إرسال بريد تجريبي'}
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* Google Calendar */}
      <GoogleCalendarSection />
    </div>
  );
};

export default SettingsPage;
