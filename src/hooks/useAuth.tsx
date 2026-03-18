import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'director' | 'partner' | 'clerk' | 'content_writer' | 'client';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (roles: AppRole | AppRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = useCallback(async (userId: string) => {
    if (!userId) {
      setRole(null);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        setRole(null);
        return null;
      }

      const nextRole = (data?.role as AppRole | undefined) ?? null;
      setRole(nextRole);
      return nextRole;
    } catch (err) {
      console.error('Error in fetchUserRole:', err);
      setRole(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    const applySession = async (nextSession: Session | null) => {
      if (!isActive) return;

      setSession(nextSession);

      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        await fetchUserRole(nextUser.id);
      } else {
        setRole(null);
      }

      if (isActive) {
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Error restoring session:', error);
        if (isActive) setLoading(false);
        return;
      }

      void applySession(data.session ?? null);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [fetchUserRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      return { error: error as Error | null };
    }

    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
    setLoading(false);
  }, []);

  const hasRole = useCallback((roles: AppRole | AppRole[]) => {
    if (!role) return false;
    if (Array.isArray(roles)) return roles.includes(role);
    return role === roles;
  }, [role]);

  const value = useMemo(() => ({
    session, user, role, loading, signIn, signUp, signOut, hasRole,
  }), [session, user, role, loading, signIn, signUp, signOut, hasRole]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
