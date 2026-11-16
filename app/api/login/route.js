import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    const { rows } = await db.query(
      'SELECT id, username, role, nama_lengkap FROM users WHERE username = $1 AND password = $2 LIMIT 1',
      [username, password]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Username atau Password salah!' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}