import { Link } from 'react-router-dom';
import { Music } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t py-8 mt-auto">
      <div className="container flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Music className="h-5 w-5" />
          <span className="font-semibold">Multitracks</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link to="/privacidade" className="hover:text-foreground underline-offset-4 hover:underline">
            Política de Privacidade
          </Link>
          <Link to="/termos" className="hover:text-foreground underline-offset-4 hover:underline">
            Termos de Uso
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
