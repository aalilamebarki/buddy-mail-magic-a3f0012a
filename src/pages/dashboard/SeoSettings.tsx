import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const SeoSettings = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">إعدادات SEO</h1>
      <p className="text-muted-foreground">تحسين محركات البحث</p>
    </div>
    <Card>
      <CardHeader><CardTitle>الإعدادات العامة</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>عنوان الموقع (Title)</Label>
          <Input placeholder="محاماة ذكية" />
        </div>
        <div className="space-y-2">
          <Label>الوصف (Meta Description)</Label>
          <Input placeholder="نظام إدارة مكتب المحاماة المغربي" />
        </div>
        <div className="space-y-2">
          <Label>الكلمات المفتاحية</Label>
          <Input placeholder="محاماة، قانون، مغرب" />
        </div>
        <Button>حفظ</Button>
      </CardContent>
    </Card>
  </div>
);

export default SeoSettings;
