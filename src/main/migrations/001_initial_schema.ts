import type BetterSqlite3 from 'better-sqlite3'
import type { Migration } from './index'

export const migration001: Migration = {
  version: 1,
  name: 'initial_schema',
  up: (db: BetterSqlite3.Database) => {
    // 계좌 테이블
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner TEXT NOT NULL CHECK(owner IN ('self', 'spouse', 'child')),
        type TEXT NOT NULL CHECK(type IN ('regular', 'cma', 'savings', 'checking', 'other')),
        bank_name TEXT NOT NULL,
        account_number TEXT,
        currency TEXT NOT NULL CHECK(currency IN ('KRW', 'AED')) DEFAULT 'KRW',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // 계좌 잔고 히스토리 테이블
    db.exec(`
      CREATE TABLE IF NOT EXISTS account_balances (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        balance INTEGER NOT NULL,
        recorded_at TEXT NOT NULL,
        memo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // 자산 테이블 (부동산/주식)
    db.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('real_estate', 'stock')),
        purchase_amount INTEGER NOT NULL,
        purchase_date TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        currency TEXT NOT NULL CHECK(currency IN ('KRW', 'AED')) DEFAULT 'KRW',
        memo TEXT,
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
        expense_type TEXT CHECK(expense_type IN ('fixed', 'variable')),
        color TEXT,
        icon TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // 거래 테이블 (수입/지출)
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL CHECK(currency IN ('KRW', 'AED')) DEFAULT 'KRW',
        category_id TEXT NOT NULL REFERENCES categories(id),
        date TEXT NOT NULL,
        description TEXT,
        memo TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // 예산 항목 템플릿 테이블
    db.exec(`
      CREATE TABLE IF NOT EXISTS budget_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        budget_type TEXT NOT NULL CHECK(budget_type IN ('fixed_monthly', 'variable_monthly', 'annual', 'quarterly')),
        base_amount INTEGER NOT NULL,
        currency TEXT NOT NULL CHECK(currency IN ('KRW', 'AED')) DEFAULT 'KRW',
        memo TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // 예산 항목-카테고리 매핑 테이블
    db.exec(`
      CREATE TABLE IF NOT EXISTS budget_item_categories (
        id TEXT PRIMARY KEY,
        budget_item_id TEXT NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL REFERENCES categories(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(budget_item_id, category_id)
      )
    `)

    // 월별 예산 테이블 (스냅샷)
    db.exec(`
      CREATE TABLE IF NOT EXISTS monthly_budgets (
        id TEXT PRIMARY KEY,
        budget_item_id TEXT NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL CHECK(month >= 1 AND month <= 12),
        amount INTEGER NOT NULL,
        is_confirmed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(budget_item_id, year, month)
      )
    `)

    // 부채 테이블
    db.exec(`
      CREATE TABLE IF NOT EXISTS liabilities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('mortgage', 'credit_loan', 'jeonse_deposit', 'car_loan', 'other')),
        principal_amount INTEGER NOT NULL,
        current_balance INTEGER NOT NULL,
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

    // 설정 테이블
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // 인덱스 생성
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_account_balances_account ON account_balances(account_id);
      CREATE INDEX IF NOT EXISTS idx_account_balances_date ON account_balances(recorded_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_monthly_budgets_year_month ON monthly_budgets(year, month);
      CREATE INDEX IF NOT EXISTS idx_budget_item_categories_item ON budget_item_categories(budget_item_id);
    `)

    // 기본 카테고리 데이터 삽입
    const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }

    if (categoryCount.count === 0) {
      const insertCategory = db.prepare(`
        INSERT INTO categories (id, name, type, expense_type, color, icon, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      // 수입 카테고리
      const incomeCategories = [
        { id: 'inc-salary', name: '급여', color: '#4CAF50', icon: 'briefcase' },
        { id: 'inc-bonus', name: '보너스', color: '#8BC34A', icon: 'gift' },
        { id: 'inc-sidejob', name: '부업/프리랜서', color: '#66BB6A', icon: 'laptop' },
        { id: 'inc-dividend', name: '배당금', color: '#FF9800', icon: 'trending-up' },
        { id: 'inc-interest', name: '이자', color: '#2196F3', icon: 'percent' },
        { id: 'inc-rental', name: '임대수입', color: '#795548', icon: 'home' },
        { id: 'inc-allowance', name: '용돈/선물', color: '#E91E63', icon: 'heart' },
        { id: 'inc-refund', name: '환급금', color: '#00BCD4', icon: 'refresh-cw' },
        { id: 'inc-other', name: '기타 수입', color: '#9E9E9E', icon: 'plus-circle' },
      ]

      // 지출 카테고리 - 고정비
      const fixedExpenseCategories = [
        { id: 'exp-housing', name: '주거비/월세', color: '#795548', icon: 'home' },
        { id: 'exp-maintenance', name: '관리비', color: '#8D6E63', icon: 'tool' },
        { id: 'exp-loan', name: '대출상환', color: '#5D4037', icon: 'credit-card' },
        { id: 'exp-insurance', name: '보험료', color: '#607D8B', icon: 'shield' },
        { id: 'exp-car-insurance', name: '자동차보험', color: '#546E7A', icon: 'truck' },
        { id: 'exp-telecom', name: '통신비', color: '#3F51B5', icon: 'phone' },
        { id: 'exp-internet', name: '인터넷/TV', color: '#5C6BC0', icon: 'wifi' },
        { id: 'exp-subscription', name: '구독료', color: '#9C27B0', icon: 'repeat' },
        { id: 'exp-education', name: '교육비/학원', color: '#00BCD4', icon: 'book' },
        { id: 'exp-tax', name: '세금', color: '#455A64', icon: 'file-text' },
      ]

      // 지출 카테고리 - 변동비
      const variableExpenseCategories = [
        { id: 'exp-grocery', name: '식료품/장보기', color: '#4CAF50', icon: 'shopping-cart' },
        { id: 'exp-dining', name: '외식', color: '#FF5722', icon: 'utensils' },
        { id: 'exp-cafe', name: '카페/음료', color: '#A1887F', icon: 'coffee' },
        { id: 'exp-transport', name: '교통비', color: '#2196F3', icon: 'car' },
        { id: 'exp-fuel', name: '주유비', color: '#1976D2', icon: 'droplet' },
        { id: 'exp-parking', name: '주차비', color: '#42A5F5', icon: 'square' },
        { id: 'exp-shopping', name: '쇼핑/의류', color: '#E91E63', icon: 'shopping-bag' },
        { id: 'exp-beauty', name: '미용/뷰티', color: '#F06292', icon: 'scissors' },
        { id: 'exp-household', name: '생활용품', color: '#26A69A', icon: 'package' },
        { id: 'exp-health', name: '의료/건강', color: '#F44336', icon: 'heart' },
        { id: 'exp-pharmacy', name: '약국/약품', color: '#EF5350', icon: 'plus' },
        { id: 'exp-leisure', name: '여가/문화', color: '#673AB7', icon: 'film' },
        { id: 'exp-hobby', name: '취미', color: '#7E57C2', icon: 'star' },
        { id: 'exp-travel', name: '여행', color: '#AB47BC', icon: 'map' },
        { id: 'exp-child', name: '육아/자녀', color: '#FFB74D', icon: 'users' },
        { id: 'exp-pet', name: '반려동물', color: '#FF8A65', icon: 'github' },
        { id: 'exp-event', name: '경조사', color: '#FFEB3B', icon: 'calendar' },
        { id: 'exp-gift', name: '선물/기부', color: '#FFC107', icon: 'gift' },
        { id: 'exp-selfdev', name: '자기개발', color: '#03A9F4', icon: 'award' },
        { id: 'exp-atm', name: 'ATM출금', color: '#78909C', icon: 'dollar-sign' },
        { id: 'exp-other', name: '기타 지출', color: '#9E9E9E', icon: 'more-horizontal' },
      ]

      incomeCategories.forEach((cat, idx) => {
        insertCategory.run(cat.id, cat.name, 'income', null, cat.color, cat.icon, idx)
      })

      fixedExpenseCategories.forEach((cat, idx) => {
        insertCategory.run(cat.id, cat.name, 'expense', 'fixed', cat.color, cat.icon, idx)
      })

      variableExpenseCategories.forEach((cat, idx) => {
        insertCategory.run(cat.id, cat.name, 'expense', 'variable', cat.color, cat.icon, idx + 100)
      })
    }
  },
}
