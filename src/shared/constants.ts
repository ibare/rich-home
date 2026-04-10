// 환율 기본값 (AED -> KRW)
export const DEFAULT_EXCHANGE_RATE = 385

// settings 테이블 키
export const SETTINGS_KEYS = {
  AED_TO_KRW_RATE: 'aed_to_krw_rate',
} as const

// localStorage 키
export const STORAGE_KEYS = {
  TRANSACTIONS_YEAR: 'transactions_selected_year',
  TRANSACTIONS_MONTH: 'transactions_selected_month',
  BUDGET_DISPLAY_CURRENCY: 'budget_display_currency',
} as const

// 차트용 카테고리 색상 팔레트
export const CATEGORY_COLORS = [
  '#5D87FF', '#13DEB9', '#FFAE1F', '#FA896B', '#49BEFF',
  '#9C27B0', '#4CAF50', '#FF5722', '#607D8B', '#795548',
  '#E91E63', '#00BCD4', '#8BC34A', '#FFC107', '#3F51B5',
]

// 차트 시맨틱 색상
export const CHART_COLORS = {
  income: '#13DEB9',
  incomeLight: '#E6FFFA',
  expense: '#5D87FF',
  expenseLight: '#ECF2FF',
  balance: '#49BEFF',
} as const
