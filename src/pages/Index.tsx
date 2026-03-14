import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import {
  Scale,
  Calculator,
  Search,
  Brain,
  BookOpen,
  Shield,
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  FileText,
  TrendingUp,
  Menu,
  X,
  ChevronDown,
  Sparkles,
  Eye,
  Quote,
  Zap,
  Target,
  Users,
  Globe,
  Gavel,
  Landmark,
  ScrollText,
  Handshake,
  HeartHandshake,
  Siren,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import teamPhoto1 from '@/assets/team-1.png';
import teamPhoto2 from '@/assets/team-2.png';

/* ═══════════════════════════════════════════
   NAVBAR
═══════════════════════════════════════════ */
const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled 
        ? 'bg-background/90 backdrop-blur-xl border-b border-border shadow-sm' 
        : 'bg-transparent'
    }`}>
      <div className="container mx-auto px-4 flex items-center justify-between h-16 md:h-20">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center">
            <Scale className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">محاماة ذكية</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {[
            { to: '/blog', label: 'المقالات' },
            { to: '/legal-fee-calculator', label: 'الأدوات' },
            { to: '/ai-consultation', label: 'المستشار الذكي' },
          ].map(link => (
            <Link key={link.to} to={link.to}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent">
              {link.label}
            </Link>
          ))}
          <div className="w-px h-6 bg-border mx-2" />
          <Link to="/auth">
            <Button size="sm" className="rounded-full px-5 gap-2">
              ابدأ الآن
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <button className="md:hidden p-2 rounded-lg hover:bg-accent" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border p-5 space-y-2"
        >
          {[
            { to: '/blog', label: 'المقالات القانونية' },
            { to: '/legal-fee-calculator', label: 'حاسبة الرسوم' },
            { to: '/case-tracker', label: 'تتبع القضايا' },
            { to: '/ai-consultation', label: 'المستشار الذكي' },
          ].map(link => (
            <Link key={link.to} to={link.to}
              className="block px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
              onClick={() => setMobileOpen(false)}>
              {link.label}
            </Link>
          ))}
          <Link to="/auth" onClick={() => setMobileOpen(false)}>
            <Button size="sm" className="w-full mt-2 rounded-full">تسجيل الدخول</Button>
          </Link>
        </motion.div>
      )}
    </nav>
  );
};

/* ═══════════════════════════════════════════
   HERO
═══════════════════════════════════════════ */
const HeroSection = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 100]);

  return (
    <section ref={ref} className="relative min-h-[100svh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-legal-navy/[0.03] via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-legal-gold/[0.05] blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <motion.div style={{ opacity, y }} className="container mx-auto px-4 relative z-10 pt-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Badge className="bg-legal-gold/10 text-legal-gold border-legal-gold/20 hover:bg-legal-gold/15 px-4 py-1.5 text-xs font-medium rounded-full">
              <Landmark className="h-3 w-3 ml-1.5" />
              محتوى قانوني مغربي بمعايير عالمية
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7 }}
            className="text-4xl sm:text-5xl md:text-7xl font-bold leading-[1.1] text-foreground"
          >
            افهم القانون
            <br />
            <span className="bg-gradient-to-l from-primary via-legal-gold to-legal-emerald bg-clip-text text-transparent">
              قبل أن يفهمك
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            مقالات معمّقة، تحليلات دقيقة، وأدوات ذكية تضع المعرفة القانونية 
            المغربية في متناول الجميع — بلا تعقيد.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="flex flex-col sm:flex-row gap-3 justify-center items-center"
          >
            <Link to="/ai-consultation">
              <Button size="lg" className="rounded-full px-8 gap-2 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                <Gavel className="h-4 w-4" />
                اطرح سؤالك الآن
              </Button>
            </Link>
            <Link to="/blog">
              <Button size="lg" variant="outline" className="rounded-full px-8 gap-2 text-base border-border/60">
                <BookOpen className="h-4 w-4" />
                تصفّح المقالات
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="flex flex-wrap justify-center gap-6 pt-8 text-xs text-muted-foreground"
          >
            {[
              { icon: ScrollText, text: '+200 مقال متخصص' },
              { icon: Gavel, text: '+5,000 قارئ شهرياً' },
              { icon: Shield, text: 'مراجع رسمية موثّقة' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 opacity-70">
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.text}</span>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <ChevronDown className="h-5 w-5 text-muted-foreground/50" />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
};

/* ═══════════════════════════════════════════ */
const AnimatedSection = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.section ref={ref} initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className={className}>
      {children}
    </motion.section>
  );
};

/* ═══════════════════════════════════════════
   STATS
═══════════════════════════════════════════ */
const StatsStrip = () => (
  <AnimatedSection className="py-12 border-y border-border/40 bg-muted/30">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
        {[
          { value: '200+', label: 'مقال منشور', icon: ScrollText },
          { value: '6', label: 'تخصصات قانونية', icon: Gavel },
          { value: '5K+', label: 'قارئ شهرياً', icon: HeartHandshake },
          { value: 'AI', label: 'مستشار ذكي', icon: Landmark },
        ].map((stat, i) => (
          <div key={i} className="text-center space-y-2">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 mx-auto">
              <stat.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  </AnimatedSection>
);

/* ═══════════════════════════════════════════
   DOMAINS
═══════════════════════════════════════════ */
const legalDomains = [
  { icon: HeartHandshake, title: 'قانون الأسرة', description: 'الزواج، الطلاق، الحضانة، النفقة، والإرث وفق مدونة الأسرة', color: 'from-blue-500/10 to-blue-600/5', iconColor: 'text-blue-600', articles: 45 },
  { icon: Siren, title: 'القانون الجنائي', description: 'الجرائم والعقوبات، حقوق المتهم، الإجراءات القضائية', color: 'from-red-500/10 to-red-600/5', iconColor: 'text-red-600', articles: 38 },
  { icon: ScrollText, title: 'القانون المدني', description: 'العقود، الالتزامات، المسؤولية المدنية، والتعويضات', color: 'from-emerald-500/10 to-emerald-600/5', iconColor: 'text-emerald-600', articles: 52 },
  { icon: Handshake, title: 'قانون الأعمال', description: 'تأسيس الشركات، النزاعات التجارية، والملكية الفكرية', color: 'from-amber-500/10 to-amber-600/5', iconColor: 'text-amber-600', articles: 31 },
  { icon: Landmark, title: 'القانون العقاري', description: 'الملكية، التحفيظ العقاري، وعقود البيع والشراء', color: 'from-violet-500/10 to-violet-600/5', iconColor: 'text-violet-600', articles: 28 },
  { icon: Globe, title: 'القانون الإداري', description: 'الصفقات العمومية، المنازعات الإدارية، وحقوق الموظف', color: 'from-cyan-500/10 to-cyan-600/5', iconColor: 'text-cyan-600', articles: 22 },
];

const DomainsSection = () => (
  <AnimatedSection className="py-20 md:py-28">
    <div className="container mx-auto px-4">
      <div className="text-center mb-14 space-y-4">
        <Badge variant="outline" className="rounded-full px-4 py-1 text-xs">المواضيع</Badge>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          نكتب في كل ما يهمّك قانونياً
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          محتوى مُحدّث باستمرار يغطي أهم فروع القانون المغربي بأسلوب واضح ومباشر
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {legalDomains.map((domain, i) => (
          <motion.div key={i} whileHover={{ y: -4, scale: 1.01 }} transition={{ type: 'spring', stiffness: 300 }}>
            <Link to="/blog" className="block h-full">
              <div className={`relative h-full rounded-2xl border border-border/50 bg-gradient-to-br ${domain.color} p-6 md:p-7 hover:border-border transition-all group overflow-hidden`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-l from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`h-11 w-11 rounded-xl bg-background/80 border border-border/50 flex items-center justify-center ${domain.iconColor}`}>
                      <domain.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs text-muted-foreground bg-background/60 px-2.5 py-1 rounded-full">{domain.articles} مقال</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-base mb-1.5">{domain.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{domain.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>تصفّح المقالات</span>
                    <ArrowLeft className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  </AnimatedSection>
);

/* ═══════════════════════════════════════════
   TOOLS
═══════════════════════════════════════════ */
const smartTools = [
  { icon: Brain, title: 'المستشار الذكي', description: 'اطرح سؤالك واحصل على إجابة فورية مدعومة بالذكاء الاصطناعي مع مراجع قانونية', link: '/ai-consultation', badge: 'ذكي', gradient: 'from-primary to-blue-600' },
  { icon: Scale, title: 'حاسبة الرسوم', description: 'احسب تكلفة الإجراءات القضائية بدقة حسب نوع القضية والمحكمة', link: '/legal-fee-calculator', badge: 'مجاني', gradient: 'from-legal-emerald to-emerald-600' },
  { icon: Gavel, title: 'تتبع القضايا', description: 'تابع مراحل قضيتك واعرف آخر المستجدات بسهولة', link: '/case-tracker', badge: 'مباشر', gradient: 'from-legal-gold to-amber-600' },
];

const ToolsSection = () => (
  <AnimatedSection className="py-20 md:py-28 bg-muted/30">
    <div className="container mx-auto px-4">
      <div className="text-center mb-14 space-y-4">
        <Badge variant="outline" className="rounded-full px-4 py-1 text-xs">
          <Zap className="h-3 w-3 ml-1" /> أدوات مجانية
        </Badge>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          لا تبحث في الفراغ
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          أدوات عملية صُمّمت لتبسيط كل ما هو معقد في الإجراءات القانونية
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {smartTools.map((tool, i) => (
          <motion.div key={i} whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300 }}>
            <Link to={tool.link} className="block h-full">
              <div className="relative h-full rounded-2xl border border-border/50 bg-card p-6 md:p-7 hover:shadow-xl hover:shadow-primary/[0.04] transition-all group overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-l ${tool.gradient} opacity-60`} />
                <div className="space-y-5">
                  <div className="flex items-start justify-between">
                    <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center text-primary-foreground`}>
                      <tool.icon className="h-6 w-6" />
                    </div>
                    <Badge className="bg-foreground/5 text-foreground border-0 text-[10px] rounded-full">{tool.badge}</Badge>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg mb-2">{tool.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{tool.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-primary font-medium pt-2 group-hover:gap-3 transition-all">
                    <span>جرّب الآن</span>
                    <ArrowLeft className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  </AnimatedSection>
);

/* ═══════════════════════════════════════════
   TEAM FACES
═══════════════════════════════════════════ */
const TeamSection = () => (
  <AnimatedSection className="py-20 md:py-28">
    <div className="container mx-auto px-4">
      <div className="text-center mb-14 space-y-4">
        <Badge variant="outline" className="rounded-full px-4 py-1 text-xs">من نحن</Badge>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground">
          الوجوه وراء <span className="text-primary">المحتوى</span>
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          فريق شغوف بتبسيط القانون وجعله في متناول الجميع
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center justify-center max-w-4xl mx-auto">
        {[
          { img: teamPhoto1, name: 'المؤسّس', role: 'كاتب المحتوى القانوني' },
          { img: teamPhoto2, name: 'الشريك', role: 'المستشار والمراجع' },
        ].map((member, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className="group text-center space-y-5"
          >
            <div className="relative mx-auto w-52 h-52 md:w-64 md:h-64">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 via-legal-gold/20 to-legal-emerald/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative w-full h-full rounded-3xl overflow-hidden border-2 border-border/20 shadow-2xl shadow-foreground/[0.06] group-hover:border-primary/20 transition-all duration-500">
                <img src={member.img} alt={member.name}
                  className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 via-transparent to-transparent" />
              </div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-card border border-border/30 rounded-full px-4 py-1.5 shadow-lg">
                <span className="text-[11px] font-semibold text-primary">{member.role}</span>
              </div>
            </div>
            <div className="pt-2">
              <h3 className="text-lg font-bold text-foreground">{member.name}</h3>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </AnimatedSection>
);

/* ═══════════════════════════════════════════
   FAMOUS QUOTES CAROUSEL
═══════════════════════════════════════════ */
const famousQuotes = [
  {
    text: 'الظلم في أي مكان يهدد العدالة في كل مكان.',
    author: 'مارتن لوثر كينغ',
    role: 'ناشط حقوقي أمريكي',
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Martin_Luther_King%2C_Jr..jpg/220px-Martin_Luther_King%2C_Jr..jpg',
  },
  {
    text: 'القانون يجب أن يكون كالموت الذي لا يستثني أحداً.',
    author: 'مونتسكيو',
    role: 'فيلسوف وفقيه قانوني فرنسي',
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Montesquieu_1.png/220px-Montesquieu_1.png',
  },
  {
    text: 'حيثما يوجد حق يوجد واجب، وحيثما يوجد واجب يوجد حق.',
    author: 'المهاتما غاندي',
    role: 'محامٍ وزعيم حركة الاستقلال الهندية',
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Mahatma-Gandhi%2C_studio%2C_1931.jpg/220px-Mahatma-Gandhi%2C_studio%2C_1931.jpg',
  },
  {
    text: 'العدل أساس المُلك.',
    author: 'عمر بن الخطاب',
    role: 'ثاني الخلفاء الراشدين',
    img: '',
  },
  {
    text: 'لا حرية بدون قانون، ولا قانون بدون حرية.',
    author: 'جون لوك',
    role: 'فيلسوف إنجليزي، أبو الليبرالية',
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/JohnLocke.png/220px-JohnLocke.png',
  },
  {
    text: 'الحرية لا تُعطى بل تُؤخذ.',
    author: 'جمال عبد الناصر',
    role: 'رئيس مصر الأسبق',
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Nasser_portrait2.jpg/220px-Nasser_portrait2.jpg',
  },
  {
    text: 'القانون الذي لا يتساوى أمامه الجميع ليس قانوناً.',
    author: 'نيلسون مانديلا',
    role: 'رئيس جنوب أفريقيا ومناضل ضد التمييز',
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Nelson_Mandela_1994.jpg/220px-Nelson_Mandela_1994.jpg',
  },
  {
    text: 'إن أردت السلام فاعمل من أجل العدالة.',
    author: 'البابا بولس السادس',
    role: 'رئيس الكنيسة الكاثوليكية',
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Paolovi.jpg/220px-Paolovi.jpg',
  },
];

const QuotesCarousel = () => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActive(prev => (prev + 1) % famousQuotes.length), 6000);
    return () => clearInterval(timer);
  }, []);

  const q = famousQuotes[active];

  return (
    <AnimatedSection className="py-20 md:py-28 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10 space-y-3">
          <Badge variant="outline" className="rounded-full px-4 py-1 text-xs gap-1.5">
            <Landmark className="h-3 w-3" /> أقوال خالدة
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            كلمات صنعت <span className="text-primary">العدالة</span>
          </h2>
          <p className="text-muted-foreground text-sm">أقوال مأثورة لأعظم المدافعين عن الحقوق والحريات عبر التاريخ</p>
        </div>

        <div className="max-w-3xl mx-auto relative min-h-[280px] flex items-center">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-6 w-full"
          >
            <Quote className="h-10 w-10 text-legal-gold/30 mx-auto" />
            <blockquote className="text-xl md:text-2xl lg:text-3xl text-foreground leading-relaxed font-semibold px-4">
              «{q.text}»
            </blockquote>
            <div className="flex items-center justify-center gap-3 pt-2">
              {q.img ? (
                <img src={q.img} alt={q.author}
                  className="h-12 w-12 rounded-full object-cover border-2 border-primary/20 shadow-md bg-muted" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-md">
                  {q.author.charAt(0)}
                </div>
              )}
              <div className="text-start">
                <div className="text-sm font-bold text-foreground">{q.author}</div>
                <div className="text-xs text-muted-foreground">{q.role}</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <button onClick={() => setActive((active - 1 + famousQuotes.length) % famousQuotes.length)}
            className="h-9 w-9 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-all hover:bg-accent">
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="flex gap-1.5">
            {famousQuotes.map((_, i) => (
              <button key={i} onClick={() => setActive(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === active ? 'w-6 bg-primary' : 'w-2 bg-border hover:bg-muted-foreground/30'
                }`} />
            ))}
          </div>
          <button onClick={() => setActive((active + 1) % famousQuotes.length)}
            className="h-9 w-9 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-all hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
    </AnimatedSection>
  );
};

