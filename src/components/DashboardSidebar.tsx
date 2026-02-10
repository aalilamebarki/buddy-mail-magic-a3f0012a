import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  Scale,
  LayoutDashboard,
  Gavel,
  Users,
  FileText,
  DollarSign,
  BarChart3,
  Settings,
  User,
  UserCog,
  Mail,
  FileBarChart,
  Globe,
  ScrollText,
  LogOut,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import RoleGuard from './RoleGuard';

const menuItems = [
  { icon: LayoutDashboard, label: 'الرئيسية', path: '/dashboard', roles: ['director', 'partner', 'clerk', 'content_writer'] as const },
  { icon: Gavel, label: 'القضايا', path: '/dashboard/cases', roles: ['director', 'partner', 'clerk'] as const },
  { icon: Users, label: 'الموكلين', path: '/dashboard/clients', roles: ['director', 'partner', 'clerk'] as const },
  { icon: FileText, label: 'المقالات', path: '/dashboard/articles', roles: ['director', 'partner', 'content_writer'] as const },
  { icon: DollarSign, label: 'المالية', path: '/dashboard/finance', roles: ['director', 'partner'] as const },
  { icon: BarChart3, label: 'الإحصائيات', path: '/dashboard/analytics', roles: ['director', 'partner'] as const },
  { icon: FileBarChart, label: 'التقارير', path: '/dashboard/reports', roles: ['director'] as const },
  { icon: UserCog, label: 'إدارة المستخدمين', path: '/dashboard/users', roles: ['director'] as const },
  { icon: Mail, label: 'النشرة البريدية', path: '/dashboard/newsletter', roles: ['director', 'content_writer'] as const },
  { icon: Globe, label: 'إعدادات SEO', path: '/dashboard/seo', roles: ['director', 'content_writer'] as const },
  { icon: ScrollText, label: 'سجل النشاط', path: '/dashboard/audit-log', roles: ['director'] as const },
  { icon: Settings, label: 'الإعدادات', path: '/dashboard/settings', roles: ['director', 'partner'] as const },
  { icon: User, label: 'الملف الشخصي', path: '/dashboard/profile', roles: ['director', 'partner', 'clerk', 'content_writer', 'client'] as const },
];

const DashboardSidebar = () => {
  const location = useLocation();
  const { signOut, user, role } = useAuth();

  return (
    <aside className="w-64 bg-card border-l border-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2">
          <Scale className="h-6 w-6 text-primary" />
          <span className="font-bold text-foreground">محاماة ذكية</span>
        </Link>
      </div>

      {/* User info */}
      <div className="p-4 border-b border-border">
        <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
        <p className="text-xs text-muted-foreground capitalize">{role}</p>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 p-2">
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <RoleGuard key={item.path} allowedRoles={[...item.roles]}>
              <Link
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  location.pathname === item.path
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            </RoleGuard>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-2">
        <Link to="/">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
            <ChevronLeft className="h-4 w-4" />
            الموقع الرئيسي
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </Button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
