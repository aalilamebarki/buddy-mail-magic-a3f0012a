import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scale, Calculator, ArrowLeft, Info } from 'lucide-react';

const courtTypes = [
  { value: 'ابتدائية', label: 'المحكمة الابتدائية' },
  { value: 'استئنافية', label: 'محكمة الاستئناف' },
  { value: 'نقض', label: 'محكمة النقض' },
  { value: 'تجارية', label: 'المحكمة التجارية' },
  { value: 'إدارية', label: 'المحكمة الإدارية' },
];

const caseTypes = [
  { value: 'مدني', label: 'قضية مدنية' },
  { value: 'جنائي', label: 'قضية جنائية' },
  { value: 'تجاري', label: 'قضية تجارية' },
  { value: 'أسرة', label: 'قضية أسرية' },
  { value: 'عقاري', label: 'قضية عقارية' },
  { value: 'إداري', label: 'قضية إدارية' },
];

const LegalFeeCalculator = () => {
  const [courtType, setCourtType] = useState('');
  const [caseType, setCaseType] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<{ fee: number; details: string } | null>(null);

  const calculateFees = () => {
    if (!courtType || !caseType) return;

    const baseAmount = parseFloat(amount) || 0;
    let fee = 0;
    let details = '';

    // Simplified Moroccan court fee calculation
    switch (caseType) {
      case 'مدني':
        fee = baseAmount <= 20000 ? 100 : baseAmount * 0.01;
        details = 'رسم ثابت أو 1% من قيمة الدعوى';
        break;
      case 'تجاري':
        fee = baseAmount <= 50000 ? 200 : baseAmount * 0.015;
        details = 'رسم ثابت أو 1.5% من قيمة الدعوى';
        break;
      case 'عقاري':
        fee = baseAmount * 0.02 + 100;
        details = '2% من قيمة العقار + رسم ثابت';
        break;
      case 'أسرة':
        fee = 50;
        details = 'رسم ثابت لقضايا الأسرة';
        break;
      case 'جنائي':
        fee = 0;
        details = 'قضايا جنائية - بدون رسوم';
        break;
      case 'إداري':
        fee = 150;
        details = 'رسم ثابت للقضايا الإدارية';
        break;
      default:
        fee = 100;
        details = 'رسم قياسي';
    }

    // Court level multiplier
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
              <Calculator className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">حاسبة الرسوم القضائية</h1>
            <p className="text-muted-foreground">احسب الرسوم القضائية حسب نوع القضية والمحكمة</p>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2">
                <Label>نوع المحكمة</Label>
                <Select value={courtType} onValueChange={setCourtType}>
                  <SelectTrigger><SelectValue placeholder="اختر المحكمة" /></SelectTrigger>
                  <SelectContent>
                    {courtTypes.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>نوع القضية</Label>
                <Select value={caseType} onValueChange={setCaseType}>
                  <SelectTrigger><SelectValue placeholder="اختر نوع القضية" /></SelectTrigger>
                  <SelectContent>
                    {caseTypes.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>قيمة الدعوى (درهم) - اختياري</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  dir="ltr"
                />
              </div>

              <Button onClick={calculateFees} className="w-full" disabled={!courtType || !caseType}>
                احسب الرسوم
              </Button>

              {result && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-6 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">الرسوم المقدرة</p>
                    <p className="text-4xl font-bold text-primary">{result.fee.toLocaleString('ar-MA')} درهم</p>
                    <p className="text-sm text-muted-foreground">{result.details}</p>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <p>هذه الحاسبة تقدم تقديرات تقريبية. الرسوم الفعلية قد تختلف حسب ظروف كل قضية. يُرجى الرجوع إلى كتابة ضبط المحكمة للمبالغ الدقيقة.</p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
};

export default LegalFeeCalculator;
