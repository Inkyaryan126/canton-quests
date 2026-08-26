import { NextResponse } from 'next/server';
import { seedDatabaseDB } from '@/lib/supabase-db';
import { authorizeGameMasterRequest } from '@/lib/admin-auth';

export async function POST(request: Request) {
  // Never reachable in production regardless of admin credentials — this
  // seeds/resets game content and must only ever run in local/dev/test.
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Not available in production.' }, { status: 403 });
  }

  const headersObj: Record<string, string> = {};
  request.headers.forEach((val, key) => {
    headersObj[key] = val;
  });
  const session = authorizeGameMasterRequest(headersObj);
  if (!session.isAdmin) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Game Master administrative authorization required' },
      { status: 401 }
    );
  }

  try {
    const result = await seedDatabaseDB();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Seed execution failed' }, { status: 500 });
  }
}
