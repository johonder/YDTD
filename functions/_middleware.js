const API_KEYS = new Set([
  ...(typeof API_KEYS_LIST !== 'undefined' ? API_KEYS_LIST.split(',').map(k => k.trim()).filter(Boolean) : []),
  'demo-key',
  'YDTD-DEMO-2024',
]);

const RATE_LIMITS = {
  free: { requests: 50, windowMs: 86400000 },
  pro: { requests: 10000, windowMs: 86400000 },
};

const rateStore = new Map();

function getClientIp(request) {
  return request.headers.get('cf-connecting-ip') ||
         request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         'unknown';
}

function checkRateLimit(ip, tier = 'free') {
  const limit = RATE_LIMITS[tier] || RATE_LIMITS.free;
  const now = Date.now();
  const key = `${ip}:${tier}`;
  if (rateStore.size > 10000) rateStore.clear();
  let entry = rateStore.get(key);
  if (!entry || (now - entry.windowStart) > limit.windowMs) {
    entry = { windowStart: now, count: 0 };
    rateStore.set(key, entry);
  }
  entry.count++;
  return {
    allowed: entry.count <= limit.requests,
    remaining: Math.max(0, limit.requests - entry.count),
    resetIn: Math.ceil((limit.windowMs - (now - entry.windowStart)) / 1000),
  };
}

function validateApiKey(request) {
  const apiKey = request.headers.get('X-API-Key') ||
                 new URL(request.url).searchParams.get('api_key');
  if (!apiKey) return { valid: false, tier: null };
  return {
    valid: API_KEYS.has(apiKey),
    tier: apiKey === 'demo-key' || apiKey === 'YDTD-DEMO-2024' ? 'free' : 'pro',
  };
}

export async function onRequest(context) {
  const { request, next } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const url = new URL(request.url);
  const isApiRoute = url.pathname.startsWith('/api/');

  if (isApiRoute) {
    const auth = validateApiKey(request);
    const ip = getClientIp(request);
    const tier = auth.valid ? auth.tier : 'free';

    const rate = checkRateLimit(ip, tier);

    if (!rate.allowed) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rate limit exceeded. Get your free API key at https://ytd.pages.dev',
        rateLimit: { remaining: 0, resetInSeconds: rate.resetIn },
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rate.resetIn),
        },
      });
    }

    const response = await next();
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('X-RateLimit-Remaining', String(rate.remaining));
    newHeaders.set('X-RateLimit-Reset', String(rate.resetIn));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  const response = await next();
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('X-Content-Type-Options', 'nosniff');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
