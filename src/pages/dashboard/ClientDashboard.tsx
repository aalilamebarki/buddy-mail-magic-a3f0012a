import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Gavel, FileText, Clock } from 'lucide-react';

const ClientDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">مرحباً 👋</h1>
        <p className="text-muted-foreground">متابعة قضاياك ومستنداتك</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <Gavel className="h-8 w-8 text-primary mx-auto" />
            <p className="font-semibold">قضاياي</p>
            <p className="text-2xl font-bold">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <Clock className="h-8 w-8 text-primary mx-auto" />
            <p className="font-semibold">الجلسات القادمة</p>
            <p className="text-2xl font-bold">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <FileText className="h-8 w-8 text-primary mx-auto" />
            <p className="font-semibold">المستندات</p>
            <p className="text-2xl font-bold">—</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientDashboard;
