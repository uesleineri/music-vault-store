import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

type Status = 'loading' | 'disabled' | 'enrolling' | 'enabled';

export function TwoFactorSettings() {
  const { toast } = useToast();
  const { refreshMfaState } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast({ title: 'Erro ao carregar 2FA', description: error.message, variant: 'destructive' });
      setStatus('disabled');
      return;
    }
    const verified = data.totp.find((f) => f.status === 'verified');
    if (verified) {
      setFactorId(verified.id);
      setStatus('enabled');
    } else {
      setStatus('disabled');
    }
  };

  useEffect(() => {
    loadFactors();
  }, []);

  const startEnrollment = async () => {
    setIsSubmitting(true);
    try {
      // Clean up any abandoned unverified attempt before starting a fresh one.
      // Unverified factors only show up in `all`, not in the per-type arrays.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const factor of existing?.all ?? []) {
        if (factor.factor_type === 'totp' && factor.status === 'unverified') {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `totp-${Date.now()}`,
      });
      if (error) throw error;

      // Supabase returns the QR as an SVG string, sometimes prefixed with a
      // "data:image/svg+xml;utf-8," data-URI header - strip it so only the
      // <svg> markup itself gets injected.
      const svgMarkup = data.totp.qr_code.replace(/^data:image\/svg\+xml;[^,]*,/, '');

      setFactorId(data.id);
      setQrCode(svgMarkup);
      setSecret(data.totp.secret);
      setStatus('enrolling');
    } catch (error: any) {
      toast({ title: 'Erro ao iniciar ativação', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setIsSubmitting(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      toast({ title: '2FA ativado!', description: 'Da próxima vez, o login vai pedir o código.' });
      setCode('');
      setStatus('enabled');
      await refreshMfaState();
    } catch (error: any) {
      toast({ title: 'Código inválido', description: error.message, variant: 'destructive' });
      setCode('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const disable2fa = async () => {
    if (!factorId) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast({ title: '2FA desativado' });
      setFactorId(null);
      setStatus('disabled');
      await refreshMfaState();
    } catch (error: any) {
      toast({ title: 'Erro ao desativar', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status === 'enabled' ? (
            <ShieldCheck className="h-5 w-5 text-success" />
          ) : (
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
          )}
          Autenticação em duas etapas (2FA)
        </CardTitle>
        <CardDescription>
          Protege sua própria conta: mesmo que sua senha vaze, ninguém entra sem o código do seu app
          autenticador (Google Authenticator, Authy, etc).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === 'loading' && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}

        {status === 'disabled' && (
          <Button onClick={startEnrollment} disabled={isSubmitting} className="gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Ativar 2FA
          </Button>
        )}

        {status === 'enrolling' && qrCode && (
          <form onSubmit={confirmEnrollment} className="space-y-4 max-w-sm">
            <p className="text-sm text-muted-foreground">
              Escaneie o QR Code com seu app autenticador, ou digite o código manualmente:
            </p>
            <div
              className="bg-white p-3 rounded-lg w-fit"
              dangerouslySetInnerHTML={{ __html: qrCode }}
            />
            {secret && (
              <p className="text-xs font-mono bg-muted p-2 rounded break-all">{secret}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="enroll-code">Código de 6 dígitos</Label>
              <Input
                id="enroll-code"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="text-center tracking-[0.5em]"
                required
              />
            </div>
            <Button type="submit" disabled={isSubmitting || code.length !== 6}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar ativação'}
            </Button>
          </form>
        )}

        {status === 'enabled' && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-success">2FA ativo na sua conta.</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isSubmitting}>
                  Desativar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desativar 2FA?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sua conta volta a depender só da senha. Só desative se tiver certeza.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={disable2fa} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Desativar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
