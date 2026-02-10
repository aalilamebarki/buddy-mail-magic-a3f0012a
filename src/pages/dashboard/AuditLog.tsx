import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollText } from 'lucide-react';

const AuditLog = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">سجل النشاط</h1>
      <p className="text-muted-foreground">تتبع جميع الأنشطة في النظام</p>
    </div>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ScrollText className="h-5 w-5" /> السجل</CardTitle></CardHeader>
      <CardContent>
        <p className="text-center text-muted-foreground py-8">سيتم عرض سجل النشاط بعد إعداد قاعدة البيانات</p>
      </CardContent>
    </Card>
  </div>
);

export default AuditLog;
