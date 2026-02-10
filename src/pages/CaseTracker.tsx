import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Scale, Search, ArrowLeft, FileText, Clock, AlertCircle } from 'lucide-react';
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

const statusColors: Record<string, string> = {
  'جارية': 'bg-blue-100 text-blue-800',
  'مؤجلة': 'bg-yellow-100 text-yellow-800',
  'محكومة': 'bg-green-100 text-green-800',
  'مستأنفة': 'bg-orange-100 text-orange-800',
  'منتهية': 'bg-gray-100 text-gray-800',
};

const CaseTracker = () => {
  const [caseNumber, setCaseNumber] = useState('');
  const [results, setResults] = useState<CaseResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseNumber.trim()) return;
    setLoading(true);
    setSearched(true);

    const { data, error } = await supabase
      .from('cases')
      .select('id, case_number, title, status, court, next_session, updated_at')
      .ilike('case_number', `%${caseNumber}%`)
      .limit(10);

    if (!error && data) {
      setResults(data as CaseResult[]);
    } else {
      setResults([]);
    }
    setLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>تتبع القضايا - محاماة ذكية</title>
        <meta name="description" content="تتبع حالة قضيتك برقم الملف" />
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

        <main className="container mx-auto px-4 py-12 max-w-2xl">
          <div className="text-center mb-10 space-y-3">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">تتبع القضايا</h1>
            <p className="text-muted-foreground">ابحث عن حالة قضيتك برقم الملف</p>
          </div>

          <Card className="mb-8">
            <CardContent className="pt-6">
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  placeholder="أدخل رقم الملف..."
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  className="flex-1"
                  dir="ltr"
                />
                <Button type="submit" disabled={loading}>
                  {loading ? 'جاري البحث...' : 'بحث'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {searched && !loading && results.length === 0 && (
            <div className="text-center py-12 space-y-3">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">لم يتم العثور على قضايا بهذا الرقم</p>
            </div>
          )}

          <div className="space-y-4">
            {results.map((c) => (
              <Card key={c.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{c.title}</p>
                      <p className="text-sm text-muted-foreground">رقم الملف: {c.case_number}</p>
                    </div>
                    <Badge className={statusColors[c.status] || 'bg-muted text-muted-foreground'}>
                      {c.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {c.court}</span>
                    {c.next_session && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        الجلسة القادمة: {new Date(c.next_session).toLocaleDateString('ar-MA')}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </>
  );
};

export default CaseTracker;
