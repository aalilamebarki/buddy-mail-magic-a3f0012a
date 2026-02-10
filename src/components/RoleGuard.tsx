import { useAuth, AppRole } from '@/hooks/useAuth';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: AppRole[];
  fallback?: React.ReactNode;
}

const RoleGuard: React.FC<RoleGuardProps> = ({ children, allowedRoles, fallback = null }) => {
  const { role } = useAuth();

  if (!role || !allowedRoles.includes(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default RoleGuard;
