// Sesi login berbasis cookie bertanda tangan (HMAC-SHA256).
// Isi cookie: data pengguna + waktu kedaluwarsa, ditandatangani dengan
// SESSION_SECRET. Cookie httpOnly sehingga tidak bisa dibaca JavaScript.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { envAdminFingerprint, envAdminUser, passwordFingerprint } from '@/lib/accounts';

const COOKIE_NAME = 'simadu_session';
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 jam

function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // Cadangan bila SESSION_SECRET belum diisi: turunan dari DATABASE_URL
  // (sama rahasianya). Sebaiknya tetap isi SESSION_SECRET sendiri.
  if (process.env.DATABASE_URL) {
    return createHash('sha256').update(`simadu-session:${process.env.DATABASE_URL}`).digest('hex');
  }
  throw new Error('SESSION_SECRET belum diatur.');
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => createHmac('sha256', getSecret()).update(data).digest('base64url');

function encode(payload) {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function decode(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = sign(body);
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Buat sesi untuk pengguna yang berhasil login.
 * fingerprint = sidik jari password saat ini (lib/accounts.js).
 */
export async function createSession(user, fingerprint) {
  const payload = {
    user: { id: user.id },
    fp: fingerprint,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  (await cookies()).set(COOKIE_NAME, encode(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * Pengguna yang sedang login (data terbaru dari database), atau null.
 * Sesi ditolak bila akun sudah dihapus atau password-nya sudah diganti.
 */
export async function getSessionUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const payload = decode(token);
  if (!payload?.user || !payload.fp) return null;

  if (payload.user.id === 'env-admin') {
    const envUser = envAdminUser();
    return envUser && payload.fp === envAdminFingerprint() ? envUser : null;
  }

  const { rows } = await db.query(
    'SELECT id, username, role, nama_lengkap, password FROM users WHERE id = $1',
    [payload.user.id]
  );
  const row = rows[0];
  if (!row || passwordFingerprint(row.password) !== payload.fp) return null;
  return { id: row.id, username: row.username, role: row.role, nama_lengkap: row.nama_lengkap };
}

export async function clearSession() {
  (await cookies()).delete(COOKIE_NAME);
}

/** Respons standar bila belum login / sesi habis. */
export const unauthorized = () =>
  NextResponse.json({ error: 'Sesi berakhir. Silakan masuk kembali.' }, { status: 401 });

/** Respons standar bila sudah login tapi perannya tidak berhak. */
export const forbidden = (message = 'Anda tidak berhak mengakses fitur ini.') =>
  NextResponse.json({ error: message }, { status: 403 });
