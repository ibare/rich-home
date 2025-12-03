import type BetterSqlite3 from 'better-sqlite3'
import type { Migration } from './index'

export const migration007: Migration = {
  version: 7,
  name: 'transaction_tag',
  up: (db: BetterSqlite3.Database) => {
    // 거래에 태그 컬럼 추가
    db.exec(`
      ALTER TABLE transactions ADD COLUMN tag TEXT DEFAULT ''
    `)
  },
}
