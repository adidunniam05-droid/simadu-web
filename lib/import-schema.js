// Skema import per bagian. Dipakai bersama oleh server (/api/import) dan
// formulir "Input Manual" di halaman, jadi aturannya selalu sama.
//
// - key      : nama kolom di database
// - label    : judul kolom di template Excel & formulir
// - aliases  : judul kolom lain yang juga dikenali (mis. judul dari Export Excel)
// - required : wajib diisi
// - options  : nilai yang diizinkan (dicocokkan tanpa beda besar/kecil huruf)
// - text     : kolom angka panjang (NIK/NISN/NSM) → di template diformat teks
// - date     : tanggal → disimpan sebagai DD-MM-YYYY seperti data yang ada
// - nip      : NIP 18 digit (spasi diabaikan)
// - max      : panjang maksimum = ukuran kolom di database

export const JENJANG_IMPORT = ['RA', 'MI', 'MTS', 'MA'];

export const IMPORT_SCHEMAS = {
  kelembagaan: {
    table: 'kelembagaan',
    title: 'Kelembagaan',
    // Urutan kunci pencocokan "perbarui bila sudah ada"
    keys: ['nsm'],
    fields: [
      { key: 'nsm', max: 25, label: 'NSM', required: true, text: true, hint: '12 digit, mis. 111235090010' },
      { key: 'npsn', max: 25, label: 'NPSN', text: true },
      { key: 'nama_lembaga', max: 150, label: 'Nama Lembaga', required: true, aliases: ['Nama Lembaga / Madrasah', 'Nama Madrasah'] },
      { key: 'jenjang', label: 'Jenjang', required: true, options: JENJANG_IMPORT },
      { key: 'kecamatan', max: 100, label: 'Kecamatan', required: true, kecamatan: true },
      { key: 'kepala_madrasah', max: 150, label: 'Kepala Madrasah', aliases: ['Kepala'] },
      { key: 'status_aktif', max: 20, label: 'Status', aliases: ['Status Aktif'] },
      { key: 'nama_pengawas', max: 150, label: 'Nama Pengawas', aliases: ['Pengawas', 'Pengawas Madrasah', 'Pengawas Pembina'] },
      { key: 'nip_pengawas', max: 30, label: 'NIP Pengawas', text: true, nip: true, hint: '18 digit' },
    ],
  },
  kesiswaan: {
    table: 'kesiswaan',
    title: 'Kesiswaan',
    keys: ['nisn', 'nik'],
    fields: [
      { key: 'nisn', max: 25, label: 'NISN', text: true, hint: 'Kunci utama; bila kosong dicocokkan lewat NIK' },
      { key: 'nik', max: 25, label: 'NIK', text: true },
      { key: 'nama_lengkap', max: 150, label: 'Nama Siswa', required: true, aliases: ['Nama Lengkap', 'Nama'] },
      { key: 'jenjang', label: 'Jenjang', options: JENJANG_IMPORT, hint: 'Boleh kosong: dibaca dari nama madrasah' },
      { key: 'tingkat_rombel', max: 100, label: 'Rombel', aliases: ['Tingkat Rombel', 'Kelas'] },
      { key: 'nama_sekolah', max: 150, label: 'Madrasah', required: true, aliases: ['Nama Sekolah', 'Nama Madrasah', 'Sekolah'] },
      { key: 'nama_wali', max: 150, label: 'Nama Wali', aliases: ['Wali'] },
      { key: 'alamat', label: 'Alamat' },
      { key: 'capaian_tahfidz', max: 100, label: 'Capaian Tahfidz', aliases: ['Tahfidz'] },
    ],
  },
  gtk: {
    table: 'gtk',
    title: 'GTK',
    keys: ['id_gtk'],
    // Ada di file Export tapi dihitung otomatis, jadi diabaikan tanpa peringatan
    ignored: ['Jenjang'],
    fields: [
      { key: 'id_gtk', max: 50, label: 'ID GTK', text: true, hint: 'Kunci pencocokan; bila kosong selalu ditambah sebagai data baru' },
      { key: 'nip_nik', max: 35, label: 'NIP / NIK', text: true, aliases: ['NIP', 'NIK', 'NIP/NIK'] },
      { key: 'nama_lengkap', max: 150, label: 'Nama Lengkap', required: true, aliases: ['Nama'] },
      { key: 'status_kepegawaian', max: 50, label: 'Status Kepegawaian', aliases: ['Kepegawaian'], hint: 'PNS / P3K / Non PNS' },
      { key: 'jabatan', max: 100, label: 'Jabatan' },
      { key: 'status_ptk', max: 50, label: 'Status PTK', hint: 'Aktif / Mutasi / Pensiun / ...' },
      { key: 'nama_madrasah', max: 150, label: 'Satuan Pendidikan', required: true, aliases: ['Madrasah', 'Nama Madrasah', 'Satuan'] },
      { key: 'tanggal_lahir', max: 25, label: 'Tanggal Lahir', date: true, hint: 'DD-MM-YYYY' },
    ],
  },
  berkas_sk: {
    table: 'berkas_sk',
    title: 'Berkas SK',
    keys: ['nomor_sk', 'id_dokumen'],
    fields: [
      { key: 'id_dokumen', max: 50, label: 'ID Dokumen', text: true },
      { key: 'judul_dokumen', max: 200, label: 'Judul Dokumen', required: true, aliases: ['Judul'] },
      { key: 'nomor_sk', max: 100, label: 'Nomor SK', aliases: ['Nomor'] },
      { key: 'kategori_utama', max: 100, label: 'Kategori', aliases: ['Kategori Utama'] },
      { key: 'sub_kategori', max: 100, label: 'Sub Kategori' },
      { key: 'tanggal_terbit', max: 50, label: 'Tanggal Terbit', date: true, aliases: ['Tanggal'], hint: 'DD-MM-YYYY' },
      { key: 'format_file', max: 20, label: 'Format', aliases: ['Format File'] },
      { key: 'link_google_drive', label: 'Link Google Drive', aliases: ['Link', 'Tautan', 'Tautan Berkas'], url: true },
    ],
  },
};

