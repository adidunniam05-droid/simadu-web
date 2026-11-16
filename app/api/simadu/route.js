import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') || 'dashboard';
  const search = searchParams.get('search') || '';
  const kecamatan = searchParams.get('kecamatan') || 'ALL';
  const jenjang = searchParams.get('jenjang') || 'ALL';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 25;
  const offset = (page - 1) * limit;

  try {
    if (tab === 'dashboard') {
      const [resKec, resLembaga, resGtk, resSiswa, resSebaran, resJenjang] = await Promise.all([
        db.query('SELECT kode_kecamatan, nama_kecamatan FROM ref_kecamatan ORDER BY nama_kecamatan ASC'),
        db.query('SELECT COUNT(*) as total FROM kelembagaan'),
        db.query(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE UPPER(status_kepegawaian) = 'PNS') as pns,
            COUNT(*) FILTER (WHERE UPPER(status_kepegawaian) = 'PPPK') as pppk,
            COUNT(*) FILTER (WHERE UPPER(status_kepegawaian) NOT IN ('PNS', 'PPPK')) as non_pns
          FROM gtk
        `),
        db.query('SELECT COUNT(*) as total FROM kesiswaan'),
        db.query(`
          SELECT kecamatan, COUNT(*) as jumlah 
          FROM kelembagaan 
          WHERE kecamatan IS NOT NULL AND kecamatan != ''
          GROUP BY kecamatan 
          ORDER BY jumlah DESC
        `),
        db.query(`
          SELECT jenjang, COUNT(*) as jumlah 
          FROM kelembagaan 
          WHERE jenjang IS NOT NULL AND jenjang != ''
          GROUP BY jenjang 
          ORDER BY jumlah DESC
        `),
      ]);

      return NextResponse.json({
        kecamatanList: resKec.rows,
        stats: {
          lembaga: parseInt(resLembaga.rows[0].total, 10),
          gtk: {
            total: parseInt(resGtk.rows[0].total, 10),
            pns: parseInt(resGtk.rows[0].pns, 10),
            pppk: parseInt(resGtk.rows[0].pppk, 10),
            nonPns: parseInt(resGtk.rows[0].non_pns, 10),
          },
          siswa: parseInt(resSiswa.rows[0].total, 10),
        },
        sebaranKecamatan: resSebaran.rows,
        sebaranJenjang: resJenjang.rows,
      });
    }

    if (tab === 'kelembagaan') {
      const conditions = [];
      const params = [];
      if (kecamatan !== 'ALL') {
        params.push(kecamatan.toUpperCase());
        conditions.push(`UPPER(kecamatan) = $${params.length}`);
      }
      if (jenjang !== 'ALL') {
        params.push(jenjang.toUpperCase());
        conditions.push(`UPPER(jenjang) = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(nama_lembaga ILIKE $${params.length} OR nsm ILIKE $${params.length} OR npsn ILIKE $${params.length} OR kepala_madrasah ILIKE $${params.length})`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRes = await db.query(`SELECT COUNT(*) as total FROM kelembagaan ${where}`, params);

      params.push(limit, offset);
      const dataRes = await db.query(
        `SELECT * FROM kelembagaan ${where} ORDER BY kecamatan ASC, nama_lembaga ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return NextResponse.json({ rows: dataRes.rows, total: parseInt(countRes.rows[0].total, 10) });
    }

    if (tab === 'gtk') {
      const conditions = [];
      const params = [];
      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(nama_lengkap ILIKE $${params.length} OR nip_nik ILIKE $${params.length} OR nama_madrasah ILIKE $${params.length})`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRes = await db.query(`SELECT COUNT(*) as total FROM gtk ${where}`, params);

      params.push(limit, offset);
      const dataRes = await db.query(
        `SELECT * FROM gtk ${where} ORDER BY nama_lengkap ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return NextResponse.json({ rows: dataRes.rows, total: parseInt(countRes.rows[0].total, 10) });
    }

    if (tab === 'kesiswaan') {
      const conditions = [];
      const params = [];
      if (jenjang !== 'ALL') {
        params.push(jenjang.toUpperCase());
        conditions.push(`UPPER(jenjang) = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(nama_lengkap ILIKE $${params.length} OR nisn ILIKE $${params.length} OR nik ILIKE $${params.length} OR nama_sekolah ILIKE $${params.length})`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRes = await db.query(`SELECT COUNT(*) as total FROM kesiswaan ${where}`, params);

      params.push(limit, offset);
      const dataRes = await db.query(
        `SELECT * FROM kesiswaan ${where} ORDER BY id ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );
      return NextResponse.json({ rows: dataRes.rows, total: parseInt(countRes.rows[0].total, 10) });
    }

    if (tab === 'berkas_sk') {
      const dataRes = await db.query('SELECT * FROM berkas_sk ORDER BY id DESC LIMIT 100');
      return NextResponse.json({ rows: dataRes.rows, total: dataRes.rows.length });
    }

    return NextResponse.json({ error: 'Tab tidak dikenali' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}