import { Loader2, CheckCircle2, AlertCircle, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUploadQueue } from '@/contexts/UploadQueueContext';

// Fixed bottom-right stack of background upload jobs (see
// UploadQueueContext) - lets an admin keep working while a large multitrack
// file uploads to Google Drive instead of being stuck staring at a dialog.
export function UploadQueueWidget() {
  const { jobs, retryJob, dismissJob } = useUploadQueue();

  if (jobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {jobs.map((job) => (
        <div key={job.id} className="rounded-lg border bg-card shadow-lg p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {job.status === 'uploading' && <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-primary" />}
              {job.status === 'success' && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success" />}
              {job.status === 'error' && <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />}
              <span className="text-sm font-medium truncate">{job.title}</span>
            </div>
            {job.status !== 'uploading' && (
              <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={() => dismissJob(job.id)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {job.status === 'uploading' && (
            <>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2">
                <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${job.progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">{job.step}</p>
            </>
          )}

          {job.status === 'error' && (
            <div className="mt-2">
              <p className="text-xs text-destructive mb-2">{job.errorMessage}</p>
              <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => retryJob(job.id)}>
                <RotateCcw className="h-3.5 w-3.5" />
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
