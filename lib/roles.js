// Level admin SIMADU. Dipakai bersama oleh server (API) dan halaman,
// jadi hak akses yang terlihat di layar selalu sama dengan yang dijaga server.

export const SUPER_ROLE = 'Superadmin';

// Urutan dari level tertinggi
export const ROLES = ['Superadmin', 'Admin', 'Viewer'];

export const ROLE_INFO = {
  Superadmin: 'Akses penuh: lihat, ekspor, import/input data, dan kelola akun admin.',
  Admin: 'Lihat, ekspor, dan import/input data. Tidak bisa mengelola akun.',
  Viewer: 'Hanya melihat dan mengekspor data. Tidak bisa mengubah data.',
};

// Nama peran lama yang masih mungkin tersimpan → nama baru
const LEGACY = { 'Admin Pusat': 'Superadmin' };

/** Peran yang tersimpan/env → salah satu ROLES (peran tak dikenal diperlakukan sebagai Viewer). */
export function normalizeRole(role) {
  const r = LEGACY[role] ?? role;
  return ROLES.includes(r) ? r : 'Viewer';
}

/** Semua nama (baru + lama) untuk satu peran, untuk query database. */
export const roleAliases = (role) => [role, ...Object.keys(LEGACY).filter((k) => LEGACY[k] === role)];

export const canManageUsers = (user) => normalizeRole(user?.role) === 'Superadmin';
export const canImport = (user) => ['Superadmin', 'Admin'].includes(normalizeRole(user?.role));
