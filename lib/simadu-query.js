// Penyusun query bersama untuk /api/simadu (tabel) dan /api/export (Excel),
// supaya pencarian, filter, dan urutan selalu sama di layar maupun di file.

export const PAGE_SIZES = [25, 50, 100];

// Jenjang diturunkan dari awalan nama madrasah (MIS/MIN → MI, MTSS/MTSN → MTS,
// MAS/MAN → MA, RA). Bila storedCol diberikan dan terisi, nilai itu yang dipakai.
// Hasil NULL = tidak bisa ditentukan (mis. "Kantor Kementerian Agama").
const jenjangSql = (nameCol, storedCol) => String.raw`(CASE${
  storedCol ? `
  WHEN NULLIF(trim(${storedCol}), '') IS NOT NULL THEN upper(trim(${storedCol}))` : ''
}
  WHEN upper(${nameCol}) ~ '^\s*(MTS|MADRASAH\s+TSANAWIYAH)' THEN 'MTS'
  WHEN upper(${nameCol}) ~ '^\s*(MI|MADRASAH\s+IBTIDAIYAH)' THEN 'MI'
  WHEN upper(${nameCol}) ~ '^\s*(MA[SN]?\y|MADRASAH\s+ALIYAH)' THEN 'MA'
  WHEN upper(${nameCol}) ~ '^\s*(R\.?A\.?\y|RAUD[LH]ATUL\s+ATH?FAL)' THEN 'RA'
END)`;

// Jenjang siswa: kolom jenjang bila terisi, kalau kosong dari nama sekolah.
export const SISWA_JENJANG_SQL = jenjangSql('nama_sekolah', 'jenjang');
// Jenjang GTK: tabel gtk tidak punya kolom jenjang, jadi dari nama satuan pendidikan.
export const GTK_JENJANG_SQL = jenjangSql('nama_madrasah');

// Status kepegawaian GTK: data memakai "P3K" untuk PPPK.
export const GTK_STATUS_GROUPS = {
  PNS: `upper(trim(status_kepegawaian)) = 'PNS'`,
  PPPK: `upper(trim(status_kepegawaian)) IN ('PPPK', 'P3K')`,
  NON_PNS: `upper(trim(status_kepegawaian)) = 'NON PNS'`,
  KOSONG: `coalesce(nullif(trim(status_kepegawaian), ''), '-') = '-'`,
};

// Urutan nama: abaikan tanda baca di awal (mis. 'ADALATUS, .WIJI) dan besar/kecil huruf.
const nameSort = (col) => String.raw`upper(regexp_replace(${col}, '^[^[:alnum:]]+', ''))`;

// LAINNYA = jenjang tidak bisa ditentukan (mis. GTK di Kantor Kemenag).
const JENJANG_VALUES = ['RA', 'MI', 'MTS', 'MA', 'LAINNYA'];

// Definisi per tab: kolom yang dicari, kolom yang boleh dipakai mengurutkan,
// dan urutan bawaan. Kunci sort dipetakan ke ekspresi SQL (tidak pernah
// memasukkan input pengguna langsung ke SQL).
export const TABLES = {
  kelembagaan: {
    from: 'kelembagaan',
    select: '*',
    searchCols: ['nama_lembaga', 'nsm', 'npsn', 'kepala_madrasah', 'kecamatan'],
    rankCols: ['nama_lembaga', 'nsm', 'npsn'],
    sorts: {
      nama: nameSort('nama_lembaga'),
      nsm: 'nsm',
      npsn: 'npsn',
      jenjang: 'jenjang',
      kecamatan: 'kecamatan',
      kepala: 'kepala_madrasah',
    },
    defaultSort: ['kecamatan', 'asc'],
    tiebreak: 'nama_lembaga ASC, id ASC',
  },
  gtk: {
    from: 'gtk',
    select: `*, ${GTK_JENJANG_SQL} AS jenjang`,
    searchCols: ['nama_lengkap', 'nip_nik', 'nama_madrasah'],
    rankCols: ['nama_lengkap', 'nip_nik'],
    sorts: {
      nama: nameSort('nama_lengkap'),
      nip: 'nip_nik',
      status: 'status_kepegawaian',
      ptk: 'status_ptk',
      jenjang: GTK_JENJANG_SQL,
      madrasah: 'nama_madrasah',
    },
    defaultSort: ['nama', 'asc'],
    tiebreak: 'id ASC',
  },
  kesiswaan: {
    from: 'kesiswaan',
    select: `id, nisn, nik, nama_lengkap, ${SISWA_JENJANG_SQL} AS jenjang, tingkat_rombel,
      nama_sekolah, nama_wali, alamat, capaian_tahfidz`,
    searchCols: ['nama_lengkap', 'nisn', 'nik', 'nama_sekolah'],
    rankCols: ['nama_lengkap', 'nisn', 'nik'],
    sorts: {
      nama: nameSort('nama_lengkap'),
      nisn: 'nisn',
      jenjang: SISWA_JENJANG_SQL,
      madrasah: 'nama_sekolah',
      rombel: 'tingkat_rombel',
    },
    defaultSort: ['nama', 'asc'],
    tiebreak: 'id ASC',
  },
  berkas_sk: {
    from: 'berkas_sk',
    select: '*',
    searchCols: ['judul_dokumen', 'nomor_sk', 'kategori_utama', 'sub_kategori'],
    rankCols: ['judul_dokumen', 'nomor_sk'],
    sorts: {
      judul: 'judul_dokumen',
      nomor: 'nomor_sk',
      kategori: 'kategori_utama',
      tanggal: 'tanggal_terbit',
      id: 'id',
    },
    defaultSort: ['id', 'desc'],
    tiebreak: 'id DESC',
  },
};

