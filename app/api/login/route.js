import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

const BCRYPT_ROUNDS = 10;
const INVALID_LOGIN = { error: 'Username atau Password salah!' };

const isBcryptHash = (value) => /^\$2[aby]\$\d{2}\$/.test(value || '');

const safeEqual = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};

// Akun admin dari environment variable (ADMIN_USERNAME + ADMIN_PASSWORD).
// Aktif hanya jika keduanya diisi; akun di tabel users tetap berlaku.
const matchEnvAdmin = (username, password) => {
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;
  if (!envUser || !envPass) return null;
  if (!safeEqual(username, envUser) || !safeEqual(password, envPass)) return null;
  return {
    id: 'env-admin',
    username: envUser,
    role: process.env.ADMIN_ROLE || 'Admin Pusat',
    nama_lengkap: process.env.ADMIN_NAMA || envUser,
  };
};

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(INVALID_LOGIN, { status: 401 });
    }

    const envAdmin = matchEnvAdmin(username, password);
    if (envAdmin) {
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
    if (isBcryptHash(found.password)) {
      valid = await bcrypt.compare(password, found.password);
    } else {
      // Akun lama dengan password teks biasa: cocokkan, lalu ubah ke hash.
      valid = found.password === password;
      if (valid) {
        try {
          const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
          await db.query('UPDATE users SET password = $1 WHERE id = $2', [hash, found.id]);
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
      role: found.role,
      nama_lengkap: found.nama_lengkap,
    };
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
