import { Outlet } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import DashboardSidebar from '@/components/DashboardSidebar';
import { useAuth } from '@/hooks/useAuth';

const Dashboard = () => {
  const { role } = useAuth();

  // Redirect clients to their own dashboard
  if (role === 'client') {
    return (
      <>
        <Helmet><title>لوحة الموكل - محاماة ذكية</title></Helmet>
        <div className="min-h-screen bg-background flex">
          <DashboardSidebar />
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>لوحة التحكم - محاماة ذكية</title></Helmet>
      <div className="min-h-screen bg-background flex">
        <DashboardSidebar />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </>
  );
};

export default Dashboard;