const escapeLike = (term) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

/** Baca & normalkan parameter filter dari URLSearchParams. */
export function readFilters(searchParams) {
  const tab = clean(searchParams.get('tab')) || 'dashboard';
  const table = TABLES[tab];
  const sortKey = clean(searchParams.get('sort'));
  const dir = clean(searchParams.get('dir')).toLowerCase();
  const pageSize = parseInt(searchParams.get('limit') || '25', 10);
  const jenjang = clean(searchParams.get('jenjang')).toUpperCase();

  return {
    tab,
    search: clean(searchParams.get('search')).slice(0, 100),
    kecamatan: clean(searchParams.get('kecamatan')) || 'ALL',
    jenjang: JENJANG_VALUES.includes(jenjang) ? jenjang : 'ALL',
    status: GTK_STATUS_GROUPS[clean(searchParams.get('status'))] ? clean(searchParams.get('status')) : 'ALL',
    ptk: clean(searchParams.get('ptk')) || 'ALL',
    kategori: clean(searchParams.get('kategori')) || 'ALL',
    sort: table && table.sorts[sortKey] ? sortKey : table?.defaultSort[0],
    // true bila pengguna memilih kolom urutan sendiri (mematikan urutan relevansi).
    explicitSort: Boolean(table && table.sorts[sortKey]),
    dir: dir === 'desc' || dir === 'asc' ? dir : table?.defaultSort[1] || 'asc',
    page: Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1),
    pageSize: PAGE_SIZES.includes(pageSize) ? pageSize : 25,
  };
}

/**
 * Susun WHERE + ORDER BY untuk satu tab. Mengembalikan teks SQL dan parameter
 * terpisah (selalu parameterized).
 */
export function buildQuery(filters) {
  const table = TABLES[filters.tab];
  if (!table) return null;

  const conditions = [];
  const params = [];
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  // Pencarian multi-kata: setiap kata harus cocok di salah satu kolom.
  // "siti jember" → nama mengandung "siti" DAN (kolom mana pun) mengandung "jember".
  const terms = filters.search.split(/\s+/).filter(Boolean).slice(0, 6);
  const termPlaceholders = [];
  for (const term of terms) {
    const ph = add(`%${escapeLike(term)}%`);
    termPlaceholders.push(ph);
    conditions.push(`(${table.searchCols.map((c) => `${c} ILIKE ${ph}`).join(' OR ')})`);
  }

  if (filters.tab === 'kelembagaan') {
    if (filters.kecamatan !== 'ALL') {
      conditions.push(`upper(trim(kecamatan)) = upper(trim(${add(filters.kecamatan)}))`);
    }
    if (filters.jenjang === 'LAINNYA') {
      conditions.push(`nullif(trim(jenjang), '') IS NULL`);
    } else if (filters.jenjang !== 'ALL') {
      conditions.push(`upper(trim(jenjang)) = ${add(filters.jenjang)}`);
    }
  }

  // Jenjang turunan untuk siswa & GTK; LAINNYA = tidak bisa ditentukan.
  const derived = { kesiswaan: SISWA_JENJANG_SQL, gtk: GTK_JENJANG_SQL }[filters.tab];
  if (derived && filters.jenjang !== 'ALL') {
    conditions.push(
      filters.jenjang === 'LAINNYA' ? `${derived} IS NULL` : `${derived} = ${add(filters.jenjang)}`
    );
  }

  if (filters.tab === 'gtk') {
    if (filters.status !== 'ALL') conditions.push(GTK_STATUS_GROUPS[filters.status]);
    if (filters.ptk !== 'ALL') {
      conditions.push(`trim(status_ptk) = ${add(filters.ptk)}`);
    }
  }

  if (filters.tab === 'berkas_sk' && filters.kategori !== 'ALL') {
    conditions.push(`trim(kategori_utama) = ${add(filters.kategori)}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortExpr = table.sorts[filters.sort] || table.sorts[table.defaultSort[0]];
  const dir = filters.dir === 'desc' ? 'DESC' : 'ASC';
  // Relevansi: saat mencari tanpa memilih kolom urutan, baris yang cocok di
  // nama / nomor induk tampil lebih dulu daripada yang cocok di kolom lain
  // (mis. cari "ahmad" → siswa bernama Ahmad sebelum siswa di "MI Ahmad Dahlan").
  const relevance =
    termPlaceholders.length && !filters.explicitSort
      ? `CASE WHEN ${termPlaceholders
          .map((ph) => `concat_ws(' ', ${table.rankCols.join(', ')}) ILIKE ${ph}`)
          .join(' AND ')} THEN 0 ELSE 1 END, `
      : '';
  const orderBy = `ORDER BY ${relevance}${sortExpr} ${dir} NULLS LAST, ${table.tiebreak}`;

  return { table, where, orderBy, params };
}
