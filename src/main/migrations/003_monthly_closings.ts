import type BetterSqlite3 from 'better-sqlite3'
import type { Migration } from './index'

export const migration003: Migration = {
  version: 3,
  name: 'monthly_closings',
  up: (db: BetterSqlite3.Database) => {
    // 월 마감 테이블
    db.exec(`
      CREATE TABLE IF NOT EXISTS monthly_closings (
        id TEXT PRIMARY KEY,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        total_income REAL NOT NULL DEFAULT 0,
        total_expense REAL NOT NULL DEFAULT 0,
        total_budget REAL DEFAULT NULL,
        net_amount REAL NOT NULL DEFAULT 0,
        memo TEXT,
        closed_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(year, month)
      )
    `)

    // 월 마감 카테고리별 상세 테이블
    db.exec(`
      CREATE TABLE IF NOT EXISTS monthly_closing_details (
        id TEXT PRIMARY KEY,
        closing_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        category_name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount REAL NOT NULL DEFAULT 0,
        budget_amount REAL DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (closing_id) REFERENCES monthly_closings(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )
    `)

    // 인덱스
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_monthly_closings_year_month
      ON monthly_closings(year, month)
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_monthly_closing_details_closing_id
      ON monthly_closing_details(closing_id)
    `)
  },
}
