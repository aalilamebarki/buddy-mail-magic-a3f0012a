import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

const Analytics = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">الإحصائيات</h1>
      <p className="text-muted-foreground">إحصائيات وتحليلات المكتب</p>
    </div>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> نظرة عامة</CardTitle></CardHeader>
      <CardContent>
        <p className="text-center text-muted-foreground py-12">ستتوفر الإحصائيات بعد إضافة بيانات كافية</p>
      </CardContent>
    </Card>
  </div>
);

export default Analytics;
