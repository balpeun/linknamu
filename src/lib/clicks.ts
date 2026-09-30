import { getMongoClient } from '@/lib/mongodb';

type ClickDoc = {
  _id: string;
  count: number;
  lastClickedAt: Date;
};

// 링크 id별 클릭 수를 1 올린다. MONGODB_URI가 없으면 기록하지 않는다.
export async function recordClick(linkId: string): Promise<void> {
  const client = await getMongoClient();
  if (!client) return;
  await client
    .db(process.env.MONGODB_DB || 'linknamu')
    .collection<ClickDoc>('clicks')
    .updateOne({ _id: linkId }, { $inc: { count: 1 }, $set: { lastClickedAt: new Date() } }, { upsert: true });
}

// 검색 봇·링크 미리보기·프리페치 요청은 실제 클릭이 아니므로 세지 않는다.
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|kakaotalk-scrap|embedly|whatsapp|telegram|discord|skype|curl|wget|headless/i;

export function isRealClick(headers: Headers): boolean {
  if (BOT_UA.test(headers.get('user-agent') || '')) return false;
  const purpose = headers.get('purpose') || headers.get('sec-purpose') || headers.get('x-purpose') || '';
  if (/prefetch|prerender/i.test(purpose)) return false;
  return true;
}
