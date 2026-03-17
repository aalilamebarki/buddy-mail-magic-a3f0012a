import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import {
  Scale, ArrowLeft, Shield, Target, Eye, BookOpen, Users, Gavel,
  Landmark, ScrollText, Award, Globe, Menu, X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import TeamSection from '@/components/TeamSection';

const AnimatedSection = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.section ref={ref} initial={{ opacity: 0, y: 40 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6 }} className={className}>
      {children}
    </motion.section>
  );
};

const timeline = [
  { year: '2024', title: 'انطلاقة المشروع', desc: 'بدأت فكرة محاماة ذكية كمدونة صغيرة لتبسيط القانون المغربي للمواطنين.', icon: Landmark },
  { year: '2025', title: 'توسّع المحتوى', desc: 'أكثر من 200 مقال قانوني متخصص يغطي كافة فروع القانون المغربي.', icon: BookOpen },
  { year: '2025', title: 'المستشار الذكي', desc: 'إطلاق نظام الاستشارة القانونية بالذكاء الاصطناعي المدعوم بالمراجع الرسمية.', icon: Scale },
  { year: '2026', title: 'المنصة المتكاملة', desc: 'أدوات ذكية، مركز وثائق، ونظام تتبع القضايا في منصة واحدة شاملة.', icon: Globe },
];

const values = [
  { icon: Target, title: 'الدقة', desc: 'كل معلومة مبنية على نصوص قانونية رسمية واجتهادات قضائية محدّثة.' },
  { icon: Shield, title: 'المصداقية', desc: 'نلتزم بالحياد والموضوعية في عرض المعلومات القانونية.' },
  { icon: Eye, title: 'الشفافية', desc: 'نذكر دائماً مصادرنا ومراجعنا لتتحقق بنفسك من كل معلومة.' },
  { icon: Users, title: 'التبسيط', desc: 'نكتب بلغة واضحة ومباشرة بعيداً عن التعقيد والمصطلحات المبهمة.' },
];


const About = () => {
  const [mobileNav, setMobileNav] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <Helmet>
        <title>من نحن - محاماة ذكية | منصة قانونية مغربية رائدة</title>
        <meta name="description" content="تعرّف على فريق محاماة ذكية ورسالتنا في تبسيط القانون المغربي وجعل المعرفة القانونية في متناول الجميع." />
      </Helmet>

      <div className="min-h-screen bg-background" dir="rtl">
        {/* Nav */}
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-background/90 backdrop-blur-xl border-b border-border shadow-sm' : 'bg-transparent'}`}>
          <div className="container mx-auto px-4 flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center">
                <Scale className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground">محاماة ذكية</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              <Link to="/blog" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent">المقالات</Link>
              <Link to="/ai-consultation" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent">المستشار الذكي</Link>
              <ThemeToggle />
              <div className="w-px h-6 bg-border mx-2" />
              <Link to="/auth"><Button size="sm" className="rounded-full px-5 gap-2">ابدأ الآن <ArrowLeft className="h-3.5 w-3.5" /></Button></Link>
            </div>
            <button className="md:hidden p-2 rounded-lg hover:bg-accent" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-legal-navy/[0.04] via-background to-background" />
          <div className="absolute top-20 right-1/4 w-[500px] h-[500px] rounded-full bg-primary/[0.04] blur-[120px]" />
          <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] rounded-full bg-legal-gold/[0.05] blur-[100px]" />
          <div className="container mx-auto px-4 relative z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              className="max-w-3xl mx-auto text-center space-y-6">
              <Badge className="bg-legal-gold/10 text-legal-gold border-legal-gold/20 px-4 py-1.5 text-xs rounded-full">
                <Award className="h-3 w-3 ml-1.5" /> رسالتنا ورؤيتنا
              </Badge>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-[1.15]">
                نبسّط القانون لنضعه في
                <br />
                <span className="bg-gradient-to-l from-primary via-legal-gold to-legal-emerald bg-clip-text text-transparent">متناول الجميع</span>
              </h1>
              <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
                محاماة ذكية منصة قانونية مغربية تهدف لتمكين المواطن من فهم حقوقه والدفاع عنها من خلال محتوى معمّق وأدوات ذكية.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Timeline */}
        <AnimatedSection className="py-20 md:py-28 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14 space-y-3">
              <Badge variant="outline" className="rounded-full px-4 py-1 text-xs">مسيرتنا</Badge>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">رحلة <span className="text-primary">التأسيس</span></h2>
            </div>
            <div className="max-w-3xl mx-auto relative">
              <div className="absolute right-6 md:right-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-primary/30 via-legal-gold/30 to-legal-emerald/30 md:translate-x-1/2" />
              {timeline.map((item, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? 30 : -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className={`relative flex items-start gap-6 mb-12 ${i % 2 === 0 ? 'md:flex-row-reverse md:text-left' : ''}`}
                >
                  <div className="absolute right-[18px] md:right-1/2 md:-translate-x-1/2 w-5 h-5 rounded-full bg-card border-[3px] border-primary shadow-lg shadow-primary/20 z-10" />
                  <div className="mr-14 md:mr-0 md:w-[calc(50%-2rem)] bg-card rounded-2xl border border-border/30 p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <Badge variant="secondary" className="text-[10px] rounded-full">{item.year}</Badge>
                    </div>
                    <h3 className="font-bold text-foreground mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* Values */}
        <AnimatedSection className="py-20 md:py-28">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14 space-y-3">
              <Badge variant="outline" className="rounded-full px-4 py-1 text-xs">قيمنا</Badge>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">مبادئ <span className="text-primary">نلتزم بها</span></h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
              {values.map((v, i) => (
                <motion.div key={i} whileHover={{ y: -4 }}
                  className="rounded-2xl border border-border/30 bg-card p-6 text-center space-y-4 hover:shadow-lg hover:border-primary/15 transition-all">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <v.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground">{v.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{v.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </AnimatedSection>

        {/* Verified Experts / Team */}
        <TeamSection variant="full" />

        {/* CTA */}
        <AnimatedSection className="py-20 md:py-28">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto relative rounded-3xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-legal-navy via-primary to-legal-navy" />
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: '24px 24px' }} />
              <div className="relative p-8 md:p-14 text-center space-y-6">
                <Gavel className="h-10 w-10 text-primary-foreground/80 mx-auto" />
                <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground">ابدأ رحلتك القانونية الآن</h2>
                <p className="text-primary-foreground/70 max-w-lg mx-auto">اكتشف مقالاتنا أو اطرح سؤالك على المستشار الذكي</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link to="/blog"><Button size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-full px-8 gap-2">تصفّح المقالات <ArrowLeft className="h-4 w-4" /></Button></Link>
                  <Link to="/ai-consultation"><Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 rounded-full px-8 gap-2">المستشار الذكي <Scale className="h-4 w-4" /></Button></Link>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Footer */}
        <footer className="border-t border-border/20 py-8">
          <div className="container mx-auto px-4 text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center">
                <Scale className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground text-sm">محاماة ذكية</span>
            </div>
            <p className="text-[11px] text-muted-foreground/50">© {new Date().getFullYear()} محاماة ذكية. جميع الحقوق محفوظة.</p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default About;
