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
const KEC_TOP = 10;

// Label yang mudah dibaca untuk kolom database di jendela detail
const FIELD_LABELS: Record<string, string> = {
  nsm: 'NSM',
  npsn: 'NPSN',
  nama_lembaga: 'Nama lembaga',
  jenjang: 'Jenjang',
  kecamatan: 'Kecamatan',
  kepala_madrasah: 'Kepala madrasah',
  status_aktif: 'Status',
  id_gtk: 'ID GTK',
  nip_nik: 'NIP / NIK',
  nama_lengkap: 'Nama lengkap',
  status_kepegawaian: 'Kepegawaian',
  jabatan: 'Jabatan',
  status_ptk: 'Status PTK',
  nama_madrasah: 'Satuan pendidikan',
  tanggal_lahir: 'Tanggal lahir',
  nisn: 'NISN',
  nik: 'NIK',
  tingkat_rombel: 'Rombel',
  nama_sekolah: 'Madrasah',
  nama_wali: 'Nama wali',
  alamat: 'Alamat',
  capaian_tahfidz: 'Capaian tahfidz',
  id_dokumen: 'ID dokumen',
  kategori_utama: 'Kategori',
  sub_kategori: 'Sub kategori',
  judul_dokumen: 'Judul dokumen',
  nomor_sk: 'Nomor SK',
  tanggal_terbit: 'Tanggal terbit',
  format_file: 'Format',
  link_google_drive: 'Tautan berkas',
};
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
const JENJANG_NAMES: Record<string, string> = {
  RA: 'Raudhatul Athfal',
  MI: 'Madrasah Ibtidaiyah',
  MTS: 'Madrasah Tsanawiyah',
  MA: 'Madrasah Aliyah',
};
const jenjangLabel = (v: unknown) =>
  JENJANG_OPTIONS.find((j) => j.value === String(v ?? '').toUpperCase())?.label ?? String(v ?? '-');

const GTK_STATUS_OPTIONS = [
  { value: 'PNS', label: 'PNS' },
  { value: 'PPPK', label: 'PPPK / P3K' },
  { value: 'NON_PNS', label: 'Non PNS' },
  { value: 'KOSONG', label: 'Belum diisi' },
];

