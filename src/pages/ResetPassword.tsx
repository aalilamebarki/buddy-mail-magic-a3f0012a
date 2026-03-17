import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Scale, Eye, EyeOff, CheckCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    if (type === 'recovery') { setValidSession(true); return; }
    supabase.auth.getSession().then(({ data: { session } }) => { setValidSession(!!session); });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error('كلمتا المرور غير متطابقتين'); return; }
    if (password.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error('حدث خطأ: ' + error.message); } else { setSuccess(true); }
  };

  if (validSession === null) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">جاري التحقق...</p>
    </div>
  );

  if (!validSession) return (
    <>
      <Helmet><title>رابط غير صالح - محاماة ذكية</title></Helmet>
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md rounded-2xl border-border/20 shadow-xl">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <p className="text-lg font-bold text-foreground">رابط غير صالح</p>
            <p className="text-sm text-muted-foreground">يرجى طلب رابط جديد.</p>
            <Link to="/forgot-password"><Button className="rounded-xl">طلب رابط جديد</Button></Link>
          </CardContent>
        </Card>
      </div>
    </>
  );

  return (
    <>
      <Helmet><title>إعادة تعيين كلمة المرور - محاماة ذكية</title></Helmet>
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4" dir="rtl">
        <div className="absolute inset-0 bg-gradient-to-br from-legal-navy/[0.03] via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-[120px]" />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-6 relative z-10">
          <div className="text-center">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Scale className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">محاماة ذكية</span>
            </Link>
          </div>

          <Card className="border-border/20 shadow-2xl shadow-foreground/[0.04] rounded-2xl overflow-hidden">
            <div className="h-[3px] bg-gradient-to-l from-legal-gold via-primary to-legal-emerald" />
            {success ? (
              <CardContent className="pt-8 pb-8 text-center space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-legal-emerald/10 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-legal-emerald" />
                </div>
                <h2 className="text-xl font-bold text-foreground">تم تغيير كلمة المرور</h2>
                <p className="text-sm text-muted-foreground">يمكنك تسجيل الدخول بكلمة المرور الجديدة.</p>
                <Button onClick={() => navigate('/auth')} className="gap-2 rounded-xl">تسجيل الدخول</Button>
              </CardContent>
            ) : (
              <>
                <CardHeader className="text-center pb-2">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle>إعادة تعيين كلمة المرور</CardTitle>
                  <CardDescription>أدخل كلمة المرور الجديدة</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password" className="text-xs">كلمة المرور الجديدة</Label>
                      <div className="relative">
                        <Input id="new-password" type={showPassword ? 'text' : 'password'}
                          value={password} onChange={(e) => setPassword(e.target.value)}
                          required dir="ltr" minLength={6} className="h-11 rounded-xl" />
                        <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-xs">تأكيد كلمة المرور</Label>
                      <Input id="confirm-password" type="password" value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required dir="ltr" minLength={6} className="h-11 rounded-xl" />
                    </div>
                    <Button type="submit" className="w-full h-11 rounded-xl font-semibold shadow-md shadow-primary/20" disabled={loading}>
                      {loading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                    </Button>
                  </form>
                </CardContent>
              </>
            )}
          </Card>
        </motion.div>
      </div>
    </>
  );
};

export default ResetPassword;
