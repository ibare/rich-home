import { useEffect, useState } from 'react'
import { DEFAULT_EXCHANGE_RATE } from '../../shared/constants'
import { getExchangeRate, convertToKRW } from '../repositories/settingsRepository'

export function useExchangeRate() {
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getExchangeRate().then(rate => {
      setExchangeRate(rate)
      setLoading(false)
    })
  }, [])

  const toKRW = (amount: number, currency: string) =>
    convertToKRW(amount, currency, exchangeRate)

  return { exchangeRate, loading, toKRW }
}
