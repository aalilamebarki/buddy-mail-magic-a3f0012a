import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Scale,
  Calculator,
  Search,
  Brain,
  BookOpen,
  Users,
  Shield,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  Star,
  FileText,
  Gavel,
  TrendingUp,
  Menu,
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2">
          <Scale className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold text-foreground">محاماة ذكية</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">المدونة</Link>
          <Link to="/legal-fee-calculator" className="text-sm text-muted-foreground hover:text-foreground transition-colors">حاسبة الرسوم</Link>
          <Link to="/case-tracker" className="text-sm text-muted-foreground hover:text-foreground transition-colors">تتبع القضايا</Link>
          <Link to="/ai-consultation" className="text-sm text-muted-foreground hover:text-foreground transition-colors">استشارة ذكية</Link>
          <Link to="/auth">
            <Button size="sm">تسجيل الدخول</Button>
          </Link>
        </div>

        <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background p-4 space-y-3">
          <Link to="/blog" className="block text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>المدونة</Link>
          <Link to="/legal-fee-calculator" className="block text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>حاسبة الرسوم</Link>
          <Link to="/case-tracker" className="block text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>تتبع القضايا</Link>
          <Link to="/ai-consultation" className="block text-sm text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>استشارة ذكية</Link>
          <Link to="/auth" onClick={() => setMobileOpen(false)}>
            <Button size="sm" className="w-full">تسجيل الدخول</Button>
          </Link>
        </div>
      )}
    </nav>
  );
};

const HeroSection = () => (
  <section className="relative overflow-hidden py-20 md:py-32">
    <div className="absolute inset-0 bg-gradient-to-bl from-primary/10 via-background to-background" />
    <div className="container mx-auto px-4 relative z-10">
      <div className="max-w-3xl mx-auto text-center space-y-6">
        <Badge variant="secondary" className="text-sm px-4 py-1">
          🇲🇦 نظام إدارة مكتب محاماة مغربي
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold leading-tight text-foreground">
          أدِر مكتبك القانوني
          <span className="text-primary"> بذكاء</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          نظام متكامل لإدارة القضايا، الموكلين، المالية، والمقالات القانونية. مصمم خصيصاً للمحاماة المغربية.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/auth">
            <Button size="lg" className="gap-2 w-full sm:w-auto">
              ابدأ مجاناً
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/blog">
            <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
              <BookOpen className="h-4 w-4" />
              تصفح المقالات
            </Button>
          </Link>
        </div>
      </div>
    </div>
  </section>
);

const features = [
  { icon: Gavel, title: 'إدارة القضايا', description: 'تتبع جميع القضايا بمراحلها المختلفة مع تنبيهات الجلسات' },
  { icon: Users, title: 'إدارة الموكلين', description: 'قاعدة بيانات شاملة للموكلين مع سجل كامل للتعاملات' },
  { icon: TrendingUp, title: 'الإدارة المالية', description: 'تتبع المداخيل والمصاريف وإنشاء الفواتير تلقائياً' },
  { icon: FileText, title: 'المقالات القانونية', description: 'نشر وإدارة المقالات مع محرر نصوص متقدم ودعم SEO' },
  { icon: Calculator, title: 'حاسبة الرسوم', description: 'حساب الرسوم القضائية حسب نوع القضية والمحكمة' },
  { icon: Brain, title: 'استشارة ذكية', description: 'مساعد قانوني بالذكاء الاصطناعي للإجابة على الأسئلة القانونية' },
];

const FeaturesSection = () => (
  <section className="py-20 bg-muted/50">
    <div className="container mx-auto px-4">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-foreground mb-4">كل ما يحتاجه مكتبك في مكان واحد</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">أدوات متكاملة لتبسيط عملك اليومي وزيادة إنتاجيتك</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, i) => (
          <Card key={i} className="hover:shadow-lg transition-shadow border-border/50">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </section>
);

const tools = [
  { icon: Calculator, title: 'حاسبة الرسوم القضائية', description: 'احسب الرسوم حسب نوع القضية', link: '/legal-fee-calculator' },
  { icon: Search, title: 'تتبع القضايا', description: 'تتبع حالة قضيتك بسهولة', link: '/case-tracker' },
  { icon: Brain, title: 'الاستشارة الذكية', description: 'اطرح سؤالك القانوني', link: '/ai-consultation' },
];

const PublicToolsSection = () => (
  <section className="py-20">
    <div className="container mx-auto px-4">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-foreground mb-4">أدوات مجانية للجميع</h2>
        <p className="text-muted-foreground">استخدم هذه الأدوات مجاناً بدون تسجيل</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {tools.map((tool, i) => (
          <Link to={tool.link} key={i}>
            <Card className="hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer h-full border-border/50">
              <CardContent className="pt-6 text-center space-y-3">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <tool.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{tool.title}</h3>
                <p className="text-sm text-muted-foreground">{tool.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  </section>
);

const NewsletterSection = () => {
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
    <section className="py-20 bg-primary/5">
      <div className="container mx-auto px-4">
        <div className="max-w-xl mx-auto text-center space-y-6">
          <Mail className="h-10 w-10 text-primary mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">اشترك في نشرتنا البريدية</h2>
          <p className="text-muted-foreground">احصل على آخر المقالات والتحديثات القانونية</p>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              type="email"
              placeholder="بريدك الإلكتروني"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              required
            />
            <Button type="submit" disabled={submitting}>
              {submitting ? 'جاري...' : 'اشترك'}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

const Footer = () => (
  <footer className="py-12 bg-foreground text-background">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Scale className="h-6 w-6" />
            <span className="text-lg font-bold">محاماة ذكية</span>
          </div>
          <p className="text-sm opacity-70">نظام متكامل لإدارة مكاتب المحاماة المغربية</p>
        </div>
        <div className="space-y-3">
          <h4 className="font-semibold">روابط سريعة</h4>
          <div className="space-y-2 text-sm opacity-70">
            <Link to="/blog" className="block hover:opacity-100">المدونة</Link>
            <Link to="/legal-fee-calculator" className="block hover:opacity-100">حاسبة الرسوم</Link>
            <Link to="/case-tracker" className="block hover:opacity-100">تتبع القضايا</Link>
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="font-semibold">تواصل معنا</h4>
          <div className="space-y-2 text-sm opacity-70">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> +212 5XX-XXXXXX</div>
            <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> info@example.com</div>
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> الدار البيضاء، المغرب</div>
          </div>
        </div>
      </div>
      <div className="mt-8 pt-8 border-t border-background/20 text-center text-sm opacity-50">
        © {new Date().getFullYear()} محاماة ذكية. جميع الحقوق محفوظة.
      </div>
    </div>
  </footer>
);

const Index = () => {
  return (
    <>
      <Helmet>
        <title>محاماة ذكية - نظام إدارة مكتب المحاماة المغربي</title>
        <meta name="description" content="نظام متكامل لإدارة مكاتب المحاماة المغربية. إدارة القضايا، الموكلين، المالية، والمقالات القانونية." />
      </Helmet>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <HeroSection />
          <FeaturesSection />
          <PublicToolsSection />
          <NewsletterSection />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
