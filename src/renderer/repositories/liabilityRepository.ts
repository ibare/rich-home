import { v4 as uuidv4 } from 'uuid'

// 활성 부채 목록 조회
export async function getActiveLiabilities() {
  return await window.electronAPI.db.query(
    'SELECT * FROM liabilities WHERE is_active = 1 ORDER BY type, start_date DESC'
  )
}

// 부채 잔액만 조회 (순자산 계산용)
export async function getLiabilityBalances() {
  return await window.electronAPI.db.query(
    'SELECT current_balance, currency FROM liabilities WHERE is_active = 1'
  )
}

// 부채 생성
export async function createLiability(data: {
  name: string
  type: string
  principal_amount: number
  current_balance: number
  interest_rate: number | null
  start_date: string
  end_date: string | null
  currency: string
  memo: string | null
}) {
  await window.electronAPI.db.query(
    `INSERT INTO liabilities (id, name, type, principal_amount, current_balance, interest_rate, start_date, end_date, currency, memo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), data.name, data.type, data.principal_amount, data.current_balance,
     data.interest_rate, data.start_date, data.end_date, data.currency, data.memo]
  )
}

// 부채 수정
export async function updateLiability(id: string, data: {
  name: string
  type: string
  principal_amount: number
  current_balance: number
  interest_rate: number | null
  start_date: string
  end_date: string | null
  currency: string
  memo: string | null
}) {
  await window.electronAPI.db.query(
    `UPDATE liabilities SET name = ?, type = ?, principal_amount = ?, current_balance = ?, interest_rate = ?, start_date = ?, end_date = ?, currency = ?, memo = ?
     WHERE id = ?`,
    [data.name, data.type, data.principal_amount, data.current_balance,
     data.interest_rate, data.start_date, data.end_date, data.currency, data.memo, id]
  )
}
