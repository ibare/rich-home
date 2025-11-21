import * as path from 'path'
import { app } from 'electron'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3')

import type BetterSqlite3 from 'better-sqlite3'

let db: BetterSqlite3.Database | null = null

export function getDatabase(): BetterSqlite3.Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'rich-home.db')

  console.log('Database path:', dbPath)

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables()
}

function createTables(): void {
  if (!db) return

  // 계좌/자산 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('bank', 'cash', 'card', 'investment', 'other')),
      balance INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'KRW',
      color TEXT,
      icon TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // 카테고리 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      parent_id TEXT REFERENCES categories(id),
      color TEXT,
      icon TEXT,
      budget_amount INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // 거래 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
      amount INTEGER NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      to_account_id TEXT REFERENCES accounts(id),
      category_id TEXT REFERENCES categories(id),
      description TEXT,
      memo TEXT,
      date TEXT NOT NULL,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurring_id TEXT REFERENCES recurring_transactions(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // 태그 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // 거래-태그 연결 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS transaction_tags (
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (transaction_id, tag_id)
    )
  `)

  // 반복 거래 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer')),
      amount INTEGER NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      to_account_id TEXT REFERENCES accounts(id),
      category_id TEXT REFERENCES categories(id),
      description TEXT,
      frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
      interval_value INTEGER NOT NULL DEFAULT 1,
      start_date TEXT NOT NULL,
      end_date TEXT,
      next_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // 예산 테이블
  db.exec(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      category_id TEXT REFERENCES categories(id),
      amount INTEGER NOT NULL,
      period TEXT NOT NULL CHECK(period IN ('monthly', 'yearly')),
      year INTEGER NOT NULL,
      month INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // 인덱스 생성
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
  `)

  // 기본 데이터 삽입 (없을 경우만)
  insertDefaultData()
}

function insertDefaultData(): void {
  if (!db) return

  const accountCount = db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number }

  if (accountCount.count === 0) {
    // 기본 계좌
    db.prepare(`
      INSERT INTO accounts (id, name, type, balance, color, icon)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('default-cash', '현금', 'cash', 0, '#4CAF50', 'wallet')

    db.prepare(`
      INSERT INTO accounts (id, name, type, balance, color, icon)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('default-bank', '주거래 은행', 'bank', 0, '#2196F3', 'account_balance')
  }

  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }

  if (categoryCount.count === 0) {
    // 기본 지출 카테고리
    const expenseCategories = [
      { id: 'exp-food', name: '식비', color: '#FF5722', icon: 'restaurant' },
      { id: 'exp-transport', name: '교통', color: '#3F51B5', icon: 'directions_car' },
      { id: 'exp-housing', name: '주거', color: '#795548', icon: 'home' },
      { id: 'exp-utilities', name: '공과금', color: '#607D8B', icon: 'receipt' },
      { id: 'exp-health', name: '의료/건강', color: '#E91E63', icon: 'local_hospital' },
      { id: 'exp-shopping', name: '쇼핑', color: '#9C27B0', icon: 'shopping_bag' },
      { id: 'exp-leisure', name: '여가/문화', color: '#00BCD4', icon: 'sports_esports' },
      { id: 'exp-education', name: '교육', color: '#8BC34A', icon: 'school' },
      { id: 'exp-other', name: '기타 지출', color: '#9E9E9E', icon: 'more_horiz' },
    ]

    // 기본 수입 카테고리
    const incomeCategories = [
      { id: 'inc-salary', name: '급여', color: '#4CAF50', icon: 'work' },
      { id: 'inc-bonus', name: '보너스', color: '#8BC34A', icon: 'card_giftcard' },
      { id: 'inc-investment', name: '투자수익', color: '#FF9800', icon: 'trending_up' },
      { id: 'inc-other', name: '기타 수입', color: '#9E9E9E', icon: 'more_horiz' },
    ]

    const insertCategory = db.prepare(`
      INSERT INTO categories (id, name, type, color, icon, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    expenseCategories.forEach((cat, idx) => {
      insertCategory.run(cat.id, cat.name, 'expense', cat.color, cat.icon, idx)
    })

    incomeCategories.forEach((cat, idx) => {
      insertCategory.run(cat.id, cat.name, 'income', cat.color, cat.icon, idx)
    })
  }
}
