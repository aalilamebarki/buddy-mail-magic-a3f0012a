import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Gavel, Users, DollarSign, FileText, TrendingUp, TrendingDown, Clock } from 'lucide-react';

const stats = [
  { icon: Gavel, label: 'القضايا الجارية', value: '—', color: 'text-blue-600' },
  { icon: Users, label: 'الموكلين', value: '—', color: 'text-green-600' },
  { icon: DollarSign, label: 'الإيرادات (الشهر)', value: '—', color: 'text-emerald-600' },
  { icon: FileText, label: 'المقالات المنشورة', value: '—', color: 'text-purple-600' },
];

const DashboardHome = () => {
  const { user, role } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">مرحباً 👋</h1>
        <p className="text-muted-foreground">لوحة التحكم الخاصة بك</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              الجلسات القادمة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">لا توجد جلسات قادمة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              آخر النشاطات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">لا توجد نشاطات حديثة</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardHome;
