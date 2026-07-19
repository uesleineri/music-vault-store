// Origins that can call these Edge Functions from a browser. Add production
// domains via the ALLOWED_ORIGINS secret (comma-separated) - no code change
// or redeploy needed, the value is read fresh on every request.
const DEFAULT_ORIGINS = ["http://localhost:8080"];

export function getCorsHeaders(req: Request): Record<string, string> {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const allowedOrigins = [...DEFAULT_ORIGINS, ...configured];

  const origin = req.headers.get("Origin") ?? "";
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}
