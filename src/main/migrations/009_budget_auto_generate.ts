import type BetterSqlite3 from 'better-sqlite3'
import type { Migration } from './index'

export const migration009: Migration = {
  version: 9,
  name: 'budget_auto_generate',
  up: (db: BetterSqlite3.Database) => {
    // 고정 예산 자동 생성 플래그 추가 (기본값: false)
    db.exec(`
      ALTER TABLE budget_items ADD COLUMN auto_generate INTEGER NOT NULL DEFAULT 0
    `)
  },
}
