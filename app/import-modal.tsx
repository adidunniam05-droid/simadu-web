'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  PencilLine,
  Upload,
  X,
} from 'lucide-react';
import { IMPORT_SCHEMAS } from '@/lib/import-schema';

type ImportTab = 'kelembagaan' | 'kesiswaan' | 'gtk' | 'berkas_sk';

interface Field {
  key: string;
  label: string;
  required?: boolean;
  options?: string[];
  kecamatan?: boolean;
  date?: boolean;
  hint?: string;
}

interface Summary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  toInsert: number;
  toUpdate: number;
  duplicatesInFile: number;
  columns: string[];
  unknownColumns: string[];
  errors: { row: number; messages: string[] }[];
  sample: { row: number; record: Record<string, string | null>; ok: boolean }[];
}

const fmt = (n: number) => n.toLocaleString('id-ID');
const MAX_BYTES = 4 * 1024 * 1024;

export default function ImportModal({
  tab,
  kecamatanList,
  onClose,
  onImported,
  onSessionExpired,
}: {
  tab: ImportTab;
  kecamatanList: { nama_kecamatan: string }[];
  onClose: () => void;
  onImported: () => void;
  onSessionExpired: () => void;
}) {
  const schema = IMPORT_SCHEMAS[tab] as { title: string; keys: string[]; fields: Field[] };
  const [mode, setMode] = useState<'file' | 'manual'>('file');

  // --- Upload file ---
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState<'' | 'template' | 'preview' | 'commit' | 'manual'>('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ inserted: number; updated: number; skipped?: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Input manual ---
  const emptyForm = () => Object.fromEntries(schema.fields.map((f) => [f.key, '']));
  const [form, setForm] = useState<Record<string, string>>(emptyForm);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Tutup dengan Esc (kecuali sedang menyimpan)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && busy !== 'commit' && busy !== 'manual') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const handle401 = (res: Response) => {
    if (res.status === 401) {
      onSessionExpired();
      return true;
    }
    return false;
  };

  const pickFile = (f: File | null | undefined) => {
    setSummary(null);
    setDone(null);
    setError('');
    if (!f) return setFile(null);
    if (!/\.(xlsx|csv)$/i.test(f.name)) {
      setFile(null);
      return setError('Gunakan file .xlsx atau .csv. File .xls lama: buka di Excel lalu simpan ulang sebagai .xlsx.');
    }
    if (f.size > MAX_BYTES) {
      setFile(null);
      return setError('Ukuran file melebihi 4 MB. Pecah menjadi beberapa file.');
    }
    setFile(f);
  };

  const downloadTemplate = async () => {
    setBusy('template');
    setError('');
    try {
      const res = await fetch(`/api/import?tab=${tab}`);
      if (handle401(res)) return;
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Gagal mengunduh template.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Template_Import_${schema.title.replace(/\W+/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const sendFile = async (commit: boolean) => {
    if (!file) return;
    setBusy(commit ? 'commit' : 'preview');
    setError('');
    try {
      const body = new FormData();
      body.set('tab', tab);
      body.set('file', file);
      if (commit) body.set('commit', '1');
      const res = await fetch('/api/import', { method: 'POST', body });
      if (handle401(res)) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal memproses file.');
      setSummary(data.summary);
      if (commit) {
        setDone({ inserted: data.inserted, updated: data.updated, skipped: data.skipped });
        onImported();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('manual');
    setFormErrors([]);
    setError('');
    setDone(null);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab, record: form }),
      });
      if (handle401(res)) return;
      const data = await res.json().catch(() => ({}));
      if (res.status === 422) return setFormErrors(data.errors || [data.error]);
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data.');
      setDone({ inserted: data.inserted, updated: data.updated });
      setForm(emptyForm());
      onImported();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy('');
    }
  };

  const keyLabels = schema.keys
    .map((k) => schema.fields.find((f) => f.key === k)?.label)
    .filter(Boolean)
    .join(' / ');
  const sampleCols = summary ? schema.fields.filter((f) => summary.columns.includes(f.key)).slice(0, 5) : [];
  const inputClass =
    'w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#01533B] focus:ring-2 focus:ring-[#01533B]/15 outline-none';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Kepala */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#01533B]">Import data</p>
            <h3 id="import-title" className="text-lg font-bold text-slate-900">
              {schema.title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Data dengan {keyLabels} yang sudah ada akan <strong>diperbarui</strong>; selebihnya <strong>ditambahkan</strong>.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy === 'commit' || busy === 'manual'}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pilihan mode */}
        <div className="px-6 pt-4">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-semibold">
            {(
              [
                ['file', 'Upload File', Upload],
                ['manual', 'Input Manual', PencilLine],
              ] as const
            ).map(([m, label, Icon]) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError('');
                  setDone(null);
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md transition cursor-pointer ${
                  mode === m ? 'bg-white text-[#01533B] shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto space-y-4">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-sm text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {done && (
            <div role="status" className="flex items-start gap-2 rounded-lg bg-[#E8F2EE] border border-[#01533B]/20 px-3.5 py-3 text-sm text-[#03422C]">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Berhasil disimpan: <strong>{fmt(done.inserted)}</strong> data ditambahkan,{' '}
                <strong>{fmt(done.updated)}</strong> diperbarui
                {done.skipped ? (
                  <>
                    , <strong>{fmt(done.skipped)}</strong> baris bermasalah dilewati
                  </>
                ) : null}
                .
              </span>
            </div>
          )}

          {mode === 'file' ? (
            <>
              {/* Langkah 1: template */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                <div className="text-sm">
                  <p className="font-semibold text-slate-900">1. Siapkan file Excel</p>
                  <p className="text-xs text-slate-500">
                    Pakai template, atau file hasil <em>Export Excel</em> SIMADU. Kolom wajib:{' '}
                    {schema.fields
                      .filter((f) => f.required)
                      .map((f) => f.label)
                      .join(', ')}
                    .
                  </p>
                </div>
                <button
                  onClick={downloadTemplate}
                  disabled={busy !== ''}
                  className="shrink-0 inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border border-[#01533B]/30 text-sm font-semibold text-[#01533B] hover:bg-[#E8F2EE] disabled:opacity-50 cursor-pointer"
                >
                  {busy === 'template' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Unduh template
                </button>
              </div>

              {/* Langkah 2: pilih file */}
              {!done && (
                <div>
                  <p className="text-sm font-semibold text-slate-900 mb-2">2. Pilih file (.xlsx / .csv, maks. 4 MB)</p>
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      pickFile(e.dataTransfer.files?.[0]);
                    }}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition ${
                      dragOver ? 'border-[#01533B] bg-[#E8F2EE]' : 'border-slate-300 hover:border-[#01533B]/50 hover:bg-slate-50'
                    }`}
                  >
                    <FileSpreadsheet className="w-7 h-7 text-[#01533B]" />
                    {file ? (
                      <>
                        <span className="text-sm font-semibold text-slate-900">{file.name}</span>
                        <span className="text-xs text-slate-500">
                          {(file.size / 1024).toLocaleString('id-ID', { maximumFractionDigits: 0 })} KB • klik untuk ganti file
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-slate-900">Klik untuk memilih file</span>
                        <span className="text-xs text-slate-500">atau seret file ke sini</span>
                      </>
                    )}
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".xlsx,.csv"
                      className="sr-only"
                      onChange={(e) => {
                        pickFile(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              )}

              {/* Langkah 3: pratinjau */}
              {summary && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900">3. Hasil pemeriksaan</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      ['Baris di file', summary.totalRows, 'text-slate-900'],
                      ['Akan ditambah', summary.toInsert, 'text-[#01533B]'],
                      ['Akan diperbarui', summary.toUpdate, 'text-sky-700'],
                      ['Bermasalah', summary.invalidRows, summary.invalidRows ? 'text-rose-600' : 'text-slate-400'],
                    ].map(([label, value, color]) => (
                      <div key={label as string} className="rounded-lg border border-slate-200 px-3 py-2">
                        <div className="text-[11px] font-medium text-slate-500">{label}</div>
                        <div className={`text-lg font-bold ${color}`}>{fmt(value as number)}</div>
                      </div>
                    ))}
                  </div>

                  {(summary.duplicatesInFile > 0 || summary.unknownColumns.length > 0) && (
                    <ul className="text-xs text-slate-600 space-y-1 list-disc pl-5">
                      {summary.duplicatesInFile > 0 && (
                        <li>
                          {fmt(summary.duplicatesInFile)} baris memakai {keyLabels} yang sama di dalam file; yang dipakai baris paling bawah.
                        </li>
                      )}
                      {summary.unknownColumns.length > 0 && (
                        <li>Kolom tidak dikenal dan diabaikan: {summary.unknownColumns.join(', ')}.</li>
                      )}
                    </ul>
                  )}

                  {summary.errors.length > 0 && (
                    <div className="rounded-lg border border-rose-200 overflow-hidden">
                      <div className="bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                        Baris bermasalah (akan dilewati){summary.invalidRows > summary.errors.length && ` • ${fmt(summary.errors.length)} pertama dari ${fmt(summary.invalidRows)}`}
                      </div>
                      <ul className="max-h-40 overflow-y-auto divide-y divide-rose-100 text-xs">
                        {summary.errors.map((e) => (
                          <li key={e.row} className="px-3 py-1.5 flex gap-3">
                            <span className="shrink-0 w-16 font-semibold text-slate-700">Baris {e.row}</span>
                            <span className="text-slate-600">{e.messages.join(' • ')}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.sample.length > 0 && (
                    <div className="rounded-lg border border-slate-200 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Baris</th>
                            {sampleCols.map((f) => (
                              <th key={f.key} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                                {f.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {summary.sample.map((s) => (
                            <tr key={s.row} className={s.ok ? '' : 'bg-rose-50/60'}>
                              <td className="px-3 py-1.5 text-slate-400">{s.row}</td>
                              {sampleCols.map((f) => (
                                <td key={f.key} className="px-3 py-1.5 text-slate-700 whitespace-nowrap max-w-[14rem] truncate">
                                  {s.record[f.key] ?? '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="px-3 py-1.5 text-[11px] text-slate-400 border-t border-slate-100">
                        Contoh {summary.sample.length} baris pertama
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Input manual satu data */
            <form id="manual-form" onSubmit={submitManual} className="space-y-4">
              {formErrors.length > 0 && (
                <ul role="alert" className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-700 list-disc pl-8">
                  {formErrors.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {schema.fields.map((f) => (
                  <div key={f.key} className={f.key === 'alamat' || f.key === 'link_google_drive' ? 'sm:col-span-2' : ''}>
                    <label htmlFor={`f-${f.key}`} className="block text-xs font-semibold text-slate-700 mb-1">
                      {f.label}
                      {f.required && <span className="text-rose-600"> *</span>}
                    </label>
                    {f.options ? (
                      <select
                        id={`f-${f.key}`}
                        value={form[f.key]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        required={f.required}
                        className={inputClass}
                      >
                        <option value="">{f.required ? 'Pilih...' : '(kosong)'}</option>
                        {f.options.map((o) => (
                          <option key={o} value={o}>
                            {o === 'MTS' ? 'MTs' : o}
                          </option>
                        ))}
                      </select>
                    ) : f.kecamatan ? (
                      <select
                        id={`f-${f.key}`}
                        value={form[f.key]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        required={f.required}
                        className={inputClass}
                      >
                        <option value="">Pilih kecamatan...</option>
                        {kecamatanList.map((k) => (
                          <option key={k.nama_kecamatan} value={k.nama_kecamatan.toUpperCase()}>
                            {k.nama_kecamatan}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`f-${f.key}`}
                        value={form[f.key]}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        required={f.required}
                        inputMode={/nik|nisn|nsm|npsn|nip/.test(f.key) ? 'numeric' : undefined}
                        placeholder={f.date ? 'DD-MM-YYYY' : ''}
                        className={inputClass}
                      />
                    )}
                    {f.hint && !f.date && <p className="mt-1 text-[11px] text-slate-400">{f.hint}</p>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Bila {keyLabels} sudah ada, data itu diperbarui (isian yang dikosongkan tidak menghapus data lama).
              </p>
            </form>
          )}
        </div>

        {/* Tombol aksi */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50/60 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={busy === 'commit' || busy === 'manual'}
            className="h-10 px-4 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
          >
            {done ? 'Selesai' : 'Batal'}
          </button>
          {mode === 'file' && !done && (
            summary ? (
              <button
                onClick={() => sendFile(true)}
                disabled={busy !== '' || summary.toInsert + summary.toUpdate === 0}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#01533B] hover:bg-[#03422C] disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
              >
                {busy === 'commit' && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy === 'commit' ? 'Menyimpan...' : `Simpan ${fmt(summary.toInsert + summary.toUpdate)} data`}
              </button>
            ) : (
              <button
                onClick={() => sendFile(false)}
                disabled={!file || busy !== ''}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#01533B] hover:bg-[#03422C] disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
              >
                {busy === 'preview' && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy === 'preview' ? 'Memeriksa...' : 'Periksa file'}
              </button>
            )
          )}
          {mode === 'manual' && (
            <button
              type="submit"
              form="manual-form"
              disabled={busy !== ''}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#01533B] hover:bg-[#03422C] disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
            >
              {busy === 'manual' && <Loader2 className="w-4 h-4 animate-spin" />}
              {busy === 'manual' ? 'Menyimpan...' : 'Simpan data'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
