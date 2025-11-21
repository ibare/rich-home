// 계좌 타입
export type AccountType = 'bank' | 'cash' | 'card' | 'investment' | 'other'

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: number
  currency: string
  color?: string
  icon?: string
  is_active: number
  created_at: string
  updated_at: string
}

// 카테고리 타입
export type CategoryType = 'income' | 'expense'

export interface Category {
  id: string
  name: string
  type: CategoryType
  parent_id?: string
  color?: string
  icon?: string
  budget_amount?: number
  is_active: number
  sort_order: number
  created_at: string
}

// 거래 타입
export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  account_id: string
  to_account_id?: string
  category_id?: string
  description?: string
  memo?: string
  date: string
  is_recurring: number
  recurring_id?: string
  created_at: string
  updated_at: string
  // Joined fields
  account_name?: string
  to_account_name?: string
  category_name?: string
  category_color?: string
  tags?: Tag[]
}

// 태그 타입
export interface Tag {
  id: string
  name: string
  color?: string
  created_at: string
}

// 반복 거래 타입
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurringTransaction {
  id: string
  type: TransactionType
  amount: number
  account_id: string
  to_account_id?: string
  category_id?: string
  description?: string
  frequency: RecurringFrequency
  interval_value: number
  start_date: string
  end_date?: string
  next_date: string
  is_active: number
  created_at: string
}

// 예산 타입
export type BudgetPeriod = 'monthly' | 'yearly'

export interface Budget {
  id: string
  category_id?: string
  amount: number
  period: BudgetPeriod
  year: number
  month?: number
  created_at: string
  // Joined fields
  category_name?: string
  spent?: number
}

// 통계 타입
export interface MonthlySummary {
  month: string
  income: number
  expense: number
  balance: number
}

export interface CategorySummary {
  category_id: string
  category_name: string
  category_color: string
  amount: number
  percentage: number
  transaction_count: number
}

// 필터 타입
export interface TransactionFilter {
  startDate?: string
  endDate?: string
  type?: TransactionType
  accountId?: string
  categoryId?: string
  tags?: string[]
  searchText?: string
  minAmount?: number
  maxAmount?: number
}
