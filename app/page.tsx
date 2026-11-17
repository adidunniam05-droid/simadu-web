'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  Eye,
  EyeOff,
  LayoutGrid,
  Building2,
  GraduationCap,
  Users,
  FileText,
  Search,
  TrendingUp,
  Download,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Loader2,
} from 'lucide-react';

interface UserData {
  id: number | string;
  username: string;
  role: string;
  nama_lengkap: string;
}

interface JenjangCount {
  jenjang: string;
  jumlah: number;
}

interface DashboardData {
  kecamatanList: { kode_kecamatan: number; nama_kecamatan: string }[];
  stats: {
    lembaga: number;
    lembagaLengkap: number;
    gtk: { total: number; pns: number; pppk: number; nonPns: number; aktif: number };
    siswa: number;
  };
  sebaranKecamatan: { kecamatan: string; jumlah: number }[];
  sebaranJenjang: JenjangCount[];
  siswaPerJenjang: JenjangCount[];
}

interface FilterOptions {
  statusPtk: { value: string; jumlah: number }[];
  kategoriSk: string[];
}

type TableTab = 'kelembagaan' | 'kesiswaan' | 'gtk' | 'berkas_sk';
type Tab = 'dashboard' | TableTab;
type Row = Record<string, unknown>;

interface Filters {
  search: string;
  kecamatan: string;
  jenjang: string;
  status: string;
  ptk: string;
  kategori: string;
  sort: string;
  dir: 'asc' | 'desc' | '';
  page: number;
  pageSize: number;
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  kecamatan: 'ALL',
  jenjang: 'ALL',
  status: 'ALL',
  ptk: 'ALL',
  kategori: 'ALL',
  sort: '',
  dir: '',
  page: 1,
  pageSize: 25,
};

const TABLE_TABS: TableTab[] = ['kelembagaan', 'kesiswaan', 'gtk', 'berkas_sk'];
const initialFilters = (): Record<TableTab, Filters> =>
  Object.fromEntries(TABLE_TABS.map((t) => [t, { ...DEFAULT_FILTERS }])) as Record<TableTab, Filters>;

const EXPORT_MAX_ROWS = 50000;
const SEARCH_DEBOUNCE_MS = 350;

const sidebarMenus: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'kelembagaan', label: 'Kelembagaan', icon: Building2 },
  { id: 'kesiswaan', label: 'Kesiswaan', icon: GraduationCap },
  { id: 'gtk', label: 'GTK', icon: Users },
  { id: 'berkas_sk', label: 'Berkas SK', icon: FileText },
];

const JENJANG_OPTIONS = [
  { value: 'RA', label: 'RA' },
  { value: 'MI', label: 'MI' },
  { value: 'MTS', label: 'MTs' },
  { value: 'MA', label: 'MA' },
];
const jenjangLabel = (v: unknown) =>
  JENJANG_OPTIONS.find((j) => j.value === String(v ?? '').toUpperCase())?.label ?? String(v ?? '-');

const JENJANG_COLORS: Record<string, { bar: string; dot: string; stroke: string }> = {
  RA: { bar: 'bg-rose-400', dot: 'bg-rose-400', stroke: '#FB7185' },
  MI: { bar: 'bg-blue-600', dot: 'bg-blue-600', stroke: '#2563EB' },
  MTS: { bar: 'bg-emerald-500', dot: 'bg-emerald-500', stroke: '#10B981' },
  MA: { bar: 'bg-amber-400', dot: 'bg-amber-400', stroke: '#FBBF24' },
};

const GTK_STATUS_OPTIONS = [
  { value: 'PNS', label: 'PNS' },
  { value: 'PPPK', label: 'PPPK / P3K' },
  { value: 'NON_PNS', label: 'Non PNS' },
  { value: 'KOSONG', label: 'Belum diisi' },
];

const SEARCH_PLACEHOLDER: Record<Tab, string> = {
  dashboard: 'Cari madrasah: nama, NSM, NPSN...',
  kelembagaan: 'Cari nama, NSM, NPSN, kepala...',
  kesiswaan: 'Cari nama, NISN, NIK, madrasah...',
  gtk: 'Cari nama, NIP/NIK, madrasah...',
  berkas_sk: 'Cari judul, nomor SK, kategori...',
};

const fmt = (n: number) => n.toLocaleString('id-ID');
const text = (v: unknown) => (v === null || v === undefined || String(v).trim() === '' ? '-' : String(v));
// "Kelas 5 - Kelas 5" → "Kelas 5"; "Kelompok B - KELOMPOK B" → "Kelompok B"
const cleanRombel = (v: unknown) => text(v).split(' - ')[0];

// Logo resmi SIMADU (ikon "S" buku + tulisan), file di public/images
function SimaduLogo({ className = 'h-11 w-auto' }: { className?: string }) {
  return (
    <Image
      src="/images/logo-simadu.png"
      alt="SIMADU — Sistem Informasi Madrasah Terpadu"
      width={900}
      height={239}
      priority
      className={className}
    />
  );
}

