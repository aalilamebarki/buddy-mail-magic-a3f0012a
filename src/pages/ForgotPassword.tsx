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
import { motion } from 'framer-motion';

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
    if (error) { toast.error('حدث خطأ: ' + error.message); } else { setSent(true); }
  };

  return (
    <>
      <Helmet><title>نسيت كلمة المرور - محاماة ذكية</title></Helmet>
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
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
            {sent ? (
              <CardContent className="pt-8 pb-8 text-center space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-legal-emerald/10 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-legal-emerald" />
                </div>
                <h2 className="text-xl font-bold text-foreground">تم إرسال الرابط</h2>
                <p className="text-sm text-muted-foreground">
                  تحقق من بريدك <strong dir="ltr">{email}</strong>
                </p>
                <p className="text-xs text-muted-foreground">لم تستلمه؟ تحقق من مجلد البريد غير المرغوب.</p>
                <Link to="/auth">
                  <Button variant="outline" className="gap-2 mt-2 rounded-xl">
                    <ArrowRight className="h-4 w-4" /> العودة لتسجيل الدخول
                  </Button>
                </Link>
              </CardContent>
            ) : (
              <>
                <CardHeader className="text-center pb-2">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Mail className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle>نسيت كلمة المرور؟</CardTitle>
                  <CardDescription>أدخل بريدك وسنرسل لك رابط الاستعادة</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs">البريد الإلكتروني</Label>
                      <Input id="email" type="email" placeholder="example@email.com"
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        required dir="ltr" className="h-11 rounded-xl" />
                    </div>
                    <Button type="submit" className="w-full h-11 rounded-xl font-semibold shadow-md shadow-primary/20" disabled={loading}>
                      {loading ? 'جاري الإرسال...' : 'إرسال رابط الاستعادة'}
                    </Button>
                    <div className="text-center">
                      <Link to="/auth" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" /> العودة لتسجيل الدخول
                      </Link>
                    </div>
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

export default ForgotPassword;
