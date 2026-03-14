import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  Scale, Calendar, ArrowRight, Clock, Tag, Share2, BookOpen, ArrowLeft,
  Menu, X, ChevronUp, Facebook, MessageCircle, Copy, Printer, Mail,
  Gavel, AlertTriangle, Lightbulb, Info, FileText, User,
  Hash, ChevronDown, Twitter, Eye, Shield, Download,
  Bookmark, BadgeCheck, ExternalLink, ChevronLeft, Quote, Scroll
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import CommentsSection from '@/components/article/CommentsSection';

/* ═══════════════════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════════════════ */
interface TocItem { id: string; text: string; level: number; }

/* ═══════════════════════════════════════════════════════
   EXECUTIVE SUMMARY BOX
   ═══════════════════════════════════════════════════════ */
const ExecutiveSummary = ({ points }: { points: string[] }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.3, duration: 0.5 }}
    className="my-8 rounded-2xl border border-legal-gold/30 bg-gradient-to-br from-legal-cream to-background overflow-hidden shadow-sm"
  >
    <div className="bg-legal-gold/10 px-5 py-3 flex items-center gap-2.5 border-b border-legal-gold/20">
      <Scroll className="h-5 w-5 text-legal-gold" />
      <h3 className="font-bold text-sm text-foreground font-legal">ملخص تنفيذي — أهم النقاط</h3>
    </div>
    <ul className="p-5 space-y-3">
      {points.map((p, i) => (
        <li key={i} className="flex items-start gap-3 text-[0.92rem] text-foreground/85 leading-relaxed">
          <span className="mt-1 w-6 h-6 rounded-full bg-legal-gold/15 text-legal-gold flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
          {p}
        </li>
      ))}
    </ul>
  </motion.div>
);

/* ═══════════════════════════════════════════════════════
   LEGAL ARTICLE HIGHLIGHT BOX
   ═══════════════════════════════════════════════════════ */
const LegalArticleHighlight = ({ articleNumber, lawName, content }: { articleNumber: string; lawName: string; content: string }) => {
  const copyCitation = () => {
    navigator.clipboard.writeText(`${articleNumber} من ${lawName}: ${content}`);
    toast.success('تم نسخ الاستشهاد القانوني');
  };
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="my-8 rounded-xl border-r-4 border-legal-navy bg-gradient-to-l from-legal-navy/[0.03] to-transparent overflow-hidden"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-legal-navy/10 flex items-center justify-center">
              <Gavel className="h-4 w-4 text-legal-navy" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{lawName}</p>
              <p className="text-sm font-bold text-legal-navy font-legal">{articleNumber}</p>
            </div>
          </div>
          <button
            onClick={copyCitation}
            className="flex items-center gap-1.5 text-[11px] text-legal-navy/70 hover:text-legal-navy transition-colors px-2.5 py-1.5 rounded-lg hover:bg-legal-navy/5 border border-legal-navy/10"
          >
            <Copy className="h-3 w-3" /> نسخ
          </button>
        </div>
        <blockquote className="text-foreground/85 leading-[1.9] text-[0.95rem] border-r-0 pr-0 mr-0 italic font-legal">
          "{content}"
        </blockquote>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════
   LEGAL ALERT COMPONENTS  
   ═══════════════════════════════════════════════════════ */
const LegalAlert = ({ type, title, children }: { type: 'caution' | 'judicial' | 'caselaw'; title?: string; children: React.ReactNode }) => {
  const config = {
    caution: {
      icon: AlertTriangle, label: title || 'تنبيه قانوني حرج',
      gradient: 'from-legal-burgundy/5 to-transparent',
      border: 'border-legal-burgundy/30', iconColor: 'text-legal-burgundy',
      headerBg: 'bg-legal-burgundy/8', dot: 'bg-legal-burgundy',
    },
    judicial: {
      icon: Lightbulb, label: title || 'ملاحظة قضائية',
      gradient: 'from-legal-emerald/5 to-transparent',
      border: 'border-legal-emerald/30', iconColor: 'text-legal-emerald',
      headerBg: 'bg-legal-emerald/8', dot: 'bg-legal-emerald',
    },
    caselaw: {
      icon: Scale, label: title || 'اجتهاد قضائي',
      gradient: 'from-legal-amber/5 to-transparent',
      border: 'border-legal-amber/30', iconColor: 'text-legal-amber',
      headerBg: 'bg-legal-amber/8', dot: 'bg-legal-amber',
    },
  };
  const c = config[type];
  const Icon = c.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`my-8 rounded-xl border ${c.border} bg-gradient-to-l ${c.gradient} overflow-hidden`}
    >
      <div className={`${c.headerBg} px-5 py-3 flex items-center gap-2.5`}>
        <div className={`w-2 h-2 rounded-full ${c.dot} animate-pulse`} />
        <Icon className={`h-4 w-4 ${c.iconColor}`} />
        <span className={`text-sm font-bold ${c.iconColor} font-legal`}>{c.label}</span>
      </div>
      <div className="p-5 text-foreground/80 text-[0.93rem] leading-[1.95]">{children}</div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════
   EXPERT OPINION CALLOUT
   ═══════════════════════════════════════════════════════ */
const ExpertOpinion = ({ quote, expert, role }: { quote: string; expert: string; role: string }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.98 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    className="my-10 relative"
  >
    <div className="absolute top-0 right-0 w-16 h-16 text-legal-gold/10">
      <Quote className="w-full h-full" />
    </div>
    <div className="bg-card rounded-2xl border border-border/50 p-6 sm:p-8 shadow-sm relative">
      <p className="text-foreground/85 text-base sm:text-lg leading-[2] font-legal italic mb-6">"{quote}"</p>
      <div className="flex items-center gap-3 border-t border-border/40 pt-4">
        <div className="w-10 h-10 rounded-full bg-legal-navy/10 flex items-center justify-center">
          <BadgeCheck className="h-5 w-5 text-legal-navy" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{expert}</p>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
      </div>
    </div>
  </motion.div>
);

/* ═══════════════════════════════════════════════════════
   AUTHOR BIO CARD (Professional)
   ═══════════════════════════════════════════════════════ */
const AuthorBioCard = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="mt-14 rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm"
  >
    <div className="h-2 bg-gradient-to-l from-legal-navy via-legal-gold to-legal-emerald" />
    <div className="p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row items-start gap-5">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-legal-navy/10 to-legal-gold/10 flex items-center justify-center shrink-0">
          <Scale className="h-9 w-9 text-legal-navy" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-foreground font-legal">فريق محاماة ذكية</h3>
            <Badge className="bg-legal-emerald/10 text-legal-emerald border-legal-emerald/20 text-[10px] px-2 py-0 gap-1">
              <BadgeCheck className="h-3 w-3" /> خبراء معتمدون
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            فريق من المحامين والمستشارين القانونيين المتخصصين في القانون المغربي، يقدمون محتوى قانونياً موثوقاً ومحدثاً يستند إلى التشريعات والاجتهادات القضائية.
          </p>
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Link to="/ai-consultation">
              <Button size="sm" className="gap-1.5 text-xs rounded-lg bg-legal-navy hover:bg-legal-navy/90 text-white h-8">
                <MessageCircle className="h-3 w-3" /> اسأل الخبير
              </Button>
            </Link>
            <Link to="/blog">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs rounded-lg h-8">
                <BookOpen className="h-3 w-3" /> جميع المقالات
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
);

