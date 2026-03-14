import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Scale, ArrowRight, Mail, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (error) {
      toast.error('حدث خطأ: ' + error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <>
      <Helmet>
        <title>نسيت كلمة المرور - محاماة ذكية</title>
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
            {sent ? (
              <CardContent className="pt-8 pb-8 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-foreground">تم إرسال رابط إعادة التعيين</h2>
                <p className="text-sm text-muted-foreground">
                  تحقق من بريدك الإلكتروني <strong dir="ltr">{email}</strong> واتبع الرابط لإعادة تعيين كلمة المرور.
                </p>
                <p className="text-xs text-muted-foreground">لم تستلم الرسالة؟ تحقق من مجلد البريد غير المرغوب فيه.</p>
                <Link to="/auth">
                  <Button variant="outline" className="gap-2 mt-2">
                    <ArrowRight className="h-4 w-4" />
                    العودة لتسجيل الدخول
                  </Button>
                </Link>
              </CardContent>
            ) : (
              <>
                <CardHeader className="text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>نسيت كلمة المرور؟</CardTitle>
                  <CardDescription>أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">البريد الإلكتروني</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="example@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        dir="ltr"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'جاري الإرسال...' : 'إرسال رابط إعادة التعيين'}
                    </Button>
                    <div className="text-center">
                      <Link to="/auth" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        العودة لتسجيل الدخول
                      </Link>
                    </div>
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

export default ForgotPassword;
