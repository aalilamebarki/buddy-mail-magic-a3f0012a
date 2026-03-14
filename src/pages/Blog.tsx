import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Scale, Search, Calendar, ArrowLeft, Clock, Tag, Menu, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const CATEGORIES = [
  'الكل', 'قضايا الأسرة', 'قضايا الكراء', 'قضايا الشغل', 'قضايا عقارية',
  'قضايا تجارية', 'قضايا جنائية', 'قضايا إدارية', 'قضايا مدنية', 'إجراءات قانونية'
];

const Blog = () => {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const fetchArticles = async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      if (!error && data) setArticles(data);
      setLoading(false);
    };
    fetchArticles();
  }, []);

  const filtered = articles.filter(a => {
    const matchSearch = !search || a.title?.includes(search) || a.excerpt?.includes(search);
    const matchCat = activeCategory === 'الكل' || a.category === activeCategory;
    return matchSearch && matchCat;
  });

  const categories = CATEGORIES.filter(c =>
    c === 'الكل' || articles.some(a => a.category === c)
  );

  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'المدونة القانونية - محاماة ذكية',
    description: 'مقالات قانونية متخصصة في القانون المغربي',
    url: window.location.href,
    inLanguage: 'ar',
    publisher: {
      '@type': 'Organization',
      name: 'محاماة ذكية',
      url: window.location.origin,
    },
  };

  return (
    <>
      <Helmet>
        <title>المدونة القانونية - مقالات قانونية مغربية متخصصة | محاماة ذكية</title>
        <meta name="description" content="مقالات قانونية متخصصة في القانون المغربي: قضايا الأسرة، الكراء، الشغل، العقار والقضايا التجارية. استشر محاميك الذكي." />
        <link rel="canonical" href={`${window.location.origin}/blog`} />
        <script type="application/ld+json">{JSON.stringify(schemaData)}</script>
      </Helmet>
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold text-foreground">محاماة ذكية</span>
            </Link>
            <div className="hidden md:flex items-center gap-4">
              <Link to="/ai-consultation" className="text-sm text-muted-foreground hover:text-foreground">استشارة ذكية</Link>
              <Link to="/legal-fee-calculator" className="text-sm text-muted-foreground hover:text-foreground">حاسبة الرسوم</Link>
              <Link to="/auth"><Button size="sm">تسجيل الدخول</Button></Link>
            </div>
            <button className="md:hidden" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {mobileNav && (
            <div className="md:hidden border-t border-border bg-background p-4 space-y-2">
              <Link to="/ai-consultation" className="block text-sm text-muted-foreground" onClick={() => setMobileNav(false)}>استشارة ذكية</Link>
              <Link to="/legal-fee-calculator" className="block text-sm text-muted-foreground" onClick={() => setMobileNav(false)}>حاسبة الرسوم</Link>
              <Link to="/auth" onClick={() => setMobileNav(false)}><Button size="sm" className="w-full mt-2">تسجيل الدخول</Button></Link>
            </div>
          )}
        </nav>

        {/* Hero */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-12 md:py-16">
          <div className="container mx-auto px-4 text-center space-y-4">
            <h1 className="text-3xl md:text-5xl font-bold text-foreground">المدونة القانونية</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">مقالات ونصائح قانونية متخصصة في القانون المغربي لمساعدتك في فهم حقوقك</p>
            <div className="relative max-w-lg mx-auto">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="ابحث عن موضوع قانوني..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-12 h-12 text-base rounded-xl"
              />
            </div>
          </div>
        </section>

        {/* Categories */}
        <div className="border-b border-border sticky top-16 z-40 bg-background/80 backdrop-blur-md">
          <div className="container mx-auto px-4">
            <div className="flex gap-1 overflow-x-auto py-3 scrollbar-hide">
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={activeCategory === cat ? 'default' : 'ghost'}
                  size="sm"
                  className="shrink-0 text-xs md:text-sm"
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <main className="container mx-auto px-4 py-8 md:py-12">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i} className="animate-pulse">
                  <div className="h-48 bg-muted rounded-t-lg" />
                  <CardHeader><div className="h-5 bg-muted rounded w-3/4" /></CardHeader>
                  <CardContent><div className="h-4 bg-muted rounded w-full" /></CardContent>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Search className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-lg text-muted-foreground">لا توجد مقالات {search && 'تطابق بحثك'}</p>
            </div>
          ) : (
            <>
              {/* Featured article */}
              {filtered.length > 0 && !search && activeCategory === 'الكل' && (
                <Link to={`/blog/${filtered[0].slug}`} className="block mb-8">
                  <Card className="overflow-hidden hover:shadow-xl transition-all group">
                    <div className="grid grid-cols-1 md:grid-cols-2">
                      <div className="h-56 md:h-80 overflow-hidden">
                        <img
                          src={filtered[0].cover_image || `https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&h=500&fit=crop`}
                          alt={filtered[0].title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="eager"
                        />
                      </div>
                      <div className="p-6 md:p-8 flex flex-col justify-center space-y-4">
                        <Badge variant="secondary" className="w-fit">{filtered[0].category || 'عام'}</Badge>
                        <h2 className="text-xl md:text-2xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                          {filtered[0].title}
                        </h2>
                        <p className="text-muted-foreground line-clamp-3 text-sm">{filtered[0].excerpt}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(filtered[0].created_at).toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {filtered[0].reading_time || 5} دقائق قراءة
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              )}

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(search || activeCategory !== 'الكل' ? filtered : filtered.slice(1)).map((article) => (
                  <Link to={`/blog/${article.slug}`} key={article.id}>
                    <Card className="overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 h-full group">
                      <div className="h-48 overflow-hidden">
                        <img
                          src={article.cover_image || `https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&h=400&fit=crop`}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      </div>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">{article.category || 'عام'}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {article.reading_time || 5} د
                          </span>
                        </div>
                        <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors line-clamp-2">
                          {article.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">{article.excerpt}</p>
                        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(article.created_at).toLocaleDateString('ar-MA')}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          )}
        </main>

        {/* CTA */}
        <section className="bg-primary/5 py-12">
          <div className="container mx-auto px-4 text-center space-y-4">
            <h2 className="text-2xl font-bold text-foreground">هل لديك سؤال قانوني؟</h2>
            <p className="text-muted-foreground">احصل على استشارة ذكية فورية مبنية على القانون المغربي</p>
            <Link to="/ai-consultation">
              <Button size="lg" className="gap-2">استشارة ذكية مجانية <ArrowLeft className="h-4 w-4" /></Button>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
};

export default Blog;
