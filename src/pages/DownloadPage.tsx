import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Download, Music, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface DownloadFile {
  artist_name: string;
  song_name: string;
  cover_url: string | null;
  download_url: string;
}

interface DownloadData {
  product_name: string | null;
  files: DownloadFile[];
}

export default function DownloadPage() {
  const { token } = useParams<{ token: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [downloadData, setDownloadData] = useState<DownloadData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDownload() {
      if (!token) {
        setError('Token inválido');
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase.functions.invoke('get-download', {
          body: {},
          headers: {},
        });

        // Call with query param
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-download?token=${token}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao buscar download');
        }

        const data2 = await response.json();
        setDownloadData(data2);
      } catch (err: any) {
        console.error('Download error:', err);
        setError(err.message || 'Erro ao carregar download');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDownload();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Carregando download...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-6" />
          <h1 className="text-2xl font-bold mb-4">Ops!</h1>
          <p className="text-muted-foreground mb-8">{error}</p>
          <Link to="/catalog">
            <Button>Ir para o catálogo</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!downloadData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Music className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Download não encontrado</h1>
          <Link to="/catalog">
            <Button>Ir para o catálogo</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md text-center animate-fade-in">
        <div className="h-20 w-20 mx-auto bg-success/10 rounded-full flex items-center justify-center mb-6">
          <Download className="h-10 w-10 text-success" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Seu download está pronto!</h1>
        <p className="text-muted-foreground mb-8">
          {downloadData.files.length > 1
            ? `Clique nos botões abaixo para baixar as ${downloadData.files.length} multitracks do seu kit.`
            : 'Clique no botão abaixo para baixar sua multitrack.'}
        </p>

        <div className="space-y-3 mb-8">
          {downloadData.files.map((file, index) => (
            <Card key={index} className="text-left">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-16 w-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  {file.cover_url ? (
                    <img
                      src={file.cover_url}
                      alt={file.song_name}
                      className="h-full w-full object-cover rounded"
                    />
                  ) : (
                    <Music className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{file.song_name}</h3>
                  <p className="text-sm text-muted-foreground truncate">{file.artist_name}</p>
                </div>
                <a href={file.download_url} download>
                  <Button size="icon" variant="secondary">
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>

        <Link to="/catalog">
          <Button variant="outline" className="w-full">Ver mais multitracks</Button>
        </Link>
      </div>
    </div>
  );
}