/* ═══════════════════════════════════════════
   WHY US
═══════════════════════════════════════════ */
const TrustSection = () => (
  <AnimatedSection className="py-20 md:py-28">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
        <div className="space-y-6">
          <Badge variant="outline" className="rounded-full px-4 py-1 text-xs">لماذا محاماة ذكية</Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
            محتوى مختلف عن أي موقع 
            <span className="text-primary"> قانوني آخر</span>
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            لا نكتب لنملأ صفحات. كل مقال هو إجابة حقيقية لسؤال حقيقي 
            يطرحه الناس كل يوم.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Target, title: 'دقة المعلومات', description: 'كل مقال مبني على نصوص قانونية رسمية واجتهادات قضائية محدّثة' },
            { icon: Shield, title: 'حماية الحقوق', description: 'نساعدك على معرفة حقوقك وكيفية الدفاع عنها بطريقة قانونية سليمة' },
            { icon: Eye, title: 'شفافية المصادر', description: 'نذكر دائماً المراجع والمصادر حتى تتحقق بنفسك من كل معلومة' },
            { icon: Handshake, title: 'أسلوب واضح', description: 'نكتب بلغة بسيطة ومباشرة بعيداً عن التعقيد والمصطلحات المبهمة' },
          ].map((reason, i) => (
            <motion.div key={i} whileHover={{ scale: 1.02 }}
              className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <reason.icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-bold text-foreground text-sm">{reason.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{reason.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </AnimatedSection>
);

/* ═══════════════════════════════════════════
   CTA + NEWSLETTER
═══════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════
   FOOTER
═══════════════════════════════════════════ */
const Footer = () => (
  <footer className="border-t border-border bg-muted/20">
    <div className="container mx-auto px-4 py-12 md:py-16">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center">
              <Scale className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">محاماة ذكية</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            مدوّنة قانونية مغربية تهدف لتبسيط المعرفة القانونية 
            وجعلها في متناول الجميع.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-2">
            <MapPin className="h-3.5 w-3.5" />
            <span>الدار البيضاء، المغرب</span>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-foreground text-sm">استكشف</h4>
          <div className="space-y-2.5">
            {[
              { to: '/blog', label: 'المقالات' },
              { to: '/legal-fee-calculator', label: 'حاسبة الرسوم' },
              { to: '/case-tracker', label: 'تتبع القضايا' },
              { to: '/ai-consultation', label: 'المستشار الذكي' },
            ].map(link => (
              <Link key={link.to} to={link.to} className="block text-sm text-muted-foreground hover:text-foreground transition-colors">{link.label}</Link>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-foreground text-sm">تواصل</h4>
          <div className="space-y-2.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /><span>+212 5XX-XXXXXX</span></div>
            <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /><span>contact@example.com</span></div>
          </div>
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} محاماة ذكية. جميع الحقوق محفوظة.</p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="hover:text-foreground cursor-pointer transition-colors">سياسة الخصوصية</span>
          <span className="hover:text-foreground cursor-pointer transition-colors">الشروط والأحكام</span>
        </div>
      </div>
    </div>
  </footer>
);

/* ═══════════════════════════════════════════ */
const Index = () => (
  <>
    <Helmet>
      <title>محاماة ذكية - محتوى قانوني مغربي بمعايير عالمية</title>
      <meta name="description" content="مقالات قانونية معمّقة، أدوات ذكية، واستشارات مدعومة بالذكاء الاصطناعي لفهم القانون المغربي بوضوح." />
    </Helmet>
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <StatsStrip />
        <DomainsSection />
        <ToolsSection />
        <TeamSection />
        <QuotesCarousel />
        <TrustSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  </>
);

export default Index;
