import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scale, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');

  useEffect(() => {
    if (!user) return;

    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    navigate(from || '/dashboard', { replace: true });
  }, [user, navigate, location.state]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);

    if (error) {
      toast.error('خطأ في تسجيل الدخول: ' + error.message);
      return;
    }

    toast.success('تم تسجيل الدخول بنجاح');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupConfirm) { toast.error('كلمتا المرور غير متطابقتين'); return; }
    if (signupPassword.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    setLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    setLoading(false);
    if (error) {
      toast.error('خطأ في إنشاء الحساب: ' + error.message);
    } else {
      toast.success('تم إنشاء الحساب بنجاح! تحقق من بريدك الإلكتروني.');
    }
  };

  return (
    <>
      <Helmet><title>تسجيل الدخول - محاماة ذكية</title></Helmet>
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-12" dir="rtl">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-legal-navy/[0.03] via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-legal-gold/[0.04] blur-[80px]" />

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-6 relative z-10">
          <div className="text-center space-y-3">
            <Link to="/" className="inline-flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Scale className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">محاماة ذكية</span>
            </Link>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              معرفة قانونية ذكية
            </p>
          </div>

          <Card className="border-border/20 shadow-2xl shadow-foreground/[0.04] rounded-2xl overflow-hidden">
            <div className="h-[3px] bg-gradient-to-l from-legal-gold via-primary to-legal-emerald" />
            <Tabs defaultValue="login" dir="rtl">
              <CardHeader className="pb-3">
                <TabsList className="grid w-full grid-cols-2 rounded-xl h-11">
                  <TabsTrigger value="login" className="rounded-lg text-sm">تسجيل الدخول</TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-lg text-sm">حساب جديد</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent>
                <TabsContent value="login" className="space-y-4 mt-0">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-xs">البريد الإلكتروني</Label>
                      <Input id="login-email" type="email" placeholder="example@email.com"
                        value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                        required dir="ltr" className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-xs">كلمة المرور</Label>
                      <div className="relative">
                        <Input id="login-password" type={showPassword ? 'text' : 'password'}
                          value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                          required dir="ltr" className="h-11 rounded-xl" />
                        <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-11 rounded-xl font-semibold shadow-md shadow-primary/20" disabled={loading}>
                      {loading ? 'جاري التسجيل...' : 'تسجيل الدخول'}
                    </Button>
                    <div className="text-center">
                      <Link to="/forgot-password" className="text-xs text-primary hover:underline">نسيت كلمة المرور؟</Link>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="space-y-4 mt-0">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-xs">الاسم الكامل</Label>
                      <Input id="signup-name" value={signupName} onChange={(e) => setSignupName(e.target.value)}
                        required className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-xs">البريد الإلكتروني</Label>
                      <Input id="signup-email" type="email" placeholder="example@email.com"
                        value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)}
                        required dir="ltr" className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-xs">كلمة المرور</Label>
                      <Input id="signup-password" type="password" value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required dir="ltr" className="h-11 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm" className="text-xs">تأكيد كلمة المرور</Label>
                      <Input id="signup-confirm" type="password" value={signupConfirm}
                        onChange={(e) => setSignupConfirm(e.target.value)}
                        required dir="ltr" className="h-11 rounded-xl" />
                    </div>
                    <Button type="submit" className="w-full h-11 rounded-xl font-semibold shadow-md shadow-primary/20" disabled={loading}>
                      {loading ? 'جاري الإنشاء...' : 'إنشاء حساب'}
                    </Button>
                  </form>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>

          <div className="text-center">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowRight className="h-3 w-3" /> العودة للرئيسية
            </Link>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default Auth;
