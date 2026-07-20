import { supabase } from '@/integrations/supabase/client';
import { getFunctionErrorMessage } from '@/lib/functionError';

// Remove accents/special chars so the Drive filename stays predictable.
export function sanitizeFileName(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_');
}

// Large multitrack files go straight to Google Drive: the Edge Function opens a
// resumable session (so it never has to receive the full file itself), and the
// browser uploads directly to the returned Drive URL.
export async function uploadAudioToDrive(
  file: File,
  artistName: string,
  songName: string,
  onProgress: (percent: number) => void
): Promise<{ driveFileId: string | null; error: Error | null }> {
  const { data, error: initError } = await supabase.functions.invoke('drive-init-upload', {
    body: {
      file_name: sanitizeFileName(file.name),
      mime_type: file.type || 'application/octet-stream',
      artist_name: artistName,
      song_name: songName,
    },
  });

  if (initError || !data?.resumable_url) {
    const message = initError ? await getFunctionErrorMessage(initError) : 'Falha ao iniciar upload no Drive';
    return { driveFileId: null, error: new Error(message) };
  }

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress((event.loaded / event.total) * 100);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({ driveFileId: response.id, error: null });
        } catch {
          resolve({ driveFileId: null, error: new Error('Resposta inválida do Google Drive') });
        }
      } else {
        resolve({ driveFileId: null, error: new Error(`Upload para o Drive falhou (status ${xhr.status})`) });
      }
    });

    xhr.addEventListener('error', () => {
      resolve({ driveFileId: null, error: new Error('Erro de rede ao enviar para o Drive') });
    });

    xhr.open('PUT', data.resumable_url);
    xhr.setRequestHeader('Authorization', `Bearer ${data.access_token}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

// Uploads a small file (cover/preview) directly to a public Supabase Storage bucket.
export function uploadToSupabaseStorage(
  bucket: string,
  fileName: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<{ error: Error | null }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${bucket}/${fileName}`;

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress((event.loaded / event.total) * 100);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ error: null });
      } else {
        let errorMessage = 'Upload failed';
        try {
          const response = JSON.parse(xhr.responseText);
          errorMessage = response.message || response.error || errorMessage;
        } catch {
          errorMessage = xhr.statusText || errorMessage;
        }
        resolve({ error: new Error(errorMessage) });
      }
    });

    xhr.addEventListener('error', () => {
      resolve({ error: new Error('Network error during upload') });
    });

    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.send(file);
  });
}

// Best-effort "Artist - Song.ext" filename parsing to pre-fill the bulk import table.
export function guessArtistAndSong(fileName: string): { artist_name: string; song_name: string } {
  const withoutExt = fileName.replace(/\.[^./]+$/, '');
  const separators = [' - ', ' – ', '_-_'];
  for (const sep of separators) {
    if (withoutExt.includes(sep)) {
      const [artist, ...rest] = withoutExt.split(sep);
      return { artist_name: artist.trim(), song_name: rest.join(sep).trim() };
    }
  }
  return { artist_name: '', song_name: withoutExt.replace(/[_.]/g, ' ').trim() };
}
