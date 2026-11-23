import { NextResponse } from 'next/server';
import { getSessionUser, unauthorized } from '@/lib/session';

// Dipakai halaman saat dimuat: apakah masih ada sesi login yang sah?
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json({ user });
}
