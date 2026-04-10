import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getExchangeRate, saveExchangeRate, getSetting, setSetting, convertToKRW } from './settingsRepository'

// window.electronAPI mock
const mockQuery = vi.fn()
const mockGet = vi.fn()

vi.stubGlobal('window', {
  electronAPI: {
    db: {
      query: mockQuery,
      get: mockGet,
    },
  },
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('settingsRepository', () => {
  describe('getExchangeRate', () => {
    it('DB에 저장된 환율을 반환한다', async () => {
      mockGet.mockResolvedValue({ value: '400' })
      const rate = await getExchangeRate()
      expect(rate).toBe(400)
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('SELECT value FROM settings'),
        ['aed_to_krw_rate']
      )
    })

    it('DB에 값이 없으면 기본값 385를 반환한다', async () => {
      mockGet.mockResolvedValue(undefined)
      const rate = await getExchangeRate()
      expect(rate).toBe(385)
    })

    it('에러 발생 시 기본값 385를 반환한다', async () => {
      mockGet.mockRejectedValue(new Error('DB error'))
      const rate = await getExchangeRate()
      expect(rate).toBe(385)
    })
  })

  describe('saveExchangeRate', () => {
    it('환율을 저장한다', async () => {
      mockQuery.mockResolvedValue(undefined)
      await saveExchangeRate(400)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO settings'),
        ['aed_to_krw_rate', '400', '400']
      )
    })
  })

  describe('getSetting', () => {
    it('설정값을 반환한다', async () => {
      mockGet.mockResolvedValue({ value: 'test_value' })
      const value = await getSetting('test_key')
      expect(value).toBe('test_value')
    })

    it('값이 없으면 null을 반환한다', async () => {
      mockGet.mockResolvedValue(undefined)
      const value = await getSetting('nonexistent')
      expect(value).toBeNull()
    })
  })

  describe('setSetting', () => {
    it('설정값을 저장한다', async () => {
      mockQuery.mockResolvedValue(undefined)
      await setSetting('my_key', 'my_value')
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO settings'),
        ['my_key', 'my_value', 'my_value']
      )
    })
  })

  describe('convertToKRW', () => {
    it('AED를 KRW로 변환한다', () => {
      expect(convertToKRW(100, 'AED', 385)).toBe(38500)
    })

    it('KRW는 그대로 반환한다', () => {
      expect(convertToKRW(100, 'KRW', 385)).toBe(100)
    })

    it('다른 통화도 그대로 반환한다', () => {
      expect(convertToKRW(100, 'USD', 385)).toBe(100)
    })
  })
})
