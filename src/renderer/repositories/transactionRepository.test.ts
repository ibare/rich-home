import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTransactions, getBudgetSummaries, getMonthsWithData, deleteTransaction, getBudgetCategoryIds } from './transactionRepository'

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

describe('transactionRepository', () => {
  describe('getTransactions', () => {
    it('지정된 년/월의 거래를 조회한다', async () => {
      mockQuery.mockResolvedValue([])
      await getTransactions(2026, 3)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM transactions t'),
        ['2026-03-01', '2026-04-01']
      )
    })

    it('12월은 다음 해 1월로 endDate를 설정한다', async () => {
      mockQuery.mockResolvedValue([])
      await getTransactions(2026, 12)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['2026-12-01', '2027-01-01']
      )
    })
  })

  describe('getBudgetSummaries', () => {
    it('예산 항목별 지출 집계를 반환한다', async () => {
      mockQuery
        .mockResolvedValueOnce([
          { budget_item_id: 'b1', budget_item_name: '식비', budget_amount: 200000, category_names: '식료품' },
        ])
        .mockResolvedValueOnce([
          { budget_item_id: 'b1', spent_amount: 150000 },
        ])

      const result = await getBudgetSummaries(2026, 3, 385)
      expect(result).toEqual([
        {
          budget_item_id: 'b1',
          budget_item_name: '식비',
          budget_amount: 200000,
          spent_amount: 150000,
          category_names: '식료품',
        },
      ])
    })

    it('지출이 없는 예산 항목은 0으로 반환한다', async () => {
      mockQuery
        .mockResolvedValueOnce([
          { budget_item_id: 'b1', budget_item_name: '교통비', budget_amount: 100000, category_names: '교통' },
        ])
        .mockResolvedValueOnce([])

      const result = await getBudgetSummaries(2026, 3, 385)
      expect(result[0].spent_amount).toBe(0)
    })
  })

  describe('getMonthsWithData', () => {
    it('데이터가 있는 월 목록을 Set으로 반환한다', async () => {
      mockQuery.mockResolvedValue([{ month: 1 }, { month: 3 }, { month: 5 }])
      const result = await getMonthsWithData(2026)
      expect(result).toEqual(new Set([1, 3, 5]))
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("strftime('%m', date)"),
        ['2026']
      )
    })
  })

  describe('deleteTransaction', () => {
    it('지정된 ID의 거래를 삭제한다', async () => {
      mockQuery.mockResolvedValue(undefined)
      await deleteTransaction('tx-123')
      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM transactions WHERE id = ?',
        ['tx-123']
      )
    })
  })

  describe('getBudgetCategoryIds', () => {
    it('예산 항목에 연결된 카테고리 ID를 반환한다', async () => {
      mockQuery.mockResolvedValue([
        { category_id: 'cat-1' },
        { category_id: 'cat-2' },
      ])
      const result = await getBudgetCategoryIds('budget-1')
      expect(result).toEqual(['cat-1', 'cat-2'])
    })
  })
})
