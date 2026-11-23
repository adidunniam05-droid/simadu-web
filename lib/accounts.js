// Aturan akun login SIMADU (tabel users), dipakai login, sesi, dan Kelola Admin.
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';

export const BCRYPT_ROUNDS = 10;

import { ROLES, SUPER_ROLE, normalizeRole } from '@/lib/roles';

export { ROLES, SUPER_ROLE, normalizeRole };
export { canImport, canManageUsers, roleAliases } from '@/lib/roles';

export const isBcryptHash = (value) => /^\$2[aby]\$\d{2}\$/.test(value || '');
export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

/**
 * Sidik jari password yang tersimpan. Disimpan di cookie sesi; bila password
 * diganti/di-reset, sidik jari berubah sehingga sesi lama otomatis tidak berlaku.
 */
export const passwordFingerprint = (storedPassword) =>
  createHash('sha256').update(`pw:${storedPassword ?? ''}`).digest('base64url').slice(0, 22);

/** Sidik jari akun admin dari environment variable. */
export const envAdminFingerprint = () =>
  passwordFingerprint(`env:${process.env.ADMIN_USERNAME ?? ''}:${process.env.ADMIN_PASSWORD ?? ''}`);

export function envAdminUser() {
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) return null;
  return {
    id: 'env-admin',
    username: process.env.ADMIN_USERNAME,
    role: normalizeRole(process.env.ADMIN_ROLE || SUPER_ROLE),
    nama_lengkap: process.env.ADMIN_NAMA || process.env.ADMIN_USERNAME,
  };
}

/** Periksa isian akun. Mengembalikan daftar pesan kesalahan (kosong = valid). */
export function validateAccount({ username, nama_lengkap, role, password }, { requirePassword }) {
  const errors = [];
  if (username !== undefined) {
    if (!username) errors.push('Username wajib diisi.');
    else if (!/^[A-Za-z0-9 ._@-]{3,50}$/.test(username))
      errors.push('Username 3–50 karakter: huruf, angka, spasi, titik, garis bawah, @ atau tanda hubung.');
  }
  if (nama_lengkap !== undefined && (!nama_lengkap || nama_lengkap.length > 100)) {
    errors.push('Nama lengkap wajib diisi (maks. 100 karakter).');
  }
  if (role !== undefined && !ROLES.includes(role)) errors.push(`Peran harus salah satu dari: ${ROLES.join(', ')}.`);
  if (requirePassword || password) {
    if (!password || password.length < 8) errors.push('Password minimal 8 karakter.');
    else if (password.length > 72) errors.push('Password maksimal 72 karakter.');
  }
  return errors;
}
