import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Scale, Calendar, ArrowRight, Clock, Tag, Share2, BookOpen, ArrowLeft,
  Menu, X, ChevronUp, Facebook, MessageCircle, Copy, Printer, Mail,
  Bookmark, Gavel, AlertTriangle, Lightbulb, Info, FileText, User,
  ExternalLink, Hash, ChevronDown, Twitter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Table of Contents Item ──
interface TocItem {
  id: string;
  text: string;
  level: number;
}

// ── Law Article Box Component ──
const LawArticleBox = ({ title, content, reference }: { title: string; content: string; reference: string }) => {
  const copyCitation = () => {
    navigator.clipboard.writeText(`${title} - ${reference}: ${content}`);
    toast.success('تم نسخ الاستشهاد');
  };
  return (
    <div className="my-8 rounded-xl border-2 border-legal-gold/30 bg-gradient-to-br from-legal-gold/5 to-transparent overflow-hidden">
      <div className="bg-legal-gold/10 px-5 py-3 flex items-center justify-between border-b border-legal-gold/20">
        <div className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-legal-gold" />
          <span className="font-semibold text-sm text-foreground font-heading">{title}</span>
        </div>
        <button
          onClick={copyCitation}
          className="flex items-center gap-1.5 text-xs text-legal-gold hover:text-legal-gold/80 transition-colors px-2 py-1 rounded-md hover:bg-legal-gold/10"
        >
          <Copy className="h-3 w-3" /> نسخ الاستشهاد
        </button>
      </div>
      <div className="p-5 space-y-2">
        <p className="text-foreground/90 leading-relaxed text-[0.95rem]">{content}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <FileText className="h-3 w-3" /> {reference}
        </p>
      </div>
    </div>
  );
};

// ── Alert Components ──
const LegalAlert = ({ type, children }: { type: 'warning' | 'important' | 'tip'; children: React.ReactNode }) => {
  const config = {
    warning: {
      icon: AlertTriangle,
      label: 'تحذير قانوني',
      border: 'border-destructive/40',
      bg: 'bg-destructive/5',
      iconColor: 'text-destructive',
      headerBg: 'bg-destructive/10',
    },
    important: {
      icon: Info,
      label: 'ملاحظة مهمة',
      border: 'border-legal-gold/40',
      bg: 'bg-legal-gold/5',
      iconColor: 'text-legal-gold',
      headerBg: 'bg-legal-gold/10',
    },
    tip: {
      icon: Lightbulb,
      label: 'نصيحة قانونية',
      border: 'border-legal-emerald/40',
      bg: 'bg-legal-emerald/5',
      iconColor: 'text-legal-emerald',
      headerBg: 'bg-legal-emerald/10',
    },
  };
  const c = config[type];
  const Icon = c.icon;
  return (
    <div className={`my-6 rounded-xl border-2 ${c.border} ${c.bg} overflow-hidden`}>
      <div className={`${c.headerBg} px-4 py-2 flex items-center gap-2`}>
        <Icon className={`h-4 w-4 ${c.iconColor}`} />
        <span className={`text-sm font-semibold ${c.iconColor}`}>{c.label}</span>
      </div>
      <div className="p-4 text-foreground/85 text-[0.95rem] leading-relaxed">{children}</div>
    </div>
  );
};

