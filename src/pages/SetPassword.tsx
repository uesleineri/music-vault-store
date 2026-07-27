import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/PasswordInput';
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Landing page for Supabase's invite/recovery email links. The client
// parses the session out of the URL hash on load (detectSessionInUrl
// defaults to true) - but if the link already expired or was already used,
// Supabase redirects here with `#error=...` instead of a session, and
// updateUser() below would otherwise fail with an unrecoverable
// "Auth session missing!" toast. That case gets its own resend-a-new-link
// screen instead of the password form.
export default function SetPassword() {
  const [linkError, setLinkError] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      setLinkError(
        params.get('error_description')?.replace(/\+/g, ' ') || 'Este link expirou ou já foi usado.'
      );
    }
  }, []);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
        redirectTo: `${window.location.origin}/minha-conta/definir-senha`,
      });
      if (error) throw error;
      setResendSent(true);
    } catch (error: any) {
      toast({ title: 'Erro ao enviar e-mail', description: error.message, variant: 'destructive' });
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Use pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'As senhas não coincidem', description: 'Digite a mesma senha nos dois campos.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: 'Senha definida!', description: 'Você já pode acessar sua conta.' });
      navigate('/minha-conta');
    } catch (error: any) {
      // A missing/expired session surfaces here too, not just as an
      // #error= in the URL - same recovery screen either way.
      if (error.message?.includes('Auth session missing')) {
        setLinkError('Este link expirou ou já foi usado.');
      } else {
        toast({ title: 'Erro ao definir senha', description: error.message, variant: 'destructive' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (linkError) {
    return (
      <div className="container py-16 max-w-md animate-fade-in">
        <h1 className="text-2xl font-bold mb-2">Link expirado</h1>
        <p className="text-muted-foreground mb-6">{linkError} Informe seu e-mail para receber um novo link.</p>
        <Card>
          <CardContent className="p-6">
            {resendSent ? (
              <p className="text-sm text-center">
                Enviamos um novo link para <strong>{resendEmail}</strong>. Confira sua caixa de entrada.
              </p>
            ) : (
              <form onSubmit={handleResend} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resend-email">E-mail</Label>
                  <Input
                    id="resend-email"
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isResending}>
                  {isResending ? 'Enviando...' : 'Enviar novo link'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-16 max-w-md animate-fade-in">
      <h1 className="text-2xl font-bold mb-2">Defina sua senha</h1>
      <p className="text-muted-foreground mb-6">
        Escolha uma senha para acessar sua conta e ver suas compras.
      </p>
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <PasswordStrengthMeter password={password} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirme a senha</Label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não coincidem.</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Definir senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
