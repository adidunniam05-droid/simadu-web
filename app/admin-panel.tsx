'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { ROLES as ROLE_LIST, ROLE_INFO } from '@/lib/roles';

interface Account {
  id: number;
  username: string;
  nama_lengkap: string;
  role: string;
  password_terenkripsi: boolean;
}

interface Me {
  id: number | string;
  username: string;
  role: string;
}

const ROLES: string[] = ROLE_LIST;
const ROLE_NOTES: Record<string, string> = ROLE_INFO;
const ROLE_BADGE: Record<string, string> = {
  Superadmin: 'bg-[#E8F2EE] text-[#01533B] ring-[#01533B]/15',
  Admin: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  Viewer: 'bg-slate-50 text-slate-600 ring-slate-500/20',
};

/** Password acak mudah dibaca (tanpa karakter mirip seperti 0/O, 1/l). */
export function generatePassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

const inputClass =
  'w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#01533B] focus:ring-2 focus:ring-[#01533B]/15 outline-none';

export function PasswordField({
  id,
  value,
  onChange,
  withGenerate = false,
  autoComplete = 'new-password',
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  withGenerate?: boolean;
  autoComplete?: string;
}) {
  // Password buatan admin (ada tombol Acak) langsung terlihat agar bisa dicatat
  const [show, setShow] = useState(withGenerate);
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`${inputClass} pr-10 font-mono`}
          required
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-700"
          aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {withGenerate && (
        <button
          type="button"
          onClick={() => {
            onChange(generatePassword());
            setShow(true);
          }}
          className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          title="Buat password acak"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Acak
        </button>
      )}
    </div>
  );
}

export function Dialog({
  title,
  subtitle,
  onClose,
  children,
  footer,
  busy,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  busy?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto space-y-4">{children}</div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50/60 rounded-b-2xl">
          {footer}
        </div>
      </div>
    </div>
  );
}

const ErrorBox = ({ messages }: { messages: string[] }) =>
  messages.length ? (
    <div role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-sm text-rose-700">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <div>
        {messages.map((m) => (
          <div key={m}>{m}</div>
        ))}
      </div>
    </div>
  ) : null;

const primaryBtn =
  'inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#01533B] hover:bg-[#03422C] disabled:opacity-50 text-white text-sm font-semibold cursor-pointer';
const ghostBtn = 'h-10 px-4 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer';

type DialogState =
  | { kind: 'create' }
  | { kind: 'edit'; account: Account }
  | { kind: 'reset'; account: Account }
  | { kind: 'delete'; account: Account }
  | null;

