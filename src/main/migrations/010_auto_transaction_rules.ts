import type BetterSqlite3 from 'better-sqlite3'
import type { Migration } from './index'

export const migration010: Migration = {
  version: 10,
  name: 'auto_transaction_rules',
  up: (db: BetterSqlite3.Database) => {
    // 1. auto_transaction_rules 테이블 생성
    db.exec(`
      CREATE TABLE auto_transaction_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rule_type TEXT NOT NULL CHECK(rule_type IN ('distributed', 'fixed_monthly')),
        base_amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'KRW',
        category_id TEXT REFERENCES categories(id),
        account_id TEXT REFERENCES accounts(id),
        valid_from TEXT,
        valid_to TEXT,
        memo TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // 2. distributed 항목 -> 새 테이블로 복사
    db.exec(`
      INSERT INTO auto_transaction_rules (id, name, rule_type, base_amount, currency, category_id, account_id, valid_from, valid_to, memo, is_active, sort_order, created_at, updated_at)
      SELECT
        bi.id,
        bi.name,
        'distributed',
        bi.base_amount,
        bi.currency,
        (SELECT bic.category_id FROM budget_item_categories bic WHERE bic.budget_item_id = bi.id LIMIT 1),
        NULL,
        bi.valid_from,
        bi.valid_to,
        bi.memo,
        bi.is_active,
        bi.sort_order,
        bi.created_at,
        bi.updated_at
      FROM budget_items bi
      WHERE bi.budget_type = 'distributed'
    `)

    // 3. fixed_monthly AND auto_generate=1 항목 -> 새 테이블로 복사
    db.exec(`
      INSERT INTO auto_transaction_rules (id, name, rule_type, base_amount, currency, category_id, account_id, valid_from, valid_to, memo, is_active, sort_order, created_at, updated_at)
      SELECT
        bi.id,
        bi.name,
        'fixed_monthly',
        bi.base_amount,
        bi.currency,
        (SELECT bic.category_id FROM budget_item_categories bic WHERE bic.budget_item_id = bi.id LIMIT 1),
        bi.account_id,
        NULL,
        NULL,
        bi.memo,
        bi.is_active,
        bi.sort_order,
        bi.created_at,
        bi.updated_at
      FROM budget_items bi
      WHERE bi.budget_type = 'fixed_monthly' AND bi.auto_generate = 1
    `)

    // 4. 이동된 항목의 budget_item_categories 삭제
    db.exec(`
      DELETE FROM budget_item_categories
      WHERE budget_item_id IN (
        SELECT id FROM budget_items
        WHERE budget_type = 'distributed'
           OR (budget_type = 'fixed_monthly' AND auto_generate = 1)
      )
    `)

    // 5. 이동된 항목을 budget_items에서 삭제 (ON DELETE CASCADE가 이미 4에서 처리됨)
    // DROP TABLE 대신 DELETE로 처리하여 남은 예산 항목의 카테고리 매핑 보존
    db.exec(`
      DELETE FROM budget_items
      WHERE budget_type = 'distributed'
         OR (budget_type = 'fixed_monthly' AND auto_generate = 1)
    `)

    // 6. 인덱스 생성
    db.exec(`CREATE INDEX idx_auto_transaction_rules_rule_type ON auto_transaction_rules(rule_type)`)
    db.exec(`CREATE INDEX idx_auto_transaction_rules_is_active ON auto_transaction_rules(is_active)`)
  },
}