const SUPPORT_TEXT =
  'Untuk pembuatan akun atau reset password, silakan hubungi Admin Penma Kantor Kementerian Agama Kabupaten Jember.';

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

const statusTone = (v: unknown) => {
  const s = String(v ?? '').toUpperCase();
  if (s === 'PNS') return 'blue';
  if (s === 'PPPK' || s === 'P3K') return 'emerald';
  if (s === 'NON PNS') return 'amber';
  return 'slate';
};
const ptkTone = (v: unknown) => {
  const s = String(v ?? '');
  if (s === 'Aktif') return 'emerald';
  if (['Meninggal Dunia', 'Mengundurkan Diri', 'Pensiun', 'Mutasi'].includes(s)) return 'rose';
  return 'slate';
};

interface Column {
  label: string;
  sort?: string;
  className?: string;
  render: (row: Row) => React.ReactNode;
}

const COLUMNS: Record<TableTab, Column[]> = {
  kelembagaan: [
    { label: 'NSM', sort: 'nsm', className: 'font-mono text-xs', render: (r) => text(r.nsm) },
    { label: 'NPSN', sort: 'npsn', className: 'font-mono text-xs', render: (r) => text(r.npsn) },
    {
      label: 'Nama Lembaga',
      sort: 'nama',
      className: 'font-semibold text-slate-900',
      render: (r) => text(r.nama_lembaga),
    },
    { label: 'Jenjang', sort: 'jenjang', render: (r) => <Badge tone="emerald">{jenjangLabel(r.jenjang)}</Badge> },
    { label: 'Kecamatan', sort: 'kecamatan', render: (r) => text(r.kecamatan) },
    { label: 'Kepala Madrasah', sort: 'kepala', render: (r) => text(r.kepala_madrasah) },
  ],
  kesiswaan: [
    { label: 'NISN', sort: 'nisn', className: 'font-mono text-xs', render: (r) => text(r.nisn) },
    {
      label: 'Nama Siswa',
      sort: 'nama',
      className: 'font-semibold text-slate-900',
      render: (r) => text(r.nama_lengkap),
    },
    { label: 'Jenjang', sort: 'jenjang', render: (r) => <Badge tone="emerald">{jenjangLabel(r.jenjang)}</Badge> },
    { label: 'Rombel', sort: 'rombel', className: 'whitespace-nowrap', render: (r) => cleanRombel(r.tingkat_rombel) },
    { label: 'Madrasah', sort: 'madrasah', render: (r) => text(r.nama_sekolah) },
  ],
  gtk: [
    {
      label: 'Nama Lengkap',
      sort: 'nama',
      className: 'font-semibold text-slate-900',
      render: (r) => text(r.nama_lengkap),
    },
    { label: 'NIP / NIK', sort: 'nip', className: 'font-mono text-xs', render: (r) => text(r.nip_nik) },
    {
      label: 'Kepegawaian',
      sort: 'status',
      render: (r) => <Badge tone={statusTone(r.status_kepegawaian)}>{text(r.status_kepegawaian)}</Badge>,
    },
    { label: 'Status PTK', sort: 'ptk', render: (r) => <Badge tone={ptkTone(r.status_ptk)}>{text(r.status_ptk)}</Badge> },
    { label: 'Satuan Pendidikan', sort: 'madrasah', render: (r) => text(r.nama_madrasah) },
  ],
  berkas_sk: [
    {
      label: 'Judul Dokumen',
      sort: 'judul',
      className: 'font-semibold text-slate-900',
      render: (r) => text(r.judul_dokumen),
    },
    { label: 'Nomor SK', sort: 'nomor', className: 'font-mono text-xs', render: (r) => text(r.nomor_sk) },
    { label: 'Kategori', sort: 'kategori', render: (r) => text(r.kategori_utama) },
    { label: 'Tanggal', sort: 'tanggal', className: 'whitespace-nowrap', render: (r) => text(r.tanggal_terbit) },
    {
      label: 'Berkas',
      render: (r) =>
        typeof r.link_google_drive === 'string' && /^https?:\/\//.test(r.link_google_drive) ? (
          <a
            href={r.link_google_drive}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-emerald-700 hover:underline"
          >
            Buka
          </a>
        ) : (
          '-'
        ),
    },
  ],
};