export default function AdminPanel({ me, onSessionExpired }: { me: Me; onSessionExpired: () => void }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [form, setForm] = useState({ username: '', nama_lengkap: '', role: 'Admin', password: '' });
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const call = useCallback(
    async (method: string, url: string, body?: unknown) => {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401) {
        onSessionExpired();
        return null;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || 'Terjadi kesalahan.'), { list: data.errors });
      return data;
    },
    [onSessionExpired]
  );

  useEffect(() => {
    (async () => {
      try {
        const data = await call('GET', '/api/admin/users');
        if (data) setAccounts(data.users);
      } catch (e) {
        setLoadError((e as Error).message);
      }
    })();
  }, [call]);

  const open = (d: DialogState) => {
    setErrors([]);
    if (d?.kind === 'create') setForm({ username: '', nama_lengkap: '', role: 'Admin', password: generatePassword() });
    if (d?.kind === 'edit')
      setForm({ username: d.account.username, nama_lengkap: d.account.nama_lengkap, role: d.account.role, password: '' });
    if (d?.kind === 'reset') setForm((f) => ({ ...f, password: generatePassword() }));
    setDialog(d);
  };

  const submit = async (method: string, url: string, body: unknown, message: string) => {
    setBusy(true);
    setErrors([]);
    try {
      const data = await call(method, url, body);
      if (!data) return;
      setAccounts(data.users);
      setDialog(null);
      setNotice(message);
    } catch (e) {
      const err = e as Error & { list?: string[] };
      setErrors(err.list?.length ? err.list : [err.message]);
    } finally {
      setBusy(false);
    }
  };

  const isMe = (a: Account) => String(a.id) === String(me.id);
  const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
  const plainCount = accounts?.filter((a) => !a.password_terenkripsi).length ?? 0;

  return (
    <div className="space-y-5">
      {notice && (
        <div role="status" className="flex items-start gap-2 rounded-xl bg-[#E8F2EE] border border-[#01533B]/20 px-4 py-3 text-sm text-[#03422C]">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Tutup pesan" className="text-[#01533B]/60 hover:text-[#01533B]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {me.id === 'env-admin' && (
        <div className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-900">
          Anda masuk dengan <strong>akun admin sistem</strong> (diatur lewat environment variable di Vercel). Akun ini tidak
          tampil di daftar dan tidak bisa diubah dari sini.
        </div>
      )}

      {plainCount > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {plainCount} akun masih menyimpan password dalam bentuk teks biasa. Password otomatis dienkripsi saat pemiliknya
            login berikutnya, atau langsung dengan <strong>Reset password</strong>.
          </span>
        </div>
      )}

      <section className={`${card} overflow-hidden`}>
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-slate-900">Akun Admin</h2>
            {accounts && (
              <span className="text-xs font-semibold text-[#01533B] bg-[#E8F2EE] px-2.5 py-1 rounded-full">
                {accounts.length} akun
              </span>
            )}
          </div>
          <button onClick={() => open({ kind: 'create' })} className={primaryBtn}>
            <Plus className="w-4 h-4" /> Tambah admin
          </button>
        </div>

        {loadError ? (
          <div className="p-5">
            <ErrorBox messages={[loadError]} />
          </div>
        ) : !accounts ? (
          <div className="py-14 flex justify-center">
            <Loader2 className="w-6 h-6 text-[#01533B] animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 pl-5 pr-3">Nama</th>
                  <th className="py-3 px-3">Username</th>
                  <th className="py-3 px-3">Peran</th>
                  <th className="py-3 px-3">Password</th>
                  <th className="py-3 pl-3 pr-5 text-right">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((a) => (
                  <tr key={a.id} className="hover:bg-[#F4F8F6]">
                    <td className="py-3 pl-5 pr-3 font-semibold text-slate-900">
                      {a.nama_lengkap}
                      {isMe(a) && (
                        <span className="ml-2 text-[11px] font-semibold text-[#01533B] bg-[#E8F2EE] px-1.5 py-0.5 rounded">Anda</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-700">{a.username}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ring-1 ring-inset ${
                          ROLE_BADGE[a.role] ?? ROLE_BADGE.Viewer
                        }`}
                      >
                        {a.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs">
                      {a.password_terenkripsi ? (
                        <span className="text-slate-500">Terenkripsi</span>
                      ) : (
                        <span className="text-amber-700 font-semibold">Belum terenkripsi</span>
                      )}
                    </td>
                    <td className="py-3 pl-3 pr-5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => open({ kind: 'edit', account: a })}
                          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Ubah
                        </button>
                        <button
                          onClick={() => open({ kind: 'reset', account: a })}
                          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          <KeyRound className="w-3.5 h-3.5" /> Reset password
                        </button>
                        <button
                          onClick={() => open({ kind: 'delete', account: a })}
                          disabled={isMe(a)}
                          title={isMe(a) ? 'Akun sendiri tidak bisa dihapus' : undefined}
                          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`${card} p-5`}>
        <h3 className="text-sm font-bold text-slate-900 mb-2">Hak akses per peran</h3>
        <dl className="grid sm:grid-cols-3 gap-3 text-sm">
          {ROLES.map((r) => (
            <div key={r} className="rounded-lg bg-slate-50 px-4 py-3">
              <dt className="font-semibold text-slate-900">{r}</dt>
              <dd className="text-slate-600 text-xs mt-0.5">{ROLE_NOTES[r]}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Tambah / ubah akun */}
      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <Dialog
          title={dialog.kind === 'create' ? 'Tambah admin' : 'Ubah akun'}
          subtitle={dialog.kind === 'edit' ? dialog.account.nama_lengkap : 'Akun baru langsung bisa dipakai login.'}
          onClose={() => setDialog(null)}
          busy={busy}
          footer={
            <>
              <button onClick={() => setDialog(null)} disabled={busy} className={ghostBtn}>
                Batal
              </button>
              <button type="submit" form="account-form" disabled={busy} className={primaryBtn}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {dialog.kind === 'create' ? 'Tambah' : 'Simpan'}
              </button>
            </>
          }
        >
          <form
            id="account-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (dialog.kind === 'create') {
                submit('POST', '/api/admin/users', form, `Akun "${form.username}" ditambahkan. Berikan password-nya kepada pemilik akun.`);
              } else {
                submit(
                  'PATCH',
                  '/api/admin/users',
                  { id: dialog.account.id, username: form.username, nama_lengkap: form.nama_lengkap, role: form.role },
                  `Akun "${form.username}" diperbarui.`
                );
              }
            }}
          >
            <ErrorBox messages={errors} />
            <div>
              <label htmlFor="acc-nama" className="block text-xs font-semibold text-slate-700 mb-1">
                Nama lengkap <span className="text-rose-600">*</span>
              </label>
              <input
                id="acc-nama"
                value={form.nama_lengkap}
                onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="acc-username" className="block text-xs font-semibold text-slate-700 mb-1">
                Username <span className="text-rose-600">*</span>
              </label>
              <input
                id="acc-username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                autoComplete="off"
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-slate-400">Dipakai saat login; huruf besar/kecil harus sama persis.</p>
            </div>
            <div>
              <label htmlFor="acc-role" className="block text-xs font-semibold text-slate-700 mb-1">
                Peran
              </label>
              <select
                id="acc-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                disabled={dialog.kind === 'edit' && isMe(dialog.account)}
                className={inputClass}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                {dialog.kind === 'edit' && isMe(dialog.account)
                  ? 'Peran akun sendiri tidak bisa diubah.'
                  : ROLE_NOTES[form.role]}
              </p>
            </div>
            {dialog.kind === 'create' && (
              <div>
                <label htmlFor="acc-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Password awal <span className="text-rose-600">*</span>
                </label>
                <PasswordField id="acc-password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} withGenerate />
                <p className="mt-1 text-[11px] text-slate-400">Minimal 8 karakter. Catat dan berikan kepada pemilik akun.</p>
              </div>
            )}
          </form>
        </Dialog>
      )}

      {/* Reset password */}
      {dialog?.kind === 'reset' && (
        <Dialog
          title="Reset password"
          subtitle={`${dialog.account.nama_lengkap} (${dialog.account.username})`}
          onClose={() => setDialog(null)}
          busy={busy}
          footer={
            <>
              <button onClick={() => setDialog(null)} disabled={busy} className={ghostBtn}>
                Batal
              </button>
              <button type="submit" form="reset-form" disabled={busy} className={primaryBtn}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan password baru
              </button>
            </>
          }
        >
          <form
            id="reset-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit(
                'PATCH',
                '/api/admin/users',
                { id: dialog.account.id, password: form.password },
                `Password "${dialog.account.username}" sudah diganti. Berikan password baru kepada pemilik akun.`
              );
            }}
          >
            <ErrorBox messages={errors} />
            <label htmlFor="reset-password" className="block text-xs font-semibold text-slate-700">
              Password baru
            </label>
            <PasswordField id="reset-password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} withGenerate />
            <p className="text-xs text-slate-500">
              Akun ini akan otomatis keluar dari semua perangkat dan harus login dengan password baru.
            </p>
          </form>
        </Dialog>
      )}

      {/* Hapus akun */}
      {dialog?.kind === 'delete' && (
        <Dialog
          title="Hapus akun?"
          subtitle={`${dialog.account.nama_lengkap} (${dialog.account.username})`}
          onClose={() => setDialog(null)}
          busy={busy}
          footer={
            <>
              <button onClick={() => setDialog(null)} disabled={busy} className={ghostBtn}>
                Batal
              </button>
              <button
                onClick={() =>
                  submit('DELETE', `/api/admin/users?id=${dialog.account.id}`, undefined, `Akun "${dialog.account.username}" dihapus.`)
                }
                disabled={busy}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Hapus akun
              </button>
            </>
          }
        >
          <ErrorBox messages={errors} />
          <p className="text-sm text-slate-600">
            Akun ini tidak bisa login lagi dan langsung keluar dari semua perangkat. Data madrasah, siswa, dan GTK tidak terpengaruh.
            Tindakan ini tidak bisa dibatalkan.
          </p>
        </Dialog>
      )}
    </div>
  );
}
