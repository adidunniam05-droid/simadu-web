'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Dialog, PasswordField } from './admin-panel';

export default function PasswordModal({
  isEnvAdmin,
  onClose,
  onSessionExpired,
}: {
  isEnvAdmin: boolean;
  onClose: () => void;
  onSessionExpired: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (next !== confirm) return setError('Konfirmasi password baru tidak sama.');
    setBusy(true);
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current, next }),
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal mengganti password.');
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const primaryBtn =
    'inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#01533B] hover:bg-[#03422C] disabled:opacity-50 text-white text-sm font-semibold cursor-pointer';

  return (
    <Dialog
      title="Ganti password"
      subtitle="Perangkat lain yang memakai akun ini akan otomatis keluar."
      onClose={onClose}
      busy={busy}
      footer={
        done || isEnvAdmin ? (
          <button onClick={onClose} className={primaryBtn}>
            Tutup
          </button>
        ) : (
          <>
            <button onClick={onClose} disabled={busy} className="h-10 px-4 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100">
              Batal
            </button>
            <button type="submit" form="password-form" disabled={busy} className={primaryBtn}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Simpan
            </button>
          </>
        )
      }
    >
      {isEnvAdmin ? (
        <p className="text-sm text-slate-600">
          Akun ini adalah akun admin sistem. Password-nya diatur lewat environment variable <code>ADMIN_PASSWORD</code> di
          Vercel, bukan dari halaman ini.
        </p>
      ) : done ? (
        <div role="status" className="flex items-start gap-2 rounded-lg bg-[#E8F2EE] border border-[#01533B]/20 px-3.5 py-3 text-sm text-[#03422C]">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          Password berhasil diganti. Gunakan password baru saat login berikutnya.
        </div>
      ) : (
        <form id="password-form" onSubmit={submit} className="space-y-3">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-sm text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          <div>
            <label htmlFor="pw-current" className="block text-xs font-semibold text-slate-700 mb-1">
              Password lama
            </label>
            <PasswordField id="pw-current" value={current} onChange={setCurrent} autoComplete="current-password" />
          </div>
          <div>
            <label htmlFor="pw-next" className="block text-xs font-semibold text-slate-700 mb-1">
              Password baru <span className="text-slate-400 font-normal">(minimal 8 karakter)</span>
            </label>
            <PasswordField id="pw-next" value={next} onChange={setNext} />
          </div>
          <div>
            <label htmlFor="pw-confirm" className="block text-xs font-semibold text-slate-700 mb-1">
              Ulangi password baru
            </label>
            <PasswordField id="pw-confirm" value={confirm} onChange={setConfirm} />
          </div>
        </form>
      )}
    </Dialog>
  );
}
