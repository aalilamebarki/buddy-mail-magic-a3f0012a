import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Scale, Calendar, ArrowRight, Clock, Tag, Share2, BookOpen, ArrowLeft, Menu, X, ChevronUp, Facebook, MessageCircle, Copy, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BlogArticle = () => {
  const { slug } = useParams();
  const [article, setArticle] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const article = document.getElementById('article-content');
      if (article) {
        const rect = article.getBoundingClientRect();
        const total = article.scrollHeight;
        const scrolled = Math.max(0, -rect.top);
        setProgress(Math.min(100, (scrolled / total) * 100));
      }
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
          .limit(4);
        if (relatedData) setRelated(relatedData);
      }
      setLoading(false);
    };
    fetchArticle();
    window.scrollTo(0, 0);
  }, [slug]);

  const shareArticle = (platform?: string) => {
    const url = window.location.href;
    const title = article?.title || '';
    if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`, '_blank');
    } else if (platform === 'copy') {
      navigator.clipboard.writeText(url);
      toast.success('تم نسخ الرابط');
    } else if (navigator.share) {
      navigator.share({ title, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('تم نسخ الرابط');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-1 bg-primary/20 fixed top-0 left-0 right-0 z-[60]">
          <div className="h-full bg-primary animate-pulse w-1/3" />
        </div>
        <div className="container mx-auto px-4 pt-24">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="h-8 bg-muted rounded-lg w-1/4 animate-pulse" />
            <div className="h-12 bg-muted rounded-lg w-3/4 animate-pulse" />
            <div className="h-6 bg-muted rounded-lg w-1/2 animate-pulse" />
            <div className="aspect-[21/9] bg-muted rounded-2xl animate-pulse" />
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-4 bg-muted rounded w-full animate-pulse" style={{ width: `${85 + Math.random() * 15}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <BookOpen className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">المقال غير موجود</h1>
          <p className="text-muted-foreground">ربما تم حذفه أو تغيير رابطه</p>
        </div>
        <Link to="/blog"><Button variant="outline" className="gap-2"><ArrowRight className="h-4 w-4" /> العودة للمدونة</Button></Link>
      </div>
    );
  }

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
      '@type': 'Organization',
      name: 'محاماة ذكية',
      url: window.location.origin,
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
      return {
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: article.excerpt || question },
      };
    }),
  } : null;

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
        {article.tags?.map((tag: string) => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={article.seo_title || article.title} />
        <meta name="twitter:description" content={article.seo_description || article.excerpt} />
        <meta name="twitter:image" content={article.cover_image} />
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
        {faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
      </Helmet>

      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-[60] h-1 bg-muted">
        <div
          className="h-full bg-gradient-to-l from-primary to-primary/70 transition-all duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="min-h-screen bg-background">
        {/* Navbar */}
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="container mx-auto px-4 flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Scale className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-base font-bold text-foreground hidden sm:block">محاماة ذكية</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              <Link to="/blog">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                  <ArrowRight className="h-3.5 w-3.5" /> المدونة
                </Button>
              </Link>
              <Link to="/ai-consultation">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">استشارة ذكية</Button>
              </Link>
              <Link to="/legal-fee-calculator">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">حاسبة الرسوم</Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => shareArticle()} className="gap-1">
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <button className="md:hidden p-2" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {mobileNav && (
            <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl p-4 space-y-1 animate-in slide-in-from-top-2">
              <Link to="/blog" className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-sm text-muted-foreground" onClick={() => setMobileNav(false)}>
                <ArrowRight className="h-4 w-4" /> المدونة
              </Link>
              <Link to="/ai-consultation" className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-sm text-muted-foreground" onClick={() => setMobileNav(false)}>
                استشارة ذكية
              </Link>
              <Link to="/legal-fee-calculator" className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-sm text-muted-foreground" onClick={() => setMobileNav(false)}>
                حاسبة الرسوم
              </Link>
            </div>
          )}
        </nav>

        {/* Hero Section with Cover Image */}
        <div className="relative">
          {article.cover_image && (
            <div className="relative h-[40vh] md:h-[55vh] overflow-hidden">
              <img
                src={article.cover_image}
                alt={article.title}
                className="w-full h-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-background/30 to-transparent h-24" />
            </div>
          )}

          {/* Article Header - Overlapping the image */}
          <div className={`container mx-auto px-4 ${article.cover_image ? '-mt-32 md:-mt-40 relative z-10' : 'pt-8'}`}>
            <div className="max-w-3xl mx-auto">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4 overflow-x-auto pb-1" aria-label="breadcrumb">
                <Link to="/" className="hover:text-foreground transition-colors shrink-0">الرئيسية</Link>
                <span className="text-border">/</span>
                <Link to="/blog" className="hover:text-foreground transition-colors shrink-0">المدونة</Link>
                <span className="text-border">/</span>
                <Link to={`/blog?category=${article.category}`} className="hover:text-foreground transition-colors shrink-0">{article.category || 'عام'}</Link>
              </nav>

              <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-6 md:p-10 shadow-xl border border-border/50 space-y-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                    {article.category || 'عام'}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {article.reading_time || 5} دقائق قراءة
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(article.created_at).toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>

                <h1 className="text-2xl md:text-4xl lg:text-[2.75rem] font-bold text-foreground leading-[1.3] tracking-tight">
                  {article.title}
                </h1>

                {article.excerpt && (
                  <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                    {article.excerpt}
                  </p>
                )}

                {/* Share buttons */}
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-xs text-muted-foreground ml-1">مشاركة:</span>
                  <button
                    onClick={() => shareArticle('facebook')}
                    className="w-8 h-8 rounded-full bg-muted hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-colors"
                    aria-label="مشاركة على فيسبوك"
                  >
                    <Facebook className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => shareArticle('whatsapp')}
                    className="w-8 h-8 rounded-full bg-muted hover:bg-success/10 hover:text-success flex items-center justify-center transition-colors"
                    aria-label="مشاركة على واتساب"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => shareArticle('copy')}
                    className="w-8 h-8 rounded-full bg-muted hover:bg-accent-foreground/10 flex items-center justify-center transition-colors"
                    aria-label="نسخ الرابط"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Article Content */}
        <article className="container mx-auto px-4 py-8 md:py-12" id="article-content">
          <div className="max-w-3xl mx-auto">
            <div
              className="article-content prose prose-lg max-w-none dark:prose-invert
                prose-headings:text-foreground prose-headings:font-bold prose-headings:leading-tight
                prose-h2:text-xl prose-h2:md:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-3 prose-h2:border-b prose-h2:border-border/50
                prose-h3:text-lg prose-h3:md:text-xl prose-h3:mt-8 prose-h3:mb-3
                prose-p:text-foreground/85 prose-p:leading-[1.9] prose-p:text-base prose-p:md:text-[1.075rem]
                prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline
                prose-strong:text-foreground prose-strong:font-semibold
                prose-img:rounded-2xl prose-img:shadow-lg
                prose-blockquote:border-r-4 prose-blockquote:border-primary/40 prose-blockquote:bg-muted/50 prose-blockquote:rounded-lg prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic
                prose-li:text-foreground/85 prose-li:leading-[1.8]
                prose-ul:mr-0 prose-ol:mr-0"
              dir="rtl"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="mt-12 p-6 bg-muted/30 rounded-2xl border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">الوسوم</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {article.tags.map((tag: string) => (
                    <Badge key={tag} variant="outline" className="text-xs bg-background hover:bg-primary/5 hover:border-primary/30 transition-colors cursor-pointer">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Inline CTA */}
            <div className="mt-12 relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-8 md:p-10">
              <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl" />
              <div className="absolute bottom-0 right-0 w-40 h-40 bg-primary/5 rounded-full translate-x-1/4 translate-y-1/4 blur-3xl" />
              <div className="relative z-10 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Scale className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-foreground">هل لديك سؤال حول هذا الموضوع؟</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  احصل على استشارة قانونية ذكية فورية مبنية على القانون المغربي
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <Link to="/ai-consultation">
                    <Button size="lg" className="gap-2 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
                      استشارة ذكية مجانية <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/legal-fee-calculator">
                    <Button variant="outline" size="lg" className="gap-2 rounded-xl">
                      حاسبة الرسوم القضائية
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Share Section */}
            <div className="mt-10 flex items-center justify-center gap-3 py-6 border-y border-border/50">
              <span className="text-sm text-muted-foreground">شارك هذا المقال:</span>
              <button
                onClick={() => shareArticle('facebook')}
                className="w-10 h-10 rounded-xl bg-muted hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-all hover:scale-105"
                aria-label="مشاركة على فيسبوك"
              >
                <Facebook className="h-4 w-4" />
              </button>
              <button
                onClick={() => shareArticle('whatsapp')}
                className="w-10 h-10 rounded-xl bg-muted hover:bg-success/10 hover:text-success flex items-center justify-center transition-all hover:scale-105"
                aria-label="مشاركة على واتساب"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
              <button
                onClick={() => shareArticle('copy')}
                className="w-10 h-10 rounded-xl bg-muted hover:bg-accent-foreground/10 flex items-center justify-center transition-all hover:scale-105"
                aria-label="نسخ الرابط"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        </article>

        {/* Related Articles */}
        {related.length > 0 && (
          <section className="bg-muted/30 border-t border-border/50 py-12 md:py-16">
            <div className="container mx-auto px-4">
              <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <div className="space-y-1">
                    <h2 className="text-xl md:text-2xl font-bold text-foreground">مقالات ذات صلة</h2>
                    <p className="text-sm text-muted-foreground">اقرأ المزيد حول {article.category || 'هذا الموضوع'}</p>
                  </div>
                  <Link to="/blog">
                    <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                      عرض الكل <ArrowLeft className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {related.map(r => (
                    <Link to={`/blog/${r.slug}`} key={r.id} className="group">
                      <Card className="overflow-hidden border-border/50 hover:shadow-xl hover:border-primary/20 transition-all duration-300 hover:-translate-y-1 h-full bg-card">
                        <div className="aspect-[16/10] overflow-hidden">
                          <img
                            src={r.cover_image || `https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=250&fit=crop`}
                            alt={r.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            loading="lazy"
                          />
                        </div>
                        <CardContent className="p-4 space-y-2">
                          <Badge variant="outline" className="text-[10px] px-2 py-0">{r.category || 'عام'}</Badge>
                          <h3 className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-relaxed">
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

        {/* Footer CTA */}
        <section className="py-12 border-t border-border/50">
          <div className="container mx-auto px-4 text-center space-y-4">
            <p className="text-sm text-muted-foreground">محاماة ذكية - منصة قانونية مغربية متكاملة</p>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <Link to="/blog" className="hover:text-foreground transition-colors">المدونة</Link>
              <span className="text-border">·</span>
              <Link to="/ai-consultation" className="hover:text-foreground transition-colors">استشارة ذكية</Link>
              <span className="text-border">·</span>
              <Link to="/legal-fee-calculator" className="hover:text-foreground transition-colors">حاسبة الرسوم</Link>
              <span className="text-border">·</span>
              <Link to="/case-tracker" className="hover:text-foreground transition-colors">تتبع القضايا</Link>
            </div>
          </div>
        </section>
      </div>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 left-6 z-50 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-110 transition-transform animate-in fade-in slide-in-from-bottom-4"
          aria-label="العودة للأعلى"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
    </>
  );
};

export default BlogArticle;
