import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Newsletter = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">النشرة البريدية</h1>
      <p className="text-muted-foreground">إدارة المشتركين والحملات</p>
    </div>
    <Card>
      <CardHeader><CardTitle>المشتركين</CardTitle></CardHeader>
      <CardContent>
        <p className="text-center text-muted-foreground py-8">سيتم عرض قائمة المشتركين بعد إعداد قاعدة البيانات</p>
      </CardContent>
    </Card>
  </div>
);

export default Newsletter;
