import { NextResponse } from 'next/server';
import { isRealClick, recordClick } from '@/lib/clicks';
import { profile } from '@/data/profile';

export const dynamic = 'force-dynamic';

// 링크 카드는 이 주소를 거쳐 이동한다. 클릭 수를 남기고 원래 주소로 보낸다.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const link = profile.links.find((l) => l.id === params.id);
  if (!link) return new NextResponse('Not Found', { status: 404 });

  if (isRealClick(request.headers)) {
    try {
      await recordClick(link.id);
    } catch (err) {
      // 집계가 실패해도 사용자는 링크로 이동해야 한다.
      console.error('클릭 수 기록 실패', err);
    }
  }

  const res = NextResponse.redirect(link.url, 302);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