/** "Nama Lembaga / Madrasah" → "namalembagamadrasah" untuk mencocokkan judul kolom. */
export const normalizeHeader = (h) =>
  String(h ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Peta judul-kolom-ternormalisasi → key database untuk satu skema. */
export function headerMap(schema) {
  const map = new Map();
  for (const f of schema.fields) {
    for (const name of [f.key, f.label, ...(f.aliases ?? [])]) map.set(normalizeHeader(name), f.key);
  }
  return map;
}

/**
 * Rapikan & periksa satu baris. Mengembalikan { record, errors }.
 * kecamatanSet: Set nama kecamatan (huruf besar) yang sah, untuk kelembagaan.
 */
export function validateRecord(schema, raw, kecamatanSet) {
  const record = {};
  const errors = [];
  for (const f of schema.fields) {
    let v = raw[f.key];
    v = v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim();
    if (v === '-') v = f.required ? '' : v;

    if (f.options && v) {
      const up = v.toUpperCase();
      if (!f.options.includes(up)) {
        errors.push(`${f.label} "${v}" tidak dikenal (pilih: ${f.options.join(', ')})`);
      }
      v = up;
    }
    if (f.kecamatan && v) {
      v = v.toUpperCase();
      if (kecamatanSet && !kecamatanSet.has(v)) errors.push(`Kecamatan "${v}" tidak ada di daftar kecamatan Jember`);
    }
    if (f.date && v && !/^\d{2}-\d{2}-\d{4}$/.test(v)) {
      errors.push(`${f.label} "${v}" harus berformat DD-MM-YYYY`);
    }
    if (f.nip && v) {
      v = v.replace(/\s+/g, '');
      if (!/^\d{18}$/.test(v)) errors.push(`${f.label} "${v}" harus 18 digit angka`);
    }
    if (f.url && v && !/^https?:\/\//i.test(v)) {
      errors.push(`${f.label} harus diawali http:// atau https://`);
    }
    if (f.required && !v) errors.push(`${f.label} wajib diisi`);
    const max = f.max ?? 500;
    if (v.length > max) errors.push(`${f.label} terlalu panjang (maks. ${max} karakter)`);
    record[f.key] = v || null;
  }
  return { record, errors };
}
