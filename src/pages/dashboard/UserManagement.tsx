import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserCog } from 'lucide-react';

const UserManagement = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>
      <p className="text-muted-foreground">إدارة حسابات وأدوار المستخدمين</p>
    </div>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> المستخدمين</CardTitle></CardHeader>
      <CardContent>
        <p className="text-center text-muted-foreground py-8">سيتم عرض قائمة المستخدمين بعد إعداد قاعدة البيانات</p>
      </CardContent>
    </Card>
  </div>
);

export default UserManagement;
