// 날짜 범위 유틸
function getDateRange(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`
  return { startDate, endDate }
}

// 월별 거래 조회
export async function getTransactions(year: number, month: number) {
  const { startDate, endDate } = getDateRange(year, month)
  const query = `
    SELECT t.*, COALESCE(c.name, '(카테고리 없음)') as category_name,
      (SELECT bi.id FROM budget_item_categories bic
       JOIN budget_items bi ON bic.budget_item_id = bi.id AND bi.is_active = 1
       WHERE bic.category_id = t.category_id
       LIMIT 1) as budget_item_id,
      (SELECT bi.name FROM budget_item_categories bic
       JOIN budget_items bi ON bic.budget_item_id = bi.id AND bi.is_active = 1
       WHERE bic.category_id = t.category_id
       LIMIT 1) as budget_item_name,
      (SELECT COALESCE(bi.group_name, '미분류') FROM budget_item_categories bic
       JOIN budget_items bi ON bic.budget_item_id = bi.id AND bi.is_active = 1
       WHERE bic.category_id = t.category_id
       LIMIT 1) as budget_group_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.date >= ? AND t.date < ?
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT 1000
  `
  return await window.electronAPI.db.query(query, [startDate, endDate])
}

// 예산 항목별 지출 집계
export async function getBudgetSummaries(year: number, month: number, exchangeRate: number) {
  const { startDate, endDate } = getDateRange(year, month)

  const budgetQuery = `
    SELECT
      bi.id as budget_item_id,
      bi.name as budget_item_name,
      CASE WHEN bi.currency = 'AED'
        THEN bi.base_amount * ?
        ELSE bi.base_amount
      END as budget_amount,
      COALESCE(GROUP_CONCAT(c.name, ', '), '') as category_names
    FROM budget_items bi
    LEFT JOIN budget_item_categories bic ON bic.budget_item_id = bi.id
    LEFT JOIN categories c ON c.id = bic.category_id
    WHERE bi.is_active = 1
    GROUP BY bi.id
    ORDER BY bi.sort_order
  `
  const budgetResult = await window.electronAPI.db.query(budgetQuery, [
    exchangeRate,
  ]) as { budget_item_id: string; budget_item_name: string; budget_amount: number; category_names: string }[]

  const spentQuery = `
    SELECT
      bi.id as budget_item_id,
      COALESCE(SUM(
        CASE WHEN t.currency = 'AED'
          THEN t.amount * ?
          ELSE t.amount
        END
      ), 0) as spent_amount
    FROM budget_items bi
    LEFT JOIN budget_item_categories bic ON bic.budget_item_id = bi.id
    LEFT JOIN transactions t ON t.category_id = bic.category_id
      AND t.date >= ?
      AND t.date < ?
      AND t.type = 'expense'
      AND t.include_in_stats = 1
    WHERE bi.is_active = 1
    GROUP BY bi.id
  `
  const spentResult = await window.electronAPI.db.query(spentQuery, [
    exchangeRate, startDate, endDate,
  ]) as { budget_item_id: string; spent_amount: number }[]

  const spentMap = new Map(spentResult.map(r => [r.budget_item_id, r.spent_amount]))
  return budgetResult.map(b => ({
    budget_item_id: b.budget_item_id,
    budget_item_name: b.budget_item_name,
    budget_amount: b.budget_amount,
    spent_amount: spentMap.get(b.budget_item_id) || 0,
    category_names: b.category_names,
  }))
}

// 월별 데이터 존재 여부
export async function getMonthsWithData(year: number): Promise<Set<number>> {
  const result = await window.electronAPI.db.query(
    `SELECT DISTINCT CAST(strftime('%m', date) AS INTEGER) as month
     FROM transactions
     WHERE strftime('%Y', date) = ?`,
    [String(year)]
  ) as { month: number }[]
  return new Set(result.map(r => r.month))
}

// 거래 삭제
export async function deleteTransaction(id: string): Promise<void> {
  await window.electronAPI.db.query('DELETE FROM transactions WHERE id = ?', [id])
}

// 예산 항목에 연결된 카테고리 ID 조회
export async function getBudgetCategoryIds(budgetItemId: string): Promise<string[]> {
  const result = await window.electronAPI.db.query(
    'SELECT category_id FROM budget_item_categories WHERE budget_item_id = ?',
    [budgetItemId]
  ) as { category_id: string }[]
  return result.map(r => r.category_id)
}

// 카테고리별 입력 내용 자동완성 조회
export async function getDescriptionSuggestions(categoryId: string): Promise<string[]> {
  const result = await window.electronAPI.db.query(
    `SELECT DISTINCT description FROM transactions
     WHERE category_id = ? AND description IS NOT NULL AND description != ''
     ORDER BY created_at DESC
     LIMIT 20`,
    [categoryId]
  ) as { description: string }[]
  return result.map(r => r.description)
}

// 태그 목록 조회
export async function getTagSuggestions(): Promise<string[]> {
  const result = await window.electronAPI.db.query(
    `SELECT DISTINCT tag FROM transactions
     WHERE tag IS NOT NULL AND tag != ''`
  ) as { tag: string }[]
  const allTags = new Set<string>()
  result.forEach(r => {
    r.tag.split(',').forEach(t => {
      const trimmed = t.trim()
      if (trimmed) allTags.add(trimmed)
    })
  })
  return Array.from(allTags).sort()
}

// 거래 수정
export async function updateTransaction(id: string, data: {
  type: string
  amount: number
  currency: string
  category_id: string
  date: string
  description: string | null
  include_in_stats: number
  tag: string | null
}) {
  await window.electronAPI.db.query(
    `UPDATE transactions
     SET type = ?, amount = ?, currency = ?, category_id = ?, date = ?, description = ?, include_in_stats = ?, tag = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [data.type, data.amount, data.currency, data.category_id, data.date, data.description, data.include_in_stats, data.tag, id]
  )
}

// 거래 카테고리 변경
export async function updateTransactionCategory(id: string, categoryId: string) {
  await window.electronAPI.db.query(
    `UPDATE transactions SET category_id = ?, updated_at = datetime('now') WHERE id = ?`,
    [categoryId, id]
  )
}

// 거래 생성
export async function createTransaction(data: {
  id: string
  type: string
  amount: number
  currency: string
  category_id: string
  date: string
  description: string | null
  include_in_stats: number
  tag: string | null
}) {
  await window.electronAPI.db.query(
    `INSERT INTO transactions (id, type, amount, currency, category_id, date, description, include_in_stats, tag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.id, data.type, data.amount, data.currency, data.category_id, data.date, data.description, data.include_in_stats, data.tag]
  )
}
