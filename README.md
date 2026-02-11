# Rich Home

개인 재산 관리 가계부 데스크톱 애플리케이션. 수입/지출 추적, 예산 관리, 자산/부채 관리, 통계 분석을 지원하며 다중 통화(KRW/AED)를 처리한다.

## 기술 스택

- **Framework**: Electron 39 (main + renderer 프로세스)
- **Frontend**: React 19 + TypeScript
- **UI**: MUI v7, @mui/x-data-grid, @tabler/icons-react
- **Charts**: Recharts
- **Database**: SQLite (better-sqlite3)
- **Bundler**: Vite (renderer), tsc (main process)
- **Routing**: react-router-dom (HashRouter)

## 개발 환경 설정

```bash
# 의존성 설치
npm install

# native 모듈 리빌드 (better-sqlite3)
npm run rebuild

# 개발 서버 실행
npm run dev
```

`npm run dev`는 renderer(Vite dev server, port 5200), main process(tsc --watch), Electron을 동시에 실행한다.

## 빌드 및 배포

```bash
# 전체 빌드 (renderer + main)
npm run build

# 개별 빌드
npm run build:renderer   # Vite 빌드
npm run build:main       # TypeScript 컴파일

# 패키징
npm run package          # 현재 플랫폼
npm run package:mac      # macOS (dmg, zip)
npm run package:win      # Windows (nsis, zip)

# 발행 (GitHub Releases)
npm run publish:mac      # macOS 발행
npm run publish:win      # Windows 발행
```

### 발행 설정

발행 시 `.env` 파일에 다음 환경변수가 필요하다:

| 변수 | 설명 |
|------|------|
| `GH_TOKEN` | GitHub Personal Access Token (releases 권한) |
| `CSC_NAME` | macOS 코드 사이닝 인증서 이름 |

electron-builder 설정 (`package.json`의 `build` 필드):
- **publish**: GitHub Releases (`ibare/rich-home`)
- **mac**: dmg, zip 타겟 / `build/icon.icns`
- **win**: nsis, zip 타겟 / `build/icon.ico`
- **extraResources**: `data/rich-home.db` (기본 DB 번들)

### 자동 업데이트

electron-updater를 사용하며 GitHub Releases에서 `latest-mac.yml` / `latest.yml`을 참조하여 업데이트를 감지한다.

## 프로젝트 구조

```
src/
├── main/                        # Electron main process
│   ├── index.ts                 # IPC 핸들러, 윈도우 생성, auto-update
│   ├── database.ts              # SQLite 초기화, DB 경로 관리
│   ├── preload.ts               # contextBridge (renderer↔main IPC)
│   └── migrations/              # DB 스키마 마이그레이션
│       ├── index.ts             # 마이그레이션 러너
│       └── 001~011_*.ts         # 개별 마이그레이션
│
├── renderer/                    # React 프론트엔드 (Vite)
│   ├── App.tsx                  # 라우팅 설정
│   ├── main.tsx                 # React 엔트리
│   ├── theme.ts                 # MUI 테마
│   ├── pages/                   # 페이지 컴포넌트
│   │   ├── Dashboard.tsx        # 대시보드
│   │   ├── Transactions.tsx     # 거래 내역
│   │   ├── Budget.tsx           # 예산 관리
│   │   ├── AutoTransactions.tsx # 자동 거래 생성 규칙
│   │   ├── Statistics.tsx       # 통계
│   │   ├── Accounts.tsx         # 계좌 관리
│   │   ├── AccountBalanceHistory.tsx  # 잔고 히스토리
│   │   ├── Assets.tsx           # 자산 관리
│   │   ├── Liabilities.tsx      # 부채 관리
│   │   ├── Categories.tsx       # 카테고리 관리
│   │   └── Settings.tsx         # 설정
│   ├── components/
│   │   ├── layout/              # Sidebar, Header
│   │   ├── modals/              # Dialog 컴포넌트
│   │   └── shared/              # AmountText, MonthNavigation, CategoryPicker 등
│   └── contexts/                # React Context (PageContext)
│
└── shared/                      # 공유 타입 정의
```

## 주요 비즈니스 로직

### 다중 통화 (KRW/AED)

- settings 테이블의 `exchange_rate` 키에 환율 저장 (기본값 385)
- 모든 금액 합산은 KRW 기준으로 변환하여 계산

```typescript
const totalKRW = items.reduce((sum, item) => {
  return sum + (item.currency === 'AED' ? item.amount * exchangeRate : item.amount)
}, 0)
```

