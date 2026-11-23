# SIMADU Kemenag Kab. Jember

Aplikasi web SIMADU untuk Kantor Kementerian Agama Kabupaten Jember, dibangun dengan Next.js, Tailwind CSS, dan PostgreSQL.

## Struktur Folder

```
simadu-web/
├── app/
│   ├── api/
│   │   ├── export/route.js   # Ekspor data ke Excel
│   │   ├── login/route.js    # Autentikasi pengguna
│   │   └── simadu/route.js   # Data dashboard & tabel
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx              # Halaman utama (login + dashboard)
├── lib/
│   └── db.js                 # Koneksi PostgreSQL
├── public/
│   └── images/               # Aset gambar
├── .env.example              # Contoh konfigurasi environment
└── package.json
```

## Menjalankan Secara Lokal

1. Install dependency:
   ```bash
   npm install
   ```
2. Salin `.env.example` menjadi `.env.local`, lalu isi `DATABASE_URL`.
3. Jalankan server development:
   ```bash
   npm run dev
   ```
4. Buka [http://localhost:3000](http://localhost:3000).

## Skrip

| Perintah        | Fungsi                     |
| --------------- | -------------------------- |
| `npm run dev`   | Server development         |
| `npm run build` | Build produksi             |
| `npm run start` | Menjalankan hasil build    |
| `npm run lint`  | Pemeriksaan kode (ESLint)  |

## Deploy (otomatis)

Situs: https://simadu-web.vercel.app — project Vercel tersambung ke repo
`kemenagjember-rgb/simadu-web`.

| Commit dibuat di repo | Yang terjadi |
| --- | --- |
| `kemenagjember-rgb/simadu-web` | Vercel langsung men-deploy. |
| `adidunniam05-droid/simadu-web` | GitHub Actions (`.github/workflows/sinkron-deploy.yml`) menyalin commit ke repo kemenagjember-rgb, lalu men-deploy ke Vercel atas nama akun Kemenag Jember. |

Kedua repo harus tetap sama. Sebelum mulai bekerja, tarik dulu perubahan
terbaru (`git pull`). Bila repo kemenagjember-rgb punya commit yang belum
ada di repo adidunniam05-droid, workflow berhenti tanpa men-deploy.

Secret yang dibutuhkan di repo `adidunniam05-droid/simadu-web`
(Settings → Secrets and variables → Actions):

- `SYNC_TOKEN` — token GitHub akun kemenagjember-rgb (fine-grained, repo
  `simadu-web`, izin *Contents: Read and write*).
- `VERCEL_TOKEN` — token Vercel akun Kemenag Jember (Account Settings → Tokens).
