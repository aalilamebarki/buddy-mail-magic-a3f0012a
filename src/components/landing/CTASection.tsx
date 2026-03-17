import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AnimatedSection from './AnimatedSection';

const CTASection = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('newsletter_subscribers').insert({ email });
      if (error) throw error;
      toast.success('تم الاشتراك بنجاح!');
      setEmail('');
    } catch {
      toast.error('حدث خطأ، حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatedSection className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-legal-navy via-primary to-legal-navy" />
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }} />
            <div className="relative p-8 md:p-14 text-center space-y-6">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-foreground/10 border border-primary-foreground/20 mx-auto">
                <Mail className="h-7 w-7 text-primary-foreground" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground">
                لا تفوّت أي تحديث قانوني
              </h2>
              <p className="text-primary-foreground/70 max-w-lg mx-auto text-sm md:text-base">
                نشرة أسبوعية تضم أهم المقالات، تحليلات جديدة، ونصائح عملية
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <Input type="email" placeholder="بريدك الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 rounded-full h-12" required />
                <Button type="submit" disabled={submitting} className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-full h-12 px-8 font-semibold">
                  {submitting ? 'جاري...' : 'اشترك'}
                </Button>
              </form>
              <p className="text-primary-foreground/40 text-xs">بدون إزعاج. إلغاء الاشتراك في أي وقت.</p>
            </div>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
};

export default CTASection;
