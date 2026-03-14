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

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user arrived via recovery link
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');

    if (type === 'recovery') {
      setValidSession(true);
      return;
    }

    // Also check if user already has an active session from recovery
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirm) {
      toast.error('كلمتا المرور غير متطابقتين');
      return;
    }
    if (password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error('حدث خطأ: ' + error.message);
    } else {
      setSuccess(true);
    }
  };

  if (validSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">جاري التحقق...</p>
      </div>
    );
  }

  if (!validSession) {
    return (
      <>
        <Helmet><title>رابط غير صالح - محاماة ذكية</title></Helmet>
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <p className="text-lg font-semibold text-foreground">رابط غير صالح أو منتهي الصلاحية</p>
              <p className="text-sm text-muted-foreground">يرجى طلب رابط إعادة تعيين جديد.</p>
              <Link to="/forgot-password">
                <Button>طلب رابط جديد</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>إعادة تعيين كلمة المرور - محاماة ذكية</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <Link to="/" className="inline-flex items-center gap-2">
              <Scale className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">محاماة ذكية</span>
            </Link>
          </div>

          <Card>
            {success ? (
              <CardContent className="pt-8 pb-8 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-foreground">تم تغيير كلمة المرور بنجاح</h2>
                <p className="text-sm text-muted-foreground">يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.</p>
                <Button onClick={() => navigate('/auth')} className="gap-2">
                  تسجيل الدخول
                </Button>
              </CardContent>
            ) : (
              <>
                <CardHeader className="text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>إعادة تعيين كلمة المرور</CardTitle>
                  <CardDescription>أدخل كلمة المرور الجديدة</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          dir="ltr"
                          minLength={6}
                        />
                        <button
                          type="button"
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        dir="ltr"
                        minLength={6}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                    </Button>
                  </form>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
};

export default ResetPassword;
