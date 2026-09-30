# 링크나무

내 모든 링크를 한 페이지에 모아 두고, 하나의 URL로 공유하는 서비스.

- **프로필**: 이름, 한 줄 소개(160자), 프로필 사진(400px 정사각형으로 자동 축소)
- **링크 카드**: 주소를 넣으면 Instagram·YouTube·X·GitHub·네이버 블로그·티스토리·velog 등 종류를 알아서 배지로 표시
- **클릭 수 집계**: 카드는 `/go/:id`를 거쳐 이동하며, 링크별 전체 클릭 수와 최근 7일 클릭 수를 기록 (검색 봇·링크 미리보기·프리페치 요청은 제외)

외부 패키지 없이 Node.js 내장 기능(`node:http`, `node:sqlite`)만으로 동작합니다.

## 실행

Node.js 22.13 이상이 필요합니다.

```bash
npm start        # http://localhost:3000
npm run dev      # 파일을 고치면 자동 재시작
```

1. `/signup`에서 아이디와 비밀번호로 가입
2. `/dashboard`에서 프로필과 링크 입력
3. `http://주소/아이디`를 SNS 프로필에 걸기

## 환경 변수

| 이름 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `3000` | 서버 포트 |
| `DB_PATH` | `./data/linknamu.db` | SQLite 파일 위치 |
| `NODE_ENV` | | `production`이면 쿠키에 `Secure`를 붙이고 정적 파일을 캐시 |

## 배포

데이터가 SQLite 파일 하나에 저장되므로 **디스크가 유지되는 곳**에 배포해야 합니다. 재배포할 때 디스크가 초기화되는 무료 호스팅에서는 가입 정보와 클릭 수가 사라집니다.

- **Railway**: 저장소 연결 → Volume을 `/data`에 연결 → `DB_PATH=/data/linknamu.db`, `NODE_ENV=production`
- **Render**: Web Service + Persistent Disk(`/data`) → 시작 명령 `npm start`, 위와 같은 환경 변수
- **Fly.io / VPS**: 볼륨을 붙이고 같은 방식으로 `DB_PATH` 지정

HTTPS는 호스팅 쪽 프록시에서 처리합니다. 내 도메인은 호스팅 설정에서 연결하세요.

## 구조

```
server.js          라우팅, 로그인 세션, API, 클릭 집계
db.js              SQLite 스키마 (users, links, clicks, sessions)
views.js           서버에서 그리는 HTML (첫 화면, 가입/로그인, 공개 프로필, 관리 화면 뼈대)
public/style.css   전체 스타일 (라이트/다크 모드, 모바일 대응)
public/dashboard.js 관리 화면 (프로필·사진·링크 편집, 순서 변경, 클릭 수)
```

## 보안

- 비밀번호는 scrypt + 솔트로 저장
- 세션 쿠키는 `HttpOnly`, `SameSite=Lax`. API는 JSON 요청만 받아서 다른 사이트에서 보낸 폼 요청을 막음
- 링크는 `http`/`https` 주소만 허용 (`javascript:` 차단), 모든 출력은 HTML 이스케이프
- 로그인·가입은 IP당 10분에 10회로 제한, CSP 헤더 적용
