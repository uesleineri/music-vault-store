import { FunctionsHttpError } from '@supabase/supabase-js';

// supabase.functions.invoke() reports ANY non-2xx response as the same
// generic "Edge Function returned a non-2xx status code" in error.message -
// the actual `{ error: "..." }` body we return from the function is still
// sitting unread on error.context (the raw Response). This digs it out so
// toasts show the real reason instead of that generic line.
export async function getFunctionErrorMessage(error: unknown, fallback = 'Tente novamente.'): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
    } catch {
      // Response body wasn't JSON (or already consumed) - fall through to the generic message below.
    }
  }
  return error instanceof Error ? error.message : fallback;
}
