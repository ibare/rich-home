# Architecture Review Report — Rich Home

- **검토일**: 2026-04-08
- **버전**: 1.6.4
- **모드**: Strict (코드 직접 확인 기반, 추론 배제)

---

## 프로젝트 개요

- **규모**: 50개 파일, 약 10,913 라인
- **스택**: Electron 39 + React 19 + TypeScript(strict) + MUI 7 + Vite 7 + better-sqlite3 12
- **테스트**: 0건 (테스트 프레임워크 미설치)
- **린팅**: ESLint/Prettier 미설치
- **타입체크**: `tsc --noEmit` 만 존재 (`package.json:21`)

---

## 요약

| 심각도 | 개수 | 감점 |
|---|---|---|
| Critical (-15) | 0 | 0 |
| High (-5) | 9 | -45 |
| Medium (-2) | 12 | -24 |
| Low (-0.5) | 1 | -0.5 |

**Health Score: 31 / 100**

---

## 카테고리별 판정

### D. 의존성 방향

| ID | 항목 | 결과 | 증거 |
|---|---|---|---|
| D-1 | Renderer → Main 단방향 | PASS | `src/main/preload.ts:1-33` contextBridge 단일 경로 |
| D-2 | Main이 Renderer 코드 import 안 함 | PASS | grep 결과 0건 |
| D-3 | shared 타입만 양쪽이 import | PASS | `src/shared/types.ts` 타입 정의만 존재 |
| D-4 | Renderer가 Node API 직접 호출 안 함 | PASS | `nodeIntegration: false`, `contextIsolation: true` (`src/main/index.ts:28-29`) |

### S. 단일 책임

| ID | 항목 | 결과 | 증거 |
|---|---|---|---|
| S-1 | 컴포넌트당 단일 책임 | **HIGH** | `src/renderer/pages/Statistics.tsx` 1684라인 — 월간/연간 탭 통합, 5종 차트, 11개 SQL |
| S-2 | 함수당 단일 책임 | **HIGH** | `Statistics.tsx:485-652` `loadMonthlyStatsData` 168라인, `Dashboard.tsx:99-277` `loadDashboardData` 178라인, `Transactions.tsx:355-504` `generateDistributedTransactions` 150라인 |
| S-3 | 모달/다이얼로그 분리 | **HIGH** | `src/renderer/components/modals/TransactionModal.tsx` 660라인 — UI + SQL UPDATE/INSERT 직접 수행 (`:278, :317`) |
| S-4 | 데이터 액세스 분리 | **HIGH** | repository/service 레이어 부재 — 페이지가 직접 `window.electronAPI.db` 호출 (전 페이지 공통) |
| S-5 | 페이지 컴포넌트 사이즈 | **MEDIUM** | `Statistics.tsx` 1684, `Transactions.tsx` 917, `TransactionModal.tsx` 660, `Dashboard.tsx` 559 |

### R. 공유 자원

| ID | 항목 | 결과 | 증거 |
|---|---|---|---|
| R-1 | DB 싱글톤 | PASS | `src/main/database.ts:10` `let db: ... \| null = null`, `:99` 단일 `new Database()` |
| R-2 | DB 트랜잭션 사용 | **MEDIUM** | `src/main/migrations/index.ts:80-87`만 사용, 비즈니스 로직(자동거래 생성, 잔고 변경)은 미사용 |
| R-3 | 마이그레이션 원자성 | PASS | `db.transaction(() => {...})()` 패턴 |
| R-4 | 환율 등 공유 상수 단일 출처 | **HIGH** | `Dashboard.tsx:86,116`는 fallback `370`, 그 외 페이지는 `385` — 데이터 불일치 |

### E. 에러 처리

| ID | 항목 | 결과 | 증거 |
|---|---|---|---|
| E-1 | 에러를 swallow하지 않음 | **HIGH** | `database.ts:40-43, 46-53, 150-159, 186-188` console.error 후 무반응. Renderer 페이지는 `catch + console.error + alert` 반복 |
| E-2 | Promise rejection 처리 | **MEDIUM** | `main/index.ts:79-91, 93-105` auto-updater `.then()` 체인에 `.catch()` 없음 |
| E-3 | 에러 메시지 사용자에게 노출 | **MEDIUM** | 원시 alert로 기술 메시지 노출 |
| E-4 | 에러 경계(Error Boundary) | **MEDIUM** | React ErrorBoundary 미존재 |
| E-5 | IPC 에러 채널 설계 | **MEDIUM** | `ipcMain.handle('db:query')`이 raw SQL을 그대로 throw — 호출자가 분기 불가 |