const SEARCH_PLACEHOLDER: Record<Tab, string> = {
  dashboard: 'Cari madrasah, NSM, NPSN...',
  kelembagaan: 'Cari nama, NSM, NPSN...',
  kesiswaan: 'Cari nama, NISN, NIK...',
  gtk: 'Cari nama atau NIP/NIK...',
  berkas_sk: 'Cari judul atau nomor SK...',
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
    emerald: 'bg-[#E8F2EE] text-[#01533B] ring-[#01533B]/15',
    amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    blue: 'bg-sky-50 text-sky-800 ring-sky-600/20',
    rose: 'bg-rose-50 text-rose-700 ring-rose-600/15',
    slate: 'bg-slate-50 text-slate-600 ring-slate-500/20',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${tones[tone]}`}>
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
      className: 'font-semibold text-slate-900 whitespace-nowrap',
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
      className: 'font-semibold text-slate-900 whitespace-nowrap',
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
      className: 'font-semibold text-slate-900 whitespace-nowrap',
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
      className: 'font-semibold text-slate-900 whitespace-nowrap',
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
  const [showAllKec, setShowAllKec] = useState(false);

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

  // Tutup jendela detail dengan tombol Esc.
  useEffect(() => {
    if (!selectedDetail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedDetail(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedDetail]);

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
        <header className="h-20 lg:h-24 shrink-0 flex items-center px-5 sm:px-10 lg:px-16 border-b border-slate-200 bg-white">
          <SimaduLogo className="h-11 sm:h-14 w-auto" />
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
  const asnPercent = totalGtk > 0 ? ((asnCount / totalGtk) * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 }) : '0';
  const lembagaLengkap = stats?.lembagaLengkap ?? 0;
  const lengkapPercent = totalLembaga > 0 ? Math.round((lembagaLengkap / totalLembaga) * 100) : 0;
  const kecamatanList = dashboardData?.kecamatanList ?? [];
  const sebaranKec = dashboardData?.sebaranKecamatan ?? [];
  const sebaranJenjang = dashboardData?.sebaranJenjang ?? [];
  const siswaPerJenjang = dashboardData?.siswaPerJenjang ?? [];
  const maxKecCount = Math.max(...sebaranKec.map((k) => k.jumlah), 1);
  const kecShown = showAllKec ? sebaranKec : sebaranKec.slice(0, KEC_TOP);
  const jenjangRows = sebaranJenjang.map((j) => ({
    jenjang: j.jenjang,
    lembaga: j.jumlah,
    siswa: siswaPerJenjang.find((s) => s.jenjang === j.jenjang)?.jumlah ?? 0,
  }));
  const maxJenjangLembaga = Math.max(...jenjangRows.map((r) => r.lembaga), 1);
  const maxJenjangSiswa = Math.max(...jenjangRows.map((r) => r.siswa), 1);
  const totalPages = Math.max(Math.ceil(totalRecords / filters.pageSize), 1);
  const firstRow = totalRecords === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const lastRow = Math.min(filters.page * filters.pageSize, totalRecords);
  const activeMenu = sidebarMenus.find((m) => m.id === activeTab);
  const kelembagaanSub = [
    { value: 'ALL', label: 'Semua lembaga', short: 'Semua', title: 'Semua jenjang', count: dashboardData ? totalLembaga : null },
    ...JENJANG_OPTIONS.map((j) => ({
      value: j.value,
      label: JENJANG_NAMES[j.value].replace(/^Madrasah /, ''),
      short: j.label,
      title: `${JENJANG_NAMES[j.value]} (${j.label})`,
      count: dashboardData ? sebaranJenjang.find((x) => x.jenjang === j.value)?.jumlah ?? 0 : null,
    })),
  ];
  const pageTitle =
    activeTab === 'kelembagaan' && filters.jenjang !== 'ALL'
      ? `Kelembagaan • ${JENJANG_NAMES[filters.jenjang]}`
      : activeMenu?.label;
  const userName = user.nama_lengkap || user.username;
  const initials = userName
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

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

  const card = 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
  const selectClass =
    'h-9 rounded-lg border border-slate-300 bg-white pl-3 pr-8 text-sm text-slate-700 focus:border-[#01533B] focus:ring-2 focus:ring-[#01533B]/15 outline-none cursor-pointer';
  const pagerBtn =
    'inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none cursor-pointer';

  const kpis = [
    {
      label: 'Total Madrasah',
      value: fmt(totalLembaga),
      sub: `Tersebar di ${kecamatanList.length || sebaranKec.length} kecamatan`,
      icon: Building2,
      onClick: () => goToTab('kelembagaan', {}),
    },
    {
      label: 'Total Siswa',
      value: fmt(totalSiswa),
      sub: `Rasio 1 : ${gtkAktif > 0 ? Math.round(totalSiswa / gtkAktif) : '-'} terhadap GTK aktif`,
      icon: GraduationCap,
      onClick: () => goToTab('kesiswaan', {}),
    },
    {
      label: 'Total GTK',
      value: fmt(totalGtk),
      sub: `${fmt(gtkAktif)} aktif • ASN ${asnPercent}%`,
      title: `ASN = PNS ${fmt(stats?.gtk.pns ?? 0)} + PPPK ${fmt(stats?.gtk.pppk ?? 0)}`,
      icon: Users,
      onClick: () => goToTab('gtk', {}),
    },
  ];

  // =========================================================
  // TAMPILAN 2: DASHBOARD & MENU TERPADU (DATA ASLI POSTGRESQL)
  // =========================================================
  return (
    <div className="min-h-screen bg-[#F4F6F5] text-slate-800 flex">
      {/* Sidebar Kiri */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="h-20 flex items-center px-6 border-b border-slate-100">
          <SimaduLogo className="h-10 w-auto" />
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Menu</p>
          {sidebarMenus.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const hasSub = item.id === 'kelembagaan';
            return (
              <div key={item.id}>
                <button
                  onClick={() => goToTab(item.id, hasSub ? {} : undefined)}
                  aria-current={isActive && !hasSub ? 'page' : undefined}
                  aria-expanded={hasSub ? true : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                    isActive
                      ? hasSub
                        ? 'bg-[#E8F2EE] text-[#01533B]'
                        : 'bg-[#01533B] text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {hasSub && <ChevronDown className="w-4 h-4 opacity-60" />}
                </button>

                {/* Submenu Kelembagaan: dibagi per jenjang */}
                {hasSub && (
                  <ul className="mt-1 mb-2 ml-5 pl-2 border-l border-slate-200 space-y-0.5">
                    {kelembagaanSub.map((sub) => {
                      const subActive = activeTab === 'kelembagaan' && filtersByTab.kelembagaan.jenjang === sub.value;
                      return (
                        <li key={sub.value}>
                          <button
                            onClick={() => goToTab('kelembagaan', sub.value === 'ALL' ? {} : { jenjang: sub.value })}
                            aria-current={subActive ? 'page' : undefined}
                            title={sub.title}
                            className={`w-full flex items-center justify-between gap-2 pl-2.5 pr-2 py-2 rounded-lg text-[13px] transition cursor-pointer ${
                              subActive
                                ? 'bg-[#01533B] text-white font-semibold'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                            }`}
                          >
                            <span className="truncate">
                              {sub.value !== 'ALL' && <span className="inline-block w-8 text-left font-bold">{sub.short}</span>}
                              {sub.label}
                            </span>
                            <span
                              className={`shrink-0 text-[11px] font-semibold px-1.5 rounded ${
                                subActive ? 'bg-white/15 text-white' : 'text-slate-400'
                              }`}
                            >
                              {sub.count === null ? '' : fmt(sub.count)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-[#E8F2EE] text-[#01533B] flex items-center justify-center font-bold text-xs shrink-0">
              {initials || 'SM'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900 truncate">{userName}</div>
              <div className="text-xs text-slate-500 truncate">{user.role || 'Admin Pusat'}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-1 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* Konten Utama */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 lg:h-20 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
          <div className="flex items-center justify-between gap-3 md:hidden">
            <SimaduLogo className="h-9 w-auto" />
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 border border-rose-200"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold text-slate-900 truncate">
              {activeTab === 'dashboard' ? `Selamat datang, ${userName}` : pageTitle}
            </h1>
            <p className="text-xs text-slate-500 truncate">
              Pendidikan Madrasah • Kantor Kementerian Agama Kabupaten Jember
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 lg:w-80 lg:flex-none">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
                aria-label="Pencarian"
                className="w-full h-10 bg-slate-50 rounded-lg border border-slate-200 pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#01533B] focus:ring-2 focus:ring-[#01533B]/15"
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

            <button
              onClick={handleExportExcel}
              disabled={exporting}
              title="Unduh data yang sedang tampil (sesuai filter) sebagai Excel"
              className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#01533B] hover:bg-[#03422C] disabled:opacity-60 text-white text-sm font-semibold transition cursor-pointer"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">{exporting ? 'Menyiapkan...' : 'Export Excel'}</span>
            </button>
          </div>
        </header>

        {/* Navigasi ponsel (sidebar disembunyikan di layar kecil) */}
        <nav className="md:hidden flex items-center gap-2 overflow-x-auto px-4 py-3 bg-white border-b border-slate-200">
          {sidebarMenus.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => goToTab(item.id)}
                className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  isActive ? 'bg-[#01533B] text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {activeTab === 'kelembagaan' && (
          <nav aria-label="Jenjang lembaga" className="md:hidden flex items-center gap-2 overflow-x-auto px-4 py-2.5 bg-white border-b border-slate-200">
            {kelembagaanSub.map((sub) => {
              const subActive = filtersByTab.kelembagaan.jenjang === sub.value;
              return (
                <button
                  key={sub.value}
                  onClick={() => goToTab('kelembagaan', sub.value === 'ALL' ? {} : { jenjang: sub.value })}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition ${
                    subActive ? 'bg-[#E8F2EE] border-[#01533B]/30 text-[#01533B]' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {sub.short}
                  {sub.count !== null && <span className="ml-1 opacity-60">{fmt(sub.count)}</span>}
                </button>
              );
            })}
          </nav>
        )}

        <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          {dataError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1">{dataError}</span>
              <button onClick={() => setDataError('')} aria-label="Tutup pesan" className="text-rose-400 hover:text-rose-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' ? (
            <>
              {/* Kartu ringkasan */}
              <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                {kpis.map((k) => {
                  const Icon = k.icon;
                  return (
                    <button
                      key={k.label}
                      onClick={k.onClick}
                      title={'title' in k ? k.title : undefined}
                      className={`${card} group text-left p-4 sm:p-5 h-full flex flex-col hover:border-[#01533B]/40 hover:shadow-md transition cursor-pointer`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs sm:text-sm font-medium text-slate-500">{k.label}</span>
                        <span className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg bg-[#E8F2EE] text-[#01533B] flex items-center justify-center">
                          <Icon className="w-[18px] h-[18px]" />
                        </span>
                      </div>
                      <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
                        {dashboardData ? k.value : '—'}
                      </div>
                      <div className="mt-auto pt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="line-clamp-2">{dashboardData ? k.sub : 'Memuat...'}</span>
                        <ChevronRight className="w-4 h-4 shrink-0 text-slate-300 group-hover:text-[#01533B] transition" />
                      </div>
                    </button>
                  );
                })}

                <button
                  onClick={() => goToTab('kelembagaan', {})}
                  title="Lembaga yang NSM, NPSN, dan kepala madrasahnya sudah terisi"
                  className={`${card} group text-left p-4 sm:p-5 h-full flex flex-col hover:border-[#01533B]/40 hover:shadow-md transition cursor-pointer`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs sm:text-sm font-medium text-slate-500">Kelengkapan Profil</span>
                    <span className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-lg bg-[#E8F2EE] text-[#01533B] flex items-center justify-center">
                      <FileText className="w-[18px] h-[18px]" />
                    </span>
                  </div>
                  <div className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
                    {dashboardData ? `${lengkapPercent}%` : '—'}
                  </div>
                  <div className="mt-auto pt-2 space-y-1.5">
                    <div
                      className="h-1.5 rounded-full bg-slate-100 overflow-hidden"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={lengkapPercent}
                      aria-label="Kelengkapan profil lembaga"
                    >
                      <div className="h-full rounded-full bg-[#01533B]" style={{ width: `${lengkapPercent}%` }} />
                    </div>
                    <div className="text-xs text-slate-500">
                      {fmt(lembagaLengkap)} dari {fmt(totalLembaga)} lembaga lengkap
                    </div>
                  </div>
                </button>
              </section>

              <section className="grid grid-cols-1 xl:grid-cols-5 gap-4 lg:gap-5 items-start">
                {/* Sebaran madrasah per kecamatan: batang mendatar, satu warna */}
                <div className={`${card} xl:col-span-3 p-5 sm:p-6`}>
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Sebaran Madrasah per Kecamatan</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Jumlah lembaga, terbanyak di atas • klik baris untuk membuka daftarnya
                      </p>
                    </div>
                    {sebaranKec.length > KEC_TOP && (
                      <button
                        onClick={() => setShowAllKec((v) => !v)}
                        className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-[#01533B] hover:underline underline-offset-4 cursor-pointer"
                      >
                        {showAllKec ? `${KEC_TOP} teratas` : `Semua (${sebaranKec.length})`}
                        {showAllKec ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>

                  {sebaranKec.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-400">Memuat data...</div>
                  ) : (
                    <ul className="space-y-0.5">
                      {kecShown.map((item, idx) => (
                        <li key={item.kecamatan}>
                          <button
                            onClick={() => goToTab('kelembagaan', { kecamatan: item.kecamatan })}
                            title={`${item.kecamatan}: ${fmt(item.jumlah)} madrasah — klik untuk melihat daftar`}
                            className="group w-full grid grid-cols-[1.5rem_8.5rem_1fr_2.5rem] items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-left"
                          >
                            <span className="text-[11px] text-slate-400 text-right">{idx + 1}</span>
                            <span className="text-xs font-medium text-slate-700 truncate">{item.kecamatan}</span>
                            <span className="h-2.5 flex items-center">
                              <span
                                className="h-full rounded-r-[4px] bg-[#01533B] group-hover:bg-[#03422C] transition-colors"
                                style={{ width: `${Math.max((item.jumlah / maxKecCount) * 100, 2)}%` }}
                              />
                            </span>
                            <span className="text-xs font-semibold text-slate-900 text-right">{item.jumlah}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Sebaran per jenjang: lembaga & siswa, masing-masing dengan batangnya sendiri */}
                <div className={`${card} xl:col-span-2 p-5 sm:p-6`}>
                  <h2 className="text-base font-bold text-slate-900">Sebaran per Jenjang</h2>
                  <p className="text-xs text-slate-500 mt-0.5 mb-5">
                    Jumlah lembaga dan siswa • klik baris untuk membuka daftar lembaganya
                  </p>

                  <div className="grid grid-cols-[3rem_1fr_1fr] gap-x-4 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <span>Jenjang</span>
                    <span>Lembaga</span>
                    <span>Siswa</span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {jenjangRows.map((r) => (
                      <li key={r.jenjang}>
                        <button
                          onClick={() => goToTab('kelembagaan', { jenjang: r.jenjang })}
                          title={`${jenjangLabel(r.jenjang)}: ${fmt(r.lembaga)} lembaga, ${fmt(r.siswa)} siswa`}
                          className="w-full grid grid-cols-[3rem_1fr_1fr] gap-x-4 items-center px-2 py-3 hover:bg-slate-50 rounded-lg cursor-pointer text-left"
                        >
                          <span className="text-sm font-bold text-slate-900">{jenjangLabel(r.jenjang)}</span>
                          <span className="space-y-1.5">
                            <span className="block text-sm font-semibold text-slate-900">{fmt(r.lembaga)}</span>
                            <span className="block h-1.5">
                              <span
                                className="block h-full rounded-r-[4px] bg-[#01533B]"
                                style={{ width: `${(r.lembaga / maxJenjangLembaga) * 100}%` }}
                              />
                            </span>
                          </span>
                          <span className="space-y-1.5">
                            <span className="block text-sm font-semibold text-slate-900">{fmt(r.siswa)}</span>
                            <span className="block h-1.5">
                              <span
                                className="block h-full rounded-r-[4px] bg-[#01533B]"
                                style={{ width: `${(r.siswa / maxJenjangSiswa) * 100}%` }}
                              />
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="grid grid-cols-[3rem_1fr_1fr] gap-x-4 px-2 pt-3 mt-1 border-t border-slate-200 text-sm">
                    <span className="font-semibold text-slate-500">Total</span>
                    <span className="font-bold text-slate-900">{fmt(totalLembaga)}</span>
                    <span className="font-bold text-slate-900">{fmt(totalSiswa)}</span>
                  </div>
                </div>
              </section>
            </>
          ) : (
            /* TAB 2-5: TABEL DATA (KELEMBAGAAN / KESISWAAN / GTK / BERKAS SK) */
            <section className={`${card} overflow-hidden`}>
              {/* Baris judul + filter */}
              <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-bold text-slate-900">Data {activeMenu?.label}</h2>
                    <span className="text-xs font-semibold text-[#01533B] bg-[#E8F2EE] px-2.5 py-1 rounded-full">
                      {fmt(totalRecords)} data
                    </span>
                    {loadingData && <Loader2 className="w-4 h-4 text-[#01533B] animate-spin" aria-label="Memuat" />}
                  </div>

                  <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
                    {activeTab === 'kelembagaan' && (
                      <select
                        value={filters.kecamatan}
                        onChange={(e) => updateFilters('kelembagaan', { kecamatan: e.target.value })}
                        className={selectClass}
                        aria-label="Filter kecamatan"
                      >
                        <option value="ALL">Semua kecamatan</option>
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
                        <option value="ALL">Semua jenjang</option>
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
                          <option value="ALL">Semua kepegawaian</option>
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
                          <option value="ALL">Semua status PTK</option>
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
                        <option value="ALL">Semua kategori</option>
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
                        className="inline-flex items-center gap-1.5 h-9 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Chip filter aktif */}
                {activeChips.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {activeChips.map((chip) => (
                      <span
                        key={chip.label}
                        className="inline-flex items-center gap-1 rounded-full bg-[#E8F2EE] pl-3 pr-1 py-0.5 text-xs font-medium text-[#01533B]"
                      >
                        {chip.label}
                        <button
                          onClick={() => {
                            updateFilters(activeTab as TableTab, chip.clear);
                            if ('search' in chip.clear) setSearchDraft('');
                          }}
                          className="p-0.5 rounded-full hover:bg-[#01533B]/10"
                          aria-label={`Hapus filter ${chip.label}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Tabel Data */}
              <div className="overflow-x-auto">
                {tableRows.length === 0 ? (
                  <div className="py-16 flex flex-col items-center text-center gap-2">
                    {loadingData ? (
                      <Loader2 className="w-6 h-6 text-[#01533B] animate-spin" />
                    ) : (
                      <Search className="w-6 h-6 text-slate-300" />
                    )}
                    <p className="text-sm text-slate-500">
                      {loadingData
                        ? 'Memuat data...'
                        : activeChips.length > 0
                        ? 'Tidak ada data yang cocok dengan pencarian atau filter.'
                        : 'Belum ada data.'}
                    </p>
                    {!loadingData && activeChips.length > 0 && (
                      <button onClick={resetFilters} className="text-sm font-semibold text-[#01533B] hover:underline underline-offset-4">
                        Hapus semua filter
                      </button>
                    )}
                  </div>
                ) : (
                  <table className={`w-full min-w-[52rem] text-left text-sm transition-opacity ${loadingData ? 'opacity-50' : ''}`}>
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th scope="col" className="py-3 pl-5 pr-3 w-14 text-right">No</th>
                        {COLUMNS[activeTab as TableTab].map((col) => {
                          const isSorted = col.sort && currentSort === col.sort;
                          const SortIcon = !isSorted ? ChevronsUpDown : currentDir === 'desc' ? ChevronDown : ChevronUp;
                          return (
                            <th
                              key={col.label}
                              scope="col"
                              className="py-3 px-3 whitespace-nowrap"
                              aria-sort={isSorted ? (currentDir === 'desc' ? 'descending' : 'ascending') : undefined}
                            >
                              {col.sort ? (
                                <button
                                  onClick={() => toggleSort(col.sort!)}
                                  className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-slate-900 ${
                                    isSorted ? 'text-[#01533B]' : ''
                                  }`}
                                >
                                  {col.label}
                                  <SortIcon className={`w-3.5 h-3.5 ${isSorted ? '' : 'text-slate-300'}`} />
                                </button>
                              ) : (
                                col.label
                              )}
                            </th>
                          );
                        })}
                        <th scope="col" className="py-3 pl-3 pr-5 text-right">
                          <span className="sr-only">Aksi</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tableRows.map((row, idx) => (
                        <tr
                          key={String(row.id ?? idx)}
                          onClick={() => setSelectedDetail(row)}
                          className="hover:bg-[#F4F8F6] cursor-pointer"
                        >
                          <td className="py-3 pl-5 pr-3 text-right text-xs text-slate-400">{fmt(firstRow + idx)}</td>
                          {COLUMNS[activeTab as TableTab].map((col) => (
                            <td key={col.label} className={`py-3 px-3 align-middle ${col.className ?? 'text-slate-700'}`}>
                              {col.render(row)}
                            </td>
                          ))}
                          <td className="py-3 pl-3 pr-5 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDetail(row);
                              }}
                              className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#01533B] hover:underline underline-offset-4 cursor-pointer"
                            >
                              Detail <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Paginasi */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-slate-200 bg-slate-50/60 text-xs text-slate-600">
                <div className="flex items-center gap-3">
                  <span>
                    Menampilkan <strong className="text-slate-900">{fmt(firstRow)}–{fmt(lastRow)}</strong> dari{' '}
                    <strong className="text-slate-900">{fmt(totalRecords)}</strong>
                  </span>
                  <select
                    value={filters.pageSize}
                    onChange={(e) => updateFilters(activeTab as TableTab, { pageSize: Number(e.target.value) })}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs"
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
                    className={pagerBtn}
                    aria-label="Halaman pertama"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={filters.page <= 1}
                    onClick={() => updateFilters(activeTab as TableTab, { page: filters.page - 1 })}
                    className={pagerBtn}
                    aria-label="Halaman sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2">
                    Halaman <strong className="text-slate-900">{fmt(filters.page)}</strong> dari {fmt(totalPages)}
                  </span>
                  <button
                    disabled={filters.page >= totalPages}
                    onClick={() => updateFilters(activeTab as TableTab, { page: filters.page + 1 })}
                    className={pagerBtn}
                    aria-label="Halaman berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    disabled={filters.page >= totalPages}
                    onClick={() => updateFilters(activeTab as TableTab, { page: totalPages })}
                    className={pagerBtn}
                    aria-label="Halaman terakhir"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        <footer className="px-4 sm:px-6 lg:px-8 py-4 text-xs text-slate-400 border-t border-slate-200 bg-white">
          © 2026 Kementerian Agama Kabupaten Jember • SIMADU
        </footer>
      </main>

      {/* Modal Detail Record */}
      {selectedDetail && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setSelectedDetail(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#01533B]">Detail {activeMenu?.label}</p>
                <h3 id="detail-title" className="text-lg font-bold text-slate-900 truncate">
                  {text(
                    selectedDetail.nama_lembaga ??
                      selectedDetail.nama_lengkap ??
                      selectedDetail.judul_dokumen ??
                      selectedDetail.nomor_sk
                  )}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <dl className="px-6 py-4 overflow-y-auto divide-y divide-slate-100 text-sm">
              {Object.entries(selectedDetail)
                .filter(([key]) => key !== 'id')
                .map(([key, val]) => (
                  <div key={key} className="grid grid-cols-[9rem_1fr] gap-4 py-2.5">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 pt-0.5">
                      {FIELD_LABELS[key] ?? key.replace(/_/g, ' ')}
                    </dt>
                    <dd className="text-slate-900 font-medium break-words min-w-0">
                      {typeof val === 'string' && /^https?:\/\//.test(val) ? (
                        <a href={val} target="_blank" rel="noopener noreferrer" className="text-[#01533B] hover:underline break-all">
                          {val}
                        </a>
                      ) : key === 'jenjang' ? (
                        jenjangLabel(val)
                      ) : key === 'tingkat_rombel' ? (
                        cleanRombel(val)
                      ) : (
                        text(val)
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
