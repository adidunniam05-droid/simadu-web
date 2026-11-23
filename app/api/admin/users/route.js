import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSession, forbidden, getSessionUser, unauthorized } from '@/lib/session';
import {
  SUPER_ROLE,
  hashPassword,
  isBcryptHash,
  isSuperAdmin,
  passwordFingerprint,
  validateAccount,
} from '@/lib/accounts';

// Kelola akun admin (tabel users). Hanya untuk peran Admin Pusat.

const bad = (message, status = 400, extra = {}) => NextResponse.json({ error: message, ...extra }, { status });
const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : undefined);

async function requireSuper() {
  const me = await getSessionUser();
  if (!me) return { res: unauthorized() };
  if (!isSuperAdmin(me)) return { res: forbidden('Hanya Admin Pusat yang dapat mengelola akun admin.') };
  return { me };
}

const listUsers = async () => {
  const { rows } = await db.query(
    'SELECT id, username, nama_lengkap, role, password FROM users ORDER BY (role = $1) DESC, lower(nama_lengkap), id',
    [SUPER_ROLE]
  );
  // Password tidak pernah dikirim; hanya penanda apakah sudah terenkripsi.
  return rows.map(({ password, ...u }) => ({ ...u, password_terenkripsi: isBcryptHash(password) }));
};

const usernameTaken = async (username, exceptId = null) => {
  if (process.env.ADMIN_USERNAME && username.toLowerCase() === process.env.ADMIN_USERNAME.toLowerCase()) return true;
  const { rows } = await db.query(
    'SELECT 1 FROM users WHERE lower(username) = lower($1) AND ($2::int IS NULL OR id <> $2) LIMIT 1',
    [username, exceptId]
  );
  return rows.length > 0;
};

export async function GET() {
  const { res } = await requireSuper();
  if (res) return res;
  return NextResponse.json({ users: await listUsers() });
}

// Tambah akun: { username, nama_lengkap, role, password }
export async function POST(request) {
  const { res } = await requireSuper();
  if (res) return res;
  try {
    const body = await request.json();
    const data = {
      username: clean(body.username) ?? '',
      nama_lengkap: clean(body.nama_lengkap) ?? '',
      role: clean(body.role) ?? '',
      password: typeof body.password === 'string' ? body.password : '',
    };
    const errors = validateAccount(data, { requirePassword: true });
    if (errors.length) return bad('Periksa kembali isian.', 422, { errors });
    if (await usernameTaken(data.username)) return bad('Username sudah dipakai akun lain.', 409);

    const { rows } = await db.query(
      'INSERT INTO users (username, nama_lengkap, role, password) VALUES ($1, $2, $3, $4) RETURNING id',
      [data.username, data.nama_lengkap, data.role, await hashPassword(data.password)]
    );
    return NextResponse.json({ ok: true, id: rows[0].id, users: await listUsers() });
  } catch (error) {
    console.error('API admin users POST:', error);
    return bad('Gagal menambah akun.', 500);
  }
}

// Ubah akun: { id, username?, nama_lengkap?, role?, password? (reset) }
export async function PATCH(request) {
  const { me, res } = await requireSuper();
  if (res) return res;
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!Number.isInteger(id)) return bad('Akun tidak dikenali.');
    const data = {
      username: clean(body.username),
      nama_lengkap: clean(body.nama_lengkap),
      role: clean(body.role),
      password: typeof body.password === 'string' && body.password ? body.password : undefined,
    };
    const errors = validateAccount(data, { requirePassword: false });
    if (errors.length) return bad('Periksa kembali isian.', 422, { errors });
    if (data.username && (await usernameTaken(data.username, id))) return bad('Username sudah dipakai akun lain.', 409);

    const result = await db.transaction(async (client) => {
      // Kunci baris Admin Pusat agar pemeriksaan "admin terakhir" tidak bentrok
      const { rows: supers } = await client.query('SELECT id FROM users WHERE role = $1 FOR UPDATE', [SUPER_ROLE]);
      const { rows } = await client.query('SELECT id, role FROM users WHERE id = $1 FOR UPDATE', [id]);
      const target = rows[0];
      if (!target) return { error: bad('Akun tidak ditemukan.', 404) };

      if (data.role && data.role !== SUPER_ROLE && target.role === SUPER_ROLE) {
        if (String(target.id) === String(me.id)) return { error: bad('Anda tidak dapat menurunkan peran akun Anda sendiri.') };
        if (supers.length <= 1) return { error: bad('Harus tetap ada minimal satu Admin Pusat.') };
      }

      const sets = [];
      const params = [];
      for (const col of ['username', 'nama_lengkap', 'role']) {
        if (data[col] !== undefined) {
          params.push(data[col]);
          sets.push(`${col} = $${params.length}`);
        }
      }
      let newHash = null;
      if (data.password) {
        newHash = await hashPassword(data.password);
        params.push(newHash);
        sets.push(`password = $${params.length}`);
      }
      if (!sets.length) return { error: bad('Tidak ada perubahan.') };
      params.push(id);
      await client.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
      return { newHash, self: String(target.id) === String(me.id) };
    });
    if (result.error) return result.error;

    // Reset password akun sendiri: perbarui sesi agar tidak ikut keluar
    if (result.self && result.newHash) await createSession(me, passwordFingerprint(result.newHash));
    return NextResponse.json({ ok: true, users: await listUsers() });
  } catch (error) {
    console.error('API admin users PATCH:', error);
    return bad('Gagal mengubah akun.', 500);
  }
}

// Hapus akun: /api/admin/users?id=3
export async function DELETE(request) {
  const { me, res } = await requireSuper();
  if (res) return res;
  try {
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!Number.isInteger(id)) return bad('Akun tidak dikenali.');
    if (String(id) === String(me.id)) return bad('Anda tidak dapat menghapus akun Anda sendiri.');

    const result = await db.transaction(async (client) => {
      const { rows: supers } = await client.query('SELECT id FROM users WHERE role = $1 FOR UPDATE', [SUPER_ROLE]);
      const { rows } = await client.query('SELECT id, role FROM users WHERE id = $1 FOR UPDATE', [id]);
      if (!rows[0]) return { error: bad('Akun tidak ditemukan.', 404) };
      if (rows[0].role === SUPER_ROLE && supers.length <= 1) {
        return { error: bad('Harus tetap ada minimal satu Admin Pusat.') };
      }
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      return {};
    });
    if (result.error) return result.error;
    return NextResponse.json({ ok: true, users: await listUsers() });
  } catch (error) {
    console.error('API admin users DELETE:', error);
    return bad('Gagal menghapus akun.', 500);
  }
}
