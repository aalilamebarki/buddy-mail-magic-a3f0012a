import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';
import { sanitizeLegalContent } from '@/lib/sanitize-content';
import {
  Scale, ArrowRight, FileText, Download, ExternalLink, Calendar,
  BookOpen, ScrollText, Landmark, CheckCircle, AlertTriangle, XCircle,
  Copy, Check, ChevronLeft,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import { useToast } from '@/hooks/use-toast';

type DocStatus = 'official' | 'modified' | 'repealed';

const statusConfig: Record<DocStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  official: { label: 'رسمي', color: 'bg-legal-emerald/10 text-legal-emerald border-legal-emerald/20', icon: CheckCircle },
  modified: { label: 'معدّل', color: 'bg-legal-gold/10 text-legal-gold border-legal-gold/20', icon: AlertTriangle },
  repealed: { label: 'ملغى', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
};

const getDocTypeLabel = (docType: string) => {
  const map: Record<string, string> = {
    ruling: 'قرار قضائي', law: 'نص قانوني', dahir: 'ظهير', decree: 'مرسوم',
  };
  return map[docType] || docType;
};

const getDocTypeIcon = (docType: string) => {
  if (docType === 'ruling') return Landmark;
  return ScrollText;
};

const DocumentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDoc = async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) setDoc(data);
      setLoading(false);
    };
    fetchDoc();
  }, [id]);

  const getStatus = (d: any): DocStatus => {
    if (d?.metadata?.status === 'repealed') return 'repealed';
    if (d?.metadata?.status === 'modified') return 'modified';
    return 'official';
  };

  const handleCopy = async () => {
    if (!doc) return;
    await navigator.clipboard.writeText(doc.content || '');
    setCopied(true);
    toast({ title: 'تم النسخ', description: 'تم نسخ محتوى الوثيقة' });
    setTimeout(() => setCopied(false), 2000);
  };

  const formatContent = (content: string) => {
    if (!content) return [];
    const cleaned = sanitizeLegalContent(content);
    return cleaned.split('\n').filter(Boolean);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-3xl px-4">
          <div className="h-8 bg-muted/30 rounded-xl w-2/3" />
          <div className="h-4 bg-muted/20 rounded-lg w-1/3" />
          <div className="h-px bg-border/20 my-6" />
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-4 bg-muted/20 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <p className="text-lg font-semibold text-foreground">الوثيقة غير موجودة</p>
          <Link to="/documents">
            <Button variant="outline" className="rounded-full gap-2">
              <ArrowRight className="h-4 w-4" /> العودة للوثائق
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const status = getStatus(doc);
  const sc = statusConfig[status];
  const StatusIcon = sc.icon;
  const DocIcon = getDocTypeIcon(doc.doc_type);
  const paragraphs = formatContent(doc.content);

  return (
    <>
      <Helmet>
        <title>{doc.title} | مركز الوثائق القانونية</title>
        <meta name="description" content={doc.content?.slice(0, 155) || doc.title} />
      </Helmet>

      <div className="min-h-screen bg-background" dir="rtl">
        {/* Nav */}
        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border/30">
          <div className="container mx-auto px-4 flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center">
                <Scale className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold text-foreground">محاماة ذكية</span>
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link to="/documents">
                <Button variant="ghost" size="sm" className="rounded-full gap-1.5 text-xs">
                  <ArrowRight className="h-3.5 w-3.5" /> الوثائق
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Breadcrumb */}
        <div className="border-b border-border/20 bg-muted/20">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/documents" className="hover:text-foreground transition-colors">الوثائق</Link>
              <ChevronLeft className="h-3 w-3" />
              <span className="text-foreground truncate max-w-[250px]">{doc.title}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 mb-8">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-legal-navy/5 flex items-center justify-center shrink-0">
                  <DocIcon className="h-7 w-7 text-legal-navy" />
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground leading-snug">
                    {doc.title}
                  </h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`${sc.color} border text-[10px] rounded-full px-2.5 py-0.5 gap-1`}>
                      <StatusIcon className="h-3 w-3" /> {sc.label}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] rounded-full px-2.5">
                      <BookOpen className="h-3 w-3 ml-1" /> {getDocTypeLabel(doc.doc_type)}
                    </Badge>
                    {doc.category && (
                      <Badge variant="secondary" className="text-[10px] rounded-full px-2.5">
                        {doc.category}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Meta cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {doc.reference_number && (
                  <div className="rounded-xl bg-card border border-border/20 p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <ScrollText className="h-3 w-3" /> رقم المرجع
                    </p>
                    <p className="text-xs font-semibold text-foreground">{doc.reference_number}</p>
                  </div>
                )}
                {doc.decision_date && (
                  <div className="rounded-xl bg-card border border-border/20 p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> التاريخ
                    </p>
                    <p className="text-xs font-semibold text-foreground">
                      {new Date(doc.decision_date).toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                )}
                {doc.court_chamber && (
                  <div className="rounded-xl bg-card border border-border/20 p-3 space-y-1">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Landmark className="h-3 w-3" /> الغرفة
                    </p>
                    <p className="text-xs font-semibold text-foreground">{doc.court_chamber}</p>
                  </div>
                )}
                <div className="rounded-xl bg-card border border-border/20 p-3 space-y-1">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" /> النوع
                  </p>
                  <p className="text-xs font-semibold text-foreground">{getDocTypeLabel(doc.doc_type)}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {doc.source && (
                  <Button size="sm" className="rounded-full gap-2 text-xs" onClick={() => setShowPdf(!showPdf)}>
                    {showPdf ? <FileText className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                    {showPdf ? 'عرض النص' : 'عرض PDF'}
                  </Button>
                )}
                {doc.source && (
                  <a href={doc.source} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="rounded-full gap-2 text-xs">
                      <ExternalLink className="h-3.5 w-3.5" /> فتح المصدر
                    </Button>
                  </a>
                )}
                <Button variant="outline" size="sm" className="rounded-full gap-2 text-xs" onClick={handleCopy}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'تم النسخ' : 'نسخ المحتوى'}
                </Button>
              </div>
            </motion.div>

            <Separator className="mb-8" />

            {/* Document Body */}
            <motion.article
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-border/20 bg-card overflow-hidden"
            >
              {showPdf && doc.source ? (
                pdfError ? (
                  <div className="text-center py-12 space-y-3 p-6">
                    <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                    <p className="text-sm text-muted-foreground">تعذر تحميل ملف PDF. قد يكون الرابط غير متاح حالياً.</p>
                    <Button size="sm" variant="outline" className="rounded-full gap-2 mt-2" onClick={() => setShowPdf(false)}>
                      <FileText className="h-3.5 w-3.5" /> عرض النص بدلاً من ذلك
                    </Button>
                  </div>
                ) : (
                  <iframe
                    src={doc.source}
                    className="w-full border-0"
                    style={{ height: '80vh' }}
                    title={doc.title}
                    onError={() => setPdfError(true)}
                  />
                )
              ) : (
                <div className="prose prose-sm max-w-none text-foreground/90 leading-[2] space-y-4 p-6 sm:p-8 md:p-10">
                  {paragraphs.length > 0 ? (
                    paragraphs.map((p, i) => {
                      const isHeading = /^(الباب|الفصل|القسم|المادة|الفرع|البند)\b/.test(p.trim());
                      const isArticle = /^(المادة|الفصل)\s+\d/.test(p.trim());

                      if (isHeading && !isArticle) {
                        return (
                          <h2 key={i} className="text-base font-bold text-primary mt-8 mb-3 pb-2 border-b border-primary/10">
                            {p}
                          </h2>
                        );
                      }
                      if (isArticle) {
                        return (
                          <div key={i} className="mt-6 mb-2">
                            <span className="inline-block bg-primary/5 text-primary font-bold text-sm px-3 py-1 rounded-lg mb-2">
                              {p.split(/[:\-–]/)[0]}
                            </span>
                            {p.includes(':') || p.includes('-') || p.includes('–') ? (
                              <p className="text-sm text-foreground/85 mt-1">
                                {p.substring(p.indexOf(p.includes(':') ? ':' : p.includes('-') ? '-' : '–') + 1).trim()}
                              </p>
                            ) : null}
                          </div>
                        );
                      }
                      return <p key={i} className="text-sm text-foreground/85">{p}</p>;
                    })
                  ) : (
                    <div className="text-center py-12 space-y-3">
                      <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                      <p className="text-sm text-muted-foreground">لا يتوفر محتوى نصي لهذه الوثيقة</p>
                      {doc.source && (
                        <Button size="sm" className="rounded-full gap-2 mt-2" onClick={() => { setShowPdf(true); setPdfError(false); }}>
                          <Download className="h-3.5 w-3.5" /> محاولة عرض PDF
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.article>

            {/* Footer nav */}
            <div className="mt-8 flex justify-center">
              <Link to="/documents">
                <Button variant="outline" className="rounded-full gap-2">
                  <ArrowRight className="h-4 w-4" /> العودة لمركز الوثائق
                </Button>
              </Link>
            </div>
          </div>
        </main>

        <footer className="border-t border-border/20 py-6">
          <div className="container mx-auto px-4 text-center">
            <p className="text-[11px] text-muted-foreground/50">© {new Date().getFullYear()} محاماة ذكية. جميع الحقوق محفوظة.</p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default DocumentDetail;