// ── Author Bio Card ──
const AuthorBioCard = () => (
  <div className="mt-14 rounded-2xl border border-border/60 bg-card overflow-hidden">
    <div className="h-20 bg-gradient-to-l from-legal-emerald/20 via-legal-emerald/10 to-transparent" />
    <div className="px-6 pb-6 -mt-10">
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-2xl bg-legal-emerald/10 border-4 border-card flex items-center justify-center shrink-0">
          <Scale className="h-8 w-8 text-legal-emerald" />
        </div>
        <div className="pt-10 space-y-2 flex-1">
          <h3 className="text-lg font-bold text-foreground font-heading">فريق محاماة ذكية</h3>
          <p className="text-sm text-muted-foreground">محامون ومستشارون قانونيون متخصصون في القانون المغربي</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            نقدم محتوى قانونياً موثوقاً ومحدثاً يستند إلى التشريعات المغربية والاجتهادات القضائية، بهدف تعزيز الثقافة القانونية وتسهيل الوصول إلى العدالة.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <Link to="/ai-consultation">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs rounded-lg border-legal-emerald/30 text-legal-emerald hover:bg-legal-emerald/5">
                <MessageCircle className="h-3 w-3" /> استشارة مجانية
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ── Newsletter Section ──
const NewsletterSection = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubscribe = async () => {
    if (!email) return;
    setSubmitting(true);
    const { error } = await supabase.from('newsletter_subscribers').insert({ email });
    if (!error) {
      toast.success('تم الاشتراك بنجاح!');
      setEmail('');
    } else if (error.code === '23505') {
      toast.info('أنت مشترك بالفعل');
    } else {
      toast.error('حدث خطأ، حاول مجدداً');
    }
    setSubmitting(false);
  };

  return (
    <section className="py-16 bg-legal-emerald/[0.03] border-t border-border/40">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-legal-gold/10 flex items-center justify-center mx-auto">
            <Mail className="h-6 w-6 text-legal-gold" />
          </div>
          <h2 className="text-2xl font-bold text-foreground font-heading">اشترك في النشرة القانونية</h2>
          <p className="text-muted-foreground text-sm">احصل على أحدث المقالات والتحديثات القانونية مباشرة في بريدك</p>
          <div className="flex gap-2 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="بريدك الإلكتروني"
              className="flex-1 h-11 rounded-xl border border-border bg-card px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-legal-emerald/30 focus:border-legal-emerald/50"
              dir="ltr"
            />
            <Button
              onClick={handleSubscribe}
              disabled={submitting}
              className="h-11 rounded-xl bg-legal-emerald hover:bg-legal-emerald/90 text-white px-6"
            >
              اشتراك
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

// ══════════════════════════════════════════════════
// ██  MAIN BLOG ARTICLE COMPONENT
// ══════════════════════════════════════════════════
const BlogArticle = () => {
  const { slug } = useParams();
  const [article, setArticle] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeHeading, setActiveHeading] = useState('');
  const [tocOpen, setTocOpen] = useState(true);
  const articleRef = useRef<HTMLDivElement>(null);

  // ── Scroll Progress & Active Heading Tracking ──
  useEffect(() => {
    const handleScroll = () => {
      const el = document.getElementById('article-body');
      if (el) {
        const rect = el.getBoundingClientRect();
        const total = el.scrollHeight - window.innerHeight;
        const scrolled = Math.max(0, -rect.top);
        setProgress(Math.min(100, (scrolled / Math.max(total, 1)) * 100));
      }
      setShowScrollTop(window.scrollY > 600);

      // Track active heading
      const headings = document.querySelectorAll('#article-body h2, #article-body h3');
      let current = '';
      headings.forEach(h => {
        const rect = h.getBoundingClientRect();
        if (rect.top <= 120) current = h.id;
      });
      if (current) setActiveHeading(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Fetch Article ──
  useEffect(() => {
    const fetchArticle = async () => {
      if (!slug) return;
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (!error && data) {
        setArticle(data);
        const { data: relatedData } = await supabase
          .from('articles')
          .select('id, title, slug, excerpt, cover_image, category, reading_time, created_at')
          .eq('status', 'published')
          .eq('category', data.category || 'عام')
          .neq('slug', slug)
          .limit(3);
        if (relatedData) setRelated(relatedData);
      }
      setLoading(false);
    };
    fetchArticle();
    window.scrollTo(0, 0);
  }, [slug]);

  // ── Extract TOC from content ──
  const toc = useMemo<TocItem[]>(() => {
    if (!article?.content) return [];
    const regex = /<h([23])[^>]*>(.*?)<\/h\1>/gi;
    const items: TocItem[] = [];
    let match;
    let idx = 0;
    while ((match = regex.exec(article.content)) !== null) {
      const text = match[2].replace(/<[^>]+>/g, '');
      const id = `heading-${idx}`;
      items.push({ id, text, level: parseInt(match[1]) });
      idx++;
    }
    return items;
  }, [article?.content]);

  // ── Inject IDs into content headings ──
  const processedContent = useMemo(() => {
    if (!article?.content) return '';
    let idx = 0;
    return article.content.replace(/<h([23])([^>]*)>/gi, (_: string, level: string, attrs: string) => {
      const id = `heading-${idx}`;
      idx++;
      return `<h${level}${attrs} id="${id}">`;
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

  const handlePrint = () => window.print();

  const scrollToHeading = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-[3px] bg-legal-emerald/20 fixed top-0 left-0 right-0 z-[60]">
          <div className="h-full bg-legal-emerald animate-pulse w-1/3" />
        </div>
        <div className="container mx-auto px-4 pt-32">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="h-5 bg-muted rounded w-1/4 animate-pulse" />
            <div className="h-12 bg-muted rounded-lg w-4/5 animate-pulse" />
            <div className="h-6 bg-muted rounded w-1/2 animate-pulse" />
            <div className="aspect-[21/9] bg-muted rounded-2xl animate-pulse" />
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-4 bg-muted rounded animate-pulse" style={{ width: `${80 + Math.random() * 20}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Not Found ──
  if (!article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4">
        <div className="w-24 h-24 rounded-full bg-legal-emerald/10 flex items-center justify-center">
          <BookOpen className="h-12 w-12 text-legal-emerald" />
        </div>
        <h1 className="text-3xl font-bold text-foreground font-heading">المقال غير موجود</h1>
        <p className="text-muted-foreground">ربما تم حذفه أو تغيير رابطه</p>
        <Link to="/blog"><Button className="gap-2 bg-legal-emerald hover:bg-legal-emerald/90 text-white rounded-xl"><ArrowRight className="h-4 w-4" /> العودة للمدونة</Button></Link>
      </div>
    );
  }

  // ── Schema / SEO ──
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': article.schema_type || 'Article',
    headline: article.seo_title || article.title,
    description: article.seo_description || article.excerpt,
    image: article.cover_image,
    datePublished: article.published_at || article.created_at,
    dateModified: article.updated_at,
    author: { '@type': 'Organization', name: 'محاماة ذكية', url: window.location.origin },
    publisher: {
      '@type': 'Organization', name: 'محاماة ذكية', url: window.location.origin,
      logo: { '@type': 'ImageObject', url: `${window.location.origin}/favicon.ico` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': window.location.href },
    inLanguage: 'ar',
    articleSection: article.category || 'قانون',
    wordCount: article.content?.replace(/<[^>]+>/g, '').split(/\s+/).length || 0,
    keywords: article.tags?.join(', ') || '',
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: window.location.origin },
      { '@type': 'ListItem', position: 2, name: 'المدونة', item: `${window.location.origin}/blog` },
      { '@type': 'ListItem', position: 3, name: article.category || 'عام', item: `${window.location.origin}/blog?category=${encodeURIComponent(article.category || '')}` },
      { '@type': 'ListItem', position: 4, name: article.title, item: window.location.href },
    ],
  };

  const faqSchema = article.content?.includes('<h2') ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (article.content.match(/<h2[^>]*>(.*?)<\/h2>/g) || []).slice(0, 5).map((h: string) => {
      const question = h.replace(/<[^>]+>/g, '');
      return { '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: article.excerpt || question } };
    }),
  } : null;

  const formattedDate = new Date(article.created_at).toLocaleDateString('ar-MA', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

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
        <meta name="twitter:title" content={article.seo_title || article.title} />
        <meta name="twitter:description" content={article.seo_description || article.excerpt} />
        <meta name="twitter:image" content={article.cover_image} />
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
      </Helmet>

      {/* ═══ Progress Bar ═══ */}
      <div className="fixed top-0 left-0 right-0 z-[70] h-[3px] bg-muted/50">
        <div
          className="h-full bg-gradient-to-l from-legal-gold via-legal-emerald to-legal-emerald transition-all duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="min-h-screen bg-background print:bg-white">
        {/* ═══ Top Navbar ═══ */}
        <nav className="sticky top-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border/40 print:hidden">
          <div className="container mx-auto px-4 flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-legal-emerald flex items-center justify-center">
                <Scale className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-base font-bold text-foreground hidden sm:block font-heading">محاماة ذكية</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              <Link to="/blog">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground text-sm">
                  <ArrowRight className="h-3.5 w-3.5" /> المدونة
                </Button>
              </Link>
              <Link to="/ai-consultation">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm">استشارة ذكية</Button>
              </Link>
              <Link to="/legal-fee-calculator">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-sm">حاسبة الرسوم</Button>
              </Link>
              <div className="w-px h-5 bg-border mx-1" />
              <Button variant="ghost" size="icon" onClick={handlePrint} className="text-muted-foreground hover:text-foreground h-8 w-8">
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => shareArticle()} className="text-muted-foreground hover:text-foreground h-8 w-8">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
            <button className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {mobileNav && (
            <div className="md:hidden border-t border-border bg-card p-3 space-y-1 animate-in slide-in-from-top-2">
              <Link to="/blog" className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted text-sm" onClick={() => setMobileNav(false)}>
                <ArrowRight className="h-4 w-4 text-muted-foreground" /> المدونة
              </Link>
              <Link to="/ai-consultation" className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted text-sm" onClick={() => setMobileNav(false)}>
                <MessageCircle className="h-4 w-4 text-muted-foreground" /> استشارة ذكية
              </Link>
              <Link to="/legal-fee-calculator" className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-muted text-sm" onClick={() => setMobileNav(false)}>
                <Scale className="h-4 w-4 text-muted-foreground" /> حاسبة الرسوم
              </Link>
              <div className="flex gap-2 pt-2 border-t border-border/50 mt-2">
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 flex-1"><Printer className="h-3.5 w-3.5" /> طباعة</Button>
                <Button variant="outline" size="sm" onClick={() => shareArticle()} className="gap-1.5 flex-1"><Share2 className="h-3.5 w-3.5" /> مشاركة</Button>
              </div>
            </div>
          )}
        </nav>

        {/* ═══ Hero Section ═══ */}
        <header className="relative overflow-hidden">
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23064e3b' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />

          <div className="relative container mx-auto px-4 pt-8 pb-0 md:pt-12">
            <div className="max-w-4xl mx-auto">
              {/* Breadcrumbs */}
              <nav className="flex items-center gap-2 text-xs text-muted-foreground mb-6" aria-label="breadcrumb">
                <Link to="/" className="hover:text-legal-emerald transition-colors flex items-center gap-1">
                  الرئيسية
                </Link>
                <ChevronDown className="h-3 w-3 -rotate-90" />
                <Link to="/blog" className="hover:text-legal-emerald transition-colors">المدونة</Link>
                <ChevronDown className="h-3 w-3 -rotate-90" />
                <Link to={`/blog?category=${article.category}`} className="hover:text-legal-emerald transition-colors text-legal-emerald font-medium">
                  {article.category || 'عام'}
                </Link>
              </nav>

              {/* Category Badge */}
              <Badge className="mb-5 bg-legal-emerald/10 text-legal-emerald border-legal-emerald/20 hover:bg-legal-emerald/15 text-xs px-3 py-1 rounded-full font-medium">
                <Gavel className="h-3 w-3 ml-1" />
                {article.category || 'عام'}
              </Badge>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-[1.35] tracking-tight mb-5 font-heading">
                {article.title}
              </h1>

              {/* Excerpt */}
              {article.excerpt && (
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-6 max-w-3xl">
                  {article.excerpt}
                </p>
              )}

              {/* Meta Row */}
              <div className="flex flex-wrap items-center gap-4 pb-8 border-b border-border/40">
                {/* Author */}
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-legal-emerald/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-legal-emerald" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">فريق محاماة ذكية</p>
                    <p className="text-xs text-muted-foreground">محامون ومستشارون</p>
                  </div>
                </div>
                <div className="hidden sm:block w-px h-8 bg-border" />
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> {formattedDate}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> {article.reading_time || 5} دقائق قراءة
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Featured Image */}
          {article.cover_image && (
            <div className="container mx-auto px-4 mt-8">
              <figure className="max-w-4xl mx-auto">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-legal-emerald/10">
                  <img
                    src={article.cover_image}
                    alt={article.title}
                    className="w-full aspect-[21/9] object-cover"
                    loading="eager"
                  />
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/10" />
                </div>
                <figcaption className="text-center text-xs text-muted-foreground mt-3">
                  صورة توضيحية — {article.category || 'القانون المغربي'}
                </figcaption>
              </figure>
            </div>
          )}
        </header>

        {/* ═══ Main Content Area with Sidebar ═══ */}
        <div className="container mx-auto px-4 py-10 md:py-14">
          <div className="max-w-6xl mx-auto flex gap-10">

            {/* ── Sticky Sidebar (TOC) ── */}
            {toc.length > 0 && (
              <aside className="hidden lg:block w-72 shrink-0 print:hidden">
                <div className="sticky top-20">
                  <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
                    <button
                      onClick={() => setTocOpen(!tocOpen)}
                      className="w-full px-5 py-4 flex items-center justify-between bg-muted/30 border-b border-border/40 hover:bg-muted/50 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Hash className="h-4 w-4 text-legal-emerald" /> فهرس المقال
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${tocOpen ? '' : '-rotate-90'}`} />
                    </button>
                    {tocOpen && (
                      <nav className="p-4 space-y-0.5 max-h-[60vh] overflow-y-auto">
                        {/* Progress indicator */}
                        <div className="mb-3 px-2">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                            <span>تقدم القراءة</span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-legal-emerald rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        {toc.map(item => (
                          <button
                            key={item.id}
                            onClick={() => scrollToHeading(item.id)}
                            className={`w-full text-right px-3 py-2 rounded-lg text-sm transition-all duration-200 leading-relaxed ${
                              item.level === 3 ? 'pr-6 text-xs' : ''
                            } ${
                              activeHeading === item.id
                                ? 'bg-legal-emerald/10 text-legal-emerald font-medium border-r-2 border-legal-emerald'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                          >
                            {item.text}
                          </button>
                        ))}
                      </nav>
                    )}
                  </div>
                </div>
              </aside>
            )}

            {/* ── Article Body ── */}
            <article className="flex-1 min-w-0" ref={articleRef}>
              <div id="article-body"
                className="legal-article-content prose prose-lg max-w-none dark:prose-invert
                  prose-headings:text-foreground prose-headings:font-heading prose-headings:font-bold prose-headings:leading-snug
                  prose-h2:text-[1.4rem] prose-h2:md:text-[1.6rem] prose-h2:mt-12 prose-h2:mb-5 prose-h2:pb-3 prose-h2:border-b prose-h2:border-border/30
                  prose-h3:text-[1.15rem] prose-h3:md:text-[1.3rem] prose-h3:mt-9 prose-h3:mb-4
                  prose-p:text-foreground/85 prose-p:leading-[2] prose-p:text-[0.975rem] prose-p:md:text-[1.05rem] prose-p:mb-5
                  prose-a:text-legal-emerald prose-a:font-medium prose-a:no-underline prose-a:border-b prose-a:border-legal-emerald/30 hover:prose-a:border-legal-emerald
                  prose-strong:text-foreground prose-strong:font-semibold
                  prose-img:rounded-2xl prose-img:shadow-xl prose-img:my-8
                  prose-blockquote:border-r-[3px] prose-blockquote:border-legal-gold prose-blockquote:bg-legal-gold/5 prose-blockquote:rounded-xl prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:not-italic prose-blockquote:text-foreground/80 prose-blockquote:my-8
                  prose-li:text-foreground/85 prose-li:leading-[2]
                  prose-ul:mr-0 prose-ol:mr-0
                  prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal"
                dir="rtl"
                dangerouslySetInnerHTML={{ __html: processedContent }}
              />

              {/* ── Tags ── */}
              {article.tags && article.tags.length > 0 && (
                <div className="mt-14 p-6 bg-muted/20 rounded-2xl border border-border/40">
                  <div className="flex items-center gap-2 mb-4">
                    <Tag className="h-4 w-4 text-legal-gold" />
                    <span className="text-sm font-semibold text-foreground font-heading">الوسوم والكلمات المفتاحية</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {article.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs bg-card hover:bg-legal-emerald/5 hover:border-legal-emerald/30 hover:text-legal-emerald transition-colors cursor-pointer rounded-full px-3 py-1">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Share Section ── */}
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 py-8 border-y border-border/40 print:hidden">
                <span className="text-sm font-medium text-foreground">شارك هذا المقال:</span>
                <div className="flex items-center gap-2">
                  {[
                    { platform: 'facebook', icon: Facebook, label: 'فيسبوك', hoverClass: 'hover:bg-[#1877F2]/10 hover:text-[#1877F2] hover:border-[#1877F2]/30' },
                    { platform: 'whatsapp', icon: MessageCircle, label: 'واتساب', hoverClass: 'hover:bg-[#25D366]/10 hover:text-[#25D366] hover:border-[#25D366]/30' },
                    { platform: 'twitter', icon: Twitter, label: 'تويتر', hoverClass: 'hover:bg-[#1DA1F2]/10 hover:text-[#1DA1F2] hover:border-[#1DA1F2]/30' },
                    { platform: 'copy', icon: Copy, label: 'نسخ الرابط', hoverClass: 'hover:bg-muted hover:text-foreground' },
                  ].map(s => (
                    <button
                      key={s.platform}
                      onClick={() => shareArticle(s.platform)}
                      className={`w-10 h-10 rounded-xl border border-border bg-card flex items-center justify-center transition-all duration-200 hover:scale-105 ${s.hoverClass}`}
                      aria-label={s.label}
                    >
                      <s.icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Author Bio ── */}
              <AuthorBioCard />

              {/* ── CTA Section ── */}
              <div className="mt-14 relative overflow-hidden rounded-2xl bg-gradient-to-br from-legal-emerald/10 via-legal-emerald/5 to-legal-gold/5 border border-legal-emerald/20 p-8 md:p-10 print:hidden">
                <div className="absolute top-0 left-0 w-40 h-40 bg-legal-gold/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
                <div className="absolute bottom-0 right-0 w-48 h-48 bg-legal-emerald/5 rounded-full translate-x-1/4 translate-y-1/4 blur-3xl" />
                <div className="relative z-10 text-center space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-legal-emerald/10 flex items-center justify-center mx-auto">
                    <Scale className="h-8 w-8 text-legal-emerald" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-foreground font-heading">هل لديك سؤال حول هذا الموضوع؟</h3>
                  <p className="text-muted-foreground max-w-lg mx-auto text-sm">
                    احصل على استشارة قانونية ذكية فورية مبنية على القانون المغربي والاجتهادات القضائية
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <Link to="/ai-consultation">
                      <Button size="lg" className="gap-2 rounded-xl bg-legal-emerald hover:bg-legal-emerald/90 text-white shadow-lg shadow-legal-emerald/20">
                        استشارة ذكية مجانية <ArrowLeft className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link to="/legal-fee-calculator">
                      <Button variant="outline" size="lg" className="gap-2 rounded-xl border-legal-gold/30 text-legal-gold hover:bg-legal-gold/5">
                        حاسبة الرسوم القضائية
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>

        {/* ═══ Related Articles ═══ */}
        {related.length > 0 && (
          <section className="border-t border-border/40 py-14 md:py-20 bg-muted/20 print:hidden">
            <div className="container mx-auto px-4">
              <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-10">
                  <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground font-heading">مقالات ذات صلة</h2>
                    <p className="text-sm text-muted-foreground">تابع القراءة حول {article.category || 'هذا الموضوع'}</p>
                  </div>
                  <Link to="/blog">
                    <Button variant="outline" size="sm" className="gap-1.5 rounded-lg text-muted-foreground hover:text-legal-emerald hover:border-legal-emerald/30">
                      عرض الكل <ArrowLeft className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {related.map(r => (
                    <Link to={`/blog/${r.slug}`} key={r.id} className="group">
                      <Card className="overflow-hidden border-border/40 hover:shadow-xl hover:shadow-legal-emerald/5 hover:border-legal-emerald/20 transition-all duration-500 hover:-translate-y-1 h-full bg-card">
                        <div className="aspect-[16/10] overflow-hidden">
                          <img
                            src={r.cover_image || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=250&fit=crop'}
                            alt={r.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            loading="lazy"
                          />
                        </div>
                        <CardContent className="p-5 space-y-3">
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full border-legal-emerald/20 text-legal-emerald">
                            {r.category || 'عام'}
                          </Badge>
                          <h3 className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-legal-emerald transition-colors leading-relaxed font-heading">
                            {r.title}
                          </h3>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(r.created_at).toLocaleDateString('ar-MA')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {r.reading_time || 5} د
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ═══ Newsletter ═══ */}
        <NewsletterSection />

        {/* ═══ Footer ═══ */}
        <footer className="py-10 border-t border-border/40 print:hidden">
          <div className="container mx-auto px-4 text-center space-y-4">
            <div className="flex items-center justify-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-legal-emerald flex items-center justify-center">
                <Scale className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-foreground font-heading">محاماة ذكية</span>
            </div>
            <p className="text-sm text-muted-foreground">منصة قانونية مغربية متكاملة — محتوى موثوق واستشارات ذكية</p>
            <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
              <Link to="/blog" className="hover:text-legal-emerald transition-colors">المدونة</Link>
              <Link to="/ai-consultation" className="hover:text-legal-emerald transition-colors">استشارة ذكية</Link>
              <Link to="/legal-fee-calculator" className="hover:text-legal-emerald transition-colors">حاسبة الرسوم</Link>
              <Link to="/case-tracker" className="hover:text-legal-emerald transition-colors">تتبع القضايا</Link>
            </div>
          </div>
        </footer>
      </div>

      {/* ═══ Floating Social Sidebar ═══ */}
      <div className="fixed top-1/2 left-4 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-2 print:hidden">
        {[
          { p: 'facebook', icon: Facebook, color: 'hover:bg-[#1877F2] hover:text-white' },
          { p: 'whatsapp', icon: MessageCircle, color: 'hover:bg-[#25D366] hover:text-white' },
          { p: 'twitter', icon: Twitter, color: 'hover:bg-[#1DA1F2] hover:text-white' },
          { p: 'copy', icon: Copy, color: 'hover:bg-foreground hover:text-background' },
        ].map(s => (
          <button
            key={s.p}
            onClick={() => shareArticle(s.p)}
            className={`w-10 h-10 rounded-xl bg-card border border-border/50 flex items-center justify-center text-muted-foreground transition-all duration-200 hover:scale-110 hover:shadow-lg ${s.color}`}
          >
            <s.icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      {/* ═══ Scroll to Top ═══ */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 left-6 xl:left-20 z-50 w-12 h-12 rounded-full bg-legal-emerald text-white shadow-lg shadow-legal-emerald/30 flex items-center justify-center hover:scale-110 transition-transform animate-in fade-in slide-in-from-bottom-4 print:hidden"
          aria-label="العودة للأعلى"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
    </>
  );
};

export default BlogArticle;
