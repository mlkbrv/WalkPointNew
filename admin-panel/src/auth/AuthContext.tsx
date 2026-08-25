/**
 * Session state for the whole panel.
 *
 * The role in the signed-in user decides which half of the app exists — a partner
 * never receives the superadmin routes, rather than receiving them disabled. The
 * server enforces the same thing; this only stops the UI offering doors that will
 * slam.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { authApi } from '@/api/endpoints';
import { setSessionLostHandler, tokens } from '@/api/client';
import type { UserPublic } from '@/api/types';

interface AuthState {
  user: UserPublic | null;
  loading: boolean;
  isSuperadmin: boolean;
  isPartner: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    tokens.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    // The client calls this when a refresh fails and the session is unrecoverable.
    setSessionLostHandler(clearSession);
  }, [clearSession]);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!tokens.access) {
        setLoading(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    tokens.set(response.tokens.access_token, response.tokens.refresh_token);
    setUser(response.user);
  }, []);

  const signOut = useCallback(async () => {
    const refresh = tokens.refresh;
    if (refresh) {
      // Best-effort: revoke server-side, but sign out locally regardless.
      await authApi.logout(refresh).catch(() => undefined);
    }
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isSuperadmin: user?.role === 'superadmin',
      isPartner: user?.role === 'partner',
      signIn,
      signOut,
    }),
    [user, loading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
