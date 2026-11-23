import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { createSession, getSessionUser, unauthorized } from '@/lib/session';
import { hashPassword, isBcryptHash, passwordFingerprint, validateAccount } from '@/lib/accounts';

// Ganti password akun sendiri: { current, next }
export async function POST(request) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (me.id === 'env-admin') {
    return NextResponse.json(
      { error: 'Password akun ini diatur lewat environment variable di Vercel (ADMIN_PASSWORD).' },
      { status: 400 }
    );
  }

  try {
    const { current, next } = await request.json();
    const errors = validateAccount({ password: next }, { requirePassword: true });
    if (errors.length) return NextResponse.json({ error: errors[0] }, { status: 422 });
    if (current === next) {
      return NextResponse.json({ error: 'Password baru harus berbeda dari password lama.' }, { status: 422 });
    }

    const { rows } = await db.query('SELECT password FROM users WHERE id = $1', [me.id]);
    const stored = rows[0]?.password;
    const ok =
      typeof current === 'string' &&
      (isBcryptHash(stored) ? await bcrypt.compare(current, stored) : stored === current);
    if (!ok) return NextResponse.json({ error: 'Password lama salah.' }, { status: 422 });

    const hash = await hashPassword(next);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hash, me.id]);
    // Sesi ini tetap aktif; sesi lain (perangkat lain) otomatis keluar.
    await createSession(me, passwordFingerprint(hash));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('API ganti password:', error);
    return NextResponse.json({ error: 'Gagal mengganti password.' }, { status: 500 });
  }
}
