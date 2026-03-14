import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Scale, Calendar, ArrowRight, Clock, Tag, Share2, BookOpen, ArrowLeft, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BlogArticle = () => {
  const { slug } = useParams();
  const [article, setArticle] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);

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
        // Fetch related articles
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

  const shareArticle = () => {
    if (navigator.share) {
      navigator.share({ title: article?.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('تم نسخ الرابط');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <BookOpen className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">المقال غير موجود</p>
        <Link to="/blog"><Button variant="outline">العودة للمدونة</Button></Link>
      </div>
    );
  }

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.seo_title || article.title,
    description: article.seo_description || article.excerpt,
    image: article.cover_image,
    datePublished: article.published_at || article.created_at,
    dateModified: article.updated_at,
    author: { '@type': 'Organization', name: 'محاماة ذكية' },
    publisher: {
      '@type': 'Organization',
      name: 'محاماة ذكية',
      url: window.location.origin,
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': window.location.href },
    inLanguage: 'ar',
    articleSection: article.category || 'قانون',
    wordCount: article.content?.replace(/<[^>]+>/g, '').length || 0,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: window.location.origin },
      { '@type': 'ListItem', position: 2, name: 'المدونة', item: `${window.location.origin}/blog` },
      { '@type': 'ListItem', position: 3, name: article.title, item: window.location.href },
    ],
  };

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
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold text-foreground">محاماة ذكية</span>
            </Link>
            <div className="hidden md:flex items-center gap-4">
              <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowRight className="h-3 w-3" /> المدونة
              </Link>
              <Link to="/ai-consultation" className="text-sm text-muted-foreground hover:text-foreground">استشارة ذكية</Link>
            </div>
            <button className="md:hidden" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {mobileNav && (
            <div className="md:hidden border-t border-border bg-background p-4 space-y-2">
              <Link to="/blog" className="block text-sm text-muted-foreground" onClick={() => setMobileNav(false)}>المدونة</Link>
              <Link to="/ai-consultation" className="block text-sm text-muted-foreground" onClick={() => setMobileNav(false)}>استشارة ذكية</Link>
            </div>
          )}
        </nav>

        {/* Breadcrumb */}
        <div className="border-b border-border">
          <div className="container mx-auto px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground overflow-x-auto">
            <Link to="/" className="hover:text-foreground shrink-0">الرئيسية</Link>
            <span>/</span>
            <Link to="/blog" className="hover:text-foreground shrink-0">المدونة</Link>
            <span>/</span>
            <span className="text-foreground truncate">{article.title}</span>
          </div>
        </div>

        <article className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <header className="space-y-4 mb-8">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{article.category || 'عام'}</Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {article.reading_time || 5} دقائق قراءة
                </span>
              </div>
              <h1 className="text-2xl md:text-4xl font-bold text-foreground leading-tight">{article.title}</h1>
              {article.excerpt && (
                <p className="text-lg text-muted-foreground leading-relaxed">{article.excerpt}</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(article.created_at).toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <Button variant="ghost" size="sm" onClick={shareArticle} className="gap-1">
                  <Share2 className="h-4 w-4" /> مشاركة
                </Button>
              </div>
            </header>

            {/* Cover image */}
            {article.cover_image && (
              <div className="h-56 md:h-96 overflow-hidden rounded-xl mb-8">
                <img
                  src={article.cover_image}
                  alt={article.title}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
            )}

            {/* Content */}
            <div
              className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-strong:text-foreground prose-img:rounded-xl"
              dir="rtl"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="mt-8 flex items-center gap-2 flex-wrap">
                <Tag className="h-4 w-4 text-muted-foreground" />
                {article.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}

            <Separator className="my-8" />

            {/* CTA */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6 text-center space-y-3">
                <h3 className="text-lg font-bold text-foreground">هل لديك سؤال حول هذا الموضوع؟</h3>
                <p className="text-sm text-muted-foreground">احصل على استشارة قانونية ذكية فورية</p>
                <Link to="/ai-consultation">
                  <Button className="gap-2">استشارة ذكية مجانية <ArrowLeft className="h-4 w-4" /></Button>
                </Link>
              </CardContent>
            </Card>

            {/* Related articles */}
            {related.length > 0 && (
              <div className="mt-12 space-y-6">
                <h2 className="text-xl font-bold text-foreground">مقالات ذات صلة</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {related.map(r => (
                    <Link to={`/blog/${r.slug}`} key={r.id}>
                      <Card className="overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 h-full group">
                        <div className="h-32 overflow-hidden">
                          <img
                            src={r.cover_image || `https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=250&fit=crop`}
                            alt={r.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        </div>
                        <CardContent className="pt-3 pb-3">
                          <p className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">{r.title}</p>
                          <span className="text-xs text-muted-foreground mt-1 block">{new Date(r.created_at).toLocaleDateString('ar-MA')}</span>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      </div>
    </>
  );
};

export default BlogArticle;
