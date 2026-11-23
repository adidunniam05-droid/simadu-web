// Mesin import (khusus server): baca file Excel/CSV, cocokkan kolom,
// periksa isi, lalu simpan dengan aturan "perbarui bila kunci sudah ada,
// tambah bila belum". Semua nilai dikirim sebagai parameter (aman dari
// SQL injection); nama tabel & kolom hanya berasal dari skema.
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import { IMPORT_SCHEMAS, headerMap, normalizeHeader, validateRecord } from '@/lib/import-schema';

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // batas body fungsi Vercel ±4,5 MB
export const MAX_ROWS = 20000;
const CHUNK = 500;
const MAX_ERRORS_SHOWN = 100;

const pad = (n) => String(n).padStart(2, '0');

/** Nilai sel ExcelJS → { text, unsafeNumber } */
function cellText(v, preferLink = false) {
  if (v === null || v === undefined) return { text: '' };
  if (v instanceof Date) {
    // ExcelJS memberi tanggal dalam UTC
    return { text: `${pad(v.getUTCDate())}-${pad(v.getUTCMonth() + 1)}-${v.getUTCFullYear()}` };
  }
  if (typeof v === 'number') {
    // Angka > 15 digit (NIK/NISN) sudah kehilangan digit terakhir di Excel
    const unsafeNumber = Number.isInteger(v) && Math.abs(v) >= 1e15;
    const text = Number.isInteger(v) ? v.toLocaleString('fullwide', { useGrouping: false }) : String(v);
    return { text, unsafeNumber };
  }
  if (typeof v === 'object') {
    if ('result' in v) return cellText(v.result, preferLink); // rumus
    if (Array.isArray(v.richText)) return { text: v.richText.map((t) => t.text).join('') };
    if (v.hyperlink) {
      const t = typeof v.text === 'string' ? v.text : cellText(v.text).text;
      return { text: preferLink || !t ? v.hyperlink : t };
    }
    if ('text' in v) return cellText(v.text, preferLink);
    return { text: '' };
  }
  return { text: String(v) };
}

/** Pembaca CSV sederhana (mendukung tanda kutip & baris baru di dalam kutip). */
function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Bungkus baris CSV agar bisa dibaca seperti lembar kerja ExcelJS (indeks mulai 1). */
function csvWorksheet(rows) {
  return {
    rowCount: rows.length,
    actualRowCount: rows.filter((r) => r.some((c) => c.trim())).length,
    getRow: (r) => ({ values: [undefined, ...(rows[r - 1] ?? [])] }),
  };
}

/** Baca file (xlsx/csv) menjadi lembar kerja. */
async function loadWorksheet(buffer, filename) {
  const name = filename.toLowerCase();
  if (name.endsWith('.csv')) {
    const text = buffer.toString('utf8').replace(/^﻿/, '');
    // Excel berbahasa Indonesia sering menyimpan CSV dengan pemisah titik koma
    const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
    const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
    return csvWorksheet(parseCsv(text, delimiter));
  }
  const wb = new ExcelJS.Workbook();
  if (name.endsWith('.xlsx')) {
    await wb.xlsx.load(buffer);
    // Lembar pertama yang berisi data (lewati lembar "Petunjuk")
    return wb.worksheets.find((s) => !/^petunjuk/i.test(s.name) && s.actualRowCount > 0) ?? wb.worksheets[0];
  }
  throw new UserError('Format file tidak didukung. Gunakan .xlsx atau .csv (file .xls lama: simpan ulang sebagai .xlsx).');
}

export class UserError extends Error {}

/**
 * Ubah file menjadi baris-baris terperiksa.
 * Hasil: { rows: [{ rowNumber, record, errors }], columns, unknownColumns, missingRequired }
 */
