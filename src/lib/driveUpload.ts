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

// Asks Google how much of the file it actually has, so a retry can send only
// what's missing instead of restarting from zero. Per Google's resumable-
// upload protocol, an empty PUT with `Content-Range: bytes */total`:
// - returns 308 + a `Range` header when only part of the file was received;
// - returns 200/201 *with the finished file's metadata in the body* when the
//   upload had actually already completed - this is the case that mattered
//   here: a dropped connection on the *response* leg (after Google already
//   received and created the file) looked identical to a real upload
//   failure, so a retry re-sent an already-finished upload and never
//   recovered the file id Google had already returned once.
function queryUploadStatus(
  resumableUrl: string,
  accessToken: string,
  totalSize: number
): Promise<{ driveFileId: string | null; uploadedBytes: number }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({ driveFileId: response.id ?? null, uploadedBytes: totalSize });
        } catch {
          resolve({ driveFileId: null, uploadedBytes: totalSize });
        }
      } else if (xhr.status === 308) {
        const range = xhr.getResponseHeader('Range');
        const match = range?.match(/bytes=0-(\d+)/);
        resolve({ driveFileId: null, uploadedBytes: match ? parseInt(match[1], 10) + 1 : 0 });
      } else {
        resolve({ driveFileId: null, uploadedBytes: 0 });
      }
    });
    xhr.addEventListener('error', () => resolve({ driveFileId: null, uploadedBytes: 0 }));
    xhr.open('PUT', resumableUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Range', `bytes */${totalSize}`);
    xhr.send();
  });
}

// Last-resort check: looks the file up by name in its destination folder.
// The status check above should normally return the finished file's id
// directly, but a status-check request isn't guaranteed to echo back full
// metadata either (it's a separate request from the one that actually
// finished the upload) - if Drive genuinely has the file already, it'll show
// up here regardless of what either PUT's response contained.
function findFileInFolder(fileName: string, folderId: string, accessToken: string): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const q = encodeURIComponent(
      `name = '${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`
    );
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response.files?.[0]?.id ?? null);
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
    xhr.addEventListener('error', () => resolve(null));
    xhr.open('GET', `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.send();
  });
}

// Sends the file (or the remaining tail of it, when resuming after `startByte`)
// to the resumable session URL.
function putFileRange(
  resumableUrl: string,
  accessToken: string,
  file: File,
  startByte: number,
  onProgress: (percent: number) => void
): Promise<{ driveFileId: string | null; error: Error | null }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(((startByte + event.loaded) / file.size) * 100);
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
      resolve({ driveFileId: null, error: new Error('NETWORK_ERROR') });
    });

    xhr.open('PUT', resumableUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    if (startByte > 0) {
      xhr.setRequestHeader('Content-Range', `bytes ${startByte}-${file.size - 1}/${file.size}`);
      xhr.send(file.slice(startByte));
    } else {
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    }
  });
}

// Large multitrack files go straight to Google Drive: the Edge Function opens a
// resumable session (so it never has to receive the full file itself), and the
// browser uploads directly to the returned Drive URL. A dropped connection
// mid-upload (common on a big ZIP) no longer means starting over, and - the
// case that actually bit us in practice - a dropped connection on the
// *response* leg (right as Google finishes creating the file) no longer gets
// reported as a failure: every network error is verified against Drive
// itself (status check, then a lookup by name as a last resort) before
// either resuming or giving up for good.
export async function uploadAudioToDrive(
  file: File,
  artistName: string,
  songName: string,
  onProgress: (percent: number) => void
): Promise<{ driveFileId: string | null; error: Error | null }> {
  const sanitizedName = sanitizeFileName(file.name);
  const { data, error: initError } = await supabase.functions.invoke('drive-init-upload', {
    body: {
      file_name: sanitizedName,
      mime_type: file.type || 'application/octet-stream',
      artist_name: artistName,
      song_name: songName,
    },
  });

  if (initError || !data?.resumable_url) {
    const message = initError ? await getFunctionErrorMessage(initError) : 'Falha ao iniciar upload no Drive';
    return { driveFileId: null, error: new Error(message) };
  }

  const maxRetries = 3;
  let startByte = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await putFileRange(data.resumable_url, data.access_token, file, startByte, onProgress);
    if (result.driveFileId) return result;
    if (result.error?.message !== 'NETWORK_ERROR') return result;

    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    const status = await queryUploadStatus(data.resumable_url, data.access_token, file.size);
    if (status.driveFileId) {
      onProgress(100);
      return { driveFileId: status.driveFileId, error: null };
    }
    if (status.uploadedBytes >= file.size && data.folder_id) {
      const foundId = await findFileInFolder(sanitizedName, data.folder_id, data.access_token);
      if (foundId) {
        onProgress(100);
        return { driveFileId: foundId, error: null };
      }
    }
    startByte = status.uploadedBytes;
  }

  // Every retry's PUT failed and none of the completion checks in between
  // found the file - one last look before truly giving up.
  const finalCheck = data.folder_id ? await findFileInFolder(sanitizedName, data.folder_id, data.access_token) : null;
  if (finalCheck) return { driveFileId: finalCheck, error: null };

  return { driveFileId: null, error: new Error('Erro de rede ao enviar para o Drive (tentamos 3 vezes)') };
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
