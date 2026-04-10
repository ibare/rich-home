import { v4 as uuidv4 } from 'uuid'

// 카테고리 목록 조회 (예산 항목명 포함)
export async function getCategoriesWithBudgetNames() {
  return await window.electronAPI.db.query(`
    SELECT c.*, GROUP_CONCAT(bi.name, ', ') as budget_item_names
    FROM categories c
    LEFT JOIN budget_item_categories bic ON c.id = bic.category_id
    LEFT JOIN budget_items bi ON bic.budget_item_id = bi.id AND bi.is_active = 1
    WHERE c.is_active = 1
    GROUP BY c.id
    ORDER BY c.type, c.expense_type, c.name
  `)
}

// 활성 카테고리 전체 조회 (거래 등록용)
export async function getAllActiveCategories() {
  return await window.electronAPI.db.query(
    'SELECT * FROM categories WHERE is_active = 1 ORDER BY type, expense_type, name'
  )
}

// 지출 카테고리만 조회 (예산/자동거래 규칙용)
export async function getExpenseCategories() {
  return await window.electronAPI.db.query(
    "SELECT * FROM categories WHERE is_active = 1 AND type = 'expense' ORDER BY expense_type, name"
  )
}

// 카테고리 생성
export async function createCategory(data: {
  name: string
  type: string
  expense_type: string | null
  color: string
}) {
  const maxOrderResult = await window.electronAPI.db.get(
    `SELECT MAX(sort_order) as max_order FROM categories WHERE type = ? AND expense_type = ?`,
    [data.type, data.expense_type]
  )
  const nextOrder = ((maxOrderResult as { max_order: number | null })?.max_order ?? 0) + 1

  await window.electronAPI.db.query(
    `INSERT INTO categories (id, name, type, expense_type, color, icon, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, '', ?, 1)`,
    [uuidv4(), data.name, data.type, data.expense_type, data.color, nextOrder]
  )
}

// 카테고리 수정
export async function updateCategory(id: string, data: {
  name: string
  type: string
  expense_type: string | null
  color: string
}) {
  await window.electronAPI.db.query(
    `UPDATE categories SET name = ?, type = ?, expense_type = ?, color = ? WHERE id = ?`,
    [data.name, data.type, data.expense_type, data.color, id]
  )
}

// 카테고리를 사용하는 거래 수 조회
export async function getTransactionCountByCategory(categoryId: string): Promise<number> {
  const result = await window.electronAPI.db.get(
    'SELECT COUNT(*) as count FROM transactions WHERE category_id = ?',
    [categoryId]
  ) as { count: number }
  return result.count
}

// 대체 가능한 카테고리 목록 조회
export async function getReplacementCategories(excludeId: string, type: string) {
  return await window.electronAPI.db.query(
    'SELECT * FROM categories WHERE is_active = 1 AND id != ? AND type = ? ORDER BY expense_type, name',
    [excludeId, type]
  )
}

// 카테고리 삭제 (연결 거래 대체 + 예산 매핑 제거)
export async function deleteCategory(id: string, replacementCategoryId?: string) {
  if (replacementCategoryId) {
    await window.electronAPI.db.query(
      'UPDATE transactions SET category_id = ? WHERE category_id = ?',
      [replacementCategoryId, id]
    )
  }
  await window.electronAPI.db.query(
    'DELETE FROM budget_item_categories WHERE category_id = ?',
    [id]
  )
  await window.electronAPI.db.query(
    'DELETE FROM categories WHERE id = ?',
    [id]
  )
}
