import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import { readFilters, buildQuery } from '@/lib/simadu-query';

// Batas baris per file agar fungsi server tidak kehabisan memori/waktu.
const EXPORT_MAX_ROWS = 50000;

const COLUMNS = {
  kelembagaan: [
    { header: 'NSM', key: 'nsm', width: 16 },
    { header: 'NPSN', key: 'npsn', width: 14 },
    { header: 'Nama Lembaga / Madrasah', key: 'nama_lembaga', width: 40 },
    { header: 'Jenjang', key: 'jenjang', width: 10 },
    { header: 'Kecamatan', key: 'kecamatan', width: 18 },
    { header: 'Kepala Madrasah', key: 'kepala_madrasah', width: 32 },
    { header: 'Status', key: 'status_aktif', width: 14 },
  ],
  gtk: [
    { header: 'Nama Lengkap', key: 'nama_lengkap', width: 34 },
    { header: 'NIP / NIK', key: 'nip_nik', width: 22 },
    { header: 'Status Kepegawaian', key: 'status_kepegawaian', width: 18 },
    { header: 'Status PTK', key: 'status_ptk', width: 22 },
    { header: 'Jabatan', key: 'jabatan', width: 14 },
    { header: 'Satuan Pendidikan', key: 'nama_madrasah', width: 40 },
    { header: 'Tanggal Lahir', key: 'tanggal_lahir', width: 14 },
  ],
  kesiswaan: [
    { header: 'NISN', key: 'nisn', width: 14 },
    { header: 'NIK', key: 'nik', width: 20 },
    { header: 'Nama Siswa', key: 'nama_lengkap', width: 34 },
    { header: 'Jenjang', key: 'jenjang', width: 10 },
    { header: 'Rombel', key: 'tingkat_rombel', width: 22 },
    { header: 'Madrasah', key: 'nama_sekolah', width: 40 },
    { header: 'Nama Wali', key: 'nama_wali', width: 30 },
    { header: 'Alamat', key: 'alamat', width: 40 },
    { header: 'Capaian Tahfidz', key: 'capaian_tahfidz', width: 16 },
  ],
  berkas_sk: [
    { header: 'Judul Dokumen', key: 'judul_dokumen', width: 40 },
    { header: 'Nomor SK', key: 'nomor_sk', width: 28 },
    { header: 'Kategori', key: 'kategori_utama', width: 20 },
    { header: 'Sub Kategori', key: 'sub_kategori', width: 20 },
    { header: 'Tanggal Terbit', key: 'tanggal_terbit', width: 16 },
    { header: 'Format', key: 'format_file', width: 10 },
    { header: 'Link Google Drive', key: 'link_google_drive', width: 50 },
  ],
};

const TITLES = {
  kelembagaan: 'Kelembagaan',
  gtk: 'GTK',
  kesiswaan: 'Kesiswaan',
  berkas_sk: 'Berkas_SK',
};

function addSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name.substring(0, 31).replace(/[\\/?*[\]:]/g, '') || 'Data', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  sheet.addRows(rows);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  // Tanpa tab (tautan lama) → ekspor kelembagaan seperti sebelumnya.
  if (!searchParams.get('tab') || searchParams.get('tab') === 'dashboard') {
    searchParams.set('tab', 'kelembagaan');
  }
  const filters = readFilters(searchParams);
  const query = buildQuery(filters);
  if (!query) {
    return NextResponse.json({ error: 'Tab tidak dikenali' }, { status: 400 });
  }

  try {
    const { table, where, orderBy, params } = query;
    const countRes = await db.query(`SELECT COUNT(*) AS total FROM ${table.from} ${where}`, params);
    const total = parseInt(countRes.rows[0].total, 10) || 0;
    if (total > EXPORT_MAX_ROWS) {
      return NextResponse.json(
        {
          error: `Data terlalu besar untuk diekspor (${total.toLocaleString('id-ID')} baris, batas ${EXPORT_MAX_ROWS.toLocaleString('id-ID')}). Persempit dengan filter atau pencarian.`,
        },
        { status: 413 }
      );
    }

    const { rows } = await db.query(
      `SELECT ${table.select} FROM ${table.from} ${where} ${orderBy}`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    const columns = COLUMNS[filters.tab];

    if (filters.tab === 'kelembagaan') {
      // Satu sheet per kecamatan, seperti format laporan sebelumnya.
      const grouped = new Map();
      for (const row of rows) {
        const kec = (row.kecamatan || '').trim().toUpperCase() || 'LAINNYA';
        if (!grouped.has(kec)) grouped.set(kec, []);
        grouped.get(kec).push(row);
      }
      const names = [...grouped.keys()].sort((a, b) => a.localeCompare(b, 'id'));
      for (const kec of names) addSheet(workbook, kec, columns, grouped.get(kec));
    }
    if (filters.tab !== 'kelembagaan' || rows.length === 0) {
      addSheet(workbook, TITLES[filters.tab], columns, rows);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const parts = [TITLES[filters.tab]];
    if (filters.jenjang !== 'ALL') parts.push(filters.jenjang);
    if (filters.kecamatan !== 'ALL' && filters.tab === 'kelembagaan') parts.push(filters.kecamatan);
    const filename = `SIMADU_Jember_${parts.join('_')}.xlsx`.replace(/[^\w.-]+/g, '_');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('API export error:', error);
    return NextResponse.json({ error: 'Gagal membuat file Excel.' }, { status: 500 });
  }
}
