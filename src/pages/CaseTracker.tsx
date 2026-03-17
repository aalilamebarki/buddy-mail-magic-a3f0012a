import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Scale, Search, ArrowLeft, FileText, Clock, AlertCircle, Menu, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

interface CaseResult {
  id: string;
  case_number: string;
  title: string;
  status: string;
  court: string;
  next_session?: string;
  updated_at: string;
}

const statusConfig: Record<string, { bg: string; text: string }> = {
  'جارية': { bg: 'bg-primary/10', text: 'text-primary' },
  'مؤجلة': { bg: 'bg-legal-gold/10', text: 'text-legal-gold' },
  'محكومة': { bg: 'bg-legal-emerald/10', text: 'text-legal-emerald' },
  'مستأنفة': { bg: 'bg-legal-amber/10', text: 'text-legal-amber' },
  'منتهية': { bg: 'bg-muted', text: 'text-muted-foreground' },
};

const CaseTracker = () => {
  const [caseNumber, setCaseNumber] = useState('');
  const [results, setResults] = useState<CaseResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseNumber.trim()) return;
    setLoading(true);
    setSearched(true);

    const { data, error } = await supabase
      .from('cases')
      .select('id, case_number, title, status, court, updated_at')
      .ilike('case_number', `%${caseNumber}%`)
      .limit(10);

    if (!error && data) setResults(data as unknown as CaseResult[]);
    else setResults([]);
    setLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>تتبع القضايا - محاماة ذكية</title>
        <meta name="description" content="تتبع حالة قضيتك برقم الملف" />
      </Helmet>

      <div className="min-h-screen bg-background relative overflow-hidden" dir="rtl">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-legal-gold/[0.03] blur-[100px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/[0.03] blur-[80px]" />
        </div>

        <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border/30 relative">
          <div className="container mx-auto px-4 flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-legal-navy to-primary flex items-center justify-center">
                <Scale className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold text-foreground">محاماة ذكية</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              <Link to="/blog" className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">المقالات</Link>
              <Link to="/ai-consultation" className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">المستشار الذكي</Link>
              <Link to="/" className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">الرئيسية <ArrowLeft className="h-3 w-3" /></Link>
            </div>
            <button className="md:hidden p-2 rounded-lg hover:bg-accent" onClick={() => setMobileNav(!mobileNav)}>
              {mobileNav ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        <main className="container mx-auto px-4 py-12 md:py-16 max-w-2xl relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10 space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-legal-gold to-legal-amber flex items-center justify-center mx-auto shadow-xl shadow-legal-gold/20">
              <Search className="h-8 w-8 text-primary-foreground" />
            </div>
            <Badge className="bg-legal-gold/10 text-legal-gold border-legal-gold/20 px-4 py-1 text-xs rounded-full">
              متابعة مباشرة
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">تتبع القضايا</h1>
            <p className="text-muted-foreground text-sm sm:text-base">ابحث عن حالة قضيتك باستخدام رقم الملف</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-border/20 shadow-xl shadow-foreground/[0.03] rounded-2xl overflow-hidden mb-8">
              <div className="h-[3px] bg-gradient-to-l from-legal-gold via-legal-amber to-legal-gold" />
              <CardContent className="pt-6 pb-6">
                <form onSubmit={handleSearch} className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="أدخل رقم الملف..." value={caseNumber}
                      onChange={(e) => setCaseNumber(e.target.value)}
                      className="flex-1 pr-11 h-12 rounded-xl" dir="ltr" />
                  </div>
                  <Button type="submit" disabled={loading} className="h-12 rounded-xl px-6 shadow-md shadow-primary/20">
                    {loading ? 'بحث...' : 'بحث'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          <AnimatePresence>
            {searched && !loading && results.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-16 space-y-4">
                <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mx-auto">
                  <AlertCircle className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p className="text-lg font-semibold text-foreground">لم يتم العثور على نتائج</p>
                <p className="text-sm text-muted-foreground">تأكد من رقم الملف وأعد المحاولة</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            {results.map((c, i) => (
              <motion.div key={c.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}>
                <Card className="border-border/15 hover:shadow-lg hover:border-primary/10 transition-all duration-300 rounded-2xl overflow-hidden">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <p className="font-bold text-foreground truncate">{c.title}</p>
                        <p className="text-xs text-muted-foreground">رقم الملف: <span dir="ltr" className="font-mono">{c.case_number}</span></p>
                      </div>
                      <Badge className={`shrink-0 text-[10px] rounded-full px-3 border-0 ${
                        statusConfig[c.status]?.bg || 'bg-muted'
                      } ${statusConfig[c.status]?.text || 'text-muted-foreground'}`}>
                        {c.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                      {c.court && (
                        <span className="flex items-center gap-1.5 bg-muted/30 px-3 py-1.5 rounded-full">
                          <FileText className="h-3 w-3" /> {c.court}
                        </span>
                      )}
                      {c.next_session && (
                        <span className="flex items-center gap-1.5 bg-muted/30 px-3 py-1.5 rounded-full">
                          <Clock className="h-3 w-3" />
                          الجلسة: {new Date(c.next_session).toLocaleDateString('ar-MA')}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </main>
      </div>
    </>
  );
};

export default CaseTracker;
