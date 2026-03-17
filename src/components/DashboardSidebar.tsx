import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  Scale,
  LayoutDashboard,
  Gavel,
  FolderOpen,
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
  BookOpen,
  LogOut,
  ChevronLeft,
  Menu,
  X,
  Stamp,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import RoleGuard from './RoleGuard';

const menuItems = [
  { icon: LayoutDashboard, label: 'الرئيسية', path: '/dashboard', roles: ['director', 'partner', 'clerk', 'content_writer'] as const },
  { icon: FolderOpen, label: 'الملفات', path: '/dashboard/cases', roles: ['director', 'partner', 'clerk'] as const },
  { icon: CalendarDays, label: 'يومية الجلسات', path: '/dashboard/court-sessions', roles: ['director', 'partner', 'clerk'] as const },
  { icon: Users, label: 'الموكلين', path: '/dashboard/clients', roles: ['director', 'partner', 'clerk'] as const },
  { icon: FileText, label: 'المقالات', path: '/dashboard/articles', roles: ['director', 'partner', 'content_writer'] as const },
  { icon: DollarSign, label: 'المالية', path: '/dashboard/finance', roles: ['director', 'partner'] as const },
  { icon: BarChart3, label: 'الإحصائيات', path: '/dashboard/analytics', roles: ['director', 'partner'] as const },
  { icon: FileBarChart, label: 'التقارير', path: '/dashboard/reports', roles: ['director'] as const },
  { icon: UserCog, label: 'إدارة المستخدمين', path: '/dashboard/users', roles: ['director'] as const },
  { icon: Mail, label: 'النشرة البريدية', path: '/dashboard/newsletter', roles: ['director', 'content_writer'] as const },
  { icon: Globe, label: 'إعدادات SEO', path: '/dashboard/seo', roles: ['director', 'content_writer'] as const },
  { icon: BookOpen, label: 'قاعدة المعرفة', path: '/dashboard/knowledge-base', roles: ['director', 'partner'] as const },
  { icon: FileText, label: 'مولّد المستندات', path: '/dashboard/document-generator', roles: ['director', 'partner', 'clerk'] as const },
  { icon: Stamp, label: 'الترويسات', path: '/dashboard/letterheads', roles: ['director', 'partner'] as const },
  { icon: Download, label: 'جلب الوثائق', path: '/dashboard/legal-scraper', roles: ['director'] as const },
  { icon: ScrollText, label: 'سجل النشاط', path: '/dashboard/audit-log', roles: ['director'] as const },
  { icon: Settings, label: 'الإعدادات', path: '/dashboard/settings', roles: ['director', 'partner'] as const },
  { icon: User, label: 'الملف الشخصي', path: '/dashboard/profile', roles: ['director', 'partner', 'clerk', 'content_writer', 'client'] as const },
];

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();
  const { signOut, user, role } = useAuth();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2" onClick={onNavigate}>
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
                onClick={onNavigate}
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
        <Link to="/" onClick={onNavigate}>
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
    </div>
  );
};

const DashboardSidebar = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile: hamburger + sheet */}
      <div className="lg:hidden fixed top-0 right-0 left-0 z-40 bg-background/80 backdrop-blur-md border-b border-border flex items-center h-14 px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0 w-72">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <Link to="/dashboard" className="flex items-center gap-2 mr-2">
          <Scale className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm text-foreground">محاماة ذكية</span>
        </Link>
      </div>

      {/* Desktop: fixed sidebar */}
      <aside className="hidden lg:flex w-64 bg-card border-l border-border flex-col h-screen sticky top-0 shrink-0">
        <SidebarContent />
      </aside>
    </>
  );
};

export default DashboardSidebar;
