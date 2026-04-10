import { v4 as uuidv4 } from 'uuid'

// 계좌 목록 조회 (최근 잔고, 자동 메모 여부 포함)
export async function getAccounts(prevMonthStr: string, currentMonthStr: string) {
  return await window.electronAPI.db.query(`
    SELECT
      a.*,
      (SELECT balance FROM account_balances
       WHERE account_id = a.id
       ORDER BY recorded_at DESC LIMIT 1) as latest_balance,
      (SELECT recorded_at FROM account_balances
       WHERE account_id = a.id
       ORDER BY recorded_at DESC LIMIT 1) as latest_recorded_at,
      (SELECT COUNT(*) FROM account_balances
       WHERE account_id = a.id
       AND memo LIKE '%[자동]%'
       AND recorded_at >= ? AND recorded_at < ?) as has_auto_prev_month
    FROM accounts a
    WHERE a.is_active = 1
    ORDER BY a.owner, a.bank_name
  `, [prevMonthStr, currentMonthStr])
}

// 계좌 상세 조회
export async function getAccount(id: string) {
  return await window.electronAPI.db.get(
    'SELECT * FROM accounts WHERE id = ?',
    [id]
  )
}

// 계좌 잔고 히스토리 조회
export async function getAccountBalances(accountId: string) {
  return await window.electronAPI.db.query(
    'SELECT * FROM account_balances WHERE account_id = ? ORDER BY recorded_at DESC',
    [accountId]
  )
}

// 활성 계좌 목록 (선택용)
export async function getActiveAccounts() {
  return await window.electronAPI.db.query(
    'SELECT id, name, owner, currency FROM accounts WHERE is_active = 1 ORDER BY owner, name'
  )
}

// 계좌 생성
export async function createAccount(data: {
  owner: string
  type: string
  bank_name: string
  account_number: string | null
  currency: string
}) {
  const id = uuidv4()
  await window.electronAPI.db.query(
    `INSERT INTO accounts (id, name, owner, type, bank_name, account_number, currency)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.bank_name, data.owner, data.type, data.bank_name, data.account_number, data.currency]
  )
  // 초기 잔고 0
  await window.electronAPI.db.query(
    `INSERT INTO account_balances (id, account_id, balance, recorded_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [uuidv4(), id, 0]
  )
}

// 계좌 삭제 (잔고 포함)
export async function deleteAccountWithBalances(accountId: string) {
  await window.electronAPI.db.query(
    'DELETE FROM account_balances WHERE account_id = ?',
    [accountId]
  )
  await window.electronAPI.db.query(
    'DELETE FROM accounts WHERE id = ?',
    [accountId]
  )
}

// 잔고 기록 생성
export async function createBalance(accountId: string, balance: number, recordedAt: string) {
  await window.electronAPI.db.query(
    `INSERT INTO account_balances (id, account_id, balance, recorded_at)
     VALUES (?, ?, ?, ?)`,
    [uuidv4(), accountId, balance, recordedAt]
  )
}

// 잔고 기록 수정
export async function updateBalance(id: string, balance: number, recordedAt: string) {
  await window.electronAPI.db.query(
    `UPDATE account_balances SET balance = ?, recorded_at = ? WHERE id = ?`,
    [balance, recordedAt, id]
  )
}

// 잔고 기록 삭제
export async function deleteBalance(id: string) {
  await window.electronAPI.db.query(
    'DELETE FROM account_balances WHERE id = ?',
    [id]
  )
}
