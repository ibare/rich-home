import { DEFAULT_EXCHANGE_RATE, SETTINGS_KEYS } from '../../shared/constants'

export async function getExchangeRate(): Promise<number> {
  try {
    const result = await window.electronAPI.db.get(
      `SELECT value FROM settings WHERE key = ?`,
      [SETTINGS_KEYS.AED_TO_KRW_RATE]
    ) as { value: string } | undefined
    return result ? parseFloat(result.value) : DEFAULT_EXCHANGE_RATE
  } catch (error) {
    console.error('Failed to load exchange rate:', error)
    return DEFAULT_EXCHANGE_RATE
  }
}

export async function saveExchangeRate(rate: number): Promise<void> {
  await window.electronAPI.db.query(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
    [SETTINGS_KEYS.AED_TO_KRW_RATE, rate.toString(), rate.toString()]
  )
}

export async function getSetting(key: string): Promise<string | null> {
  const result = await window.electronAPI.db.get(
    `SELECT value FROM settings WHERE key = ?`,
    [key]
  ) as { value: string } | undefined
  return result ? result.value : null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await window.electronAPI.db.query(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
    [key, value, value]
  )
}

export function convertToKRW(amount: number, currency: string, rate: number): number {
  return currency === 'AED' ? amount * rate : amount
}
