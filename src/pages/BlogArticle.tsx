import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence, useScroll, useTransform, useInView } from 'framer-motion';
import {
  Scale, Calendar, ArrowRight, Clock, Tag, Share2, BookOpen, ArrowLeft,
  Menu, X, ChevronUp, Facebook, MessageCircle, Copy, Printer, Mail,
  Gavel, AlertTriangle, Lightbulb, FileText, User, Send,
  Hash, ChevronDown, Eye, Shield, Download,
  Bookmark, BadgeCheck, ChevronLeft, Quote,
  Sparkles, BookMarked, Library, CircleCheck, Zap, Award, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CommentsSection from '@/components/article/CommentsSection';

/* ═══════════════════════════════════════════
   TYPES & ANIMATION PRESETS
═══════════════════════════════════════════ */
interface TocItem { id: string; text: string; level: number; }

const revealUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

/* ═══════════════════════════════════════════
   EXECUTIVE SUMMARY
═══════════════════════════════════════════ */
const ExecutiveSummary = ({ points }: { points: string[] }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? 'show' : 'hidden'}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
      className="my-10 md:my-14"
    >
      <div className="relative rounded-[20px] overflow-hidden">
        {/* Gradient border effect */}
        <div className="absolute inset-0 rounded-[20px] p-[1px] bg-gradient-to-br from-legal-gold/40 via-legal-gold/10 to-legal-emerald/30">
          <div className="w-full h-full rounded-[19px] bg-card" />
        </div>
        <div className="relative">
          <div className="px-6 sm:px-8 py-5 flex items-center gap-3 border-b border-border/30">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-legal-gold to-legal-amber flex items-center justify-center shadow-lg shadow-legal-gold/25">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-[15px]">خلاصة المقال</h3>
              <p className="text-[11px] text-muted-foreground">ما ستتعلمه في هذا المقال</p>
            </div>
          </div>
          <div className="px-6 sm:px-8 py-6 space-y-4">
            {points.map((p, i) => (
              <motion.div key={i} variants={revealUp} className="flex items-start gap-4 group">
                <div className="relative mt-1">
                  <div className="w-7 h-7 rounded-full bg-legal-gold/10 group-hover:bg-legal-gold/20 flex items-center justify-center transition-colors duration-300">
                    <span className="text-[11px] font-bold text-legal-gold">{i + 1}</span>
                  </div>
                </div>
                <p className="text-[15px] text-foreground/80 leading-[1.9] group-hover:text-foreground transition-colors duration-300">{p}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════
   LEGAL ARTICLE HIGHLIGHT
═══════════════════════════════════════════ */
const LegalArticleHighlight = ({ articleNumber, lawName, content }: { articleNumber: string; lawName: string; content: string }) => {
  const copyCitation = () => {
    navigator.clipboard.writeText(`${articleNumber} من ${lawName}: ${content}`);
    toast.success('تم نسخ الاستشهاد');
  };
  return (
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={revealUp} className="my-10 md:my-14 relative group/hl">
      <div className="absolute -inset-[1px] rounded-[20px] bg-gradient-to-br from-legal-navy/50 via-legal-gold/30 to-legal-navy/50 opacity-60 group-hover/hl:opacity-100 transition-opacity duration-700" />
      <div className="relative rounded-[20px] bg-card overflow-hidden">
        <div className="h-[3px] bg-gradient-to-l from-legal-navy via-legal-gold to-legal-navy" />
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-legal-navy to-legal-navy/80 flex items-center justify-center shadow-xl shadow-legal-navy/20 group-hover/hl:shadow-legal-navy/30 transition-shadow">
                <Gavel className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{lawName}</p>
                <p className="text-base font-bold text-legal-navy">{articleNumber}</p>
              </div>
            </div>
            <button onClick={copyCitation}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary-foreground hover:bg-legal-navy px-3 py-2 rounded-xl border border-border/40 hover:border-legal-navy transition-all duration-300">
              <Copy className="h-3 w-3" /> نسخ
            </button>
          </div>
          <div className="relative rounded-xl bg-gradient-to-br from-legal-navy/[0.03] to-legal-gold/[0.02] p-5 sm:p-7 border border-legal-navy/[0.06]">
            <div className="absolute top-3 right-4 opacity-[0.04]">
              <BookMarked className="w-14 h-14 text-legal-navy" />
            </div>
            <blockquote className="text-foreground/85 leading-[2.2] text-[15px] sm:text-[16px] font-legal relative z-10">
              «{content}»
            </blockquote>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════
   LEGAL ALERT CARDS
═══════════════════════════════════════════ */
const LegalAlert = ({ type, title, children }: { type: 'caution' | 'judicial' | 'caselaw'; title?: string; children: React.ReactNode }) => {
  const config = {
    caution: {
      icon: AlertTriangle, label: title || 'تنبيه قانوني',
      bg: 'bg-gradient-to-l from-destructive/[0.06] to-destructive/[0.02]',
      border: 'border-destructive/20',
      iconBg: 'from-destructive to-destructive/80',
      accent: 'text-destructive', dot: 'bg-destructive',
    },
    judicial: {
      icon: Lightbulb, label: title || 'ملاحظة قضائية',
      bg: 'bg-gradient-to-l from-legal-emerald/[0.06] to-legal-emerald/[0.02]',
      border: 'border-legal-emerald/20',
      iconBg: 'from-legal-emerald to-legal-emerald/80',
      accent: 'text-legal-emerald', dot: 'bg-legal-emerald',
    },
    caselaw: {
      icon: Scale, label: title || 'اجتهاد قضائي',
      bg: 'bg-gradient-to-l from-legal-amber/[0.06] to-legal-amber/[0.02]',
      border: 'border-legal-amber/20',
      iconBg: 'from-legal-amber to-legal-amber/80',
      accent: 'text-legal-amber', dot: 'bg-legal-amber',
    },
  };
  const c = config[type];
  const Icon = c.icon;
  return (
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={revealUp}
      className={`my-10 md:my-14 rounded-[20px] border ${c.border} ${c.bg} overflow-hidden`}>
      <div className="px-6 py-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.iconBg} flex items-center justify-center shadow-lg`}>
          <Icon className="h-4.5 w-4.5 text-primary-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${c.dot} animate-pulse`} />
          <span className={`text-sm font-bold ${c.accent}`}>{c.label}</span>
        </div>
      </div>
      <div className="px-6 pb-6 text-foreground/80 text-[15px] leading-[2.1]">{children}</div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════
   EXPERT OPINION
═══════════════════════════════════════════ */
const ExpertOpinion = ({ quote, expert, role }: { quote: string; expert: string; role: string }) => (
  <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={revealUp} className="my-12 md:my-16 relative">
    <div className="absolute -top-5 right-8 z-10">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-legal-gold to-legal-amber flex items-center justify-center shadow-xl shadow-legal-gold/30 ring-4 ring-background rotate-3">
        <Quote className="h-6 w-6 text-primary-foreground" />
      </div>
    </div>
    <div className="rounded-[20px] border border-border/30 bg-card p-7 sm:p-9 pt-12 shadow-xl shadow-foreground/[0.03] relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-40 h-40 bg-legal-gold/[0.03] rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
      <p className="text-foreground/80 text-lg sm:text-xl leading-[2.2] font-legal mb-8 relative z-10">«{quote}»</p>
      <div className="flex items-center gap-4 border-t border-border/20 pt-5 relative z-10">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-legal-navy/10 to-legal-gold/10 flex items-center justify-center">
          <Award className="h-5 w-5 text-legal-navy" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-foreground">{expert}</p>
            <BadgeCheck className="h-4 w-4 text-legal-emerald" />
          </div>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
      </div>
    </div>
  </motion.div>
);

/* ═══════════════════════════════════════════
   INLINE AI CONSULTATION
═══════════════════════════════════════════ */
const InlineAIConsultation = ({ category }: { category: string }) => {
  const [question, setQuestion] = useState('');
  return (
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={revealUp} className="my-12 md:my-16">
      <div className="relative rounded-[20px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-legal-navy via-primary to-legal-navy" />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '20px 20px',
        }} />
        <div className="relative p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-5">
            <motion.div
              animate={{ boxShadow: ['0 0 0 0 rgba(255,255,255,0)', '0 0 0 10px rgba(255,255,255,0.1)', '0 0 0 0 rgba(255,255,255,0)'] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="w-12 h-12 rounded-2xl bg-primary-foreground/15 border border-primary-foreground/20 flex items-center justify-center backdrop-blur-sm"
            >
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </motion.div>
            <div>
              <h3 className="font-bold text-primary-foreground text-[15px]">هل لديك سؤال حول {category}؟</h3>
              <p className="text-[11px] text-primary-foreground/60">احصل على إجابة فورية من المستشار الذكي</p>
            </div>
          </div>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="مثال: ما هي شروط الطلاق الاتفاقي حسب مدونة الأسرة؟"
            className="w-full min-h-[90px] rounded-2xl bg-primary-foreground/10 border border-primary-foreground/15 px-5 py-4 text-sm text-primary-foreground placeholder:text-primary-foreground/35 focus:outline-none focus:ring-2 focus:ring-primary-foreground/20 resize-none transition-all backdrop-blur-sm"
            dir="rtl"
          />
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 text-[11px] text-primary-foreground/50">
              <Zap className="h-3 w-3" />
              <span>مدعوم بالذكاء الاصطناعي</span>
            </div>
            <Link to={`/ai-consultation${question ? `?q=${encodeURIComponent(question)}` : ''}`}>
              <Button size="sm" className="gap-2 rounded-xl bg-primary-foreground text-primary hover:bg-primary-foreground/90 h-10 px-6 font-semibold shadow-lg">
                <Send className="h-3.5 w-3.5" /> أرسل سؤالك
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════
   DOCUMENT GALLERY
═══════════════════════════════════════════ */
const DocumentGallery = () => {
  const docs = [
    { name: 'ظهير شريف رقم 1.04.22', type: 'PDF', size: '2.4 MB', color: 'from-destructive/10 to-destructive/5', iconColor: 'text-destructive', border: 'border-destructive/15 hover:border-destructive/30' },
    { name: 'مدونة الأسرة — النص الكامل', type: 'PDF', size: '5.1 MB', color: 'from-legal-navy/10 to-legal-navy/5', iconColor: 'text-legal-navy', border: 'border-legal-navy/15 hover:border-legal-navy/30' },
    { name: 'نموذج عقد الزواج الرسمي', type: 'DOCX', size: '340 KB', color: 'from-primary/10 to-primary/5', iconColor: 'text-primary', border: 'border-primary/15 hover:border-primary/30' },
    { name: 'قرار محكمة النقض عدد 2847', type: 'PDF', size: '1.2 MB', color: 'from-legal-gold/10 to-legal-gold/5', iconColor: 'text-legal-gold', border: 'border-legal-gold/15 hover:border-legal-gold/30' },
  ];
  return (
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      className="my-12 md:my-16"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-legal-burgundy/10 flex items-center justify-center">
          <Library className="h-5 w-5 text-legal-burgundy" />
        </div>
        <div>
          <h3 className="text-[15px] font-bold text-foreground">مستندات ومرفقات</h3>
          <p className="text-[11px] text-muted-foreground">وثائق رسمية قابلة للتحميل</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {docs.map((doc, i) => (
          <motion.div key={i} variants={revealUp}
            whileHover={{ y: -3 }}
            className={`flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-l ${doc.color} border ${doc.border} transition-all duration-300 cursor-pointer group`}
          >
            <div className={`w-11 h-11 rounded-xl bg-card flex items-center justify-center border border-border/20 ${doc.iconColor} group-hover:scale-110 transition-transform shadow-sm`}>
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground truncate">{doc.name}</p>
              <p className="text-[11px] text-muted-foreground">{doc.type} • {doc.size}</p>
            </div>
            <Download className={`h-4 w-4 ${doc.iconColor} opacity-30 group-hover:opacity-100 transition-opacity`} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════
   FOOTNOTES
═══════════════════════════════════════════ */
const FootnotesSection = () => {
  const notes = [
    { id: 1, text: 'ظهير شريف رقم 1.04.22 صادر في 12 من ذي الحجة 1424 (3 فبراير 2004) بتنفيذ القانون رقم 70.03 بمثابة مدونة الأسرة.' },
    { id: 2, text: 'قرار محكمة النقض عدد 2847 الصادر بتاريخ 14/06/2019 في الملف الشرعي عدد 2018/1/2/547.' },
    { id: 3, text: 'دليل المساطر القضائية في مادة الأحوال الشخصية، منشورات وزارة العدل، الطبعة الثالثة 2022.' },
  ];
  return (
    <div className="my-12 md:my-16 p-6 sm:p-8 rounded-[20px] bg-muted/20 border border-border/20">
      <div className="flex items-center gap-2 mb-5">
        <Hash className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-bold text-foreground">الهوامش والمراجع</h3>
      </div>
      <div className="space-y-3">
        {notes.map(fn => (
          <div key={fn.id} className="flex gap-3 group">
            <span className="text-[10px] font-bold text-legal-navy bg-legal-navy/8 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5">{fn.id}</span>
            <p className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground/70 transition-colors">{fn.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   AUTHOR BIO CARD
═══════════════════════════════════════════ */
const AuthorBioCard = () => (
  <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={revealUp} className="mt-16">
    <div className="relative rounded-[20px] overflow-hidden">
      <div className="absolute inset-0 rounded-[20px] p-[1px] bg-gradient-to-br from-legal-navy/30 via-legal-gold/20 to-legal-emerald/30">
        <div className="w-full h-full rounded-[19px] bg-card" />
      </div>
      <div className="relative">
        <div className="h-[3px] bg-gradient-to-l from-legal-navy via-legal-gold to-legal-emerald" />
        <div className="p-7 sm:p-9">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <motion.div whileHover={{ rotate: 3, scale: 1.05 }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-legal-navy/10 to-legal-gold/10 flex items-center justify-center shrink-0 shadow-lg shadow-legal-navy/10">
              <Scale className="h-9 w-9 text-legal-navy" />
            </motion.div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-foreground font-display">فريق محاماة ذكية</h3>
                <Badge className="bg-legal-emerald/10 text-legal-emerald border-legal-emerald/20 text-[10px] px-2 py-0.5 gap-1 rounded-lg">
                  <BadgeCheck className="h-3 w-3" /> خبراء معتمدون
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                فريق من المحامين والمستشارين القانونيين المتخصصين في القانون المغربي، يقدمون محتوى قانونياً موثوقاً ومحدثاً.
              </p>
              <div className="flex items-center gap-2 pt-2 flex-wrap">
                <Link to="/ai-consultation">
                  <Button size="sm" className="gap-1.5 text-xs rounded-xl h-9 shadow-md">
                    <MessageCircle className="h-3.5 w-3.5" /> اسأل الخبير
                  </Button>
                </Link>
                <Link to="/blog">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs rounded-xl h-9">
                    <BookOpen className="h-3.5 w-3.5" /> جميع المقالات
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

/* ═══════════════════════════════════════════
   DISCLAIMER
═══════════════════════════════════════════ */
const LegalDisclaimer = () => (
  <div className="mt-12 p-6 rounded-[20px] bg-muted/15 border border-border/20">
    <div className="flex items-center gap-2 mb-3">
      <Shield className="h-4 w-4 text-muted-foreground" />
      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">إخلاء المسؤولية</h4>
    </div>
    <p className="text-xs text-muted-foreground/80 leading-relaxed">
      هذا المقال لأغراض تعليمية وإعلامية فقط ولا يُعد بديلاً عن الاستشارة القانونية المتخصصة. القوانين قد تتغير، ويُنصح بالرجوع إلى محامٍ مرخص. © {new Date().getFullYear()} محاماة ذكية.
    </p>
  </div>
);

/* ═══════════════════════════════════════════
   NEWSLETTER
═══════════════════════════════════════════ */
const NewsletterCTA = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const handleSub = async () => {
    if (!email) return;
    setSubmitting(true);
    const { error } = await supabase.from('newsletter_subscribers').insert({ email });
    if (!error) { toast.success('تم الاشتراك بنجاح!'); setEmail(''); }
    else if (error.code === '23505') toast.info('أنت مشترك بالفعل');
    else toast.error('حدث خطأ');
    setSubmitting(false);
  };
  return (
    <section className="py-16 sm:py-20 border-t border-border/10 print:hidden">
      <div className="container mx-auto px-4">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={revealUp} className="max-w-lg mx-auto text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center mx-auto shadow-xl shadow-legal-navy/20">
            <Mail className="h-6 w-6 text-primary-foreground" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground font-display">النشرة القانونية</h2>
          <p className="text-muted-foreground text-sm">تحليلات وتحديثات أسبوعية مباشرة في بريدك</p>
          <div className="flex gap-2 max-w-sm mx-auto">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="بريدك الإلكتروني"
              className="flex-1 h-12 rounded-xl border border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              dir="ltr"
            />
            <Button onClick={handleSub} disabled={submitting} className="h-12 rounded-xl px-6 shadow-md">
              {submitting ? '...' : 'اشتراك'}
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════
   ██  MAIN BLOG ARTICLE PAGE
═══════════════════════════════════════════════════════════ */
const BlogArticle = () => {
  const { slug } = useParams();
  const [article, setArticle] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeHeading, setActiveHeading] = useState('');
  const [tocOpen, setTocOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);

  const { scrollYProgress } = useScroll();
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 600);
      const headings = document.querySelectorAll('#article-body h2, #article-body h3');
      let current = '';
      headings.forEach(h => {
        if (h.getBoundingClientRect().top <= 130) current = h.id;
      });
      if (current) setActiveHeading(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!slug) return;
      const { data } = await supabase.from('articles').select('*').eq('slug', slug).eq('status', 'published').single();
      if (data) {
        setArticle(data);
        const { data: rel } = await supabase.from('articles')
          .select('id, title, slug, excerpt, cover_image, category, reading_time, created_at')
          .eq('status', 'published').eq('category', data.category || 'عام').neq('slug', slug).limit(3);
        if (rel) setRelated(rel);
      }
      setLoading(false);
    };
    fetchArticle();
    window.scrollTo(0, 0);
  }, [slug]);

  const toc = useMemo<TocItem[]>(() => {
    if (!article?.content) return [];
    const regex = /<h([23])[^>]*>(.*?)<\/h\1>/gi;
    const items: TocItem[] = []; let match; let idx = 0;
    while ((match = regex.exec(article.content)) !== null) {
      items.push({ id: `heading-${idx}`, text: match[2].replace(/<[^>]+>/g, ''), level: parseInt(match[1]) });
      idx++;
    }
    return items;
  }, [article?.content]);

  const processedContent = useMemo(() => {
    if (!article?.content) return '';
    let idx = 0;
    return article.content.replace(/<h([23])([^>]*)>/gi, (_: string, level: string, attrs: string) => {
      return `<h${level}${attrs} id="heading-${idx++}">`;
    });
  }, [article?.content]);

  const shareArticle = useCallback((platform?: string) => {
    const url = window.location.href;
    const title = article?.title || '';
    if (platform === 'facebook') window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    else if (platform === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`, '_blank');
    else if (platform === 'twitter') window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank');
    else if (platform === 'copy') { navigator.clipboard.writeText(url); toast.success('تم نسخ الرابط'); }
    else if (navigator.share) navigator.share({ title, url });
    else { navigator.clipboard.writeText(url); toast.success('تم نسخ الرابط'); }
  }, [article?.title]);

  const scrollToHeading = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  /* LOADING */
  if (loading) return (
    <div className="min-h-screen bg-background">
      <motion.div className="h-[3px] bg-gradient-to-l from-legal-gold to-legal-navy fixed top-0 left-0 right-0 z-[60]">
        <motion.div className="h-full bg-legal-navy" animate={{ width: ['0%', '60%', '30%', '80%'] }} transition={{ duration: 2, repeat: Infinity }} />
      </motion.div>
      <div className="container mx-auto px-4 pt-28 max-w-3xl space-y-6">
        <div className="h-5 bg-muted rounded-lg animate-pulse w-1/3" />
        <div className="h-12 bg-muted rounded-xl animate-pulse w-4/5" />
        <div className="h-8 bg-muted rounded-lg animate-pulse w-2/3" />
        <div className="aspect-[2/1] bg-muted rounded-2xl animate-pulse" />
        {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-muted/70 rounded animate-pulse" style={{ width: `${70 + Math.random() * 30}%` }} />)}
      </div>
    </div>
  );

  /* NOT FOUND */
  if (!article) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-legal-navy/10 to-legal-gold/10 flex items-center justify-center">
        <BookOpen className="h-12 w-12 text-legal-navy" />
      </div>
      <h1 className="text-2xl font-bold text-foreground font-display">المقال غير موجود</h1>
      <Link to="/blog"><Button className="gap-2 rounded-xl"><ArrowRight className="h-4 w-4" /> العودة للمدونة</Button></Link>
    </div>
  );

  /* SCHEMAS */
  const articleSchema = {
    '@context': 'https://schema.org', '@type': article.schema_type || 'Article',
    headline: article.seo_title || article.title,
    description: article.seo_description || article.excerpt,
    image: article.cover_image,
    datePublished: article.published_at || article.created_at,
    dateModified: article.updated_at,
    author: { '@type': 'Organization', name: 'محاماة ذكية', url: window.location.origin },
    publisher: { '@type': 'Organization', name: 'محاماة ذكية', url: window.location.origin },
    mainEntityOfPage: { '@type': 'WebPage', '@id': window.location.href },
    inLanguage: 'ar',
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: window.location.origin },
      { '@type': 'ListItem', position: 2, name: 'المدونة', item: `${window.location.origin}/blog` },
      { '@type': 'ListItem', position: 3, name: article.category || 'عام' },
      { '@type': 'ListItem', position: 4, name: article.title },
    ],
  };

  const formattedDate = new Date(article.created_at).toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' });
  const wordCount = article.content?.replace(/<[^>]+>/g, '').split(/\s+/).length || 0;

  return (
    <>
      <Helmet>
        <title>{article.seo_title || article.title} | محاماة ذكية</title>
        <meta name="description" content={article.seo_description || article.excerpt} />
        <link rel="canonical" href={`${window.location.origin}/blog/${slug}`} />
        <meta property="og:title" content={article.seo_title || article.title} />
        <meta property="og:description" content={article.seo_description || article.excerpt} />
        <meta property="og:image" content={article.cover_image} />
        <meta property="og:type" content="article" />
        <meta property="og:locale" content="ar_MA" />
        <meta property="article:published_time" content={article.published_at || article.created_at} />
        <meta property="article:modified_time" content={article.updated_at} />
        {article.tags?.map((tag: string) => <meta key={tag} property="article:tag" content={tag} />)}
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>

      {/* ═══ READING PROGRESS BAR ═══ */}
      <motion.div className="fixed top-0 left-0 right-0 z-[70] h-[3px] bg-border/10">
        <motion.div className="h-full bg-gradient-to-l from-legal-gold via-primary to-legal-emerald" style={{ width: progressWidth }} />
      </motion.div>

      <div className={`min-h-screen bg-background transition-all duration-500 ${focusMode ? 'focus-reading' : ''}`}>

        {/* ═══ STICKY HEADER ═══ */}
        <header className="sticky top-0 z-50 print:hidden">
          <nav className="bg-background/80 backdrop-blur-2xl border-b border-border/15">
            <div className="container mx-auto px-4 flex items-center justify-between h-14">
              <Link to="/" className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center">
                  <Scale className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-sm font-bold text-foreground hidden sm:block font-display">محاماة ذكية</span>
              </Link>

              <div className="hidden md:flex items-center gap-1">
                <Link to="/blog"><Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8 rounded-lg text-muted-foreground"><ArrowRight className="h-3 w-3" /> المدونة</Button></Link>
                <Link to="/ai-consultation"><Button variant="ghost" size="sm" className="text-xs h-8 rounded-lg text-muted-foreground">المستشار الذكي</Button></Link>
                <div className="w-px h-5 bg-border/30 mx-1" />
                {[
                  { icon: Printer, tip: 'طباعة', action: () => window.print() },
                  { icon: Download, tip: 'PDF', action: () => window.print() },
                  { icon: Bookmark, tip: 'حفظ', action: () => toast.success('تمت الإضافة للمفضلة') },
                  { icon: Eye, tip: focusMode ? 'إيقاف التركيز' : 'وضع التركيز', action: () => setFocusMode(!focusMode) },
                  { icon: Share2, tip: 'مشاركة', action: () => shareArticle() },
                ].map((btn, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={btn.action}
                        className={`h-8 w-8 text-muted-foreground hover:text-foreground ${
                          btn.icon === Eye && focusMode ? 'text-primary bg-primary/10' : ''
                        }`}>
                        <btn.icon className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{btn.tip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>

              <button className="md:hidden p-2 rounded-lg hover:bg-accent" onClick={() => setMobileNav(!mobileNav)}>
                {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </nav>

          <AnimatePresence>
            {mobileNav && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="md:hidden bg-background border-b border-border/20 overflow-hidden">
                <div className="p-4 space-y-2">
                  <Link to="/blog" className="flex items-center gap-2 p-3 rounded-xl hover:bg-accent text-sm" onClick={() => setMobileNav(false)}>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" /> المدونة
                  </Link>
                  <Link to="/ai-consultation" className="flex items-center gap-2 p-3 rounded-xl hover:bg-accent text-sm" onClick={() => setMobileNav(false)}>
                    <Sparkles className="h-4 w-4 text-muted-foreground" /> المستشار الذكي
                  </Link>
                  <div className="grid grid-cols-5 gap-2 pt-3 border-t border-border/20">
                    {[
                      { icon: Printer, action: () => window.print() },
                      { icon: Download, action: () => window.print() },
                      { icon: Bookmark, action: () => toast.success('تمت الإضافة') },
                      { icon: Eye, action: () => setFocusMode(!focusMode) },
                      { icon: Share2, action: () => shareArticle() },
                    ].map((b, i) => (
                      <Button key={i} variant="outline" size="sm" onClick={b.action} className="h-10 rounded-xl"><b.icon className="h-4 w-4" /></Button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* ═══ ARTICLE HERO ═══ */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }} />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/[0.03] rounded-full -translate-y-1/2 translate-x-1/3 blur-[100px]" />

          <div className="relative container mx-auto px-4 pt-8 sm:pt-12 pb-2">
            <div className="max-w-4xl mx-auto">
              {/* Breadcrumbs */}
              <motion.nav initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-8" aria-label="breadcrumb">
                <Link to="/" className="hover:text-foreground transition-colors flex items-center gap-1">
                  <Scale className="h-3 w-3" /> الرئيسية
                </Link>
                <ChevronLeft className="h-3 w-3 rotate-180" />
                <Link to="/blog" className="hover:text-foreground transition-colors">المدونة</Link>
                <ChevronLeft className="h-3 w-3 rotate-180" />
                <span className="text-primary font-medium">{article.category || 'عام'}</span>
              </motion.nav>

              {/* Category Badge */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="flex items-center gap-2 mb-6 flex-wrap">
                <Badge className="bg-primary/10 text-primary border-primary/15 text-[11px] px-3.5 py-1.5 rounded-full font-semibold gap-1.5">
                  <Gavel className="h-3 w-3" /> {article.category || 'عام'}
                </Badge>
                {article.updated_at !== article.created_at && (
                  <Badge variant="outline" className="text-[10px] px-2.5 py-1 rounded-full border-legal-emerald/25 text-legal-emerald gap-1">
                    <TrendingUp className="h-3 w-3" /> تم التحديث
                  </Badge>
                )}
              </motion.div>

              {/* Title */}
              <motion.h1
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="text-[1.7rem] sm:text-[2.2rem] md:text-[2.8rem] lg:text-[3.2rem] font-bold text-foreground leading-[1.3] mb-6 font-display"
              >
                {article.title}
              </motion.h1>

              {/* Excerpt */}
              {article.excerpt && (
                <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                  className="text-base sm:text-lg text-muted-foreground leading-[1.8] mb-8 max-w-3xl">
                  {article.excerpt}
                </motion.p>
              )}

              {/* Author + Meta */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 pb-8 border-b border-border/15">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-legal-navy/10 to-legal-gold/10 flex items-center justify-center ring-2 ring-background shadow-lg">
                    <User className="h-5 w-5 text-legal-navy" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground">فريق محاماة ذكية</span>
                      <BadgeCheck className="h-3.5 w-3.5 text-legal-emerald" />
                    </div>
                    <span className="text-[11px] text-muted-foreground">خبراء قانونيون معتمدون</span>
                  </div>
                </div>

                <div className="hidden sm:block w-px h-8 bg-border/20" />

                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { icon: Calendar, text: formattedDate },
                    { icon: Clock, text: `${article.reading_time || 5} د قراءة` },
                    { icon: FileText, text: `${wordCount.toLocaleString('ar-MA')} كلمة` },
                  ].map((meta, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full">
                      <meta.icon className="h-3 w-3" /> {meta.text}
                    </span>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Cover Image */}
          {article.cover_image && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.7 }}
              className="container mx-auto px-4 mt-8 sm:mt-10">
              <figure className="max-w-4xl mx-auto">
                <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-foreground/[0.06] group">
                  <img src={article.cover_image} alt={article.title}
                    className="w-full aspect-[16/9] sm:aspect-[2.2/1] object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    loading="eager" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-foreground/[0.04] rounded-2xl sm:rounded-3xl" />
                  <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-foreground/10 to-transparent" />
                </div>
              </figure>
            </motion.div>
          )}
        </section>

        {/* ═══ MAIN CONTENT AREA ═══ */}
        <div className="container mx-auto px-4 py-10 sm:py-14 md:py-16">
          <div className={`max-w-6xl mx-auto flex gap-12 transition-all duration-500 ${focusMode ? 'max-w-3xl' : ''}`}>

            {/* SIDEBAR TOC */}
            {toc.length > 0 && !focusMode && (
              <aside className="hidden lg:block w-72 shrink-0 print:hidden">
                <div className="sticky top-20">
                  <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
                    className="rounded-2xl border border-border/20 bg-card overflow-hidden shadow-lg shadow-foreground/[0.02]">
                    <button onClick={() => setTocOpen(!tocOpen)}
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                          <Hash className="h-3 w-3 text-primary" />
                        </div>
                        فهرس المقال
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${tocOpen ? '' : '-rotate-90'}`} />
                    </button>

                    <AnimatePresence>
                      {tocOpen && (
                        <motion.nav initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                          <div className="px-4 pb-4 space-y-0.5 max-h-[55vh] overflow-y-auto border-t border-border/10">
                            <div className="my-3 mx-1">
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <motion.div className="h-full bg-gradient-to-l from-legal-gold to-primary rounded-full" style={{ width: progressWidth }} />
                              </div>
                            </div>
                            {toc.map(item => (
                              <button key={item.id} onClick={() => scrollToHeading(item.id)}
                                className={`w-full text-right px-3 py-2.5 rounded-xl text-[13px] transition-all leading-relaxed ${
                                  item.level === 3 ? 'pr-7 text-[12px]' : ''
                                } ${
                                  activeHeading === item.id
                                    ? 'bg-primary/8 text-primary font-semibold border-r-2 border-primary'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                                }`}>
                                {item.text}
                              </button>
                            ))}
                          </div>
                        </motion.nav>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Tags */}
                  {article.tags?.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-border/20 bg-card p-4">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Tag className="h-3.5 w-3.5 text-legal-gold" />
                        <span className="text-xs font-semibold text-foreground">الوسوم</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {article.tags.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-[10px] hover:bg-primary/5 hover:border-primary/20 hover:text-primary transition-all cursor-pointer rounded-lg px-2.5 py-1">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            )}

            {/* ARTICLE BODY */}
            <article className="flex-1 min-w-0">
              {article.excerpt && (
                <ExecutiveSummary points={[
                  article.excerpt,
                  `التصنيف: ${article.category || 'القانون المغربي'}`,
                  `وقت القراءة: ${article.reading_time || 5} دقائق`,
                ]} />
              )}

              <div id="article-body"
                className="legal-article-content
                  prose prose-lg max-w-none dark:prose-invert
                  prose-headings:text-foreground prose-headings:font-bold prose-headings:font-display prose-headings:leading-[1.4]
                  prose-h2:text-[1.35rem] sm:prose-h2:text-[1.55rem] md:prose-h2:text-[1.75rem] prose-h2:mt-14 prose-h2:mb-6
                  prose-h3:text-[1.15rem] sm:prose-h3:text-[1.25rem] md:prose-h3:text-[1.35rem] prose-h3:mt-10 prose-h3:mb-4
                  prose-p:text-foreground/75 prose-p:leading-[2.15] prose-p:text-[15px] sm:prose-p:text-[16px] md:prose-p:text-[17px] prose-p:mb-6
                  prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-img:rounded-2xl prose-img:shadow-xl prose-img:my-8 sm:prose-img:my-10
                  prose-blockquote:border-r-[3px] prose-blockquote:border-legal-gold prose-blockquote:bg-legal-gold/[0.04]
                  prose-blockquote:rounded-2xl prose-blockquote:py-5 prose-blockquote:px-6 sm:prose-blockquote:px-8
                  prose-blockquote:not-italic prose-blockquote:text-foreground/70 prose-blockquote:font-legal
                  prose-blockquote:text-[15px] sm:prose-blockquote:text-[16px] prose-blockquote:leading-[2.1]
                  prose-blockquote:my-8 sm:prose-blockquote:my-10
                  prose-li:text-foreground/75 prose-li:leading-[2.15] prose-li:text-[15px] sm:prose-li:text-[16px]
                  prose-ul:mr-0 prose-ol:mr-0
                  prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm"
                dir="rtl"
                dangerouslySetInnerHTML={{ __html: processedContent }}
              />

              <InlineAIConsultation category={article.category || 'القانون المغربي'} />

              {/* Mobile Tags */}
              {article.tags?.length > 0 && (
                <div className="mt-10 lg:hidden p-5 rounded-2xl bg-muted/15 border border-border/15">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="h-4 w-4 text-legal-gold" />
                    <span className="text-sm font-semibold text-foreground">الوسوم</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {article.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs hover:bg-primary/5 hover:text-primary transition-all cursor-pointer rounded-lg px-3 py-1.5">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <DocumentGallery />
              <FootnotesSection />
              <LegalDisclaimer />

              {/* Share Row */}
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 py-7 border-y border-border/15 print:hidden">
                <span className="text-sm font-medium text-foreground">شارك هذا المقال:</span>
                <div className="flex items-center gap-2.5">
                  {[
                    { p: 'facebook', icon: Facebook, hover: 'hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2]', label: 'فيسبوك' },
                    { p: 'whatsapp', icon: MessageCircle, hover: 'hover:bg-[#25D366] hover:text-white hover:border-[#25D366]', label: 'واتساب' },
                    { p: 'twitter', icon: Share2, hover: 'hover:bg-foreground hover:text-background hover:border-foreground', label: '𝕏' },
                    { p: 'copy', icon: Copy, hover: 'hover:bg-primary hover:text-primary-foreground hover:border-primary', label: 'نسخ' },
                  ].map(s => (
                    <motion.button key={s.p}
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => shareArticle(s.p)}
                      className={`w-11 h-11 rounded-xl border border-border/30 bg-card flex items-center justify-center text-muted-foreground transition-all duration-300 shadow-sm ${s.hover}`}>
                      <s.icon className="h-4 w-4" />
                    </motion.button>
                  ))}
                </div>
              </div>

              <AuthorBioCard />
              <CommentsSection articleId={article.id} />
            </article>
          </div>
        </div>

        {/* ═══ RELATED ARTICLES ═══ */}
        {related.length > 0 && (
          <section className="border-t border-border/10 py-14 sm:py-20 bg-muted/10 print:hidden">
            <div className="container mx-auto px-4">
              <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground font-display">مقالات ذات صلة</h2>
                    <p className="text-xs text-muted-foreground mt-1">تابع القراءة حول {article.category}</p>
                  </div>
                  <Link to="/blog">
                    <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs">الكل <ArrowLeft className="h-3 w-3" /></Button>
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {related.map((r, i) => (
                    <motion.div key={r.id}
                      initial={{ opacity: 0, y: 25 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}>
                      <Link to={`/blog/${r.slug}`} className="group block h-full">
                        <Card className="overflow-hidden border-border/15 hover:shadow-xl hover:border-primary/10 transition-all duration-500 hover:-translate-y-1.5 h-full">
                          <div className="aspect-[16/10] overflow-hidden relative">
                            <img src={r.cover_image || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=250&fit=crop'}
                              alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                            <div className="absolute inset-0 bg-gradient-to-t from-foreground/10 to-transparent" />
                            <Badge className="absolute top-3 right-3 bg-card/80 backdrop-blur-xl text-[9px] px-2.5 py-1 border border-border/15 text-foreground rounded-lg">
                              {r.category || 'عام'}
                            </Badge>
                          </div>
                          <CardContent className="p-5 space-y-3">
                            <h3 className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-relaxed font-display">
                              {r.title}
                            </h3>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(r.created_at).toLocaleDateString('ar-MA')}</span>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.reading_time || 5} د</span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <NewsletterCTA />

        <footer className="py-8 border-t border-border/10 print:hidden">
          <div className="container mx-auto px-4 text-center space-y-3">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center">
                <Scale className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground text-sm font-display">محاماة ذكية</span>
            </div>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <Link to="/blog" className="hover:text-foreground transition-colors">المدونة</Link>
              <Link to="/ai-consultation" className="hover:text-foreground transition-colors">المستشار الذكي</Link>
              <Link to="/legal-fee-calculator" className="hover:text-foreground transition-colors">حاسبة الرسوم</Link>
            </div>
            <p className="text-[11px] text-muted-foreground/50">© {new Date().getFullYear()} محاماة ذكية. جميع الحقوق محفوظة.</p>
          </div>
        </footer>
      </div>

      {/* FLOATING SOCIAL BAR */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 }}
        className="fixed top-1/2 left-4 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-2 print:hidden">
        {[
          { p: 'facebook', icon: Facebook, hover: 'hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2]' },
          { p: 'whatsapp', icon: MessageCircle, hover: 'hover:bg-[#25D366] hover:text-white hover:border-[#25D366]' },
          { p: 'copy', icon: Copy, hover: 'hover:bg-foreground hover:text-background hover:border-foreground' },
        ].map(s => (
          <motion.button key={s.p}
            whileHover={{ scale: 1.15, x: 3 }}
            onClick={() => shareArticle(s.p)}
            className={`w-10 h-10 rounded-xl bg-card border border-border/20 flex items-center justify-center text-muted-foreground transition-all shadow-md ${s.hover}`}>
            <s.icon className="h-4 w-4" />
          </motion.button>
        ))}
      </motion.div>

      {/* SCROLL TO TOP */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 left-6 xl:left-20 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-xl shadow-primary/25 flex items-center justify-center hover:scale-110 transition-transform print:hidden">
            <ChevronUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};

export default BlogArticle;
