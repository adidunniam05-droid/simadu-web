import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const jenjang = searchParams.get('jenjang') || 'ALL';

  try {
    let query = `
      SELECT nsm, npsn, nama_lembaga, jenjang, kecamatan, kepala_madrasah, status_aktif 
      FROM kelembagaan
    `;
    const params = [];
    if (jenjang !== 'ALL') {
      query += ` WHERE UPPER(jenjang) = $1`;
      params.push(jenjang.toUpperCase());
    }
    query += ` ORDER BY kecamatan ASC, nama_lembaga ASC`;

    const { rows } = await db.query(query, params);
    const workbook = new ExcelJS.Workbook();

    const columns = [
      { header: 'NSM', key: 'nsm', width: 16 },
      { header: 'NPSN', key: 'npsn', width: 14 },
      { header: 'Nama Lembaga / Madrasah', key: 'nama_lembaga', width: 40 },
      { header: 'Jenjang', key: 'jenjang', width: 10 },
      { header: 'Kecamatan', key: 'kecamatan', width: 18 },
      { header: 'Kepala Madrasah', key: 'kepala_madrasah', width: 32 },
      { header: 'Status', key: 'status_aktif', width: 14 },
    ];

    const grouped = rows.reduce((acc, row) => {
      const kec = row.kecamatan || 'LAINNYA';
      if (!acc[kec]) acc[kec] = [];
      acc[kec].push(row);
      return acc;
    }, {});

    for (const [namaKec, data] of Object.entries(grouped)) {
      const sheetName = namaKec.substring(0, 31).replace(/[\\/?*[\]]/g, '');
      const sheet = workbook.addWorksheet(sheetName);
      sheet.columns = columns;
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
      sheet.addRows(data);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="SIMADU_Jember_Per_Kecamatan_${jenjang}.xlsx"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}