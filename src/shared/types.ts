// 통화 타입
export type Currency = 'KRW' | 'AED'

// 계좌 소유자 타입
export type AccountOwner = 'self' | 'spouse' | 'child'

// 계좌 종류 타입
export type AccountType = 'regular' | 'cma' | 'savings' | 'checking' | 'other'

// 계좌
export interface Account {
  id: string
  name: string
  owner: AccountOwner
  type: AccountType
  bank_name: string
  account_number?: string
  currency: Currency
  is_active: number
  created_at: string
  updated_at: string
  // 조인 필드
  latest_balance?: number
  latest_balance_date?: string
}

// 계좌 잔고 히스토리
export interface AccountBalance {
  id: string
  account_id: string
  balance: number
  recorded_at: string
  memo?: string
  created_at: string
}

// 자산 타입
export type AssetType = 'real_estate' | 'stock'

// 자산 (부동산/주식)
export interface Asset {
  id: string
  name: string
  type: AssetType
  purchase_amount: number
  purchase_date: string
  quantity: number
  currency: Currency
  memo?: string
  is_active: number
  created_at: string
  updated_at: string
}

// 카테고리 타입
export type CategoryType = 'income' | 'expense'

// 지출 카테고리 타입 (고정비/변동비)
export type ExpenseType = 'fixed' | 'variable'

// 카테고리
export interface Category {
  id: string
  name: string
  type: CategoryType
  expense_type?: ExpenseType
  color?: string
  icon?: string
  is_active: number
  sort_order: number
  created_at: string
}

// 거래 타입
export type TransactionType = 'income' | 'expense'

// 거래 (수입/지출)
export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  currency: Currency
  category_id: string
  date: string
  description?: string
  memo?: string
  created_at: string
  updated_at: string
  // 조인 필드
  category_name?: string
  category_color?: string
  category_icon?: string
  expense_type?: ExpenseType
}

// 예산
export interface Budget {
  id: string
  category_id: string
  amount: number
  currency: Currency
  year: number
  month: number
  created_at: string
  // 조인 필드
  category_name?: string
  category_color?: string
  expense_type?: ExpenseType
  spent?: number
}

// 월별 요약
export interface MonthlySummary {
  year: number
  month: number
  total_income: number
  total_expense: number
  balance: number
  currency: Currency
}

// 카테고리별 지출 요약
export interface CategorySummary {
  category_id: string
  category_name: string
  category_color: string
  expense_type: ExpenseType
  budget_amount: number
  spent_amount: number
  difference: number
  currency: Currency
}

// 자산 평가
export interface AssetValuation {
  id: string
  name: string
  type: AssetType
  purchase_amount: number
  current_value: number  // 평가 시 입력받는 값
  quantity: number
  currency: Currency
  total_value: number    // current_value * quantity
  gain_loss: number      // total_value - purchase_amount
  gain_loss_percent: number
}

// 총 자산 요약
export interface TotalAssetSummary {
  accounts_total: number      // 계좌 잔고 합계
  assets_total: number        // 자산 평가 합계
  grand_total: number         // 총합
  base_currency: Currency     // 기준 통화
  exchange_rate?: number      // 환율 (AED to KRW)
}

// 필터
export interface TransactionFilter {
  startDate?: string
  endDate?: string
  type?: TransactionType
  categoryId?: string
  currency?: Currency
  minAmount?: number
  maxAmount?: number
  searchText?: string
}