### 예산 시스템

예산 항목에 카테고리를 연결하여 월별 지출을 추적한다.

- `budget_item_categories` 테이블로 예산 항목과 카테고리를 M:N 매핑
- `group_name`으로 예산 항목을 그룹화하여 합산 지출 추적
- 거래내역 페이지에서 예산별 지출 카드로 실시간 현황 확인

### 자동 거래 생성 규칙

예산과 분리된 독립 테이블(`auto_transaction_rules`)로 자동 거래 생성을 관리한다.

| 규칙 유형 | 설명 |
|-----------|------|
| `distributed` | 분배: `base_amount`를 `valid_from`~`valid_to` 기간의 월수로 나누어 매월 거래 생성 |
| `fixed_monthly` | 월 자동 생성: 매월 동일 금액으로 거래 생성, 계좌 연결 시 잔고 자동 합산 |

- 거래내역 페이지의 "자동 거래 생성" 버튼으로 실행 (description 기반 중복 방지)
- 규칙별 상태 표시: 정상 / 기간만료 / 미완성(카테고리 미연결)

### 거래 내역

- `type`: income(수입) / expense(지출)
- `include_in_stats`: 통계 포함 여부 (기본값 1, 0이면 통계에서 제외)
- `tag`: 콤마 구분 문자열로 태그 저장
- 자동 거래 생성 시 계좌 잔고를 자동 갱신

### 계좌 & 잔고

- `owner`: self / spouse / child
- `type`: regular / cma / savings / checking / other
- `account_balances`: 특정 시점의 잔고 스냅샷 기록
- 최신 잔고 조회: `ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY recorded_at DESC)`

### 자산 & 부채

- **자산**: real_estate(부동산), stock(주식) — 가치 = `purchase_amount × quantity`
- **부채**: mortgage, credit_loan, jeonse_deposit, car_loan, other
- **순자산** = 계좌 잔고 합계 + 자산 합계 - 부채 합계 (모두 KRW 환산)

## 데이터베이스

SQLite (better-sqlite3)를 사용하며, WAL 모드와 foreign_keys를 활성화한다.

### DB 경로

- **개발**: 프로젝트 루트의 `data/rich-home.db`
- **프로덕션**: 최초 실행 시 `resources/data/rich-home.db`를 사용자 데이터 디렉토리로 복사
- 설정에서 커스텀 DB 경로를 지정할 수 있음

### 마이그레이션

`src/main/migrations/`에 마이그레이션 파일이 위치하며, 앱 시작 시 `schema_migrations` 테이블을 기준으로 미적용 마이그레이션을 자동 실행한다.

새 마이그레이션 추가:

1. `src/main/migrations/0XX_description.ts` 파일 생성
2. `Migration` 인터페이스(`version`, `name`, `up`)를 구현하여 export
3. `src/main/migrations/index.ts`의 `migrations` 배열에 추가

```typescript
// src/main/migrations/010_example.ts
import type BetterSqlite3 from 'better-sqlite3'
import type { Migration } from './index'

export const migration010: Migration = {
  version: 10,
  name: 'example_migration',
  up: (db: BetterSqlite3.Database) => {
    db.exec(`ALTER TABLE ... `)
  },
}
```

### 주요 테이블

| 테이블 | 설명 |
|--------|------|
| `accounts` | 은행 계좌 (소유자, 유형, 통화) |
| `account_balances` | 계좌 잔고 히스토리 스냅샷 |
| `transactions` | 수입/지출 거래 내역 |
| `categories` | 수입/지출 카테고리 (expense_type: fixed/variable) |
| `budget_items` | 예산 항목 (이름, 금액, 통화) |
| `budget_item_categories` | 예산-카테고리 M:N 매핑 |
| `auto_transaction_rules` | 자동 거래 생성 규칙 (분배/월 자동 생성) |
| `assets` | 자산 (부동산, 주식) |
| `liabilities` | 부채 (대출, 전세보증금 등) |
| `settings` | 키-값 설정 (환율 등) |
| `schema_migrations` | 마이그레이션 이력 |

## IPC 통신

Electron의 `contextBridge`를 통해 renderer에서 main process의 DB에 접근한다.

```typescript
// renderer에서 사용
await window.electronAPI.db.query(sql, params)  // SELECT → array, INSERT/UPDATE/DELETE → run result
await window.electronAPI.db.get(sql, params)    // 단일 행 조회
await window.electronAPI.db.getPath()           // 현재 DB 경로 조회
await window.electronAPI.app.restart()          // 앱 재시작
```
