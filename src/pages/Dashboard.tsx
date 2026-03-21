import { Outlet } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import DashboardSidebar from '@/components/DashboardSidebar';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useAuth } from '@/hooks/useAuth';
import { useSyncQueue } from '@/hooks/useSyncQueue';

const Dashboard = () => {
  const { role } = useAuth();
  const syncState = useSyncQueue();

  return (
    <>
      <Helmet>
        <title>{role === 'client' ? 'لوحة الموكل' : 'لوحة التحكم'} - محاماة ذكية</title>
      </Helmet>
      <div className="min-h-screen bg-background flex" dir="rtl">
        <DashboardSidebar syncIndicator={<SyncIndicator state={syncState} compact />} />
        <main className="flex-1 p-4 md:p-6 overflow-auto pt-[72px] lg:pt-6 min-w-0">
          <Outlet />
        </main>
      </div>
    </>
  );
};

export default Dashboard;
