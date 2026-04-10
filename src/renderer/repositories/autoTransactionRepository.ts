import { v4 as uuidv4 } from 'uuid'

// 자동 거래 규칙 목록 조회
export async function getAutoTransactionRules() {
  return await window.electronAPI.db.query(`
    SELECT atr.*, c.name as category_name, a.name as account_name
    FROM auto_transaction_rules atr
    LEFT JOIN categories c ON atr.category_id = c.id
    LEFT JOIN accounts a ON atr.account_id = a.id
    WHERE atr.is_active = 1
    ORDER BY atr.sort_order, atr.name
  `)
}

// 자동 거래 규칙 생성
export async function createAutoTransactionRule(data: {
  name: string
  rule_type: string
  base_amount: number
  currency: string
  category_id: string | null
  account_id: string | null
  valid_from: string | null
  valid_to: string | null
  memo: string | null
}) {
  await window.electronAPI.db.query(
    `INSERT INTO auto_transaction_rules (id, name, rule_type, base_amount, currency, category_id, account_id, valid_from, valid_to, memo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), data.name, data.rule_type, data.base_amount, data.currency,
     data.category_id, data.account_id, data.valid_from, data.valid_to, data.memo]
  )
}

// 자동 거래 규칙 수정
export async function updateAutoTransactionRule(id: string, data: {
  name: string
  base_amount: number
  currency: string
  category_id: string | null
  account_id: string | null
  valid_from: string | null
  valid_to: string | null
  memo: string | null
}) {
  await window.electronAPI.db.query(
    `UPDATE auto_transaction_rules
     SET name = ?, base_amount = ?, currency = ?, category_id = ?, account_id = ?,
         valid_from = ?, valid_to = ?, memo = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [data.name, data.base_amount, data.currency, data.category_id, data.account_id,
     data.valid_from, data.valid_to, data.memo, id]
  )
}

// 자동 거래 규칙 삭제
export async function deleteAutoTransactionRule(id: string) {
  await window.electronAPI.db.query(
    'DELETE FROM auto_transaction_rules WHERE id = ?',
    [id]
  )
}
