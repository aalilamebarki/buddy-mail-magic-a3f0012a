import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scale, Calculator, ArrowRight, Info, Sparkles, ArrowLeft, Menu, X, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const courtTypes = [
  { value: 'ابتدائية', label: 'المحكمة الابتدائية' },
  { value: 'استئنافية', label: 'محكمة الاستئناف' },
  { value: 'نقض', label: 'محكمة النقض' },
  { value: 'تجارية', label: 'المحكمة التجارية' },
  { value: 'إدارية', label: 'المحكمة الإدارية' },
];

const caseTypes = [
  { value: 'مدني', label: 'قضية مدنية', icon: '⚖️' },
  { value: 'جنائي', label: 'قضية جنائية', icon: '🔒' },
  { value: 'تجاري', label: 'قضية تجارية', icon: '💼' },
  { value: 'أسرة', label: 'قضية أسرية', icon: '👨‍👩‍👧' },
  { value: 'عقاري', label: 'قضية عقارية', icon: '🏠' },
  { value: 'إداري', label: 'قضية إدارية', icon: '🏛️' },
];

const LegalFeeCalculator = () => {
  const [courtType, setCourtType] = useState('');
  const [caseType, setCaseType] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<{ fee: number; details: string } | null>(null);
  const [mobileNav, setMobileNav] = useState(false);

  const calculateFees = () => {
    if (!courtType || !caseType) return;
    const baseAmount = parseFloat(amount) || 0;
    let fee = 0;
    let details = '';

    switch (caseType) {
      case 'مدني': fee = baseAmount <= 20000 ? 100 : baseAmount * 0.01; details = 'رسم ثابت أو 1% من قيمة الدعوى'; break;
      case 'تجاري': fee = baseAmount <= 50000 ? 200 : baseAmount * 0.015; details = 'رسم ثابت أو 1.5% من قيمة الدعوى'; break;
      case 'عقاري': fee = baseAmount * 0.02 + 100; details = '2% من قيمة العقار + رسم ثابت'; break;
      case 'أسرة': fee = 50; details = 'رسم ثابت لقضايا الأسرة'; break;
      case 'جنائي': fee = 0; details = 'قضايا جنائية - بدون رسوم'; break;
      case 'إداري': fee = 150; details = 'رسم ثابت للقضايا الإدارية'; break;
      default: fee = 100; details = 'رسم قياسي';
    }

    if (courtType === 'استئنافية') fee *= 1.5;
    if (courtType === 'نقض') fee *= 2;

    setResult({ fee: Math.round(fee), details });
  };

  return (
    <>
      <Helmet>
        <title>حاسبة الرسوم القضائية - محاماة ذكية</title>
        <meta name="description" content="احسب الرسوم القضائية المغربية حسب نوع القضية والمحكمة" />
      </Helmet>

      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-legal-emerald/[0.03] blur-[100px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-legal-gold/[0.04] blur-[80px]" />
        </div>

        {/* Nav */}
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
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-legal-emerald to-legal-emerald/80 flex items-center justify-center mx-auto shadow-xl shadow-legal-emerald/20">
              <Calculator className="h-8 w-8 text-primary-foreground" />
            </div>
            <Badge className="bg-legal-emerald/10 text-legal-emerald border-legal-emerald/20 px-4 py-1 text-xs rounded-full">
              أداة مجانية
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">حاسبة الرسوم القضائية</h1>
            <p className="text-muted-foreground text-sm sm:text-base">احسب الرسوم القضائية حسب نوع القضية والمحكمة المغربية</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-border/20 shadow-xl shadow-foreground/[0.03] rounded-2xl overflow-hidden">
              <div className="h-[3px] bg-gradient-to-l from-legal-emerald via-legal-gold to-legal-emerald" />
              <CardContent className="pt-7 pb-7 space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">نوع المحكمة</Label>
                  <Select value={courtType} onValueChange={setCourtType}>
                    <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="اختر المحكمة" /></SelectTrigger>
                    <SelectContent>
                      {courtTypes.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">نوع القضية</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {caseTypes.map(ct => (
                      <button key={ct.value} onClick={() => setCaseType(ct.value)}
                        className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                          caseType === ct.value
                            ? 'border-primary bg-primary/5 text-primary shadow-sm'
                            : 'border-border/30 text-muted-foreground hover:border-border hover:bg-muted/30'
                        }`}>
                        <span>{ct.icon}</span>
                        <span className="text-xs">{ct.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">قيمة الدعوى (درهم) - اختياري</Label>
                  <Input type="number" placeholder="0" value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    dir="ltr" className="h-12 rounded-xl" />
                </div>

                <Button onClick={calculateFees} className="w-full h-12 rounded-xl font-semibold text-base shadow-lg shadow-primary/20"
                  disabled={!courtType || !caseType}>
                  <Calculator className="h-4 w-4 ml-2" />
                  احسب الرسوم
                </Button>

                <AnimatePresence>
                  {result && (
                    <motion.div initial={{ opacity: 0, y: 15, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}>
                      <div className="relative rounded-2xl overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-legal-emerald/10 to-legal-gold/5" />
                        <div className="relative p-6 text-center space-y-3">
                          <CheckCircle className="h-8 w-8 text-legal-emerald mx-auto" />
                          <p className="text-sm text-muted-foreground">الرسوم المقدرة</p>
                          <p className="text-4xl font-bold bg-gradient-to-l from-legal-emerald to-primary bg-clip-text text-transparent">
                            {result.fee.toLocaleString('ar-MA')} درهم
                          </p>
                          <p className="text-xs text-muted-foreground">{result.details}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-muted/30 rounded-xl p-4 border border-border/10">
                  <Info className="h-4 w-4 mt-0.5 shrink-0 text-legal-gold" />
                  <p className="leading-relaxed">هذه الحاسبة تقدم تقديرات تقريبية. الرسوم الفعلية قد تختلف حسب ظروف كل قضية. يُرجى الرجوع إلى كتابة ضبط المحكمة للمبالغ الدقيقة.</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    </>
  );
};

export default LegalFeeCalculator;
