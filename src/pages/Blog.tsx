import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion, useInView } from 'framer-motion';
import {
  Scale, Search, Calendar, ArrowLeft, Clock, Menu, X,
  Sparkles, BookOpen, Filter, TrendingUp, Gavel, ScrollText,
  Tag, Eye,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const CATEGORIES = [
  'الكل', 'قضايا الأسرة', 'قضايا الكراء', 'قضايا الشغل', 'قضايا عقارية',
  'قضايا تجارية', 'قضايا جنائية', 'قضايا إدارية', 'قضايا مدنية', 'إجراءات قانونية'
];

const categoryIcons: Record<string, typeof Scale> = {
  'الكل': BookOpen,
  'قضايا الأسرة': Scale,
  'قضايا الكراء': ScrollText,
  'قضايا الشغل': Gavel,
  'قضايا عقارية': ScrollText,
  'قضايا تجارية': TrendingUp,
  'قضايا جنائية': Gavel,
  'قضايا إدارية': Scale,
  'قضايا مدنية': ScrollText,
  'إجراءات قانونية': BookOpen,
};

const AnimatedCard = ({ children, index }: { children: React.ReactNode; index: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08 }}>
      {children}
    </motion.div>
  );
};

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
    publisher: { '@type': 'Organization', name: 'محاماة ذكية', url: window.location.origin },
  };

  return (
    <>
      <Helmet>
        <title>المدونة القانونية - مقالات قانونية مغربية متخصصة | محاماة ذكية</title>
        <meta name="description" content="مقالات قانونية متخصصة في القانون المغربي: قضايا الأسرة، الكراء، الشغل، العقار والقضايا التجارية." />
        <link rel="canonical" href={`${window.location.origin}/blog`} />
        <script type="application/ld+json">{JSON.stringify(schemaData)}</script>
      </Helmet>

      <div className="min-h-screen bg-background" dir="rtl">
        {/* ═══ NAV ═══ */}
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border/30">
          <div className="container mx-auto px-4 flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center">
                <Scale className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold text-foreground">محاماة ذكية</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              <Link to="/blog" className="px-3 py-1.5 text-xs text-primary font-medium transition-colors rounded-lg bg-primary/5">المقالات</Link>
              <Link to="/ai-consultation" className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent">المستشار الذكي</Link>
              <Link to="/legal-fee-calculator" className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent">الأدوات</Link>
              <div className="w-px h-5 bg-border mx-1" />
              <Link to="/auth"><Button size="sm" className="rounded-full px-5 text-xs">دخول</Button></Link>
            </div>
            <button className="md:hidden p-2 rounded-lg hover:bg-accent" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {mobileNav && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border p-4 space-y-2">
              <Link to="/ai-consultation" className="block px-4 py-3 rounded-xl text-sm hover:bg-accent" onClick={() => setMobileNav(false)}>المستشار الذكي</Link>
              <Link to="/legal-fee-calculator" className="block px-4 py-3 rounded-xl text-sm hover:bg-accent" onClick={() => setMobileNav(false)}>حاسبة الرسوم</Link>
              <Link to="/auth" onClick={() => setMobileNav(false)}><Button size="sm" className="w-full mt-2 rounded-full">تسجيل الدخول</Button></Link>
            </motion.div>
          )}
        </nav>

        {/* ═══ HERO ═══ */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-legal-navy/[0.04] via-background to-background" />
          <div className="absolute top-0 left-1/3 w-[500px] h-[500px] rounded-full bg-primary/[0.03] blur-[100px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-legal-gold/[0.04] blur-[80px]" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
              backgroundSize: '50px 50px',
            }}
          />

          <div className="container mx-auto px-4 relative z-10 py-14 md:py-20">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              className="max-w-3xl mx-auto text-center space-y-6">
              <Badge className="bg-legal-gold/10 text-legal-gold border-legal-gold/20 px-4 py-1.5 text-xs rounded-full">
                <BookOpen className="h-3 w-3 ml-1.5" />
                +{articles.length || 200} مقال منشور
              </Badge>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-[1.15]">
                المدونة <span className="bg-gradient-to-l from-primary via-legal-gold to-legal-emerald bg-clip-text text-transparent">القانونية</span>
              </h1>
              <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
                محتوى قانوني مغربي معمّق ومحدّث، مكتوب بأسلوب واضح يساعدك على فهم حقوقك والدفاع عنها
              </p>

              {/* Search */}
              <div className="relative max-w-lg mx-auto">
                <div className="absolute inset-0 bg-gradient-to-l from-primary/10 via-legal-gold/5 to-primary/10 rounded-2xl blur-xl" />
                <div className="relative">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="ابحث عن موضوع قانوني..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-12 h-13 text-base rounded-2xl border-border/40 bg-card shadow-lg shadow-foreground/[0.03] focus:shadow-xl focus:border-primary/30 transition-all"
                  />
                  {search && (
                    <button onClick={() => setSearch('')}
                      className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors">
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap justify-center gap-4 pt-2 text-xs text-muted-foreground">
                {[
                  { icon: ScrollText, text: `${filtered.length || articles.length} مقال` },
                  { icon: Tag, text: `${categories.length - 1} تصنيف` },
                  { icon: Eye, text: 'قراءة مجانية' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 rounded-full">
                    <s.icon className="h-3 w-3" /> {s.text}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══ CATEGORIES ═══ */}
        <div className="border-b border-border/30 sticky top-16 z-40 bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-2 py-3">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                {categories.map(cat => {
                  const Icon = categoryIcons[cat] || BookOpen;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                        activeCategory === cat
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ CONTENT ═══ */}
        <main className="container mx-auto px-4 py-10 md:py-14">
          {/* Results count */}
          {!loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center justify-between mb-6">
              <p className="text-sm text-muted-foreground">
                {search || activeCategory !== 'الكل'
                  ? <>{filtered.length} نتيجة {search && <span>لـ «{search}»</span>}</>
                  : <>{articles.length} مقال منشور</>
                }
              </p>
              {(search || activeCategory !== 'الكل') && (
                <button onClick={() => { setSearch(''); setActiveCategory('الكل'); }}
                  className="text-xs text-primary hover:underline">
                  عرض الكل
                </button>
              )}
            </motion.div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="rounded-2xl border border-border/20 overflow-hidden animate-pulse">
                  <div className="h-52 bg-muted" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-muted rounded w-1/4" />
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 space-y-5">
              <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto border border-border/20">
                <Search className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">لا توجد نتائج</p>
                <p className="text-sm text-muted-foreground mt-1">{search ? 'جرّب كلمات مفتاحية مختلفة' : 'لا توجد مقالات في هذا التصنيف بعد'}</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => { setSearch(''); setActiveCategory('الكل'); }}>
                عرض جميع المقالات
              </Button>
            </motion.div>
          ) : (
            <>
              {/* Featured article */}
              {filtered.length > 0 && !search && activeCategory === 'الكل' && (
                <AnimatedCard index={0}>
                  <Link to={`/blog/${filtered[0].slug}`} className="block mb-10 group">
                    <div className="relative rounded-3xl overflow-hidden border border-border/15 bg-card shadow-xl shadow-foreground/[0.03] hover:shadow-2xl transition-all duration-500">
                      <div className="grid grid-cols-1 lg:grid-cols-2">
                        <div className="relative h-64 lg:h-[400px] overflow-hidden">
                          <img
                            src={filtered[0].cover_image || `https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&h=500&fit=crop`}
                            alt={filtered[0].title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            loading="eager"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-foreground/25 via-foreground/5 to-transparent" />
                          <Badge className="absolute top-4 right-4 bg-legal-gold/90 text-primary-foreground border-0 px-3.5 py-1.5 text-[10px] rounded-full shadow-lg gap-1.5 font-semibold">
                            <TrendingUp className="h-3 w-3" /> مقال مميّز
                          </Badge>
                        </div>
                        <div className="p-7 lg:p-10 flex flex-col justify-center space-y-5">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] gap-1">
                              <Tag className="h-2.5 w-2.5" />
                              {filtered[0].category || 'عام'}
                            </Badge>
                            {filtered[0].tags?.slice(0, 2).map((tag: string) => (
                              <Badge key={tag} variant="secondary" className="rounded-full px-2.5 py-0.5 text-[9px]">{tag}</Badge>
                            ))}
                          </div>
                          <h2 className="text-xl lg:text-2xl xl:text-3xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors duration-300">
                            {filtered[0].title}
                          </h2>
                          <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">{filtered[0].excerpt}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2">
                            <span className="flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 rounded-full">
                              <Calendar className="h-3 w-3" />
                              {new Date(filtered[0].created_at).toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                            <span className="flex items-center gap-1.5 bg-muted/40 px-3 py-1.5 rounded-full">
                              <Clock className="h-3 w-3" />
                              {filtered[0].reading_time || 5} دقائق
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-primary font-medium pt-1 group-hover:gap-3 transition-all">
                            <span>اقرأ المقال كاملاً</span>
                            <ArrowLeft className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </AnimatedCard>
              )}

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                {(search || activeCategory !== 'الكل' ? filtered : filtered.slice(1)).map((article, i) => (
                  <AnimatedCard key={article.id} index={i}>
                    <Link to={`/blog/${article.slug}`} className="group block h-full">
                      <div className="relative h-full rounded-2xl border border-border/15 bg-card overflow-hidden hover:shadow-xl hover:border-primary/10 transition-all duration-500 hover:-translate-y-1">
                        <div className="relative h-48 sm:h-52 overflow-hidden">
                          <img
                            src={article.cover_image || `https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&h=400&fit=crop`}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 via-transparent to-transparent" />
                          <Badge className="absolute top-3 right-3 bg-card/85 backdrop-blur-xl text-[9px] px-2.5 py-1 border border-border/15 text-foreground rounded-lg gap-1">
                            <Tag className="h-2.5 w-2.5" />
                            {article.category || 'عام'}
                          </Badge>
                        </div>
                        <div className="p-5 space-y-3">
                          <h3 className="font-bold text-foreground text-[15px] leading-relaxed line-clamp-2 group-hover:text-primary transition-colors duration-300">
                            {article.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{article.excerpt}</p>
                          {article.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {article.tags.slice(0, 3).map((tag: string) => (
                                <span key={tag} className="text-[9px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">{tag}</span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/20">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(article.created_at).toLocaleDateString('ar-MA')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {article.reading_time || 5} د قراءة
                            </span>
                          </div>
                        </div>
                        {/* Bottom accent line */}
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-l from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  </AnimatedCard>
                ))}
              </div>
            </>
          )}
        </main>

        {/* ═══ CTA ═══ */}
        <section className="border-t border-border/15 bg-muted/20">
          <div className="container mx-auto px-4 py-16 md:py-20">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="max-w-2xl mx-auto text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-legal-gold flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">هل لديك سؤال قانوني؟</h2>
              <p className="text-muted-foreground text-sm sm:text-base">اطرح سؤالك واحصل على إجابة فورية مبنية على القانون المغربي</p>
              <Link to="/ai-consultation">
                <Button size="lg" className="rounded-full px-8 gap-2 shadow-lg shadow-primary/20 mt-2">
                  <Gavel className="h-4 w-4" />
                  اسأل المستشار الذكي
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="border-t border-border/20 py-8">
          <div className="container mx-auto px-4 text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center">
                <Scale className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground text-sm">محاماة ذكية</span>
            </div>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground transition-colors">الرئيسية</Link>
              <Link to="/ai-consultation" className="hover:text-foreground transition-colors">المستشار الذكي</Link>
              <Link to="/legal-fee-calculator" className="hover:text-foreground transition-colors">الأدوات</Link>
            </div>
            <p className="text-[11px] text-muted-foreground/50">© {new Date().getFullYear()} محاماة ذكية. جميع الحقوق محفوظة.</p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Blog;
