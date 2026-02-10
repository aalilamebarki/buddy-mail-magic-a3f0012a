import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

const Profile = () => {
  const { user, role } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الملف الشخصي</h1>
        <p className="text-muted-foreground">معلومات حسابك</p>
      </div>

      <Card>
        <CardHeader><CardTitle>المعلومات الأساسية</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input value={user?.email || ''} disabled dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>الدور</Label>
            <div><Badge variant="secondary" className="capitalize">{role || 'غير محدد'}</Badge></div>
          </div>
          <div className="space-y-2">
            <Label>الاسم الكامل</Label>
            <Input placeholder="الاسم الكامل" defaultValue={user?.user_metadata?.full_name || ''} />
          </div>
          <Button>تحديث الملف</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
