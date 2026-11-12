import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GitHub Actions is the active scheduler. This legacy Vercel endpoint must
// never report a job as accepted because it does not enqueue production work.
export async function POST() {
  return NextResponse.json({
    status: 'not_configured',
    scheduler: 'github-actions',
    message: 'La producción se programa desde GitHub Actions; este endpoint no crea trabajos.',
  }, { status: 501 });
}
