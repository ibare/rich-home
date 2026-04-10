import { v4 as uuidv4 } from 'uuid'

// 활성 자산 목록 조회
export async function getActiveAssets() {
  return await window.electronAPI.db.query(
    'SELECT * FROM assets WHERE is_active = 1 ORDER BY type, purchase_date DESC'
  )
}

// 자산 생성
export async function createAsset(data: {
  name: string
  type: string
  purchase_amount: number
  purchase_date: string
  quantity: number
  currency: string
  memo: string | null
}) {
  await window.electronAPI.db.query(
    `INSERT INTO assets (id, name, type, purchase_amount, purchase_date, quantity, currency, memo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), data.name, data.type, data.purchase_amount, data.purchase_date, data.quantity, data.currency, data.memo]
  )
}

// 자산 삭제
export async function deleteAsset(id: string) {
  await window.electronAPI.db.query(
    'DELETE FROM assets WHERE id = ?',
    [id]
  )
}
