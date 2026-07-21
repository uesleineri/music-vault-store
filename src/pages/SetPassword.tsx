import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Landing page for Supabase's invite/recovery email links. The client
// already parses the session out of the URL hash on load (detectSessionInUrl
// defaults to true), so by the time this renders there's an active session
// ready for updateUser() - no manual token handling needed here.
export default function SetPassword() {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Use pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: 'Senha definida!', description: 'Você já pode acessar sua conta.' });
      navigate('/minha-conta');
    } catch (error: any) {
      toast({ title: 'Erro ao definir senha', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
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