export async function parseFile(tab, buffer, filename, kecamatanSet) {
  const schema = IMPORT_SCHEMAS[tab];
  const ws = await loadWorksheet(buffer, filename);
  if (!ws || ws.actualRowCount === 0) throw new UserError('File kosong.');

  // Cari baris judul kolom di 10 baris pertama (boleh ada baris judul laporan di atasnya)
  const map = headerMap(schema);
  let headerRow = 0;
  let best = 0;
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const vals = ws.getRow(r).values;
    let hits = 0;
    for (let c = 1; c < vals.length; c++) if (map.has(normalizeHeader(cellText(vals[c]).text))) hits++;
    if (hits > best) {
      best = hits;
      headerRow = r;
    }
  }
  if (best === 0) {
    throw new UserError(
      `Judul kolom tidak dikenali. Gunakan template ${schema.title} (kolom: ${schema.fields.map((f) => f.label).join(', ')}).`
    );
  }

  const columns = new Map(); // nomor kolom → key
  const unknownColumns = [];
  const ignored = new Set((schema.ignored ?? []).map(normalizeHeader));
  const headerVals = ws.getRow(headerRow).values;
  for (let c = 1; c < headerVals.length; c++) {
    const label = cellText(headerVals[c]).text.trim();
    if (!label) continue;
    const key = map.get(normalizeHeader(label));
    if (key && ![...columns.values()].includes(key)) columns.set(c, key);
    else if (!key && !ignored.has(normalizeHeader(label))) unknownColumns.push(label);
  }
  const present = new Set(columns.values());
  const missingRequired = schema.fields.filter((f) => f.required && !present.has(f.key)).map((f) => f.label);
  if (missingRequired.length) {
    throw new UserError(`Kolom wajib tidak ditemukan: ${missingRequired.join(', ')}.`);
  }

  const fieldByKey = Object.fromEntries(schema.fields.map((f) => [f.key, f]));
  const rows = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const vals = ws.getRow(r).values;
    const raw = {};
    const cellErrors = [];
    let empty = true;
    for (const [c, key] of columns) {
      const { text, unsafeNumber } = cellText(vals[c], fieldByKey[key].url);
      if (text.trim()) empty = false;
      raw[key] = text;
      if (unsafeNumber && fieldByKey[key].text) {
        cellErrors.push(
          `${fieldByKey[key].label} tersimpan sebagai angka di Excel sehingga digit terakhir bisa berubah; ubah format kolom menjadi Teks lalu ketik ulang`
        );
      }
    }
    if (empty) continue;
    if (rows.length >= MAX_ROWS) {
      throw new UserError(`File berisi lebih dari ${MAX_ROWS.toLocaleString('id-ID')} baris data. Pecah menjadi beberapa file.`);
    }
    const { record, errors } = validateRecord(schema, raw, kecamatanSet);
    rows.push({ rowNumber: r, record, errors: [...cellErrors, ...errors] });
  }
  if (rows.length === 0) throw new UserError('Tidak ada baris data di bawah judul kolom.');

  return {
    rows,
    columns: schema.fields.filter((f) => present.has(f.key)).map((f) => f.key),
    unknownColumns,
  };
}

/** Daftar kecamatan sah (huruf besar), untuk memeriksa kolom kecamatan. */
export async function loadKecamatanSet() {
  const { rows } = await db.query(
    `SELECT DISTINCT upper(trim(nama_kecamatan)) AS k FROM ref_kecamatan WHERE nullif(trim(nama_kecamatan), '') IS NOT NULL`
  );
  return new Set(rows.map((r) => r.k));
}

/** Kunci pertama yang terisi pada sebuah record → [kolom, nilai] atau null. */
const keyOf = (schema, record) => {
  for (const k of schema.keys) if (record[k]) return [k, record[k]];
  return null;
};

/**
 * Kelompokkan baris valid menurut kunci, buang duplikat di dalam file
 * (baris terakhir yang dipakai), dan tandai mana yang sudah ada di database.
 */
export async function planRows(tab, validRows) {
  const schema = IMPORT_SCHEMAS[tab];
  const byKey = new Map(); // "kolom\u0000nilai" → row
  const noKey = [];
  let duplicatesInFile = 0;
  for (const row of validRows) {
    const k = keyOf(schema, row.record);
    if (!k) {
      noKey.push(row);
      continue;
    }
    const id = `${k[0]}\u0000${k[1]}`;
    if (byKey.has(id)) duplicatesInFile++;
    byKey.set(id, { ...row, keyCol: k[0], keyVal: k[1] });
  }

  // Cek kunci mana yang sudah ada di database
  const existing = new Set();
  for (const col of schema.keys) {
    const vals = [...byKey.values()].filter((r) => r.keyCol === col).map((r) => r.keyVal);
    for (let i = 0; i < vals.length; i += 5000) {
      const { rows } = await db.query(
        `SELECT DISTINCT trim(${col}) AS v FROM ${schema.table} WHERE trim(${col}) = ANY($1::text[])`,
        [vals.slice(i, i + 5000)]
      );
      for (const r of rows) existing.add(`${col}\u0000${r.v}`);
    }
  }

  const keyed = [...byKey.entries()].map(([id, r]) => ({ ...r, exists: existing.has(id) }));
  return { keyed, noKey, duplicatesInFile };
}

