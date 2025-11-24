import type BetterSqlite3 from 'better-sqlite3'
import type { Migration } from './index'

export const migration006: Migration = {
  version: 6,
  name: 'budget_valid_period',
  up: (db: BetterSqlite3.Database) => {
    // 1. 새 테이블 생성 (distributed 타입 추가, valid_from/valid_to 컬럼 추가)
    db.exec(`
      CREATE TABLE budget_items_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        group_name TEXT,
        budget_type TEXT NOT NULL CHECK(budget_type IN ('fixed_monthly', 'variable_monthly', 'distributed')),
        base_amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'KRW',
        memo TEXT,
        valid_from TEXT,
        valid_to TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // 2. 기존 데이터 복사 (annual/quarterly -> distributed 변환)
    const currentYear = new Date().getFullYear()
    const yearStart = `${currentYear}-01-01`
    const yearEnd = `${currentYear}-12-31`

    // 현재 분기 계산
    const currentMonth = new Date().getMonth() + 1
    const quarterStart = currentMonth <= 3 ? 1 : currentMonth <= 6 ? 4 : currentMonth <= 9 ? 7 : 10
    const quarterEnd = quarterStart + 2
    const qStart = `${currentYear}-${String(quarterStart).padStart(2, '0')}-01`
    const lastDayOfQuarter = new Date(currentYear, quarterEnd, 0).getDate()
    const qEnd = `${currentYear}-${String(quarterEnd).padStart(2, '0')}-${String(lastDayOfQuarter).padStart(2, '0')}`

    db.exec(`
      INSERT INTO budget_items_new (id, name, group_name, budget_type, base_amount, currency, memo, valid_from, valid_to, is_active, sort_order, created_at, updated_at)
      SELECT
        id, name, group_name,
        CASE
          WHEN budget_type IN ('annual', 'quarterly') THEN 'distributed'
          ELSE budget_type
        END,
        base_amount, currency, memo,
        CASE
          WHEN budget_type = 'annual' THEN '${yearStart}'
          WHEN budget_type = 'quarterly' THEN '${qStart}'
          ELSE NULL
        END,
        CASE
          WHEN budget_type = 'annual' THEN '${yearEnd}'
          WHEN budget_type = 'quarterly' THEN '${qEnd}'
          ELSE NULL
        END,
        is_active, sort_order, created_at, updated_at
      FROM budget_items
    `)

    // 3. 기존 테이블 삭제
    db.exec(`DROP TABLE budget_items`)

    // 4. 새 테이블 이름 변경
    db.exec(`ALTER TABLE budget_items_new RENAME TO budget_items`)
  },
}
