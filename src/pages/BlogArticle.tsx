import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Badge } from '@/components/ui/badge';
import { Scale, Calendar, User, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Article {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  category: string;
  author_name: string;
  created_at: string;
  featured_image?: string;
  meta_title?: string;
  meta_description?: string;
}

const BlogArticle = () => {
  const { slug } = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!slug) return;
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .single();

      if (!error && data) {
        setArticle(data as Article);
      }
      setLoading(false);
    };
    fetchArticle();
  }, [slug]);

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
        <p className="text-muted-foreground">المقال غير موجود</p>
        <Link to="/blog" className="text-primary hover:underline">العودة للمدونة</Link>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{article.meta_title || article.title} - محاماة ذكية</title>
        <meta name="description" content={article.meta_description || article.excerpt} />
      </Helmet>
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="container mx-auto px-4 flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">محاماة ذكية</span>
            </Link>
            <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <ArrowRight className="h-3 w-3" /> المدونة
            </Link>
          </div>
        </nav>

        <article className="container mx-auto px-4 py-12 max-w-3xl">
          {article.featured_image && (
            <div className="h-64 md:h-96 overflow-hidden rounded-xl mb-8">
              <img src={article.featured_image} alt={article.title} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="space-y-4 mb-8">
            {article.category && <Badge variant="secondary">{article.category}</Badge>}
            <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">{article.title}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><User className="h-4 w-4" /> {article.author_name}</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(article.created_at).toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>

          <div
            className="prose prose-lg max-w-none tiptap"
            dir="rtl"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </article>
      </div>
    </>
  );
};

export default BlogArticle;
