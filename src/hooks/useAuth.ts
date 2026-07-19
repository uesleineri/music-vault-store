import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  // True once a password sign-in succeeds but a verified TOTP factor still
  // needs to be challenged before the session reaches aal2.
  const [needsMfaVerification, setNeedsMfaVerification] = useState(false);

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Admin check error:', error);
        return false;
      }

      return !!data;
    } catch (err) {
      console.error('Admin check exception:', err);
      return false;
    }
  };

  const evaluateSession = async (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setIsAdmin(false);
      setNeedsMfaVerification(false);
      setLoading(false);
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const mfaPending = aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';
    setNeedsMfaVerification(mfaPending);

    if (mfaPending) {
      // Don't grant admin access until the TOTP challenge is completed.
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const adminStatus = await checkAdminStatus(nextSession.user.id);
    setIsAdmin(adminStatus);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      evaluateSession(nextSession);
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      evaluateSession(initialSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  // Completes the second factor after signIn(); re-evaluates admin status once verified.
  const verifyMfaCode = async (code: string) => {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) throw factorsError;
    const totpFactor = factors.totp.find((f) => f.status === 'verified');
    if (!totpFactor) throw new Error('Nenhum fator de autenticação encontrado');

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: totpFactor.id,
    });
    if (challengeError) throw challengeError;

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) throw verifyError;

    const { data: { session: refreshedSession } } = await supabase.auth.getSession();
    await evaluateSession(refreshedSession);
  };

  const refreshMfaState = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    await evaluateSession(currentSession);
  }, []);

  return {
    user,
    session,
    isAdmin,
    loading,
    needsMfaVerification,
    signIn,
    signOut,
    verifyMfaCode,
    refreshMfaState,
  };
}
