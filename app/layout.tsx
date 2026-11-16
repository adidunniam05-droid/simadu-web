import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIMADU v4.0 — Sistem Informasi Madrasah dan Data Terpadu",
  description:
    "Pendidikan Madrasah Kantor Kementerian Agama Kabupaten Jember",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F4F7F9] text-slate-900 selection:bg-emerald-700 selection:text-white">
        {children}
      </body>
    </html>
  );
}