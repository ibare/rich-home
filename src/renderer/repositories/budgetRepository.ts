import { v4 as uuidv4 } from 'uuid'

// 예산 항목 목록 조회 (카테고리명 포함)
export async function getBudgetItems() {
  return await window.electronAPI.db.query(`
    SELECT bi.id, bi.name, bi.group_name, bi.base_amount, bi.currency,
           bi.memo, bi.is_active,
           GROUP_CONCAT(c.name, ', ') as category_names
    FROM budget_items bi
    LEFT JOIN budget_item_categories bic ON bi.id = bic.budget_item_id
    LEFT JOIN categories c ON bic.category_id = c.id
    WHERE bi.is_active = 1
    GROUP BY bi.id
    ORDER BY bi.group_name, bi.sort_order, bi.name
  `)
}

// 예산 항목에 연결된 카테고리 ID 조회
export async function getBudgetItemCategoryIds(budgetItemId: string): Promise<string[]> {
  const result = await window.electronAPI.db.query(
    'SELECT category_id FROM budget_item_categories WHERE budget_item_id = ?',
    [budgetItemId]
  ) as { category_id: string }[]
  return result.map(r => r.category_id)
}

// 다른 예산 항목에서 사용 중인 카테고리 맵 조회
export async function getUsedCategoryMap(excludeId: string): Promise<Record<string, string>> {
  const result = await window.electronAPI.db.query(
    `SELECT bic.category_id, bi.name as budget_name
     FROM budget_item_categories bic
     JOIN budget_items bi ON bi.id = bic.budget_item_id
     WHERE bi.is_active = 1 AND bi.id != ?`,
    [excludeId]
  ) as { category_id: string; budget_name: string }[]
  const map: Record<string, string> = {}
  for (const row of result) {
    map[row.category_id] = row.budget_name
  }
  return map
}

// 예산 항목 생성
export async function createBudgetItem(data: {
  name: string
  group_name: string | null
  base_amount: number
  currency: string
  memo: string | null
  category_ids: string[]
}) {
  const budgetItemId = uuidv4()
  await window.electronAPI.db.query(
    `INSERT INTO budget_items (id, name, group_name, base_amount, currency, memo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [budgetItemId, data.name, data.group_name, data.base_amount, data.currency, data.memo]
  )
  for (const categoryId of data.category_ids) {
    await window.electronAPI.db.query(
      `INSERT INTO budget_item_categories (id, budget_item_id, category_id)
       VALUES (?, ?, ?)`,
      [uuidv4(), budgetItemId, categoryId]
    )
  }
}

// 예산 항목 수정
export async function updateBudgetItem(id: string, data: {
  name: string
  group_name: string | null
  base_amount: number
  currency: string
  memo: string | null
  category_ids: string[]
}) {
  await window.electronAPI.db.query(
    `UPDATE budget_items SET name = ?, group_name = ?, base_amount = ?, currency = ?, memo = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [data.name, data.group_name, data.base_amount, data.currency, data.memo, id]
  )
  // 기존 카테고리 매핑 삭제 후 재등록
  await window.electronAPI.db.query(
    'DELETE FROM budget_item_categories WHERE budget_item_id = ?',
    [id]
  )
  for (const categoryId of data.category_ids) {
    await window.electronAPI.db.query(
      `INSERT INTO budget_item_categories (id, budget_item_id, category_id)
       VALUES (?, ?, ?)`,
      [uuidv4(), id, categoryId]
    )
  }
}

// 예산 항목 삭제 (카테고리 매핑 포함)
export async function deleteBudgetItem(id: string) {
  await window.electronAPI.db.query(
    'DELETE FROM budget_item_categories WHERE budget_item_id = ?',
    [id]
  )
  await window.electronAPI.db.query(
    'DELETE FROM budget_items WHERE id = ?',
    [id]
  )
}
