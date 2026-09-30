export type Platform = {
  name: string;
  abbr: string;
  kind: 'sns' | 'dev' | 'blog' | 'web';
  host: string;
};

// 주소로 SNS·블로그 종류를 알아내 카드 배지에 표시한다. [호스트 패턴, 이름, 약칭, 분류]
const PLATFORMS: [RegExp, string, string, Platform['kind']][] = [
  [/(^|\.)instagram\.com$/, 'Instagram', 'IG', 'sns'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube', 'YT', 'sns'],
  [/(^|\.)(x\.com|twitter\.com)$/, 'X', 'X', 'sns'],
  [/(^|\.)threads\.(net|com)$/, 'Threads', 'TH', 'sns'],
  [/(^|\.)tiktok\.com$/, 'TikTok', 'TT', 'sns'],
  [/(^|\.)facebook\.com$/, 'Facebook', 'FB', 'sns'],
  [/(^|\.)linkedin\.com$/, 'LinkedIn', 'in', 'sns'],
  [/(^|\.)github\.com$/, 'GitHub', 'GH', 'dev'],
  [/(^|\.)gitlab\.com$/, 'GitLab', 'GL', 'dev'],
  [/(^|\.)blog\.naver\.com$/, '네이버 블로그', 'N', 'blog'],
  [/(^|\.)tistory\.com$/, '티스토리', 'T', 'blog'],
  [/(^|\.)velog\.io$/, 'velog', 'V', 'blog'],
  [/(^|\.)brunch\.co\.kr$/, '브런치', 'B', 'blog'],
  [/(^|\.)medium\.com$/, 'Medium', 'M', 'blog'],
  [/(^|\.)substack\.com$/, 'Substack', 'S', 'blog'],
];

export function platformOf(url: string): Platform {
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {}
  for (const [re, name, abbr, kind] of PLATFORMS) {
    if (re.test(host)) return { name, abbr, kind, host };
  }
  return { name: '웹사이트', abbr: (host[0] || '↗').toUpperCase(), kind: 'web', host };
}
