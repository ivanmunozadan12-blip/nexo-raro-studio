import { createHmac, timingSafeEqual } from 'node:crypto';

export type SocialPlatform = 'youtube' | 'tiktok';

function siteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000');
  return value.replace(/\/$/, '');
}
export function callbackUrl() { return siteUrl() + '/api/social/callback'; }
function secret() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.');
  return value;
}
export function signState(userId: string, platform: SocialPlatform) {
  const payload = Buffer.from(JSON.stringify({ userId, platform, expires: Date.now() + 10 * 60 * 1000 })).toString('base64url');
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
  return payload + '.' + signature;
}
export function verifyState(value: string) {
  const [payload, signature] = value.split('.');
  if (!payload || !signature) throw new Error('Estado OAuth no válido.');
  const expected = createHmac('sha256', secret()).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Firma OAuth no válida.');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!data.userId || !['youtube','tiktok'].includes(data.platform) || Number(data.expires) < Date.now()) throw new Error('La solicitud OAuth ha caducado.');
  return data as { userId: string; platform: SocialPlatform; expires: number };
}
export function serviceHeaders() {
  const key = secret();
  return { apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: 'Bearer ' + key }), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' };
}
