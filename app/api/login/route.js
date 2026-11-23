import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { createSession } from '@/lib/session';
import {
  envAdminFingerprint,
  envAdminUser,
  hashPassword,
  isBcryptHash,
  normalizeRole,
  passwordFingerprint,
} from '@/lib/accounts';

const INVALID_LOGIN = { error: 'Username atau Password salah!' };

const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};

// Akun admin dari environment variable (ADMIN_USERNAME + ADMIN_PASSWORD).
// Aktif hanya jika keduanya diisi; akun di tabel users tetap berlaku.
const matchEnvAdmin = (username, password) => {
  const envUser = envAdminUser();
  if (!envUser) return null;
  if (!safeEqual(username, process.env.ADMIN_USERNAME) || !safeEqual(password, process.env.ADMIN_PASSWORD)) {
    return null;
  }
  return envUser;
};

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(INVALID_LOGIN, { status: 401 });
    }

    const envAdmin = matchEnvAdmin(username, password);
    if (envAdmin) {
      await createSession(envAdmin, envAdminFingerprint());
      return NextResponse.json({ user: envAdmin });
    }

    const { rows } = await db.query(
      'SELECT id, username, role, nama_lengkap, password FROM users WHERE username = $1 LIMIT 1',
      [username]
    );

    const found = rows[0];
    if (!found) {
      return NextResponse.json(INVALID_LOGIN, { status: 401 });
    }

    let valid = false;
    let storedPassword = found.password;
    if (isBcryptHash(found.password)) {
      valid = await bcrypt.compare(password, found.password);
    } else {
      // Akun lama dengan password teks biasa: cocokkan, lalu ubah ke hash.
      valid = found.password === password;
      if (valid) {
        try {
          const hash = await hashPassword(password);
          await db.query('UPDATE users SET password = $1 WHERE id = $2', [hash, found.id]);
          storedPassword = hash;
        } catch (upgradeError) {
          console.error('Gagal mengubah password ke hash:', upgradeError.message);
        }
      }
    }

    if (!valid) {
      return NextResponse.json(INVALID_LOGIN, { status: 401 });
    }

    const user = {
      id: found.id,
      username: found.username,
      role: normalizeRole(found.role),
      nama_lengkap: found.nama_lengkap,
    };
    await createSession(user, passwordFingerprint(storedPassword));
    return NextResponse.json({ user });
  } catch (error) {
    console.error('API login error:', error);
    return NextResponse.json({ error: 'Gagal memproses login.' }, { status: 500 });
  }
}
