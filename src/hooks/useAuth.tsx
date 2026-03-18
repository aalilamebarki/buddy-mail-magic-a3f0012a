import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
  const lastRoleFetchId = useRef<string | null>(null);

  const fetchUserRole = useCallback(async (userId: string) => {
    if (!userId || lastRoleFetchId.current === userId) return;

    try {
      const { data, error } = await (supabase as any)
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        lastRoleFetchId.current = null;
        setRole(null);
        return;
      }

      if (data?.role) {
        lastRoleFetchId.current = userId;
        setRole(data.role as AppRole);
        return;
      }

      lastRoleFetchId.current = null;
      setRole(null);
    } catch (err) {
      console.error('Error in fetchUserRole:', err);
      lastRoleFetchId.current = null;
      setRole(null);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        // Only update state if something actually changed
        setSession(prev => {
          if (prev?.access_token === newSession?.access_token) return prev;
          return newSession;
        });
        
        const newUser = newSession?.user ?? null;
        setUser(prev => {
          if (prev?.id === newUser?.id) return prev;
          return newUser;
        });

        if (newSession?.user) {
          // Await role fetch before marking loading as done
          await fetchUserRole(newSession.user.id);
        } else {
          lastRoleFetchId.current = null;
          setRole(null);
        }

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          setLoading(false);
        }

        // If user signs out, reset
        if (event === 'SIGNED_OUT') {
          lastRoleFetchId.current = null;
          setRole(null);
          setLoading(false);
        }
      }
    );

    // Fallback: ensure loading is false after timeout
    const timeout = setTimeout(() => setLoading(false), 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [fetchUserRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    lastRoleFetchId.current = null;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { error: error as Error | null };
    }

    // State will be set by onAuthStateChange listener
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
    await supabase.auth.signOut();
    lastRoleFetchId.current = null;
    setSession(null);
    setUser(null);
    setRole(null);
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
