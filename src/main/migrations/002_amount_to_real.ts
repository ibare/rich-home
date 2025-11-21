import type BetterSqlite3 from 'better-sqlite3'
import type { Migration } from './index'

export const migration002: Migration = {
  version: 2,
  name: 'amount_to_real',
  up: (db: BetterSqlite3.Database) => {
    // AED 소수점 지원을 위해 금액 컬럼을 INTEGER에서 REAL로 변경

    // 1. account_balances 테이블
    db.exec(`
      CREATE TABLE account_balances_new (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        balance REAL NOT NULL,
        recorded_at TEXT NOT NULL,
        memo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.exec(`INSERT INTO account_balances_new SELECT * FROM account_balances`)
    db.exec(`DROP TABLE account_balances`)
    db.exec(`ALTER TABLE account_balances_new RENAME TO account_balances`)
    db.exec(`CREATE INDEX idx_account_balances_account ON account_balances(account_id)`)
    db.exec(`CREATE INDEX idx_account_balances_date ON account_balances(recorded_at)`)

    // 2. assets 테이블
    db.exec(`
      CREATE TABLE assets_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('real_estate', 'stock')),
        purchase_amount REAL NOT NULL,
        purchase_date TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        currency TEXT NOT NULL CHECK(currency IN ('KRW', 'AED')) DEFAULT 'KRW',
        memo TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.exec(`INSERT INTO assets_new SELECT * FROM assets`)
    db.exec(`DROP TABLE assets`)
    db.exec(`ALTER TABLE assets_new RENAME TO assets`)

    // 3. transactions 테이블
    db.exec(`
      CREATE TABLE transactions_new (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount REAL NOT NULL,
        currency TEXT NOT NULL CHECK(currency IN ('KRW', 'AED')) DEFAULT 'KRW',
        category_id TEXT NOT NULL REFERENCES categories(id),
        date TEXT NOT NULL,
        description TEXT,
        memo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.exec(`INSERT INTO transactions_new SELECT * FROM transactions`)
    db.exec(`DROP TABLE transactions`)
    db.exec(`ALTER TABLE transactions_new RENAME TO transactions`)
    db.exec(`CREATE INDEX idx_transactions_date ON transactions(date)`)
    db.exec(`CREATE INDEX idx_transactions_category ON transactions(category_id)`)
    db.exec(`CREATE INDEX idx_transactions_type ON transactions(type)`)

    // 4. budget_items 테이블
    db.exec(`
      CREATE TABLE budget_items_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        budget_type TEXT NOT NULL CHECK(budget_type IN ('fixed_monthly', 'variable_monthly', 'annual', 'quarterly')),
        base_amount REAL NOT NULL,
        currency TEXT NOT NULL CHECK(currency IN ('KRW', 'AED')) DEFAULT 'KRW',
        memo TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.exec(`INSERT INTO budget_items_new SELECT * FROM budget_items`)
    db.exec(`DROP TABLE budget_items`)
    db.exec(`ALTER TABLE budget_items_new RENAME TO budget_items`)

    // 5. monthly_budgets 테이블
    db.exec(`
      CREATE TABLE monthly_budgets_new (
        id TEXT PRIMARY KEY,
        budget_item_id TEXT NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL CHECK(month >= 1 AND month <= 12),
        amount REAL NOT NULL,
        is_confirmed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(budget_item_id, year, month)
      )
    `)
    db.exec(`INSERT INTO monthly_budgets_new SELECT * FROM monthly_budgets`)
    db.exec(`DROP TABLE monthly_budgets`)
    db.exec(`ALTER TABLE monthly_budgets_new RENAME TO monthly_budgets`)
    db.exec(`CREATE INDEX idx_monthly_budgets_year_month ON monthly_budgets(year, month)`)

    // 6. liabilities 테이블
    db.exec(`
      CREATE TABLE liabilities_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('mortgage', 'credit_loan', 'jeonse_deposit', 'car_loan', 'other')),
        principal_amount REAL NOT NULL,
        current_balance REAL NOT NULL,
        interest_rate REAL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        currency TEXT NOT NULL CHECK(currency IN ('KRW', 'AED')) DEFAULT 'KRW',
        memo TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.exec(`INSERT INTO liabilities_new SELECT * FROM liabilities`)
    db.exec(`DROP TABLE liabilities`)
    db.exec(`ALTER TABLE liabilities_new RENAME TO liabilities`)
  },
}
