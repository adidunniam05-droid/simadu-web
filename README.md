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
