import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadDashboardData } from './dashboardRepository'

const mockQuery = vi.fn()

vi.stubGlobal('window', {
  electronAPI: {
    db: {
      query: mockQuery,
      get: vi.fn(),
    },
  },
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('dashboardRepository', () => {
  describe('loadDashboardData', () => {
    it('모든 대시보드 데이터를 로드하고 KRW로 환산한다', async () => {
      // 각 쿼리에 대한 mock 응답 (총 9개 쿼리 + 3개월 예산비교 6개)
      mockQuery
        // 1. 계좌 잔고
        .mockResolvedValueOnce([
          { currency: 'KRW', balance: 1000000 },
          { currency: 'AED', balance: 1000 },
        ])
        // 2. 자산
        .mockResolvedValueOnce([
          { purchase_amount: 500000000, quantity: 1, currency: 'KRW' },
        ])
        // 3. 부채
        .mockResolvedValueOnce([
          { current_balance: 200000000, currency: 'KRW' },
        ])
        // 4. 이번 달 거래
        .mockResolvedValueOnce([
          { type: 'income', amount: 5000000, currency: 'KRW' },
          { type: 'expense', amount: 3000000, currency: 'KRW' },
        ])
        // 5. 예산
        .mockResolvedValueOnce([
          { monthly_amount: 4000000, currency: 'KRW' },
        ])
        // 6. 최근 거래
        .mockResolvedValueOnce([])
        // 7. 카테고리별 지출
        .mockResolvedValueOnce([])
        // 8-9. 3개월 예산비교 (3쌍: budget + expense)
        .mockResolvedValueOnce([{ total_budget: 4000000 }])
        .mockResolvedValueOnce([{ total_expense: 2500000 }])
        .mockResolvedValueOnce([{ total_budget: 4000000 }])
        .mockResolvedValueOnce([{ total_expense: 3000000 }])
        .mockResolvedValueOnce([{ total_budget: 4000000 }])
        .mockResolvedValueOnce([{ total_expense: 3200000 }])

      const result = await loadDashboardData(385)

      // 계좌 잔고: KRW 1,000,000 + AED 1,000 * 385 = 1,385,000
      expect(result.totalAccountBalance).toBe(1385000)
      // 자산: 500,000,000
      expect(result.totalAssets).toBe(500000000)
      // 부채: 200,000,000
      expect(result.totalLiabilities).toBe(200000000)
      // 순자산: 1,385,000 + 500,000,000 - 200,000,000
      expect(result.netWorth).toBe(301385000)
      // 수입/지출
      expect(result.monthlyIncome).toBe(5000000)
      expect(result.monthlyExpense).toBe(3000000)
      expect(result.monthlyBudget).toBe(4000000)
      // 3개월 비교
      expect(result.monthlyBudgetComparison).toHaveLength(3)
    })

    it('잔고가 null인 계좌는 무시한다', async () => {
      mockQuery
        .mockResolvedValueOnce([{ currency: 'KRW', balance: null }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total_budget: null }])
        .mockResolvedValueOnce([{ total_expense: null }])
        .mockResolvedValueOnce([{ total_budget: null }])
        .mockResolvedValueOnce([{ total_expense: null }])
        .mockResolvedValueOnce([{ total_budget: null }])
        .mockResolvedValueOnce([{ total_expense: null }])

      const result = await loadDashboardData(385)
      expect(result.totalAccountBalance).toBe(0)
      expect(result.netWorth).toBe(0)
    })
  })
})