### H. 하드코딩

| ID | 항목 | 결과 | 증거 |
|---|---|---|---|
| H-1 | 환율 fallback 단일 값 | **HIGH** | `Dashboard.tsx:86,116` `370` vs 그 외 `385` |
| H-2 | 색상 팔레트 분산 | **MEDIUM** | `Statistics.tsx:96-100` `CATEGORY_COLORS`, `Dashboard.tsx:324,339,354,369,385,393,462,463` 인라인 hex |
| H-3 | localStorage 키 문자열 | **MEDIUM** | `Transactions.tsx:65,76,80,86,87,92` 직접 키 문자열 — 상수화 안 됨 |
| H-4 | 환경 분기 직접 사용 | **LOW** | `main/index.ts:8`, `database.ts:22` `process.env.NODE_ENV` 직접 |

### A. API 설계

| ID | 항목 | 결과 | 증거 |
|---|---|---|---|
| A-1 | IPC 채널 명명 일관성 | PASS | `db:*`, `app:*` 네임스페이스 |
| A-2 | 입력 검증 | **HIGH** | `main/index.ts:118-131` `db:query` 핸들러가 임의 SQL 실행 — Renderer에 무제한 권한 위임 |
| A-3 | 타입 안전 IPC | **HIGH** | `db.query<T>` 의 `T`가 호출자 측 단언, 서버 측 검증 없음 — 데이터 액세스 레이어 부재의 직접 결과 |
| A-4 | 페이지네이션/리미트 | **MEDIUM** | 거래 목록 SELECT에 LIMIT 없음 (`Transactions.tsx`) |
| A-5 | 매직 문자열 키 | **MEDIUM** | settings 키 문자열(`aed_to_krw_rate` 등) 상수화 안 됨 |

### T. 테스트

| ID | 항목 | 결과 | 증거 |
|---|---|---|---|
| T-1 | 단위 테스트 존재 | **HIGH** | 0건, 프레임워크 미설치 |
| T-2 | 마이그레이션 테스트 | **MEDIUM** | 0건 |
| T-3 | E2E 테스트 | **MEDIUM** | 0건 |
| T-4 | 타입체크 강제 | PASS | `tsconfig.json` strict + noUnused* 활성, `npm run typecheck` 존재 |

### SEC. 보안

| ID | 항목 | 결과 | 증거 |
|---|---|---|---|
| SEC-1 | contextIsolation/nodeIntegration | PASS | `main/index.ts:28-29` |
| SEC-2 | SQL Injection 방지 | PASS | grep 결과 모든 쿼리 파라미터화 |
| SEC-3 | .env 비추적 | PASS | `.gitignore`에 등재, `git ls-files .env` 빈 결과 |
| SEC-4 | 시크릿 평문 노출 | **HIGH** | `.env`에 `GH_TOKEN=ghp_...` 평문 — 회전 필요 |

---

## 핵심 위반 심층 분석

### 1. 데이터 액세스 레이어 부재 (S-4, A-3, R-4 결합)

**증거**: 모든 페이지가 `window.electronAPI.db.query('SELECT ...')` 형태로 SQL 직접 작성. 동일 쿼리가 페이지마다 중복.

**파급효과**:
- 환율 fallback 불일치(`370` vs `385`)는 같은 로직이 5곳 이상에 흩어진 결과
- 카테고리 색상 매핑이 컴포넌트마다 재정의됨
- 스키마 변경 시 영향 범위가 grep으로만 추적 가능

**조치**: `src/renderer/data/` 하위에 `transactionRepository.ts`, `accountRepository.ts`, `budgetRepository.ts`, `settingsRepository.ts` 도입. 페이지는 SQL을 알지 못함.

### 2. 거대 컴포넌트 (S-1, S-2, S-3)

