import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readFilters, buildQuery, SISWA_JENJANG_SQL, GTK_STATUS_GROUPS } from '@/lib/simadu-query';

const toInt = (value) => parseInt(value ?? 0, 10) || 0;

async function getDashboard() {
  const [resKec, resLembaga, resGtk, resSiswa, resSebaran, resJenjang, resSiswaJenjang] =
    await Promise.all([
      db.query(`
        SELECT DISTINCT ON (upper(trim(nama_kecamatan)))
          kode_kecamatan, trim(nama_kecamatan) AS nama_kecamatan
        FROM ref_kecamatan
        WHERE nullif(trim(nama_kecamatan), '') IS NOT NULL
        ORDER BY upper(trim(nama_kecamatan))
      `),
      db.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (
            WHERE nullif(trim(nsm), '') IS NOT NULL
              AND nullif(trim(npsn), '') IS NOT NULL
              AND coalesce(nullif(trim(kepala_madrasah), ''), '-') <> '-'
          ) AS lengkap
        FROM kelembagaan
      `),
      db.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE ${GTK_STATUS_GROUPS.PNS}) AS pns,
          COUNT(*) FILTER (WHERE ${GTK_STATUS_GROUPS.PPPK}) AS pppk,
          COUNT(*) FILTER (WHERE ${GTK_STATUS_GROUPS.NON_PNS}) AS non_pns,
          COUNT(*) FILTER (WHERE trim(status_ptk) = 'Aktif') AS aktif
        FROM gtk
      `),
      db.query('SELECT COUNT(*) AS total FROM kesiswaan'),
      db.query(`
        SELECT upper(trim(kecamatan)) AS kecamatan, COUNT(*) AS jumlah
        FROM kelembagaan
        WHERE nullif(trim(kecamatan), '') IS NOT NULL
        GROUP BY 1
        ORDER BY jumlah DESC, kecamatan ASC
      `),
      db.query(`
        SELECT upper(trim(jenjang)) AS jenjang, COUNT(*) AS jumlah
        FROM kelembagaan
        WHERE nullif(trim(jenjang), '') IS NOT NULL
        GROUP BY 1
      `),
      db.query(`
        SELECT ${SISWA_JENJANG_SQL} AS jenjang, COUNT(*) AS jumlah
        FROM kesiswaan
        GROUP BY 1
      `),
    ]);

  const order = ['RA', 'MI', 'MTS', 'MA'];
  const byOrder = (a, b) => order.indexOf(a.jenjang) - order.indexOf(b.jenjang);
  const totalLembaga = toInt(resLembaga.rows[0].total);
  const gtk = resGtk.rows[0];

  return {
    kecamatanList: resKec.rows,
    stats: {
      lembaga: totalLembaga,
      lembagaLengkap: toInt(resLembaga.rows[0].lengkap),
      gtk: {
        total: toInt(gtk.total),
        pns: toInt(gtk.pns),
        pppk: toInt(gtk.pppk),
        nonPns: toInt(gtk.non_pns),
        aktif: toInt(gtk.aktif),
      },
      siswa: toInt(resSiswa.rows[0].total),
    },
    sebaranKecamatan: resSebaran.rows.map((r) => ({ kecamatan: r.kecamatan, jumlah: toInt(r.jumlah) })),
    sebaranJenjang: resJenjang.rows
      .map((r) => ({ jenjang: r.jenjang, jumlah: toInt(r.jumlah) }))
      .sort(byOrder),
    siswaPerJenjang: resSiswaJenjang.rows
      .filter((r) => r.jenjang)
      .map((r) => ({ jenjang: r.jenjang, jumlah: toInt(r.jumlah) }))
      .sort(byOrder),
  };
}

async function getOptions() {
  const [ptk, kategori] = await Promise.all([
    db.query(`
      SELECT trim(status_ptk) AS value, COUNT(*) AS jumlah
      FROM gtk
      WHERE coalesce(nullif(trim(status_ptk), ''), '-') <> '-'
      GROUP BY 1
      ORDER BY jumlah DESC
    `),
    db.query(`
      SELECT DISTINCT trim(kategori_utama) AS value
      FROM berkas_sk
      WHERE nullif(trim(kategori_utama), '') IS NOT NULL
      ORDER BY 1
    `),
  ]);
  return {
    statusPtk: ptk.rows.map((r) => ({ value: r.value, jumlah: toInt(r.jumlah) })),
    kategoriSk: kategori.rows.map((r) => r.value),
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const filters = readFilters(searchParams);

  try {
    if (filters.tab === 'dashboard') {
      return NextResponse.json(await getDashboard());
    }
    if (filters.tab === 'options') {
      return NextResponse.json(await getOptions());
    }

    const query = buildQuery(filters);
    if (!query) {
      return NextResponse.json({ error: 'Tab tidak dikenali' }, { status: 400 });
    }

    const { table, where, orderBy, params } = query;
    const offset = (filters.page - 1) * filters.pageSize;
    const [countRes, dataRes] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total FROM ${table.from} ${where}`, params),
      db.query(
        `SELECT ${table.select} FROM ${table.from} ${where} ${orderBy}
         LIMIT ${filters.pageSize} OFFSET ${offset}`,
        params
      ),
    ]);

    return NextResponse.json({
      rows: dataRes.rows,
      total: toInt(countRes.rows[0].total),
      page: filters.page,
      pageSize: filters.pageSize,
      sort: filters.sort,
      dir: filters.dir,
    });
  } catch (error) {
    console.error('API simadu error:', error);
    return NextResponse.json({ error: 'Gagal memuat data dari database.' }, { status: 500 });
  }
}
