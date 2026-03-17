import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Scale, Search, FileText, Download, Eye, ExternalLink, Menu, X,
  ArrowLeft, Filter, Calendar, BookOpen, Gavel, ScrollText, Landmark,
  ChevronDown, CheckCircle, AlertTriangle, XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import { getCleanExcerpt } from '@/lib/sanitize-content';

type DocStatus = 'official' | 'modified' | 'repealed';

const statusConfig: Record<DocStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  official: { label: 'رسمي', color: 'bg-legal-emerald/10 text-legal-emerald border-legal-emerald/20', icon: CheckCircle },
  modified: { label: 'معدّل', color: 'bg-legal-gold/10 text-legal-gold border-legal-gold/20', icon: AlertTriangle },
  repealed: { label: 'ملغى', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
};

const categoryFilters = ['الكل', 'ظهائر', 'قوانين', 'مراسيم', 'قرارات قضائية', 'اجتهادات'];

const getDocTypeLabel = (docType: string) => docType === 'ruling' ? 'قرار قضائي' : 'نص قانوني';

const docKey = (doc: any) => (doc.source || `${doc.title}|${doc.doc_type}`).trim();

const dedupeDocuments = (rows: any[]) => {
  const map = new Map<string, any>();

  for (const row of rows) {
    const key = docKey(row);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, { ...row, content: row.content || '' });
      continue;
    }

    const mergedContent = [existing.content, row.content]
      .filter(Boolean)
      .join('\n')
      .slice(0, 2500);

    map.set(key, {
      ...existing,
      content: mergedContent,
      created_at: new Date(existing.created_at) > new Date(row.created_at) ? existing.created_at : row.created_at,
      reference_number: existing.reference_number || row.reference_number,
      decision_date: existing.decision_date || row.decision_date,
      category: existing.category || row.category,
      metadata: existing.metadata || row.metadata,
    });
  }

  return Array.from(map.values()).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
};

const matchesFilter = (doc: any, activeFilter: string) => {
  if (activeFilter === 'الكل') return true;

  if (activeFilter === 'قرارات قضائية' || activeFilter === 'اجتهادات') {
    return doc.doc_type === 'ruling';
  }

  if (activeFilter === 'مراسيم') {
    return doc.doc_type === 'law' && /مرسوم/.test(`${doc.title || ''} ${doc.category || ''}`);
  }

  if (activeFilter === 'ظهائر') {
    return doc.doc_type === 'law' && /ظهير/.test(`${doc.title || ''} ${doc.category || ''}`);
  }

  if (activeFilter === 'قوانين') {
    return doc.doc_type === 'law';
  }

  return true;
};

const DocumentCenter = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('الكل');
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const fetchDocs = async () => {
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!error && data) {
        setDocuments(dedupeDocuments(data));
      }

      setLoading(false);
    };

    fetchDocs();
  }, []);

  const filtered = documents.filter((d) => {
    const q = search.trim();
    const searchable = `${d.title || ''} ${d.reference_number || ''} ${d.category || ''}`;
    const matchSearch = !q || searchable.includes(q);
    const matchFilter = matchesFilter(d, activeFilter);
    return matchSearch && matchFilter;
  });

  const getStatus = (doc: any): DocStatus => {
    if (doc.metadata?.status === 'repealed') return 'repealed';
    if (doc.metadata?.status === 'modified') return 'modified';
    return 'official';
  };

  return (
    <>
      <Helmet>
        <title>مركز الوثائق القانونية - ظهائر ونصوص رسمية | محاماة ذكية</title>
        <meta name="description" content="مركز الوثائق القانونية المغربية: ظهائر، قوانين، مراسيم، وقرارات قضائية مع إمكانية البحث والتحميل." />
      </Helmet>

      <div className="min-h-screen bg-background" dir="rtl">
        {/* Nav */}
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border/30">
          <div className="container mx-auto px-4 flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center">
                <Scale className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold text-foreground">محاماة ذكية</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              <Link to="/blog" className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent">المقالات</Link>
              <Link to="/documents" className="px-3 py-1.5 text-xs text-primary font-medium transition-colors rounded-lg bg-primary/5">الوثائق</Link>
              <Link to="/ai-consultation" className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent">المستشار الذكي</Link>
              <ThemeToggle />
              <div className="w-px h-5 bg-border mx-1" />
              <Link to="/auth"><Button size="sm" className="rounded-full px-5 text-xs">دخول</Button></Link>
            </div>
            <button className="md:hidden p-2 rounded-lg hover:bg-accent" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-legal-navy/[0.04] via-background to-background" />
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-primary/[0.03] blur-[100px]" />
          <div className="container mx-auto px-4 relative z-10 py-14 md:py-20">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="max-w-3xl mx-auto text-center space-y-6">
              <Badge className="bg-legal-navy/10 text-legal-navy border-legal-navy/20 px-4 py-1.5 text-xs rounded-full">
                <Landmark className="h-3 w-3 ml-1.5" />
                مركز الوثائق الرسمية
              </Badge>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-[1.15]">
                المكتبة <span className="bg-gradient-to-l from-primary to-legal-navy bg-clip-text text-transparent">القانونية</span>
              </h1>
              <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
                ظهائر، قوانين، مراسيم، وقرارات قضائية — ابحث وتصفّح وحمّل النصوص الرسمية
              </p>

              <div className="relative max-w-lg mx-auto">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="ابحث برقم المرجع أو العنوان..."
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  className="pr-12 h-13 text-base rounded-2xl border-border/40 bg-card shadow-lg"
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Filters */}
        <div className="border-b border-border/30 sticky top-16 z-40 bg-background/80 backdrop-blur-xl">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-2 py-3">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                {categoryFilters.map(cat => (
                  <button key={cat} onClick={() => setActiveFilter(cat)}
                    className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                      activeFilter === cat ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Documents Table */}
        <main className="container mx-auto px-4 py-10 md:py-14">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">{filtered.length} وثيقة</p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-20 rounded-2xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-20 space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <p className="text-lg font-semibold text-foreground">لا توجد وثائق</p>
              <p className="text-sm text-muted-foreground">جرّب تغيير معايير البحث أو التصفية</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {filtered.map((doc, i) => {
                const status = getStatus(doc);
                const sc = statusConfig[status];
                const StatusIcon = sc.icon;
                return (
                  <Link to={`/documents/${doc.id}`} className="block">
                    <motion.div key={doc.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="group rounded-2xl border border-border/20 bg-card hover:border-primary/15 hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer"
                    >
                      <div className="flex items-center gap-4 p-4 md:p-5">
                        <div className="w-12 h-12 rounded-xl bg-legal-navy/5 flex items-center justify-center shrink-0 group-hover:bg-legal-navy/10 transition-colors">
                          <FileText className="h-5 w-5 text-legal-navy" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-foreground text-sm truncate group-hover:text-primary transition-colors">{doc.title}</span>
                            <Badge className={`${sc.color} border text-[9px] rounded-full px-2 py-0.5 gap-1`}>
                              <StatusIcon className="h-2.5 w-2.5" /> {sc.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            {doc.reference_number && <span className="flex items-center gap-1"><ScrollText className="h-3 w-3" /> {doc.reference_number}</span>}
                            {doc.decision_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(doc.decision_date).toLocaleDateString('ar-MA')}</span>}
                            <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {getDocTypeLabel(doc.doc_type)}</span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          )}
        </main>

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

export default DocumentCenter;
