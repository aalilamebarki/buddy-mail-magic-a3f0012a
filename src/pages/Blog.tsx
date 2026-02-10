import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Scale, Search, Calendar, User, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Article {
  id: string;
  title: string;
  excerpt: string;
  slug: string;
  category: string;
  author_name: string;
  created_at: string;
  featured_image?: string;
  published: boolean;
}

const Blog = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchArticles = async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setArticles(data as Article[]);
      }
      setLoading(false);
    };
    fetchArticles();
  }, []);

  const filtered = articles.filter(
    (a) =>
      a.title.includes(search) ||
      a.excerpt?.includes(search) ||
      a.category?.includes(search)
  );

  return (
    <>
      <Helmet>
        <title>المدونة القانونية - محاماة ذكية</title>
        <meta name="description" content="مقالات قانونية متخصصة في القانون المغربي" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">محاماة ذكية</span>
            </Link>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              الرئيسية <ArrowLeft className="h-3 w-3" />
            </Link>
          </div>
        </nav>

        <main className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10 space-y-4">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">المدونة القانونية</h1>
              <p className="text-muted-foreground">مقالات ونصائح قانونية متخصصة</p>
              <div className="relative max-w-md mx-auto">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث في المقالات..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader><div className="h-6 bg-muted rounded w-3/4" /></CardHeader>
                    <CardContent><div className="h-4 bg-muted rounded w-full" /></CardContent>
                  </Card>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                لا توجد مقالات {search && 'تطابق بحثك'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filtered.map((article) => (
                  <Link to={`/blog/${article.slug}`} key={article.id}>
                    <Card className="hover:shadow-lg transition-all hover:-translate-y-1 h-full">
                      {article.featured_image && (
                        <div className="h-48 overflow-hidden rounded-t-lg">
                          <img
                            src={article.featured_image}
                            alt={article.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardHeader>
                        {article.category && (
                          <Badge variant="secondary" className="w-fit">{article.category}</Badge>
                        )}
                        <CardTitle className="text-lg leading-tight">{article.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground line-clamp-2">{article.excerpt}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {article.author_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(article.created_at).toLocaleDateString('ar-MA')}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default Blog;
