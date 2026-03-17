import { Outlet } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import DashboardSidebar from '@/components/DashboardSidebar';
import { useAuth } from '@/hooks/useAuth';

const Dashboard = () => {
  const { role } = useAuth();

  return (
    <>
      <Helmet>
        <title>{role === 'client' ? 'لوحة الموكل' : 'لوحة التحكم'} - محاماة ذكية</title>
      </Helmet>
      <div className="min-h-screen bg-background flex flex-row-reverse">
        <DashboardSidebar />
        <main className="flex-1 p-4 md:p-6 overflow-auto pt-[72px] lg:pt-6 min-w-0">
          <Outlet />
        </main>
      </div>
    </>
  );
};

export default Dashboard;
