import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scale, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);
    if (error) {
      toast.error('خطأ في تسجيل الدخول: ' + error.message);
    } else {
      toast.success('تم تسجيل الدخول بنجاح');
      navigate('/dashboard');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupConfirm) {
      toast.error('كلمتا المرور غير متطابقتين');
      return;
    }
    if (signupPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
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
      <Helmet>
        <title>تسجيل الدخول - محاماة ذكية</title>
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <Link to="/" className="inline-flex items-center gap-2">
              <Scale className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">محاماة ذكية</span>
            </Link>
            <p className="text-muted-foreground">نظام إدارة مكتب المحاماة</p>
          </div>

          <Card>
            <Tabs defaultValue="login" dir="rtl">
              <CardHeader>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
                  <TabsTrigger value="signup">حساب جديد</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent>
                <TabsContent value="login" className="space-y-4 mt-0">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">البريد الإلكتروني</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="example@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">كلمة المرور</Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          dir="ltr"
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
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'جاري التسجيل...' : 'تسجيل الدخول'}
                    </Button>
                    <div className="text-center">
                      <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                        نسيت كلمة المرور؟
                      </Link>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="space-y-4 mt-0">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">الاسم الكامل</Label>
                      <Input
                        id="signup-name"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">البريد الإلكتروني</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="example@email.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">كلمة المرور</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm">تأكيد كلمة المرور</Label>
                      <Input
                        id="signup-confirm"
                        type="password"
                        value={signupConfirm}
                        onChange={(e) => setSignupConfirm(e.target.value)}
                        required
                        dir="ltr"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'جاري الإنشاء...' : 'إنشاء حساب'}
                    </Button>
                  </form>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Auth;
