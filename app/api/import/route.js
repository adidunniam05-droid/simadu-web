import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { forbidden, getSessionUser, unauthorized } from '@/lib/session';
import { canImport } from '@/lib/roles';
import { IMPORT_SCHEMAS, validateRecord } from '@/lib/import-schema';
import {
  MAX_FILE_BYTES,
  UserError,
  commitPlan,
  loadKecamatanSet,
  parseFile,
  planRows,
  summarize,
} from '@/lib/import-runner';

const bad = (message, status = 400) => NextResponse.json({ error: message }, { status });

// GET /api/import?tab=gtk → unduh template Excel untuk bagian tersebut
export async function GET(request) {
  if (!(await getSessionUser())) return unauthorized();
  const tab = new URL(request.url).searchParams.get('tab');
  const schema = IMPORT_SCHEMAS[tab];
  if (!schema) return bad('Bagian tidak dikenali.');

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = schema.fields.map((f) => ({
    header: f.label,
    key: f.key,
    width: Math.max(14, f.label.length + 6),
    // Kolom angka panjang diformat Teks agar NIK/NISN tidak berubah
    style: f.text || f.date ? { numFmt: '@' } : undefined,
  }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  schema.fields.forEach((f, i) => {
    head.getCell(i + 1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: f.required ? 'FF01533B' : 'FF64748B' },
    };
  });

  const guide = wb.addWorksheet('Petunjuk');
  guide.columns = [
    { header: 'Kolom', key: 'label', width: 22 },
    { header: 'Wajib', key: 'req', width: 8 },
    { header: 'Keterangan', key: 'note', width: 70 },
  ];
  guide.getRow(1).font = { bold: true };
  for (const f of schema.fields) {
    const notes = [];
    if (schema.keys.includes(f.key)) notes.push('Kunci pencocokan: bila sudah ada di SIMADU, datanya diperbarui');
    if (f.options) notes.push(`Isi salah satu: ${f.options.join(', ')}`);
    if (f.kecamatan) notes.push('Nama kecamatan di Kabupaten Jember (lihat daftar di bawah)');
    if (f.hint) notes.push(f.hint);
    guide.addRow({ label: f.label, req: f.required ? 'Ya' : '', note: notes.join('. ') });
  }
  guide.addRow({});
  guide.addRow({ label: 'Catatan', note: 'Kolom berwarna hijau di lembar Data wajib diisi. Baris judul jangan diubah.' });
  guide.addRow({ note: 'Sel yang dikosongkan tidak menghapus data lama saat memperbarui.' });
  if (schema.fields.some((f) => f.kecamatan)) {
    guide.addRow({});
    guide.addRow({ label: 'Daftar kecamatan' }).font = { bold: true };
    for (const k of [...(await loadKecamatanSet())].sort()) guide.addRow({ label: k });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Template_Import_${schema.title.replace(/\W+/g, '_')}.xlsx"`,
    },
  });
}

// POST /api/import
//  - multipart: tab, file, commit=1 (tanpa commit = pratinjau saja)
//  - JSON: { tab, record } untuk input manual satu data
export async function POST(request) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  if (!canImport(me)) return forbidden('Peran Viewer hanya dapat melihat dan mengekspor data.');

  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const { tab, record } = await request.json();
      const schema = IMPORT_SCHEMAS[tab];
      if (!schema || !record || typeof record !== 'object') return bad('Data tidak lengkap.');
      const kecamatanSet = schema.fields.some((f) => f.kecamatan) ? await loadKecamatanSet() : null;
      const { record: clean, errors } = validateRecord(schema, record, kecamatanSet);
      if (errors.length) return NextResponse.json({ error: 'Periksa kembali isian.', errors }, { status: 422 });
      const plan = await planRows(tab, [{ rowNumber: 1, record: clean, errors: [] }]);
      const result = await commitPlan(tab, plan, schema.fields.map((f) => f.key));
      return NextResponse.json({ ok: true, ...result });
    }

    const form = await request.formData();
    const tab = String(form.get('tab') || '');
    const file = form.get('file');
    const commit = form.get('commit') === '1';
    if (!IMPORT_SCHEMAS[tab]) return bad('Bagian tidak dikenali.');
    if (!file || typeof file === 'string') return bad('Pilih file terlebih dahulu.');
    if (file.size > MAX_FILE_BYTES) return bad('Ukuran file melebihi 4 MB. Pecah menjadi beberapa file.');

    const buffer = Buffer.from(await file.arrayBuffer());
    const kecamatanSet = IMPORT_SCHEMAS[tab].fields.some((f) => f.kecamatan) ? await loadKecamatanSet() : null;
    const parsed = await parseFile(tab, buffer, file.name || '', kecamatanSet);
    const plan = await planRows(
      tab,
      parsed.rows.filter((r) => !r.errors.length)
    );
    const summary = summarize(parsed, plan);

    if (!commit) return NextResponse.json({ ok: true, summary });
    if (summary.validRows === 0) return bad('Tidak ada baris yang valid untuk disimpan.');

    const result = await commitPlan(tab, plan, parsed.columns);
    return NextResponse.json({ ok: true, summary, ...result, skipped: summary.invalidRows });
  } catch (error) {
    if (error instanceof UserError) return bad(error.message);
    console.error('API import error:', error);
    return bad('Gagal memproses import. Periksa format file lalu coba lagi.', 500);
  }
}
