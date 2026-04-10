import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { migrations, runMigrations } from './index'

describe('마이그레이션', () => {
  it('모든 마이그레이션이 빈 DB에서 순차적으로 실행된다', () => {
    const db = new Database(':memory:')
    expect(() => runMigrations(db)).not.toThrow()

    // 모든 마이그레이션이 기록되었는지 확인
    const applied = db.prepare('SELECT version, name FROM schema_migrations ORDER BY version').all() as {
      version: number
      name: string
    }[]
    expect(applied).toHaveLength(migrations.length)
    expect(applied.map(r => r.version)).toEqual(migrations.map(m => m.version))

    db.close()
  })

  it('마이그레이션 후 핵심 테이블이 생성된다', () => {
    const db = new Database(':memory:')
    runMigrations(db)

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[]
    const tableNames = tables.map(t => t.name)

    // monthly_budgets는 migration 005에서 삭제됨
    const expectedTables = [
      'accounts',
      'account_balances',
      'assets',
      'auto_transaction_rules',
      'budget_item_categories',
      'budget_items',
      'categories',
      'liabilities',
      'schema_migrations',
      'settings',
      'transactions',
    ]
    for (const table of expectedTables) {
      expect(tableNames).toContain(table)
    }

    db.close()
  })

  it('기본 카테고리가 삽입된다', () => {
    const db = new Database(':memory:')
    runMigrations(db)

    const categories = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }
    expect(categories.count).toBeGreaterThan(0)

    // 수입/지출 카테고리가 모두 존재하는지
    const income = db.prepare("SELECT COUNT(*) as count FROM categories WHERE type = 'income'").get() as { count: number }
    const expense = db.prepare("SELECT COUNT(*) as count FROM categories WHERE type = 'expense'").get() as { count: number }
    expect(income.count).toBeGreaterThan(0)
    expect(expense.count).toBeGreaterThan(0)

    db.close()
  })

  it('마이그레이션을 두 번 실행해도 멱등하다', () => {
    const db = new Database(':memory:')
    runMigrations(db)
    expect(() => runMigrations(db)).not.toThrow()

    // 마이그레이션 중복 기록이 없는지
    const applied = db.prepare('SELECT version FROM schema_migrations').all()
    expect(applied).toHaveLength(migrations.length)

    db.close()
  })

  it('budget_items 테이블에 group_name 컬럼이 존재하고 budget_type은 제거되었다', () => {
    const db = new Database(':memory:')
    runMigrations(db)

    const columns = db.prepare("PRAGMA table_info('budget_items')").all() as { name: string }[]
    const colNames = columns.map(c => c.name)

    expect(colNames).toContain('group_name')
    // migration 011에서 budget_type, valid_from, valid_to 제거됨
    expect(colNames).not.toContain('budget_type')
    expect(colNames).not.toContain('valid_from')

    db.close()
  })

  it('transactions 테이블에 include_in_stats, tag 컬럼이 존재한다', () => {
    const db = new Database(':memory:')
    runMigrations(db)

    const columns = db.prepare("PRAGMA table_info('transactions')").all() as { name: string }[]
    const colNames = columns.map(c => c.name)

    expect(colNames).toContain('include_in_stats')
    expect(colNames).toContain('tag')

    db.close()
  })
})