export default function SimaduApp() {
  // State Autentikasi
  const [user, setUser] = useState<UserData | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  // State Navigasi & Filter (filter disimpan terpisah per tab)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [filtersByTab, setFiltersByTab] = useState<Record<TableTab, Filters>>(initialFilters);
  const [searchDraft, setSearchDraft] = useState('');

  // State Data Backend
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [tableRows, setTableRows] = useState<Row[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [dataError, setDataError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<Row | null>(null);
  const [appliedSort, setAppliedSort] = useState<{ sort: string; dir: 'asc' | 'desc' }>({
    sort: '',
    dir: 'asc',
  });

  const isTableTab = activeTab !== 'dashboard';
  const filters = isTableTab ? filtersByTab[activeTab as TableTab] : DEFAULT_FILTERS;

  // Fungsi Login ke /api/login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.trim(),
          password: passwordInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Username atau Password salah!');
      } else {
        setUser(data.user);
        setPasswordInput('');
      }
    } catch {
      setLoginError('Gagal terhubung ke server database.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActiveTab('dashboard');
    setFiltersByTab(initialFilters());
    setSearchDraft('');
    setDashboardData(null);
    setTableRows([]);
    setTotalRecords(0);
    setSelectedDetail(null);
  };

  // Ubah filter satu tab. Selain pindah halaman, perubahan filter mengembalikan ke halaman 1.
  const updateFilters = useCallback((tab: TableTab, patch: Partial<Filters>) => {
    setFiltersByTab((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], page: 1, ...patch },
    }));
  }, []);

  // Pindah tab; opsional sekaligus mengganti filter tab tujuan (mis. klik grafik dashboard).
  const goToTab = useCallback(
    (tab: Tab, patch?: Partial<Filters>) => {
      if (tab !== 'dashboard' && patch) {
        setFiltersByTab((prev) => ({ ...prev, [tab]: { ...DEFAULT_FILTERS, ...patch } }));
      }
      setActiveTab(tab);
      setSearchDraft(tab === 'dashboard' ? '' : (patch?.search ?? filtersByTab[tab as TableTab].search));
    },
    [filtersByTab]
  );

  // Pencarian dengan jeda: query baru dikirim 350 ms setelah berhenti mengetik.
  useEffect(() => {
    const term = searchDraft.trim();
    if (activeTab === 'dashboard') {
      if (!term) return;
      const t = setTimeout(() => goToTab('kelembagaan', { search: term }), SEARCH_DEBOUNCE_MS);
      return () => clearTimeout(t);
    }
    if (term === filtersByTab[activeTab].search) return;
    const t = setTimeout(() => updateFilters(activeTab, { search: term }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchDraft, activeTab, filtersByTab, updateFilters, goToTab]);

  // Data dashboard & pilihan filter (sekali setelah login)
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    (async () => {
      try {
        const [dashRes, optRes] = await Promise.all([
          fetch('/api/simadu?tab=dashboard', { signal: controller.signal }),
          fetch('/api/simadu?tab=options', { signal: controller.signal }),
        ]);
        if (dashRes.ok) setDashboardData(await dashRes.json());
        else setDataError('Gagal memuat ringkasan dashboard.');
        if (optRes.ok) setOptions(await optRes.json());
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setDataError('Gagal terhubung ke server.');
      }
    })();
    return () => controller.abort();
  }, [user]);

  // Data tabel. Request lama dibatalkan bila filter berubah sebelum selesai,
  // sehingga hasil yang tampil selalu milik filter terakhir.
  const queryString = useMemo(() => {
    if (!isTableTab) return '';
    const p = new URLSearchParams({ tab: activeTab });
    const f = filtersByTab[activeTab as TableTab];
    if (f.search) p.set('search', f.search);
    if (f.kecamatan !== 'ALL') p.set('kecamatan', f.kecamatan);
    if (f.jenjang !== 'ALL') p.set('jenjang', f.jenjang);
    if (f.status !== 'ALL') p.set('status', f.status);
    if (f.ptk !== 'ALL') p.set('ptk', f.ptk);
    if (f.kategori !== 'ALL') p.set('kategori', f.kategori);
    if (f.sort) p.set('sort', f.sort);
    if (f.dir) p.set('dir', f.dir);
    return p.toString();
  }, [isTableTab, activeTab, filtersByTab]);

  // "Sedang memuat" = permintaan yang diminta belum sama dengan yang terakhir selesai.
  const requestKey = isTableTab ? `${queryString}&page=${filters.page}&limit=${filters.pageSize}` : '';
  const [loadedKey, setLoadedKey] = useState('');
  const loadingData = isTableTab && loadedKey !== requestKey;

  useEffect(() => {
    if (!user || !requestKey) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/simadu?${requestKey}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat data.');
        setTableRows(data.rows || []);
        setTotalRecords(data.total || 0);
        // Urutan yang benar-benar dipakai server (termasuk urutan bawaan) untuk ikon kolom.
        setAppliedSort({ sort: data.sort || '', dir: data.dir === 'desc' ? 'desc' : 'asc' });
        setDataError('');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setDataError((err as Error).message || 'Gagal memuat data.');
        setTableRows([]);
        setTotalRecords(0);
      }
      setLoadedKey(requestKey);
    })();
    return () => controller.abort();
  }, [user, requestKey]);

  const currentSort = filters.sort || appliedSort.sort;
  const currentDir = filters.dir || appliedSort.dir;

  const toggleSort = (key: string) => {
    if (!isTableTab) return;
    const nextDir = currentSort === key && currentDir === 'asc' ? 'desc' : 'asc';
    updateFilters(activeTab as TableTab, { sort: key, dir: nextDir });
  };

  const resetFilters = () => {
    if (!isTableTab) return;
    setFiltersByTab((prev) => ({ ...prev, [activeTab]: { ...DEFAULT_FILTERS, pageSize: filters.pageSize } }));
    setSearchDraft('');
  };

  // Ekspor Excel: mengikuti tab, pencarian, filter, dan urutan yang sedang tampil.
  const handleExportExcel = async () => {
    const tab: TableTab = isTableTab ? (activeTab as TableTab) : 'kelembagaan';
    if (isTableTab && totalRecords > EXPORT_MAX_ROWS) {
      setDataError(
        `Data terlalu besar untuk diekspor (${fmt(totalRecords)} baris, batas ${fmt(EXPORT_MAX_ROWS)}). Persempit dengan filter atau pencarian.`
      );
      return;
    }
    setExporting(true);
    setDataError('');
    try {
      const qs = isTableTab ? queryString : `tab=${tab}`;
      const res = await fetch(`/api/export?${qs}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal membuat file Excel.');
      }
      const blob = await res.blob();
      const name =
        /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] ||
        `SIMADU_${tab}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDataError((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  // =========================================================
  // TAMPILAN 1: HALAMAN LOGIN (panel hijau + formulir)
  // =========================================================
  if (!user) {
    return (
      <div className="min-h-screen w-full flex flex-col bg-white">
        {/* Header */}
        <header className="h-20 lg:h-24 shrink-0 flex items-center justify-between px-5 sm:px-10 lg:px-16 border-b border-slate-200 bg-white">
          <SimaduLogo className="h-11 sm:h-14 w-auto" />
          <a
            href="https://kemenagjember.id"
            className="text-sm sm:text-base font-bold text-[#01533B] hover:text-[#03422C] hover:underline underline-offset-4"
          >
            <span className="hidden sm:inline">Kembali ke </span>Beranda
          </a>
        </header>

        <div className="flex-1 grid lg:grid-cols-[minmax(0,48%)_minmax(0,1fr)]">
          {/* Panel kiri: identitas */}
          <section className="relative overflow-hidden bg-[#014D3B] text-white px-6 py-10 sm:px-10 lg:px-20 lg:pt-0 lg:pb-28 flex flex-col justify-center">
            <Image
              src="/images/logo-simadu-icon.png"
              alt=""
              aria-hidden
              loading="eager"
              width={451}
              height={512}
              className="pointer-events-none select-none absolute -left-24 -bottom-32 w-[20rem] lg:w-[27rem] h-auto opacity-[0.07] [filter:brightness(0)_invert(1)]"
            />
            <div className="relative max-w-xl">
              <div className="h-1.5 w-28 rounded-full bg-[#DB9B09] mb-8" />
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
                Sistem Informasi
                <br />
                Madrasah Terpadu
              </h2>
              <p className="mt-4 text-base sm:text-lg lg:text-2xl text-white/90">
                Kementerian Agama Kabupaten Jember
              </p>
            </div>
          </section>

          {/* Panel kanan: formulir */}
          <section className="flex flex-col px-5 sm:px-10 lg:px-16">
            <div className="flex-1 flex items-center justify-center py-10">
              <div className="w-full max-w-[36rem]">
                <h1 className="text-3xl sm:text-[2.75rem] sm:leading-tight font-extrabold tracking-tight text-slate-900">
                  Masuk ke SIMADU
                </h1>
                <p className="mt-2 text-base sm:text-lg text-slate-600">Silakan masuk menggunakan akun Anda.</p>

                {loginError && (
                  <div
                    role="alert"
                    className="mt-6 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-sm font-medium text-rose-700"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="mt-8 space-y-5">
                  <div>
                    <label htmlFor="login-username" className="block text-sm font-bold text-slate-900 mb-2">
                      Username
                    </label>
                    <input
                      id="login-username"
                      type="text"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="Masukkan username"
                      autoComplete="username"
                      required
                      className="w-full rounded-lg bg-white border border-slate-300 focus:border-[#01533B] focus:ring-2 focus:ring-[#01533B]/20 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition"
                    />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="block text-sm font-bold text-slate-900 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Masukkan password"
                        autoComplete="current-password"
                        required
                        className="w-full rounded-lg bg-white border border-slate-300 focus:border-[#01533B] focus:ring-2 focus:ring-[#01533B]/20 pl-4 pr-12 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500 hover:text-slate-800"
                        aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <div className="flex justify-end mt-2.5">
                      <button
                        type="button"
                        onClick={() => setShowSupport((v) => !v)}
                        className="text-sm font-bold text-[#01533B] hover:underline underline-offset-4"
                      >
                        Lupa password?
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#01533B] hover:bg-[#03422C] disabled:opacity-60 text-white text-base font-bold py-3.5 shadow-sm transition cursor-pointer"
                  >
                    {loginLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loginLoading ? 'Memverifikasi...' : 'Masuk'}
                  </button>
                </form>

                {showSupport && (
                  <div className="mt-5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                    {SUPPORT_TEXT}
                  </div>
                )}

                <p className="mt-6 text-center text-sm text-slate-600">
                  Butuh bantuan?{' '}
                  <button
                    type="button"
                    onClick={() => setShowSupport((v) => !v)}
                    className="font-bold text-[#01533B] hover:underline underline-offset-4"
                  >
                    Hubungi admin
                  </button>
                </p>
              </div>
            </div>

            <footer className="border-t border-slate-200 py-5 text-center text-xs sm:text-sm text-slate-500">
              © 2026 Kementerian Agama Kabupaten Jember. All rights reserved.
            </footer>
          </section>
        </div>
      </div>
    );
  }

  // Hitung metrik asli dari database
  const stats = dashboardData?.stats;
  const totalLembaga = stats?.lembaga ?? 0;
  const totalSiswa = stats?.siswa ?? 0;
  const totalGtk = stats?.gtk.total ?? 0;
  const gtkAktif = stats?.gtk.aktif ?? 0;
  const asnCount = (stats?.gtk.pns ?? 0) + (stats?.gtk.pppk ?? 0);
  const asnPercent = totalGtk > 0 ? ((asnCount / totalGtk) * 100).toFixed(1) : '0';
  const lengkapPercent = totalLembaga > 0 ? Math.round(((stats?.lembagaLengkap ?? 0) / totalLembaga) * 100) : 0;
  const kecamatanList = dashboardData?.kecamatanList ?? [];
  const sebaranKec = dashboardData?.sebaranKecamatan ?? [];
  const sebaranJenjang = dashboardData?.sebaranJenjang ?? [];
  const siswaPerJenjang = dashboardData?.siswaPerJenjang ?? [];
  const maxKecCount = Math.max(...sebaranKec.map((k) => k.jumlah), 1);
  const totalPages = Math.max(Math.ceil(totalRecords / filters.pageSize), 1);
  const firstRow = totalRecords === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const lastRow = Math.min(filters.page * filters.pageSize, totalRecords);

  // Segmen donat proporsi jenjang dari data asli
  const DONUT_R = 46;
  const DONUT_C = 2 * Math.PI * DONUT_R;
  const jenjangTotal = sebaranJenjang.reduce((s, j) => s + j.jumlah, 0) || 1;
  const donutLens = sebaranJenjang.map((j) => (j.jumlah / jenjangTotal) * DONUT_C);
  const donutSegments = sebaranJenjang.map((j, i) => ({
    ...j,
    len: donutLens[i],
    offset: donutLens.slice(0, i).reduce((a, b) => a + b, 0),
  }));

  // Chip filter aktif (untuk ditampilkan & dihapus satu per satu)
  const activeChips: { label: string; clear: Partial<Filters> }[] = [];
  if (isTableTab) {
    if (filters.search) activeChips.push({ label: `Cari: "${filters.search}"`, clear: { search: '' } });
    if (filters.kecamatan !== 'ALL')
      activeChips.push({ label: `Kecamatan: ${filters.kecamatan}`, clear: { kecamatan: 'ALL' } });
    if (filters.jenjang !== 'ALL')
      activeChips.push({ label: `Jenjang: ${jenjangLabel(filters.jenjang)}`, clear: { jenjang: 'ALL' } });
    if (filters.status !== 'ALL')
      activeChips.push({
        label: `Kepegawaian: ${GTK_STATUS_OPTIONS.find((s) => s.value === filters.status)?.label}`,
        clear: { status: 'ALL' },
      });
    if (filters.ptk !== 'ALL') activeChips.push({ label: `Status PTK: ${filters.ptk}`, clear: { ptk: 'ALL' } });
    if (filters.kategori !== 'ALL')
      activeChips.push({ label: `Kategori: ${filters.kategori}`, clear: { kategori: 'ALL' } });
  }

  const selectClass =
    'rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 outline-none cursor-pointer';

  // =========================================================
  // TAMPILAN 2: DASHBOARD & MENU TERPADU (DATA ASLI POSTGRESQL)
  // =========================================================
  return (
    <div className="min-h-screen bg-[#F3F6F8] text-slate-800 flex">
      {/* Sidebar Kiri */}
      <aside className="w-64 bg-white border-r border-slate-200/70 hidden md:flex flex-col p-5 shrink-0">
        <div className="px-2 mb-8">
          <SimaduLogo className="w-full h-auto" />
        </div>

        <nav className="space-y-1.5 flex-1">
          {sidebarMenus.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => goToTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-[#01533B] text-white shadow-md shadow-emerald-900/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar Akun</span>
        </button>
      </aside>

      {/* Konten Utama */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {/* Navigasi ponsel (sidebar disembunyikan di layar kecil) */}
        <nav className="md:hidden flex items-center gap-2 overflow-x-auto pb-3 mb-4 -mx-1 px-1">
          {sidebarMenus.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => goToTab(item.id)}
                className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  isActive ? 'bg-[#01533B] text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
          <button
            onClick={handleLogout}
            className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-rose-600 border border-rose-200"
          >
            <LogOut className="w-4 h-4" />
            Keluar
          </button>
        </nav>

        {/* Topbar */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-7">
          <div>
            <p className="text-xs text-slate-500">
              Pendidikan Madrasah Kantor Kementerian Agama Kabupaten Jember
            </p>
            <h1 className="text-2xl font-bold text-slate-900">
              {activeTab === 'dashboard'
                ? `Selamat Datang, ${user.nama_lengkap || user.username}`
                : sidebarMenus.find((m) => m.id === activeTab)?.label}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Pencarian */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isTableTab) {
                    updateFilters(activeTab as TableTab, { search: searchDraft.trim() });
                  }
                  if (e.key === 'Escape') setSearchDraft('');
                }}
                placeholder={SEARCH_PLACEHOLDER[activeTab]}
                className="w-full bg-white rounded-xl border border-slate-200 pl-10 pr-9 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
              />
              {searchDraft && (
                <button
                  onClick={() => setSearchDraft('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700"
                  aria-label="Hapus pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Tombol Ekspor Excel */}
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="inline-flex items-center gap-2 bg-[#01533B] hover:bg-[#03422C] disabled:opacity-60 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition cursor-pointer"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{exporting ? 'Menyiapkan...' : 'Export Excel (.xlsx)'}</span>
            </button>

            <div className="flex items-center gap-2.5 pl-1">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                {(user.nama_lengkap || user.username).slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden xl:block text-xs">
                <div className="font-bold text-slate-800">
                  {user.nama_lengkap || user.username}
                </div>
                <div className="text-slate-500 capitalize">
                  {user.role || 'Admin Pusat'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {dataError && (
          <div className="mb-5 flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-medium text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
            <span className="flex-1">{dataError}</span>
            <button onClick={() => setDataError('')} aria-label="Tutup pesan" className="text-rose-400 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' ? (
          <>
            {/* 4 Kartu KPI */}
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
              <button
                onClick={() => goToTab('kelembagaan', {})}
                className="text-left bg-white rounded-2xl p-5 shadow-sm border border-slate-100 border-b-4 border-b-blue-600 cursor-pointer hover:shadow-md transition"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">Total Madrasah</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl font-bold text-slate-900">{fmt(totalLembaga)}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3 h-3" /> {kecamatanList.length || sebaranKec.length} Kecamatan
                  </span>
                </div>
              </button>

              <button
                onClick={() => goToTab('kesiswaan', {})}
                className="text-left bg-white rounded-2xl p-5 shadow-sm border border-slate-100 border-b-4 border-b-emerald-600 cursor-pointer hover:shadow-md transition"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">Total Siswa</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{fmt(totalSiswa)}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Rasio siswa : GTK aktif = 1 : {gtkAktif > 0 ? Math.round(totalSiswa / gtkAktif) : '-'}
                </div>
              </button>

              <button
                onClick={() => goToTab('gtk', {})}
                className="text-left bg-white rounded-2xl p-5 shadow-sm border border-slate-100 border-b-4 border-b-amber-400 cursor-pointer hover:shadow-md transition"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-400 text-white flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">Total GTK</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-slate-900">{fmt(totalGtk)}</span>
                  <span
                    className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full"
                    title="PNS + PPPK dibanding seluruh GTK"
                  >
                    ASN {asnPercent}%
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {fmt(gtkAktif)} aktif • PNS {fmt(stats?.gtk.pns ?? 0)} • PPPK {fmt(stats?.gtk.pppk ?? 0)}
                </div>
              </button>

              <button
                onClick={() => goToTab('kelembagaan', {})}
                className="text-left bg-white rounded-2xl p-5 shadow-sm border border-slate-100 border-b-4 border-b-rose-400 cursor-pointer hover:shadow-md transition"
                title="Lembaga yang NSM, NPSN, dan kepala madrasahnya sudah terisi"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-400 text-white flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-slate-600">Kelengkapan Profil</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">{lengkapPercent}%</div>
                <div className="flex items-center gap-2 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs text-slate-500">
                    {fmt(stats?.lembagaLengkap ?? 0)} dari {fmt(totalLembaga)} lembaga lengkap
                  </span>
                </div>
              </button>
            </section>

            {/* Grafik Batang Sebaran Kecamatan & Donat Proporsi Jenjang */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 min-w-0">
                <div className="flex items-center justify-between mb-6 gap-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Statistik Sebaran Madrasah per Kecamatan
                    </h2>
                    <p className="text-xs text-slate-500">
                      Diurutkan dari terbanyak • klik batang untuk membuka daftar lembaganya
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    {sebaranKec.length} Wilayah
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <div className="flex items-end gap-1.5 h-56 pt-6 border-b border-slate-100 min-w-max">
                    {sebaranKec.map((item, idx) => {
                      const heightPct = Math.max((item.jumlah / maxKecCount) * 100, 6);
                      const barColor =
                        idx % 3 === 0 ? 'bg-emerald-500' : idx % 3 === 1 ? 'bg-blue-600' : 'bg-rose-400';
                      return (
                        <button
                          key={item.kecamatan}
                          onClick={() => goToTab('kelembagaan', { kecamatan: item.kecamatan })}
                          className="w-10 flex flex-col items-center justify-end h-full group cursor-pointer"
                          title={`${item.kecamatan}: ${item.jumlah} Madrasah`}
                        >
                          <span className="text-[11px] font-bold text-slate-600 mb-1 group-hover:text-emerald-600">
                            {item.jumlah}
                          </span>
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-6 rounded-t-lg ${barColor} group-hover:opacity-80 transition-all`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-1.5 text-[10px] font-medium text-slate-500 mt-2.5 min-w-max">
                    {sebaranKec.map((item) => (
                      <span
                        key={item.kecamatan}
                        className="w-10 text-center [writing-mode:vertical-rl] rotate-180 h-20 truncate"
                        title={item.kecamatan}
                      >
                        {item.kecamatan}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Proporsi Satuan per Jenjang */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Proporsi Satuan per Jenjang</h2>
                  <p className="text-xs text-slate-500">Jumlah lembaga dan siswa RA, MI, MTs, MA</p>
                </div>

                <div className="relative w-44 h-44 mx-auto my-4 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r={DONUT_R} fill="none" stroke="#E2E8F0" strokeWidth="14" />
                    {donutSegments.map((s) => (
                      <circle
                        key={s.jenjang}
                        cx="60"
                        cy="60"
                        r={DONUT_R}
                        fill="none"
                        stroke={JENJANG_COLORS[s.jenjang]?.stroke ?? '#94A3B8'}
                        strokeWidth="14"
                        strokeDasharray={`${Math.max(s.len - 1.5, 0)} ${DONUT_C}`}
                        strokeDashoffset={-s.offset}
                      >
                        <title>{`${jenjangLabel(s.jenjang)}: ${fmt(s.jumlah)} lembaga`}</title>
                      </circle>
                    ))}
                  </svg>
                  <div className="absolute text-center">
                    <div className="text-lg font-extrabold text-slate-900">{fmt(totalLembaga)}</div>
                    <div className="text-[10px] text-slate-500">Lembaga</div>
                  </div>
                </div>

                <div className="space-y-1 text-xs pt-3 border-t border-slate-100">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-2.5 text-[10px] font-semibold uppercase text-slate-400">
                    <span>Jenjang</span>
                    <span className="text-right">Lembaga</span>
                    <span className="text-right">Siswa</span>
                  </div>
                  {sebaranJenjang.map((j) => (
                    <button
                      key={j.jenjang}
                      onClick={() => goToTab('kelembagaan', { jenjang: j.jenjang })}
                      className="w-full grid grid-cols-[1fr_auto_auto] gap-x-4 items-center px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left"
                      title={`Buka daftar lembaga ${jenjangLabel(j.jenjang)}`}
                    >
                      <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <span className={`w-2.5 h-2.5 rounded-full ${JENJANG_COLORS[j.jenjang]?.dot ?? 'bg-slate-400'}`} />
                        {jenjangLabel(j.jenjang)}
                      </span>
                      <span className="font-bold text-slate-900 text-right">{fmt(j.jumlah)}</span>
                      <span className="text-slate-600 text-right">
                        {fmt(siswaPerJenjang.find((s) => s.jenjang === j.jenjang)?.jumlah ?? 0)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : (
          /* TAB 2-5: TABEL DATA (KELEMBAGAAN / KESISWAAN / GTK / BERKAS SK) */
          <section className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100">
            {/* Baris Filter */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-slate-900">
                  Data {sidebarMenus.find((m) => m.id === activeTab)?.label}
                </h2>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                  {fmt(totalRecords)} Record
                </span>
                {loadingData && <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {activeTab === 'kelembagaan' && (
                  <select
                    value={filters.kecamatan}
                    onChange={(e) => updateFilters('kelembagaan', { kecamatan: e.target.value })}
                    className={selectClass}
                    aria-label="Filter kecamatan"
                  >
                    <option value="ALL">Semua Kecamatan ({kecamatanList.length})</option>
                    {kecamatanList.map((k) => (
                      <option key={k.kode_kecamatan} value={k.nama_kecamatan.toUpperCase()}>
                        {k.nama_kecamatan}
                      </option>
                    ))}
                  </select>
                )}

                {(activeTab === 'kelembagaan' || activeTab === 'kesiswaan') && (
                  <select
                    value={filters.jenjang}
                    onChange={(e) => updateFilters(activeTab, { jenjang: e.target.value })}
                    className={selectClass}
                    aria-label="Filter jenjang"
                  >
                    <option value="ALL">Semua Jenjang</option>
                    {JENJANG_OPTIONS.map((j) => (
                      <option key={j.value} value={j.value}>
                        {j.label}
                      </option>
                    ))}
                  </select>
                )}

                {activeTab === 'gtk' && (
                  <>
                    <select
                      value={filters.status}
                      onChange={(e) => updateFilters('gtk', { status: e.target.value })}
                      className={selectClass}
                      aria-label="Filter status kepegawaian"
                    >
                      <option value="ALL">Semua Kepegawaian</option>
                      {GTK_STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filters.ptk}
                      onChange={(e) => updateFilters('gtk', { ptk: e.target.value })}
                      className={selectClass}
                      aria-label="Filter status PTK"
                    >
                      <option value="ALL">Semua Status PTK</option>
                      {(options?.statusPtk ?? []).map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.value} ({fmt(s.jumlah)})
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {activeTab === 'berkas_sk' && (options?.kategoriSk.length ?? 0) > 0 && (
                  <select
                    value={filters.kategori}
                    onChange={(e) => updateFilters('berkas_sk', { kategori: e.target.value })}
                    className={selectClass}
                    aria-label="Filter kategori"
                  >
                    <option value="ALL">Semua Kategori</option>
                    {options?.kategoriSk.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                )}

                {activeChips.length > 0 && (
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </button>
                )}
              </div>
            </div>

            {/* Chip filter aktif */}
            {activeChips.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {activeChips.map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 pl-3 pr-1.5 py-1 text-xs font-medium text-emerald-800"
                  >
                    {chip.label}
                    <button
                      onClick={() => {
                        updateFilters(activeTab as TableTab, chip.clear);
                        if ('search' in chip.clear) setSearchDraft('');
                      }}
                      className="p-0.5 rounded-full hover:bg-emerald-100"
                      aria-label={`Hapus filter ${chip.label}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Tabel Data */}
            <div className="overflow-x-auto">
              {tableRows.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  {loadingData
                    ? 'Memuat data dari server SIMADU...'
                    : activeChips.length > 0
                    ? 'Tidak ada data yang cocok dengan pencarian atau filter.'
                    : 'Belum ada data.'}
                </div>
              ) : (
                <table className={`w-full text-left border-collapse text-sm transition-opacity ${loadingData ? 'opacity-50' : ''}`}>
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                      <th className="py-3 pr-3 w-12 text-right">No</th>
                      {COLUMNS[activeTab as TableTab].map((col) => {
                        const isSorted = col.sort && currentSort === col.sort;
                        const SortIcon = !isSorted ? ChevronsUpDown : currentDir === 'desc' ? ChevronDown : ChevronUp;
                        return (
                          <th key={col.label} className="py-3 pr-3" aria-sort={isSorted ? (currentDir === 'desc' ? 'descending' : 'ascending') : undefined}>
                            {col.sort ? (
                              <button
                                onClick={() => toggleSort(col.sort!)}
                                className={`inline-flex items-center gap-1 uppercase cursor-pointer hover:text-slate-800 ${isSorted ? 'text-emerald-700' : ''}`}
                              >
                                {col.label}
                                <SortIcon className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              col.label
                            )}
                          </th>
                        );
                      })}
                      <th className="py-3 text-right">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableRows.map((row, idx) => (
                      <tr key={String(row.id ?? idx)} className="hover:bg-slate-50/80">
                        <td className="py-3.5 pr-3 text-right text-xs text-slate-400 tabular-nums">
                          {fmt(firstRow + idx)}
                        </td>
                        {COLUMNS[activeTab as TableTab].map((col) => (
                          <td key={col.label} className={`py-3.5 pr-3 ${col.className ?? ''}`}>
                            {col.render(row)}
                          </td>
                        ))}
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => setSelectedDetail(row)}
                            className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 cursor-pointer"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Paginasi */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex items-center gap-3">
                <span>
                  Menampilkan <strong>{fmt(firstRow)}–{fmt(lastRow)}</strong> dari{' '}
                  <strong>{fmt(totalRecords)}</strong>
                </span>
                <select
                  value={filters.pageSize}
                  onChange={(e) => updateFilters(activeTab as TableTab, { pageSize: Number(e.target.value) })}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                  aria-label="Jumlah baris per halaman"
                >
                  {[25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n} / halaman
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={filters.page <= 1}
                  onClick={() => updateFilters(activeTab as TableTab, { page: 1 })}
                  className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                  aria-label="Halaman pertama"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={filters.page <= 1}
                  onClick={() => updateFilters(activeTab as TableTab, { page: filters.page - 1 })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" /> Sebelumnya
                </button>
                <span className="px-2">
                  <strong>{fmt(filters.page)}</strong> / {fmt(totalPages)}
                </span>
                <button
                  disabled={filters.page >= totalPages}
                  onClick={() => updateFilters(activeTab as TableTab, { page: filters.page + 1 })}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                >
                  Berikutnya <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  disabled={filters.page >= totalPages}
                  onClick={() => updateFilters(activeTab as TableTab, { page: totalPages })}
                  className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                  aria-label="Halaman terakhir"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Modal Inspeksi Detail Record */}
      {selectedDetail && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedDetail(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Detail Informasi Data</h3>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              {Object.entries(selectedDetail)
                .filter(([key]) => key !== 'id')
                .map(([key, val]) => (
                  <div key={key} className="flex justify-between gap-4 py-1.5 border-b border-slate-50">
                    <span className="font-semibold text-slate-500 uppercase shrink-0">{key.replace(/_/g, ' ')}</span>
                    <span className="text-slate-900 text-right font-medium break-words min-w-0">
                      {typeof val === 'string' && /^https?:\/\//.test(val) ? (
                        <a href={val} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline break-all">
                          {val}
                        </a>
                      ) : key === 'jenjang' ? (
                        jenjangLabel(val)
                      ) : key === 'tingkat_rombel' ? (
                        cleanRombel(val)
                      ) : (
                        text(val)
                      )}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
