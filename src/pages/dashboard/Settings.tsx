import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const SettingsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>
        <p className="text-muted-foreground">إعدادات المكتب العامة</p>
      </div>

      <Card>
        <CardHeader><CardTitle>معلومات المكتب</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>اسم المكتب</Label>
            <Input placeholder="مكتب المحاماة" />
          </div>
          <div className="space-y-2">
            <Label>العنوان</Label>
            <Input placeholder="العنوان الكامل" />
          </div>
          <div className="space-y-2">
            <Label>رقم الهاتف</Label>
            <Input placeholder="+212..." dir="ltr" />
          </div>
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input placeholder="email@example.com" dir="ltr" />
          </div>
          <Button>حفظ التغييرات</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
