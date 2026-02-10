import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Reports = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">التقارير</h1>
      <p className="text-muted-foreground">تقارير شاملة عن أداء المكتب</p>
    </div>
    <Card>
      <CardHeader><CardTitle>التقارير المتاحة</CardTitle></CardHeader>
      <CardContent>
        <p className="text-center text-muted-foreground py-8">ستتوفر التقارير بعد إضافة بيانات كافية</p>
      </CardContent>
    </Card>
  </div>
);

export default Reports;