/* ═══════════════════════════════════════════════════════
   TERMINOLOGY TOOLTIP
   ═══════════════════════════════════════════════════════ */
const TermTooltip = ({ term, definition }: { term: string; definition: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="border-b border-dotted border-legal-navy/40 text-legal-navy cursor-help hover:border-legal-navy transition-colors">
        {term}
      </span>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-xs text-right leading-relaxed bg-card border-border shadow-xl">
      <p className="text-xs font-semibold text-foreground mb-1">{term}</p>
      <p className="text-[11px] text-muted-foreground">{definition}</p>
    </TooltipContent>
  </Tooltip>
);

/* ═══════════════════════════════════════════════════════
   DOCUMENT GALLERY
   ═══════════════════════════════════════════════════════ */
const DocumentGallery = () => {
  const documents = [
    { name: 'ظهير شريف رقم 1.04.22', type: 'PDF', size: '2.4 MB', icon: '📜' },
    { name: 'مدونة الأسرة — النص الكامل', type: 'PDF', size: '5.1 MB', icon: '📕' },
    { name: 'نموذج عقد الزواج الرسمي', type: 'DOCX', size: '340 KB', icon: '📄' },
    { name: 'قرار محكمة النقض عدد 2847', type: 'PDF', size: '1.2 MB', icon: '⚖️' },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="my-10 rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm"
    >
      <div className="px-5 py-4 bg-muted/20 border-b border-border/30 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-legal-burgundy/10 flex items-center justify-center">
          <FileText className="h-4 w-4 text-legal-burgundy" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground font-legal">مستندات ومرفقات قانونية</h3>
          <p className="text-[10px] text-muted-foreground">ظهائر، نشرات رسمية، ونماذج قابلة للتحميل</p>
        </div>
      </div>
      <div className="divide-y divide-border/20">
        {documents.map((doc, i) => (
          <motion.div
            key={i}
            whileHover={{ backgroundColor: 'hsl(var(--muted) / 0.15)' }}
            className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg">{doc.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate group-hover:text-legal-navy transition-colors">{doc.name}</p>
                <p className="text-[10px] text-muted-foreground">{doc.type} • {doc.size}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-legal-navy hover:bg-legal-navy/5">
              <Download className="h-3.5 w-3.5" />
            </Button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════
   FOOTNOTES SECTION
   ═══════════════════════════════════════════════════════ */
const FootnotesSection = () => {
  const footnotes = [
    { id: 1, text: 'ظهير شريف رقم 1.04.22 صادر في 12 من ذي الحجة 1424 (3 فبراير 2004) بتنفيذ القانون رقم 70.03 بمثابة مدونة الأسرة، الجريدة الرسمية عدد 5184.' },
    { id: 2, text: 'قرار محكمة النقض عدد 2847 الصادر بتاريخ 14/06/2019 في الملف الشرعي عدد 2018/1/2/547.' },
    { id: 3, text: 'دليل المساطر القضائية في مادة الأحوال الشخصية، منشورات وزارة العدل، الطبعة الثالثة 2022.' },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="my-10 rounded-2xl border border-border/40 bg-card overflow-hidden"
    >
      <div className="px-5 py-3.5 bg-muted/20 border-b border-border/30 flex items-center gap-2">
        <Hash className="h-4 w-4 text-legal-slate" />
        <h3 className="text-sm font-bold text-foreground font-legal">الهوامش والمراجع</h3>
      </div>
      <div className="p-5 space-y-3">
        {footnotes.map(fn => (
          <div key={fn.id} className="flex gap-3 text-xs text-muted-foreground leading-relaxed">
            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-foreground/60 shrink-0 mt-0.5">
              {fn.id}
            </span>
            <p>{fn.text}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════
   LEGAL DISCLAIMER
   ═══════════════════════════════════════════════════════ */
const LegalDisclaimer = () => (
  <div className="mt-10 p-5 rounded-xl bg-muted/30 border border-border/40">
    <div className="flex items-center gap-2 mb-3">
      <Shield className="h-4 w-4 text-muted-foreground" />
      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">إخلاء المسؤولية القانونية</h4>
    </div>
    <p className="text-xs text-muted-foreground leading-relaxed">
      هذا المقال لأغراض تعليمية وإعلامية فقط ولا يُعد بديلاً عن الاستشارة القانونية المتخصصة. القوانين والأنظمة قد تتغير، ويُنصح بالرجوع إلى محامٍ مرخص للحصول على مشورة قانونية تتعلق بحالتك الخاصة. جميع الحقوق محفوظة © {new Date().getFullYear()} محاماة ذكية.
    </p>
  </div>
);

/* ═══════════════════════════════════════════════════════
   NEWSLETTER SECTION
   ═══════════════════════════════════════════════════════ */
const NewsletterSection = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const handleSubscribe = async () => {
    if (!email) return;
    setSubmitting(true);
    const { error } = await supabase.from('newsletter_subscribers').insert({ email });
    if (!error) { toast.success('تم الاشتراك بنجاح!'); setEmail(''); }
    else if (error.code === '23505') toast.info('أنت مشترك بالفعل');
    else toast.error('حدث خطأ، حاول مجدداً');
    setSubmitting(false);
  };
  return (
    <section className="py-16 bg-legal-cream/50 dark:bg-muted/10 border-t border-border/30 print:hidden">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-xl mx-auto text-center space-y-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-legal-navy/10 flex items-center justify-center mx-auto">
            <Mail className="h-6 w-6 text-legal-navy" />
          </div>
          <h2 className="text-2xl font-bold text-foreground font-legal">النشرة القانونية الأسبوعية</h2>
          <p className="text-muted-foreground text-sm">أحدث المقالات والتحديثات القانونية مباشرة في بريدك</p>
          <div className="flex gap-2 max-w-sm mx-auto">
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="بريدك الإلكتروني"
              className="flex-1 h-11 rounded-xl border border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-legal-navy/20 focus:border-legal-navy/40 transition-all"
              dir="ltr"
            />
            <Button onClick={handleSubscribe} disabled={submitting} className="h-11 rounded-xl bg-legal-navy hover:bg-legal-navy/90 text-white px-5">
              اشتراك
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground/60">بدون إزعاج — يمكنك إلغاء الاشتراك في أي وقت</p>
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
  const articleRef = useRef<HTMLDivElement>(null);

  // Scroll progress via framer-motion
  const { scrollYProgress } = useScroll();
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  // Active heading tracking
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 600);
      const headings = document.querySelectorAll('#article-body h2, #article-body h3');
      let current = '';
      headings.forEach(h => {
        const rect = h.getBoundingClientRect();
        if (rect.top <= 130) current = h.id;
      });
      if (current) setActiveHeading(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch article
  useEffect(() => {
    const fetchArticle = async () => {
      if (!slug) return;
      const { data, error } = await supabase
        .from('articles').select('*').eq('slug', slug).eq('status', 'published').single();
      if (!error && data) {
        setArticle(data);
        const { data: rel } = await supabase
          .from('articles')
          .select('id, title, slug, excerpt, cover_image, category, reading_time, created_at')
          .eq('status', 'published').eq('category', data.category || 'عام')
          .neq('slug', slug).limit(3);
        if (rel) setRelated(rel);
      }
      setLoading(false);
    };
    fetchArticle();
    window.scrollTo(0, 0);
  }, [slug]);

  // TOC extraction
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

  // Inject heading IDs
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

  /* ─── LOADING ─── */
  if (loading) return (
    <div className="min-h-screen bg-background">
      <div className="h-[3px] bg-primary/20 fixed top-0 left-0 right-0 z-[60]">
        <div className="h-full bg-primary animate-pulse w-1/3" />
      </div>
      <div className="container mx-auto px-4 pt-28">
        <div className="max-w-3xl mx-auto space-y-8">
          {[1/4, 4/5, 1/2].map((w, i) => <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" style={{ width: `${w * 100}%` }} />)}
          <div className="aspect-[21/9] bg-muted rounded-2xl animate-pulse" />
          {[...Array(8)].map((_, i) => <div key={i} className="h-4 bg-muted rounded animate-pulse" style={{ width: `${80 + Math.random() * 20}%` }} />)}
        </div>
      </div>
    </div>
  );

  /* ─── NOT FOUND ─── */
  if (!article) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
        <BookOpen className="h-12 w-12 text-primary" />
      </div>
      <h1 className="text-3xl font-bold text-foreground font-legal">المقال غير موجود</h1>
      <p className="text-muted-foreground">ربما تم حذفه أو تغيير رابطه</p>
      <Link to="/blog"><Button className="gap-2 rounded-xl"><ArrowRight className="h-4 w-4" /> العودة للمدونة</Button></Link>
    </div>
  );

  /* ─── SCHEMAS ─── */
  const articleSchema = {
    '@context': 'https://schema.org', '@type': article.schema_type || 'Article',
    headline: article.seo_title || article.title,
    description: article.seo_description || article.excerpt,
    image: article.cover_image,
    datePublished: article.published_at || article.created_at,
    dateModified: article.updated_at,
    author: { '@type': 'Organization', name: 'محاماة ذكية', url: window.location.origin },
    publisher: { '@type': 'Organization', name: 'محاماة ذكية', url: window.location.origin, logo: { '@type': 'ImageObject', url: `${window.location.origin}/favicon.ico` } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': window.location.href },
    inLanguage: 'ar', articleSection: article.category || 'قانون',
    wordCount: article.content?.replace(/<[^>]+>/g, '').split(/\s+/).length || 0,
    keywords: article.tags?.join(', ') || '',
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: window.location.origin },
      { '@type': 'ListItem', position: 2, name: 'المدونة', item: `${window.location.origin}/blog` },
      { '@type': 'ListItem', position: 3, name: article.category || 'عام', item: `${window.location.origin}/blog?category=${encodeURIComponent(article.category || '')}` },
      { '@type': 'ListItem', position: 4, name: article.title, item: window.location.href },
    ],
  };
  const faqSchema = article.content?.includes('<h2') ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: (article.content.match(/<h2[^>]*>(.*?)<\/h2>/g) || []).slice(0, 5).map((h: string) => {
      const q = h.replace(/<[^>]+>/g, '');
      return { '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: article.excerpt || q } };
    }),
  } : null;

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
        <meta property="og:url" content={window.location.href} />
        <meta property="og:locale" content="ar_MA" />
        <meta property="article:published_time" content={article.published_at || article.created_at} />
        <meta property="article:modified_time" content={article.updated_at} />
        <meta property="article:section" content={article.category} />
        {article.tags?.map((tag: string) => <meta key={tag} property="article:tag" content={tag} />)}
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
      </Helmet>

      {/* ═══ PROGRESS BAR ═══ */}
      <motion.div
        className="fixed top-0 left-0 right-0 z-[70] h-[3px] bg-transparent"
        style={{ originX: 1 }}
      >
        <motion.div
          className="h-full bg-gradient-to-l from-legal-gold via-legal-navy to-legal-navy"
          style={{ width: progressWidth }}
        />
      </motion.div>

      <div className={`min-h-screen bg-background print:bg-white transition-all duration-500 ${focusMode ? 'focus-reading' : ''}`}>

        {/* ═══ STICKY HEADER ═══ */}
        <header className="sticky top-0 z-50 print:hidden">
          <nav className="bg-card/95 backdrop-blur-xl border-b border-border/30 shadow-sm">
            <div className="container mx-auto px-4 flex items-center justify-between h-14">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl bg-legal-navy flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Scale className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-bold text-foreground hidden sm:block">محاماة ذكية</span>
              </Link>

              {/* Desktop Actions */}
              <div className="hidden md:flex items-center gap-1">
                <Link to="/blog">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground text-xs h-8">
                    <ArrowRight className="h-3 w-3" /> المدونة
                  </Button>
                </Link>
                <Link to="/ai-consultation">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs h-8">استشارة ذكية</Button>
                </Link>
                <div className="w-px h-5 bg-border/50 mx-1" />

                {/* Quick Actions */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => window.print()} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>طباعة المقال</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => { toast.success('جاري تحميل PDF...'); window.print(); }} className="h-8 w-8 text-muted-foreground hover:text-legal-emerald">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>تحميل PDF</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => { toast.success('تمت الإضافة للمفضلة'); }} className="h-8 w-8 text-muted-foreground hover:text-legal-gold">
                      <Bookmark className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>حفظ في المفضلة</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setFocusMode(!focusMode)} className={`h-8 w-8 ${focusMode ? 'text-legal-navy bg-legal-navy/10' : 'text-muted-foreground hover:text-foreground'}`}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{focusMode ? 'إيقاف وضع التركيز' : 'وضع القراءة المركّزة'}</TooltipContent>
                </Tooltip>

                <Button variant="ghost" size="icon" onClick={() => shareArticle()} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <Share2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Mobile Menu */}
              <button className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileNav(!mobileNav)}>
                {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </nav>

          <AnimatePresence>
            {mobileNav && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="md:hidden border-b border-border bg-card overflow-hidden"
              >
                <div className="p-3 space-y-1">
                  <Link to="/blog" className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted text-sm" onClick={() => setMobileNav(false)}>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" /> المدونة
                  </Link>
                  <Link to="/ai-consultation" className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted text-sm" onClick={() => setMobileNav(false)}>
                    <MessageCircle className="h-4 w-4 text-muted-foreground" /> استشارة ذكية
                  </Link>
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/50 mt-2">
                    <Button variant="outline" size="sm" onClick={() => window.print()} className="text-xs h-9"><Printer className="h-3.5 w-3.5" /></Button>
                    <Button variant="outline" size="sm" onClick={() => toast.success('تمت الإضافة')} className="text-xs h-9"><Bookmark className="h-3.5 w-3.5" /></Button>
                    <Button variant="outline" size="sm" onClick={() => setFocusMode(!focusMode)} className="text-xs h-9"><Eye className="h-3.5 w-3.5" /></Button>
                    <Button variant="outline" size="sm" onClick={() => shareArticle()} className="text-xs h-9"><Share2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* ═══ HERO SECTION ═══ */}
        <section className="relative overflow-hidden">
          {/* Subtle background texture */}
          <div className="absolute inset-0 opacity-[0.02]" style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, hsl(var(--legal-navy)) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }} />

          <div className="relative container mx-auto px-4 pt-6 sm:pt-8 md:pt-10">
            <div className="max-w-4xl mx-auto">
              {/* Breadcrumbs */}
              <nav className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground mb-5 overflow-x-auto pb-1" aria-label="breadcrumb">
                <Link to="/" className="hover:text-legal-navy transition-colors shrink-0">الرئيسية</Link>
                <ChevronLeft className="h-3 w-3 shrink-0 rotate-180" />
                <Link to="/blog" className="hover:text-legal-navy transition-colors shrink-0">المدونة</Link>
                <ChevronLeft className="h-3 w-3 shrink-0 rotate-180" />
                <Link to={`/blog?category=${article.category}`} className="text-legal-navy font-medium shrink-0">{article.category || 'عام'}</Link>
              </nav>

              {/* Category + Updated Badge */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Badge className="bg-legal-navy/10 text-legal-navy border-legal-navy/15 text-[11px] px-3 py-1 rounded-full font-medium gap-1">
                  <Gavel className="h-3 w-3" />
                  {article.category || 'عام'}
                </Badge>
                {article.updated_at && article.updated_at !== article.created_at && (
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full border-legal-emerald/30 text-legal-emerald gap-1">
                    <BadgeCheck className="h-3 w-3" /> محدّث
                  </Badge>
                )}
              </div>

              {/* Title */}
              <motion.h1
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-foreground leading-[1.4] tracking-tight mb-5 font-legal"
              >
                {article.title}
              </motion.h1>

              {/* Excerpt */}
              {article.excerpt && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.5 }}
                  className="text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed mb-6 max-w-3xl"
                >
                  {article.excerpt}
                </motion.p>
              )}

              {/* Meta Row */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.5 }}
                className="flex flex-wrap items-center gap-3 sm:gap-4 pb-6 sm:pb-8 border-b border-border/30"
              >
                {/* Author */}
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-legal-navy/15 to-legal-gold/10 flex items-center justify-center ring-2 ring-background">
                    <User className="h-5 w-5 text-legal-navy" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs sm:text-sm font-semibold text-foreground">فريق محاماة ذكية</p>
                      <BadgeCheck className="h-3.5 w-3.5 text-legal-emerald" />
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">خبراء قانونيون معتمدون</p>
                  </div>
                </div>

                <div className="hidden sm:block w-px h-8 bg-border/50" />

                <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" /> {formattedDate}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> {article.reading_time || 5} دقائق
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3 w-3" /> {Math.floor(Math.random() * 3000 + 500).toLocaleString('ar-MA')} مشاهدة
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3 w-3" /> {wordCount} كلمة
                  </span>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Featured Image */}
          {article.cover_image && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6 }}
              className="container mx-auto px-4 mt-6 sm:mt-8"
            >
              <figure className="max-w-4xl mx-auto">
                <div className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl shadow-foreground/5 group">
                  <img src={article.cover_image} alt={article.title} className="w-full aspect-[16/9] sm:aspect-[2.2/1] object-cover transition-transform duration-700 group-hover:scale-[1.02]" loading="eager" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-foreground/5 rounded-xl sm:rounded-2xl" />
                  {/* Gradient overlay on bottom */}
                  <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-foreground/10 to-transparent" />
                </div>
                <figcaption className="text-center text-[11px] text-muted-foreground/60 mt-3">
                  صورة توضيحية — {article.category || 'القانون المغربي'}
                </figcaption>
              </figure>
            </motion.div>
          )}
        </section>

        {/* ═══ MAIN CONTENT ═══ */}
        <div className="container mx-auto px-4 py-8 sm:py-10 md:py-14">
          <div className={`max-w-6xl mx-auto flex gap-10 transition-all duration-500 ${focusMode ? 'max-w-3xl' : ''}`}>

            {/* ── STICKY SIDEBAR (TOC) ── */}
            {toc.length > 0 && !focusMode && (
              <aside className="hidden lg:block w-72 shrink-0 print:hidden">
                <div className="sticky top-20">
                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm"
                  >
                    <button
                      onClick={() => setTocOpen(!tocOpen)}
                      className="w-full px-5 py-4 flex items-center justify-between bg-muted/20 border-b border-border/30 hover:bg-muted/40 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Hash className="h-4 w-4 text-legal-navy" /> فهرس المقال
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${tocOpen ? '' : '-rotate-90'}`} />
                    </button>

                    <AnimatePresence>
                      {tocOpen && (
                        <motion.nav
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 space-y-0.5 max-h-[55vh] overflow-y-auto">
                            {/* Mini progress */}
                            <div className="mb-3 px-2">
                              <div className="h-1 bg-muted rounded-full overflow-hidden">
                                <motion.div className="h-full bg-legal-navy rounded-full" style={{ width: progressWidth }} />
                              </div>
                            </div>
                            {toc.map(item => (
                              <button
                                key={item.id}
                                onClick={() => scrollToHeading(item.id)}
                                className={`w-full text-right px-3 py-2 rounded-lg text-[13px] transition-all duration-200 leading-relaxed ${
                                  item.level === 3 ? 'pr-6 text-xs' : ''
                                } ${
                                  activeHeading === item.id
                                    ? 'bg-legal-navy/8 text-legal-navy font-semibold border-r-2 border-legal-navy'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                                }`}
                              >
                                {item.text}
                              </button>
                            ))}
                          </div>
                        </motion.nav>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Tags Cloud in sidebar */}
                  {article.tags && article.tags.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-border/40 bg-card p-4">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Tag className="h-3.5 w-3.5 text-legal-gold" />
                        <span className="text-xs font-semibold text-foreground">الوسوم القانونية</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {article.tags.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-[10px] bg-transparent hover:bg-legal-navy/5 hover:border-legal-navy/20 hover:text-legal-navy transition-colors cursor-pointer rounded-full px-2.5 py-0.5">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            )}

            {/* ── ARTICLE BODY ── */}
            <article className="flex-1 min-w-0" ref={articleRef}>
              {/* Executive Summary */}
              {article.excerpt && (
                <ExecutiveSummary points={[
                  article.excerpt,
                  `يندرج هذا المقال ضمن تصنيف: ${article.category || 'القانون المغربي'}`,
                  `وقت القراءة المقدر: ${article.reading_time || 5} دقائق`,
                ]} />
              )}

              <div id="article-body"
                className="legal-article-content prose prose-lg max-w-none dark:prose-invert
                  prose-headings:text-foreground prose-headings:font-bold prose-headings:leading-snug prose-headings:font-legal
                  prose-h2:text-[1.25rem] prose-h2:sm:text-[1.4rem] prose-h2:md:text-[1.6rem] prose-h2:mt-10 prose-h2:sm:mt-12 prose-h2:mb-4 prose-h2:sm:mb-5 prose-h2:pb-3 prose-h2:border-b prose-h2:border-border/20
                  prose-h3:text-[1.1rem] prose-h3:sm:text-[1.2rem] prose-h3:md:text-[1.3rem] prose-h3:mt-8 prose-h3:sm:mt-9 prose-h3:mb-3
                  prose-p:text-foreground/80 prose-p:leading-[2] prose-p:text-[0.9rem] prose-p:sm:text-[0.95rem] prose-p:md:text-[1.05rem] prose-p:mb-5
                  prose-a:text-legal-navy prose-a:font-medium prose-a:no-underline prose-a:border-b prose-a:border-legal-navy/20 hover:prose-a:border-legal-navy prose-a:transition-colors
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-img:rounded-xl prose-img:sm:rounded-2xl prose-img:shadow-lg prose-img:my-6 prose-img:sm:my-8
                  prose-blockquote:border-r-[3px] prose-blockquote:border-legal-gold prose-blockquote:bg-legal-gold/[0.04] prose-blockquote:rounded-xl prose-blockquote:py-3 prose-blockquote:sm:py-4 prose-blockquote:px-4 prose-blockquote:sm:px-6 prose-blockquote:not-italic prose-blockquote:text-foreground/75 prose-blockquote:font-legal prose-blockquote:my-6 prose-blockquote:sm:my-8
                  prose-li:text-foreground/80 prose-li:leading-[2]
                  prose-ul:mr-0 prose-ol:mr-0
                  prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm"
                dir="rtl"
                dangerouslySetInnerHTML={{ __html: processedContent }}
              />

              {/* Mobile Tags */}
              {article.tags && article.tags.length > 0 && (
                <div className="mt-10 lg:hidden p-4 sm:p-5 bg-muted/15 rounded-xl border border-border/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="h-4 w-4 text-legal-gold" />
                    <span className="text-sm font-semibold text-foreground">الوسوم القانونية</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {article.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs hover:bg-legal-navy/5 hover:border-legal-navy/20 hover:text-legal-navy transition-colors cursor-pointer rounded-full px-3 py-1">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Document Gallery */}
              <DocumentGallery />

              {/* Footnotes */}
              <FootnotesSection />

              {/* Legal Disclaimer */}
              <LegalDisclaimer />

              {/* Share Row */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 py-6 border-y border-border/30 print:hidden">
                <span className="text-sm font-medium text-foreground">شارك هذا المقال:</span>
                <div className="flex items-center gap-2">
                  {[
                    { platform: 'facebook', icon: Facebook, label: 'فيسبوك', hover: 'hover:bg-[#1877F2]/10 hover:text-[#1877F2] hover:border-[#1877F2]/30' },
                    { platform: 'whatsapp', icon: MessageCircle, label: 'واتساب', hover: 'hover:bg-[#25D366]/10 hover:text-[#25D366] hover:border-[#25D366]/30' },
                    { platform: 'twitter', icon: Twitter, label: 'تويتر', hover: 'hover:bg-[#1DA1F2]/10 hover:text-[#1DA1F2] hover:border-[#1DA1F2]/30' },
                    { platform: 'copy', icon: Copy, label: 'نسخ', hover: 'hover:bg-muted hover:text-foreground' },
                  ].map(s => (
                    <motion.button
                      key={s.platform}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => shareArticle(s.platform)}
                      className={`w-10 h-10 rounded-xl border border-border/50 bg-card flex items-center justify-center transition-colors ${s.hover}`}
                      aria-label={s.label}
                    >
                      <s.icon className="h-4 w-4" />
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Author Bio */}
              <AuthorBioCard />

              {/* Comments Section */}
              <CommentsSection articleId={article.id} />

              {/* CTA Block */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mt-14 relative overflow-hidden rounded-2xl bg-gradient-to-br from-legal-navy/[0.06] via-legal-gold/[0.03] to-legal-emerald/[0.03] border border-legal-navy/15 p-6 sm:p-8 md:p-10 print:hidden"
              >
                <div className="absolute top-0 left-0 w-48 h-48 bg-legal-gold/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
                <div className="absolute bottom-0 right-0 w-56 h-56 bg-legal-navy/5 rounded-full translate-x-1/4 translate-y-1/4 blur-3xl" />
                <div className="relative z-10 text-center space-y-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-legal-navy/10 flex items-center justify-center mx-auto">
                    <Scale className="h-7 w-7 sm:h-8 sm:w-8 text-legal-navy" />
                  </div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground font-legal">هل لديك سؤال حول هذا الموضوع؟</h3>
                  <p className="text-muted-foreground max-w-lg mx-auto text-xs sm:text-sm">
                    احصل على استشارة قانونية فورية مبنية على القانون المغربي
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <Link to="/ai-consultation">
                      <Button size="lg" className="gap-2 rounded-xl bg-legal-navy hover:bg-legal-navy/90 text-white shadow-lg shadow-legal-navy/15">
                        استشارة ذكية مجانية <ArrowLeft className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link to="/legal-fee-calculator">
                      <Button variant="outline" size="lg" className="gap-2 rounded-xl">حاسبة الرسوم القضائية</Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            </article>
          </div>
        </div>

        {/* ═══ RELATED ARTICLES ═══ */}
        {related.length > 0 && (
          <section className="border-t border-border/30 py-12 sm:py-16 md:py-20 bg-muted/10 print:hidden">
            <div className="container mx-auto px-4">
              <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8 sm:mb-10">
                  <div>
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground font-legal">مقالات ذات صلة</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">تابع القراءة حول {article.category}</p>
                  </div>
                  <Link to="/blog">
                    <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-xs">
                      عرض الكل <ArrowLeft className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {related.map((r, i) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Link to={`/blog/${r.slug}`} className="group block h-full">
                        <Card className="overflow-hidden border-border/30 hover:shadow-xl hover:shadow-foreground/5 hover:border-legal-navy/15 transition-all duration-500 hover:-translate-y-1 h-full bg-card">
                          <div className="aspect-[16/10] overflow-hidden relative">
                            <img
                              src={r.cover_image || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=250&fit=crop'}
                              alt={r.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-foreground/5 to-transparent" />
                          </div>
                          <CardContent className="p-4 sm:p-5 space-y-2.5">
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full border-legal-navy/15 text-legal-navy">
                              {r.category || 'عام'}
                            </Badge>
                            <h3 className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-legal-navy transition-colors leading-relaxed font-legal">
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

        {/* ═══ NEWSLETTER ═══ */}
        <NewsletterSection />

        {/* ═══ FOOTER ═══ */}
        <footer className="py-8 sm:py-10 border-t border-border/30 print:hidden">
          <div className="container mx-auto px-4 text-center space-y-3">
            <div className="flex items-center justify-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-legal-navy flex items-center justify-center">
                <Scale className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-foreground font-legal">محاماة ذكية</span>
            </div>
            <p className="text-xs text-muted-foreground">منصة قانونية مغربية متكاملة — محتوى موثوق واستشارات ذكية</p>
            <div className="flex items-center justify-center gap-3 sm:gap-5 text-xs text-muted-foreground flex-wrap">
              <Link to="/blog" className="hover:text-legal-navy transition-colors">المدونة</Link>
              <Link to="/ai-consultation" className="hover:text-legal-navy transition-colors">استشارة ذكية</Link>
              <Link to="/legal-fee-calculator" className="hover:text-legal-navy transition-colors">حاسبة الرسوم</Link>
              <Link to="/case-tracker" className="hover:text-legal-navy transition-colors">تتبع القضايا</Link>
            </div>
          </div>
        </footer>
      </div>

      {/* ═══ FLOATING SOCIAL BAR ═══ */}
      <div className="fixed top-1/2 left-4 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-2 print:hidden">
        {[
          { p: 'facebook', icon: Facebook, color: 'hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2]' },
          { p: 'whatsapp', icon: MessageCircle, color: 'hover:bg-[#25D366] hover:text-white hover:border-[#25D366]' },
          { p: 'twitter', icon: Twitter, color: 'hover:bg-[#1DA1F2] hover:text-white hover:border-[#1DA1F2]' },
          { p: 'copy', icon: Copy, color: 'hover:bg-foreground hover:text-background hover:border-foreground' },
        ].map(s => (
          <motion.button
            key={s.p}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => shareArticle(s.p)}
            className={`w-10 h-10 rounded-xl bg-card border border-border/40 flex items-center justify-center text-muted-foreground transition-all duration-200 shadow-sm ${s.color}`}
          >
            <s.icon className="h-4 w-4" />
          </motion.button>
        ))}
      </div>

      {/* ═══ SCROLL TO TOP ═══ */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 left-6 xl:left-20 z-50 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-legal-navy text-white shadow-lg shadow-legal-navy/25 flex items-center justify-center hover:scale-110 transition-transform print:hidden"
            aria-label="العودة للأعلى"
          >
            <ChevronUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};

export default BlogArticle;
