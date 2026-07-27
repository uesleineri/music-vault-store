import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getFunctionErrorMessage } from '@/lib/functionError';

// Same session mechanics as the admin's useAuth, but with none of the
// MFA/admin_users logic - a customer is just "someone with a Supabase Auth
// session". Note this shares the same client/localStorage as admin auth, so
// one browser can't be logged in as both at once (fine for real customers,
// just something to know when testing as the store owner).
export function useCustomerAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
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

  // Same email-based entry point for "esqueci a senha" and "ainda não
  // defini uma senha" - a buyer who never opened their invite email lands
  // here too, and this sends them a working link either way. Routed through
  // request-password-reset (not resetPasswordForEmail directly) so repeated
  // requests for the same email/IP get rate-limited server-side - this is a
  // public, unauthenticated action, otherwise it's a way to spam anyone's
  // inbox with reset-link emails.
  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.functions.invoke('request-password-reset', {
      body: { email },
    });
    if (error) throw new Error(await getFunctionErrorMessage(error));
  };

  return { user, session, loading, signIn, signOut, requestPasswordReset };
}