| 파일 | 라인 | 분리 권고 |
|---|---|---|
| `Statistics.tsx` | 1684 | `MonthlyStatistics.tsx`, `YearlyStatistics.tsx`, `CategoryTreemap.tsx` |
| `Transactions.tsx` | 917 | `TransactionList.tsx` + `useAutoTransactionGenerator.ts` 훅 |
| `TransactionModal.tsx` | 660 | UI와 영속화 분리, 폼 상태는 `useTransactionForm.ts` |
| `Dashboard.tsx` | 559 | 위젯 단위 분리(`BudgetSummaryCard`, `RecentTransactionsCard` 등) |

### 3. 에러 swallow 패턴 (E-1)

```typescript
// database.ts:40-43
} catch (error) {
  console.error('Failed to load settings:', error)
  // 에러 무시
}
```

호출자는 정상/실패를 구분할 수 없음. 빈 결과와 실패가 동일하게 보임 → 사용자에게 데이터 손실 가능성.

### 4. 환율 fallback 불일치 (H-1, R-4)

- `Dashboard.tsx:86, 116`: `370`
- `Statistics.tsx:110, 184`, `Transactions.tsx:61`, `Settings.tsx:74`, `Budget.tsx`: `385`

대시보드와 통계 페이지 합계가 미세하게 다를 수 있음. **이 차이는 사용자가 인지하지만 원인을 추적하지 못한다.**

### 5. 테스트 0건 (T-1)

마이그레이션·환율 변환·자동거래 생성 같은 금융 로직에 회귀 안전망이 전무함. 1.6.3, 1.6.4 연속 핫픽스는 그 결과의 표면 징후.

### 6. `db:query` IPC가 무한 권한 위임 (A-2)

```typescript
// src/main/index.ts:118-131
ipcMain.handle('db:query', async (_event, sql: string, params?: unknown[]) => {
  const stmt = db.prepare(sql)
  ...
})
```

Renderer가 임의 SQL을 실행할 수 있음. Electron 보안 관행상 IPC는 도메인 의도를 표현해야 함(`transactions:listByMonth(year, month)` 식).

---

## 우선순위별 조치 계획

| # | 작업 | 기대효과 | 위반 해소 |
|---|---|---|---|
| 1 | `.env`의 `GH_TOKEN` 회전 | 시크릿 노출 차단 | SEC-4 |
| 2 | 환율 fallback을 단일 상수(`DEFAULT_AED_TO_KRW_RATE = 385`)로 통일, `Dashboard.tsx` 수정 | 합계 일치 | H-1, R-4 |
| 3 | `useExchangeRate()` 훅 도입 | 환율 로딩 코드 5곳 → 1곳 | H-1, R-4, S-4 |
| 4 | `src/renderer/data/` 도메인 리포지토리 도입 | SQL 분산 제거 | S-4, A-3 |
| 5 | `Statistics.tsx` 월간/연간 탭 분리 | 단일 파일 1684 → 약 500×3 | S-1, S-2 |
| 6 | `TransactionModal.tsx`에서 SQL 제거, 리포지토리 호출로 대체 | 모달 단일 책임 회복 | S-3 |
| 7 | `db:query` raw IPC 폐기, 도메인 IPC(`transactions:list`, `accounts:upsert`)로 교체 | 권한 최소화, 타입 안전 | A-2, A-3, E-5 |
| 8 | Vitest + React Testing Library 도입, 환율 변환 로직부터 테스트 작성 | 회귀 방지 | T-1, T-2 |
| 9 | 에러 코드 enum + ErrorBoundary 도입, alert 제거 | 사용자 경험 + 디버깅 | E-1, E-3, E-4 |
| 10 | ESLint + Prettier + `eslint-plugin-react-hooks` 도입 | 자동 가드레일 | (예방) |

---

## 결론

**Health Score 31점**의 주요 원인은 한 가지로 수렴한다: **데이터 액세스 레이어가 없어 SQL과 비즈니스 로직이 페이지 컴포넌트로 누출되어 있다.** 이 단일 결함이 컴포넌트 비대화(S-1~S-3), 환율 불일치(H-1, R-4), IPC 권한 과다(A-2, A-3), 에러 처리 일관성 부재(E-1)를 동시에 유발한다.

**`useExchangeRate()` 훅 + 도메인 리포지토리 4개 도입만으로 식별된 위반의 절반 이상이 해소된다.** 이것이 가장 비용 대비 효과가 큰 단일 리팩터링이며, 우선순위 #3~#4가 진입점이다.