/** Simpan hasil rencana ke database dalam satu transaksi. */
export async function commitPlan(tab, plan, columns) {
  const schema = IMPORT_SCHEMAS[tab];
  const cols = schema.fields.map((f) => f.key).filter((k) => columns.includes(k));
  const colDefs = cols.map((c) => `${c} text`).join(', ');
  const pick = (rec) => Object.fromEntries(cols.map((c) => [c, rec[c] ?? null]));

  return db.transaction(async (client) => {
    let inserted = 0;
    let updated = 0;

    for (const keyCol of schema.keys) {
      const group = plan.keyed.filter((r) => r.keyCol === keyCol);
      const setCols = cols.filter((c) => c !== keyCol);
      for (let i = 0; i < group.length; i += CHUNK) {
        const data = JSON.stringify(group.slice(i, i + CHUNK).map((r) => pick(r.record)));
        // Kolom kosong di file tidak menghapus isi yang sudah ada (COALESCE)
        const sql = `
          WITH data AS (SELECT * FROM json_to_recordset($1::json) AS d(${colDefs})),
          upd AS (
            ${
              setCols.length
                ? `UPDATE ${schema.table} t SET ${setCols.map((c) => `${c} = COALESCE(d.${c}, t.${c})`).join(', ')}
                   FROM data d WHERE trim(t.${keyCol}) = d.${keyCol}
                   RETURNING trim(t.${keyCol}) AS k`
                : `SELECT DISTINCT trim(t.${keyCol}) AS k FROM ${schema.table} t JOIN data d ON trim(t.${keyCol}) = d.${keyCol}`
            }
          ),
          ins AS (
            INSERT INTO ${schema.table} (${cols.join(', ')})
            SELECT ${cols.map((c) => `d.${c}`).join(', ')} FROM data d
            WHERE d.${keyCol} NOT IN (SELECT k FROM upd)
            RETURNING 1
          )
          SELECT (SELECT count(DISTINCT k) FROM upd) AS updated, (SELECT count(*) FROM ins) AS inserted`;
        const { rows } = await client.query(sql, [data]);
        updated += Number(rows[0].updated);
        inserted += Number(rows[0].inserted);
      }
    }

    // Baris tanpa kunci sama sekali → selalu ditambahkan sebagai data baru
    for (let i = 0; i < plan.noKey.length; i += CHUNK) {
      const data = JSON.stringify(plan.noKey.slice(i, i + CHUNK).map((r) => pick(r.record)));
      const { rowCount } = await client.query(
        `INSERT INTO ${schema.table} (${cols.join(', ')})
         SELECT ${cols.map((c) => `d.${c}`).join(', ')} FROM json_to_recordset($1::json) AS d(${colDefs})`,
        [data]
      );
      inserted += rowCount;
    }

    return { inserted, updated };
  });
}

/** Ringkasan untuk ditampilkan di pratinjau. */
export function summarize(parsed, plan) {
  const invalid = parsed.rows.filter((r) => r.errors.length);
  return {
    totalRows: parsed.rows.length,
    validRows: parsed.rows.length - invalid.length,
    invalidRows: invalid.length,
    toInsert: plan.keyed.filter((r) => !r.exists).length + plan.noKey.length,
    toUpdate: plan.keyed.filter((r) => r.exists).length,
    duplicatesInFile: plan.duplicatesInFile,
    columns: parsed.columns,
    unknownColumns: parsed.unknownColumns,
    errors: invalid
      .slice(0, MAX_ERRORS_SHOWN)
      .map((r) => ({ row: r.rowNumber, messages: r.errors })),
    sample: parsed.rows.slice(0, 10).map((r) => ({ row: r.rowNumber, record: r.record, ok: !r.errors.length })),
  };
}
