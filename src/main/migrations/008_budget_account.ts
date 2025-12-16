import type BetterSqlite3 from 'better-sqlite3'
import type { Migration } from './index'

export const migration008: Migration = {
  version: 8,
  name: 'budget_account',
  up: (db: BetterSqlite3.Database) => {
    // 예산 항목에 계좌 연결 컬럼 추가
    db.exec(`
      ALTER TABLE budget_items ADD COLUMN account_id TEXT REFERENCES accounts(id)
    `)
  },
}
