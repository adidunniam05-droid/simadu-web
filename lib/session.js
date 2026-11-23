// Sesi login berbasis cookie bertanda tangan (HMAC-SHA256).
// Isi cookie: data pengguna + waktu kedaluwarsa, ditandatangani dengan
// SESSION_SECRET. Cookie httpOnly sehingga tidak bisa dibaca JavaScript.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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

/** Buat sesi untuk pengguna yang berhasil login. */
export async function createSession(user) {
  const payload = {
    user: { id: user.id, username: user.username, role: user.role, nama_lengkap: user.nama_lengkap },
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

/** Pengguna yang sedang login, atau null. */
export async function getSessionUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return decode(token)?.user ?? null;
}

export async function clearSession() {
  (await cookies()).delete(COOKIE_NAME);
}

/** Respons standar bila belum login / sesi habis. */
export const unauthorized = () =>
  NextResponse.json({ error: 'Sesi berakhir. Silakan masuk kembali.' }, { status: 401 });
