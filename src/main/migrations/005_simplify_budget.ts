import type BetterSqlite3 from 'better-sqlite3'
import type { Migration } from './index'

export const migration005: Migration = {
  version: 5,
  name: 'simplify_budget',
  up: (db: BetterSqlite3.Database) => {
    // 1. budget_items에 group_name 컬럼 추가
    db.exec(`
      ALTER TABLE budget_items ADD COLUMN group_name TEXT
    `)

    // 2. monthly_budgets 테이블 삭제
    db.exec(`DROP TABLE IF EXISTS monthly_budgets`)

    // 3. monthly_closings 관련 테이블 삭제
    db.exec(`DROP TABLE IF EXISTS monthly_closing_details`)
    db.exec(`DROP TABLE IF EXISTS monthly_closings`)

    // 4. 인덱스 정리
    db.exec(`DROP INDEX IF EXISTS idx_monthly_budgets_year_month`)
    db.exec(`DROP INDEX IF EXISTS idx_monthly_closings_year_month`)
    db.exec(`DROP INDEX IF EXISTS idx_monthly_closing_details_closing_id`)
  },
}
