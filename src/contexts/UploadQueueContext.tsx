import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { useCreateMultitrack, useUpdateMultitrack } from '@/hooks/useMultitracks';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeFileName, uploadAudioToDrive, uploadToSupabaseStorage } from '@/lib/driveUpload';
import { logClientEvent } from '@/lib/clientAuditLog';
import { Multitrack } from '@/types/multitrack';

export interface MultitrackUploadInput {
  editingMultitrack: Multitrack | null;
  formData: {
    artist_name: string;
    song_name: string;
    price: number;
    genre: string | null;
    key_signature: string | null;
    bpm: number | null;
    language: string | null;
  };
  audioFile: File | null;
  coverFile: File | null;
  previewFile: File | null;
  // Either the existing cover (edit), a Deezer/iTunes URL picked in the
  // form, or null after the admin clicked "Remover" - coverFile (if set)
  // always wins over this.
  coverPreviewUrl: string | null;
}

interface UploadJob {
  id: string;
  title: string;
  step: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  errorMessage?: string;
  input: MultitrackUploadInput;
}

interface UploadQueueContextValue {
  jobs: UploadJob[];
  enqueueMultitrackUpload: (input: MultitrackUploadInput) => void;
  retryJob: (id: string) => void;
  dismissJob: (id: string) => void;
}

const UploadQueueContext = createContext<UploadQueueContextValue | null>(null);

// Lives above the admin routes (see AdminLayout) so an upload started from
// the Multitracks dialog keeps running - and stays visible in the
// bottom-right widget - even after the admin closes that dialog or
// navigates to another page.
export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const jobsRef = useRef<UploadJob[]>([]);
  jobsRef.current = jobs;

  const createMultitrack = useCreateMultitrack();
  const updateMultitrack = useUpdateMultitrack();
  const { toast } = useToast();

  const patchJob = useCallback((id: string, patch: Partial<UploadJob>) => {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }, []);

  const runJob = useCallback(
    async (id: string, input: MultitrackUploadInput) => {
      const { editingMultitrack, formData, audioFile, coverFile, previewFile, coverPreviewUrl } = input;

      try {
        let fileUrl = editingMultitrack?.file_url || '';
        let coverUrl = editingMultitrack?.cover_url || null;
        let previewUrl = editingMultitrack?.preview_url || null;

        const filesToUpload = [audioFile, coverFile, previewFile].filter(Boolean);
        const totalFiles = filesToUpload.length;
        let completedFiles = 0;

        const updateOverallProgress = (fileProgress: number) => {
          const baseProgress = (completedFiles / Math.max(totalFiles, 1)) * 100;
          const currentFileContribution = fileProgress / Math.max(totalFiles, 1);
          patchJob(id, { progress: Math.round(baseProgress + currentFileContribution) });
        };

        if (audioFile) {
          patchJob(id, { step: 'Enviando arquivo multitrack para o Google Drive...' });
          const { driveFileId, error: audioError } = await uploadAudioToDrive(
            audioFile,
            formData.artist_name,
            formData.song_name,
            updateOverallProgress
          );
          if (audioError || !driveFileId) {
            throw new Error(`Erro no upload: ${audioError?.message || 'ID do arquivo não retornado'}`);
          }
          fileUrl = driveFileId;
          completedFiles++;
          updateOverallProgress(0);
        }

        if (coverFile) {
          patchJob(id, { step: 'Enviando capa...' });
          const coverFileName = `${Date.now()}-${sanitizeFileName(coverFile.name)}`;
          const { error: coverError } = await uploadToSupabaseStorage('covers', coverFileName, coverFile, updateOverallProgress);
          if (coverError) throw new Error(`Erro no upload da capa: ${coverError.message}`);
          const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(coverFileName);
          coverUrl = publicUrl;
          completedFiles++;
          updateOverallProgress(0);
        } else if (coverPreviewUrl && coverPreviewUrl !== editingMultitrack?.cover_url) {
          coverUrl = coverPreviewUrl;
        }

        if (previewFile) {
          patchJob(id, { step: 'Enviando preview de áudio...' });
          const previewFileName = `${Date.now()}-${sanitizeFileName(previewFile.name)}`;
          const { error: previewError } = await uploadToSupabaseStorage('previews', previewFileName, previewFile, updateOverallProgress);
          if (previewError) throw new Error(`Erro no upload do preview: ${previewError.message}`);
          const { data: { publicUrl: previewPublicUrl } } = supabase.storage.from('previews').getPublicUrl(previewFileName);
          previewUrl = previewPublicUrl;
          completedFiles++;
        }

        patchJob(id, { step: 'Salvando dados...', progress: 100 });

        if (editingMultitrack) {
          await updateMultitrack.mutateAsync({
            id: editingMultitrack.id,
            ...formData,
            file_url: fileUrl,
            cover_url: coverUrl,
            preview_url: previewUrl,
          });
        } else {
          await createMultitrack.mutateAsync({
            ...formData,
            file_url: fileUrl,
            cover_url: coverUrl,
            preview_url: previewUrl,
            is_active: true,
          });
        }

        patchJob(id, { status: 'success', step: 'Concluído' });
        toast({
          title: editingMultitrack ? 'Multitrack atualizada!' : 'Multitrack adicionada!',
          description: `${formData.artist_name} - ${formData.song_name}`,
        });
        setTimeout(() => {
          setJobs((prev) => prev.filter((job) => job.id !== id));
        }, 4000);
      } catch (error: any) {
        const title = `${formData.artist_name} - ${formData.song_name}`;
        patchJob(id, { status: 'error', errorMessage: error.message || 'Tente novamente.' });
        toast({
          title: 'Erro ao salvar multitrack',
          description: `${title}: ${error.message}`,
          variant: 'destructive',
        });
        logClientEvent('multitrack.upload_failed', 'multitrack', title, { error: error.message });
      }
    },
    [createMultitrack, updateMultitrack, patchJob, toast]
  );

  const enqueueMultitrackUpload = useCallback(
    (input: MultitrackUploadInput) => {
      const id = crypto.randomUUID();
      const title = `${input.formData.artist_name} - ${input.formData.song_name}`;
      setJobs((prev) => [...prev, { id, title, step: 'Iniciando...', progress: 0, status: 'uploading', input }]);
      runJob(id, input);
    },
    [runJob]
  );

  const retryJob = useCallback(
    (id: string) => {
      const job = jobsRef.current.find((j) => j.id === id);
      if (!job) return;
      patchJob(id, { status: 'uploading', progress: 0, step: 'Tentando novamente...', errorMessage: undefined });
      runJob(id, job.input);
    },
    [patchJob, runJob]
  );

  const dismissJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== id));
  }, []);

  return (
    <UploadQueueContext.Provider value={{ jobs, enqueueMultitrackUpload, retryJob, dismissJob }}>
      {children}
    </UploadQueueContext.Provider>
  );
}

export function useUploadQueue() {
  const context = useContext(UploadQueueContext);
  if (!context) throw new Error('useUploadQueue must be used within an UploadQueueProvider');
  return context;
}
