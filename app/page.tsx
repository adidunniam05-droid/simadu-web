'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LayoutGrid,
  Building2,
  GraduationCap,
  Users,
  FileText,
  Search,
  Bell,
  MoreVertical,
  TrendingUp,
  Download,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface UserData {
  id: number;
  username: string;
  role: string;
  nama_lengkap: string;
}

interface DashboardData {
  kecamatanList: { kode_kecamatan: string; nama_kecamatan: string }[];
  stats: {
    lembaga: number;
    gtk: { total: number; pns: number; pppk: number; nonPns: number };
    siswa: number;
  };
  sebaranKecamatan: { kecamatan: string; jumlah: string }[];
  sebaranJenjang: { jenjang: string; jumlah: string }[];
}

const sidebarMenus = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'kelembagaan', label: 'Kelembagaan', icon: Building2 },
  { id: 'kesiswaan', label: 'Kesiswaan', icon: GraduationCap },
  { id: 'gtk', label: 'GTK', icon: Users },
  { id: 'berkas_sk', label: 'Berkas SK', icon: FileText },
];

// Komponen Logo Resmi SIMADU Kemenag (SVG tajam, tidak pernah pecah)
function SimaduLogo({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <polygon
        points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5"
        fill="#047857"
        stroke="#FACC15"
        strokeWidth="2.5"
      />
      <polygon
        points="32,8 52,19.5 52,44.5 32,56 12,44.5 12,19.5"
        fill="#065F46"
        stroke="#FDE047"
        strokeWidth="1"
      />
      <polygon
        points="32,13 34.2,19.5 41,19.5 35.5,23.5 37.6,30 32,26 26.4,30 28.5,23.5 23,19.5 29.8,19.5"
        fill="#FACC15"
      />
      <path
        d="M19 36C24 34 29 35 32 38C35 35 40 34 45 36V45C40 43 35 44 32 47C29 44 24 43 19 45V36Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export default function SimaduApp() {
  // State Autentikasi
  const [user, setUser] = useState<UserData | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // State Navigasi & Filter
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKecamatan, setSelectedKecamatan] = useState('ALL');
  const [selectedJenjang, setSelectedJenjang] = useState('ALL');
  const [page, setPage] = useState(1);

  // State Data Backend
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);

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
          username: usernameInput,
          password: passwordInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Username atau Password salah!');
      } else {
        setUser(data.user);
      }
    } catch {
      setLoginError('Gagal terhubung ke server database.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Fetch Data Dashboard
  const fetchDashboard = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch('/api/simadu?tab=dashboard');
      const data = await res.json();
      if (res.ok) setDashboardData(data);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Fetch Data Tabel (Kelembagaan, Kesiswaan, GTK, Berkas SK)
  const fetchTableData = useCallback(async () => {
    if (activeTab === 'dashboard') return;
    setLoadingData(true);
    try {
      const params = new URLSearchParams({
        tab: activeTab,
        search: searchQuery,
        kecamatan: selectedKecamatan,
        jenjang: selectedJenjang,
        page: String(page),
      });
      const res = await fetch(`/api/simadu?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setTableRows(data.rows || []);
        setTotalRecords(data.total || 0);
      }
    } finally {
      setLoadingData(false);
    }
  }, [activeTab, searchQuery, selectedKecamatan, selectedJenjang, page]);

  useEffect(() => {
    if (!user) return;
    fetchDashboard();
  }, [user, fetchDashboard]);

  useEffect(() => {
    if (!user || activeTab === 'dashboard') return;
    fetchTableData();
  }, [user, activeTab, fetchTableData]);

  // Ekspor Excel
  const handleExportExcel = () => {
    const params = new URLSearchParams({
      tab: activeTab === 'dashboard' ? 'kelembagaan' : activeTab,
      kecamatan: selectedKecamatan,
      jenjang: selectedJenjang,
      search: searchQuery,
    });
    window.open(`/api/export?${params.toString()}`, '_blank');
  };

  // =========================================================
  // TAMPILAN 1: HALAMAN LOGIN GLASSMORPHISM (DESAIN BARU)
  // =========================================================
  if (!user) {
    return (
      <div
        className="relative min-h-screen w-full bg-cover bg-center flex items-center justify-center lg:justify-end px-4 sm:px-8 lg:px-20 bg-emerald-950"
        style={{ backgroundImage: `url('/images/bg-madrasah.jpg')` }}
      >
        <div className="absolute inset-0 bg-black/15" />

        <div className="relative z-10 w-full max-w-[440px] rounded-3xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-2xl p-8 sm:p-10">
          <div className="flex items-center gap-4 mb-8">
            <SimaduLogo size={60} />
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-none">
                SIMADU
              </h1>
              <p className="text-xs font-medium text-slate-700 mt-1">
                Sistem Informasi Madrasah Terpadu
              </p>
              <p className="text-xs font-medium text-slate-600">
                Pendma Kemenag Kab. Jember
              </p>
            </div>
          </div>

          {loginError && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">
                Username / NIP
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <User className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Masukkan Username / NIP"
                  required
                  className="w-full rounded-xl bg-white/95 border border-emerald-600/60 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 pl-11 pr-4 py-3 text-sm text-slate-800 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl bg-white/95 border border-slate-200 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/30 pl-11 pr-11 py-3 text-sm text-slate-800 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>
              <div className="flex justify-end mt-2">
                <span className="text-xs font-medium text-slate-700">
                  Lupa Password?
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-full bg-[#059669] hover:bg-[#047857] disabled:opacity-60 text-white font-semibold py-3.5 shadow-lg shadow-emerald-600/25 transition cursor-pointer"
            >
              {loginLoading ? 'Memverifikasi...' : 'Masuk'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-700 mt-6">
            Belum punya akun?{' '}
            <span className="font-semibold text-slate-900">
              Hubungi Admin Penma Jember
            </span>
          </p>
        </div>
      </div>
    );
  }

  // Hitung metrik asli dari database
  const totalLembaga = dashboardData?.stats.lembaga ?? 0;
  const totalSiswa = dashboardData?.stats.siswa ?? 0;
  const totalGtk = dashboardData?.stats.gtk.total ?? 0;
  const pnsCount = dashboardData?.stats.gtk.pns ?? 0;
  const asnPercent = totalGtk > 0 ? ((pnsCount / totalGtk) * 100).toFixed(1) : '0';
  const sebaranKec = dashboardData?.sebaranKecamatan ?? [];
  const sebaranJenjang = dashboardData?.sebaranJenjang ?? [];
  const maxKecCount = Math.max(...sebaranKec.map((k) => Number(k.jumlah)), 1);
  const totalPages = Math.max(Math.ceil(totalRecords / 25), 1);

  // =========================================================
  // TAMPILAN 2: DASHBOARD & MENU TERPADU (DATA ASLI POSTGRESQL)
  // =========================================================
  return (
    <div className="min-h-screen bg-[#F3F6F8] text-slate-800 flex">
      {/* Sidebar Kiri */}
      <aside className="w-64 bg-white border-r border-slate-200/70 hidden md:flex flex-col p-5 shrink-0">
        <div className="flex items-center gap-3 px-2 mb-8">
          <SimaduLogo size={44} />
          <div>
            <div className="text-xl font-extrabold tracking-tight text-slate-900 leading-none">
              SIMADU
            </div>
            <div className="text-[10px] font-medium text-slate-500 mt-1">
              Sistem Informasi Madrasah Terpadu
            </div>
          </div>
        </div>

        <nav className="space-y-1.5 flex-1">
          {sidebarMenus.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setPage(1);
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#059669] to-[#10B981] text-white shadow-md shadow-emerald-600/20'
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
          onClick={() => setUser(null)}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar Akun</span>
        </button>
      </aside>

      {/* Konten Utama */}
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
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
            {/* Pencarian Cepat */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                  if (activeTab === 'dashboard' && e.target.value.trim()) {
                    setActiveTab('kelembagaan');
                  }
                }}
                placeholder="Cari NSM, NPSN, atau Nama..."
                className="w-full bg-white rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm text-slate-700 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Tombol Ekspor Excel */}
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 bg-[#059669] hover:bg-[#047857] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel (.xlsx)</span>
            </button>

            <button className="relative p-2.5 bg-white rounded-xl border border-slate-200 text-slate-600">
              <Bell className="w-5 h-5" />
              <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-2 right-2.5" />
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

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' ? (
          <>
            {/* 4 Kartu KPI */}
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
              <div
                onClick={() => setActiveTab('kelembagaan')}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 border-b-4 border-b-blue-600 cursor-pointer hover:shadow-md transition"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium text-slate-600">
                      Total Madrasah
                    </span>
                  </div>
                  <MoreVertical className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl font-bold text-slate-900">
                    {totalLembaga.toLocaleString('id-ID')}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3 h-3" /> 31 Kecamatan
                  </span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('kesiswaan')}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 border-b-4 border-b-emerald-600 cursor-pointer hover:shadow-md transition"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium text-slate-600">
                      Total Siswa
                    </span>
                  </div>
                  <MoreVertical className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {totalSiswa.toLocaleString('id-ID')}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  TA 2026/2027 • Rasio 1:
                  {totalGtk > 0 ? Math.round(totalSiswa / totalGtk) : 7}
                </div>
              </div>

              <div
                onClick={() => setActiveTab('gtk')}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 border-b-4 border-b-amber-400 cursor-pointer hover:shadow-md transition"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400 text-white flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium text-slate-600">
                      Total GTK
                    </span>
                  </div>
                  <MoreVertical className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {totalGtk.toLocaleString('id-ID')}
                  </span>
                  <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    ASN {asnPercent}%
                  </span>
                </div>
              </div>

              <div
                onClick={() => setActiveTab('berkas_sk')}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 border-b-4 border-b-rose-400 cursor-pointer hover:shadow-md transition"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-400 text-white flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium text-slate-600">
                      Kelengkapan Data
                    </span>
                  </div>
                  <MoreVertical className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-2xl font-bold text-slate-900">100%</div>
                <div className="flex items-center gap-2 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    Tersinkron
                  </span>
                </div>
              </div>
            </section>

            {/* Grafik Batang Sebaran Kecamatan & Ring Proporsi Jenjang */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Grafik Batang Sebaran 12 Kecamatan Teratas (Klik batang untuk buka daftar lembaga kecamatan tsb) */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Statistik Sebaran Madrasah per Kecamatan
                    </h2>
                    <p className="text-xs text-slate-500">
                      Klik batang kecamatan untuk membuka daftar lembaganya
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    {sebaranKec.length} Wilayah
                  </span>
                </div>

                <div className="flex items-end justify-between gap-2 h-56 pt-6 border-b border-slate-100 overflow-x-auto">
                  {sebaranKec.slice(0, 12).map((item, idx) => {
                    const count = Number(item.jumlah);
                    const heightPct = Math.max((count / maxKecCount) * 100, 10);
                    const barColor =
                      idx % 3 === 0
                        ? 'bg-emerald-500'
                        : idx % 3 === 1
                        ? 'bg-blue-600'
                        : 'bg-rose-400';
                    return (
                      <button
                        key={item.kecamatan}
                        onClick={() => {
                          setSelectedKecamatan(item.kecamatan);
                          setActiveTab('kelembagaan');
                          setPage(1);
                        }}
                        className="flex-1 min-w-[42px] flex flex-col items-center justify-end h-full group cursor-pointer"
                        title={`${item.kecamatan}: ${count} Madrasah`}
                      >
                        <span className="text-[11px] font-bold text-slate-600 mb-1 group-hover:text-emerald-600">
                          {count}
                        </span>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-6 rounded-t-lg ${barColor} group-hover:opacity-80 transition-all`}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] font-medium text-slate-500 mt-2.5 gap-1 overflow-x-auto">
                  {sebaranKec.slice(0, 12).map((item) => (
                    <span
                      key={item.kecamatan}
                      className="flex-1 min-w-[42px] text-center truncate"
                    >
                      {item.kecamatan}
                    </span>
                  ))}
                </div>
              </div>

              {/* Proporsi Satuan per Jenjang */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Proporsi Satuan per Jenjang
                  </h2>
                  <p className="text-xs text-slate-500">
                    Komposisi RA, MI, MTs, dan MA di Kab. Jember
                  </p>
                </div>

                <div className="relative w-44 h-44 mx-auto my-4 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="48" fill="none" stroke="#E2E8F0" strokeWidth="10" />
                    <circle cx="60" cy="60" r="48" fill="none" stroke="#2563EB" strokeWidth="10" strokeDasharray="301" strokeDashoffset="75" strokeLinecap="round" />
                    <circle cx="60" cy="60" r="35" fill="none" stroke="#10B981" strokeWidth="10" strokeDasharray="220" strokeDashoffset="65" strokeLinecap="round" />
                    <circle cx="60" cy="60" r="22" fill="none" stroke="#FB7185" strokeWidth="10" strokeDasharray="138" strokeDashoffset="45" strokeLinecap="round" />
                  </svg>
                  <div className="absolute text-center">
                    <div className="text-lg font-extrabold text-slate-900">
                      {totalLembaga.toLocaleString('id-ID')}
                    </div>
                    <div className="text-[10px] text-slate-500">Lembaga</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-100">
                  {sebaranJenjang.map((j, idx) => {
                    const dotColors = [
                      'bg-blue-600',
                      'bg-emerald-500',
                      'bg-amber-400',
                      'bg-rose-400',
                    ];
                    return (
                      <button
                        key={j.jenjang}
                        onClick={() => {
                          setSelectedJenjang(j.jenjang);
                          setActiveTab('kelembagaan');
                          setPage(1);
                        }}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              dotColors[idx % dotColors.length]
                            }`}
                          />
                          {j.jenjang}
                        </span>
                        <span className="font-bold text-slate-900">
                          {Number(j.jumlah).toLocaleString('id-ID')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        ) : (
          /* TAB 2-5: TABEL DATA ASLI (KELEMBAGAAN / KESISWAAN / GTK / BERKAS SK) */
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            {/* Baris Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-slate-900 capitalize">
                  Data {activeTab.replace('_', ' ')}
                </h2>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                  {totalRecords.toLocaleString('id-ID')} Record
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {activeTab === 'kelembagaan' && (
                  <select
                    value={selectedKecamatan}
                    onChange={(e) => {
                      setSelectedKecamatan(e.target.value);
                      setPage(1);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 outline-none"
                  >
                    <option value="ALL">
                      Semua Kecamatan ({dashboardData?.kecamatanList.length ?? 31})
                    </option>
                    {dashboardData?.kecamatanList.map((k) => (
                      <option key={k.kode_kecamatan} value={k.nama_kecamatan}>
                        {k.nama_kecamatan}
                      </option>
                    ))}
                  </select>
                )}

                {(activeTab === 'kelembagaan' || activeTab === 'kesiswaan') && (
                  <select
                    value={selectedJenjang}
                    onChange={(e) => {
                      setSelectedJenjang(e.target.value);
                      setPage(1);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 focus:border-emerald-500 outline-none"
                  >
                    <option value="ALL">Semua Jenjang</option>
                    <option value="RA">RA</option>
                    <option value="MI">MI</option>
                    <option value="MTS">MTs</option>
                    <option value="MA">MA</option>
                  </select>
                )}
              </div>
            </div>

            {/* Tabel Data */}
            <div className="overflow-x-auto">
              {loadingData ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Memuat data dari server SIMADU...
                </div>
              ) : tableRows.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Tidak ada data yang cocok dengan filter pencarian.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                      {activeTab === 'kelembagaan' && (
                        <>
                          <th className="py-3 pr-3">NSM</th>
                          <th className="py-3 pr-3">NPSN</th>
                          <th className="py-3 pr-3">Nama Lembaga</th>
                          <th className="py-3 pr-3">Jenjang</th>
                          <th className="py-3 pr-3">Kecamatan</th>
                          <th className="py-3 pr-3">Kepala Madrasah</th>
                          <th className="py-3 text-right">Profil</th>
                        </>
                      )}
                      {activeTab === 'gtk' && (
                        <>
                          <th className="py-3 pr-3">Nama Lengkap</th>
                          <th className="py-3 pr-3">NIP / NIK</th>
                          <th className="py-3 pr-3">Status</th>
                          <th className="py-3 pr-3">Satuan Pendidikan</th>
                          <th className="py-3 text-right">Detail</th>
                        </>
                      )}
                      {activeTab === 'kesiswaan' && (
                        <>
                          <th className="py-3 pr-3">NISN</th>
                          <th className="py-3 pr-3">Nama Siswa</th>
                          <th className="py-3 pr-3">Jenjang</th>
                          <th className="py-3 pr-3">Madrasah</th>
                          <th className="py-3 text-right">Detail</th>
                        </>
                      )}
                      {activeTab === 'berkas_sk' && (
                        <>
                          <th className="py-3 pr-3">Nomor / Judul SK</th>
                          <th className="py-3 pr-3">Lembaga</th>
                          <th className="py-3 pr-3">Keterangan</th>
                          <th className="py-3 text-right">Detail</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableRows.map((row, idx) => (
                      <tr key={row.id || idx} className="hover:bg-slate-50/80">
                        {activeTab === 'kelembagaan' && (
                          <>
                            <td className="py-3.5 pr-3 font-mono text-xs">{row.nsm}</td>
                            <td className="py-3.5 pr-3 font-mono text-xs">{row.npsn}</td>
                            <td className="py-3.5 pr-3 font-semibold text-slate-900">
                              {row.nama_lembaga}
                            </td>
                            <td className="py-3.5 pr-3">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                                {row.jenjang}
                              </span>
                            </td>
                            <td className="py-3.5 pr-3">{row.kecamatan}</td>
                            <td className="py-3.5 pr-3">{row.kepala_madrasah}</td>
                            <td className="py-3.5 text-right">
                              <button
                                onClick={() => setSelectedDetail(row)}
                                className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 cursor-pointer"
                              >
                                Detail
                              </button>
                            </td>
                          </>
                        )}
                        {activeTab === 'gtk' && (
                          <>
                            <td className="py-3.5 pr-3 font-semibold text-slate-900">
                              {row.nama_lengkap}
                            </td>
                            <td className="py-3.5 pr-3 font-mono text-xs">{row.nip_nik}</td>
                            <td className="py-3.5 pr-3">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                                {row.status_kepegawaian}
                              </span>
                            </td>
                            <td className="py-3.5 pr-3">{row.nama_madrasah}</td>
                            <td className="py-3.5 text-right">
                              <button
                                onClick={() => setSelectedDetail(row)}
                                className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-medium hover:bg-emerald-50 cursor-pointer"
                              >
                                Detail
                              </button>
                            </td>
                          </>
                        )}
                        {activeTab === 'kesiswaan' && (
                          <>
                            <td className="py-3.5 pr-3 font-mono text-xs">{row.nisn}</td>
                            <td className="py-3.5 pr-3 font-semibold text-slate-900">
                              {row.nama_lengkap}
                            </td>
                            <td className="py-3.5 pr-3">{row.jenjang}</td>
                            <td className="py-3.5 pr-3">{row.nama_sekolah}</td>
                            <td className="py-3.5 text-right">
                              <button
                                onClick={() => setSelectedDetail(row)}
                                className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-medium hover:bg-emerald-50 cursor-pointer"
                              >
                                Detail
                              </button>
                            </td>
                          </>
                        )}
                        {activeTab === 'berkas_sk' && (
                          <>
                            <td className="py-3.5 pr-3 font-semibold text-slate-900">
                              {row.nomor_sk || row.judul_sk || `Berkas #${row.id}`}
                            </td>
                            <td className="py-3.5 pr-3">{row.nama_lembaga || '-'}</td>
                            <td className="py-3.5 pr-3">{row.keterangan || '-'}</td>
                            <td className="py-3.5 text-right">
                              <button
                                onClick={() => setSelectedDetail(row)}
                                className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-medium hover:bg-emerald-50 cursor-pointer"
                              >
                                Detail
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Paginasi */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 text-xs text-slate-600">
              <span>
                Halaman <strong>{page}</strong> dari <strong>{totalPages}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" /> Sebelumnya
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                >
                  Berikutnya <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Modal Inspeksi Detail Record */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Detail Informasi Data
              </h3>
              <button
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              {Object.entries(selectedDetail).map(([key, val]) => (
                <div
                  key={key}
                  className="flex justify-between gap-4 py-1.5 border-b border-slate-50"
                >
                  <span className="font-semibold text-slate-500 uppercase">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-slate-900 text-right font-medium">
                    {val !== null && val !== '' ? String(val) : '-'}
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