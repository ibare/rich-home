import type BetterSqlite3 from 'better-sqlite3'
import type { Migration } from './index'

export const migration004: Migration = {
  version: 4,
  name: 'transaction_include_stats',
  up: (db: BetterSqlite3.Database) => {
    // 거래에 통계 포함 여부 컬럼 추가 (기본값: 1 = 포함)
    db.exec(`
      ALTER TABLE transactions ADD COLUMN include_in_stats INTEGER NOT NULL DEFAULT 1
    `)
  },
}
