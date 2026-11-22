const ALLOWED_PREFIXES = [
  '/',
  '/dashboard',
  '/admin',
  '/workspace',
  '/orders',
  '/production',
  '/suppliers',
  '/rfq',
];

export function safeDestination(value: unknown, fallback = '/dashboard') {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  if (value.startsWith('/login') || value.startsWith('/register')) return fallback;
  const path = value.split('?')[0];
  const allowed = ALLOWED_PREFIXES.some((prefix) => prefix === '/' ? path === '/' : path === prefix || path.startsWith(`${prefix}/`));
  return allowed ? value : fallback;
}

export function withNext(path: string, next?: unknown) {
  const destination = safeDestination(next, '');
  return destination ? `${path}?next=${encodeURIComponent(destination)}` : path;
}
