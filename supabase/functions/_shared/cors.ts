// Shared CORS configuration for edge functions
// Restricts origins to trusted domains only

const ALLOWED_ORIGINS = [
  // Production domains
  'https://kaiconsulting.ai',
  'https://www.kaiconsulting.ai',
  'https://kaiconsulting.lovable.app',
  'https://zxsfsmrelpwfujmyypsa.lovable.app',
  // Lovable preview environments
  'https://lovable.dev',
  // Local development
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && ALLOWED_ORIGINS.some(allowed => 
    origin === allowed || 
    origin.endsWith('.lovable.app') || 
    origin.endsWith('.lovable.dev') ||
    origin.endsWith('.lovableproject.com')
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
}

export function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response(null, { 
      status: 204,
      headers: {
        ...getCorsHeaders(origin),
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Max-Age': '86400',
      }
    });
  }
  return null;
}
