import type BetterSqlite3 from 'better-sqlite3'
import type { Migration } from './index'

export const migration011: Migration = {
  version: 11,
  name: 'remove_budget_type',
  up: (db: BetterSqlite3.Database) => {
    // budget_type에 CHECK 제약조건이 있어 DROP COLUMN 불가 → 테이블 재생성
    // foreign_keys = OFF 상태에서 실행됨 (database.ts에서 보장)
    db.exec(`
      CREATE TABLE budget_items_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        group_name TEXT,
        base_amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'KRW',
        memo TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    db.exec(`
      INSERT INTO budget_items_new (id, name, group_name, base_amount, currency, memo, is_active, sort_order, created_at, updated_at)
      SELECT id, name, group_name, base_amount, currency, memo, is_active, sort_order, created_at, updated_at
      FROM budget_items
    `)

    db.exec(`DROP TABLE budget_items`)
    db.exec(`ALTER TABLE budget_items_new RENAME TO budget_items`)
  },
}
