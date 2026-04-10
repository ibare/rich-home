interface DashboardResult {
  totalAccountBalance: number
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  monthlyIncome: number
  monthlyExpense: number
  monthlyBudget: number
  recentTransactions: unknown[]
  categoryExpenses: unknown[]
  monthlyBudgetComparison: { month: string; budget: number; expense: number }[]
}

export async function loadDashboardData(exchangeRate: number): Promise<DashboardResult> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  // 계좌 잔고
  const accountBalances = (await window.electronAPI.db.query(`
    SELECT a.currency, ab.balance
    FROM accounts a
    LEFT JOIN (
      SELECT account_id, balance, recorded_at,
             ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY recorded_at DESC) as rn
      FROM account_balances
    ) ab ON a.id = ab.account_id AND ab.rn = 1
    WHERE a.is_active = 1
  `)) as { currency: string; balance: number | null }[]

  let totalAccountBalance = 0
  for (const acc of accountBalances) {
    if (acc.balance !== null) {
      totalAccountBalance += acc.currency === 'AED' ? acc.balance * exchangeRate : acc.balance
    }
  }

  // 자산 총액
  const assets = (await window.electronAPI.db.query(`
    SELECT purchase_amount, quantity, currency FROM assets WHERE is_active = 1
  `)) as { purchase_amount: number; quantity: number; currency: string }[]

  let totalAssets = 0
  for (const asset of assets) {
    const value = asset.purchase_amount * asset.quantity
    totalAssets += asset.currency === 'AED' ? value * exchangeRate : value
  }

  // 부채 총액
  const liabilities = (await window.electronAPI.db.query(`
    SELECT current_balance, currency FROM liabilities WHERE is_active = 1
  `)) as { current_balance: number; currency: string }[]

  let totalLiabilities = 0
  for (const liability of liabilities) {
    totalLiabilities += liability.currency === 'AED'
      ? liability.current_balance * exchangeRate
      : liability.current_balance
  }

  // 이번 달 수입/지출
  const monthlyTransactions = (await window.electronAPI.db.query(`
    SELECT type, amount, currency FROM transactions
    WHERE date >= ? AND date < ? AND include_in_stats = 1
  `, [startDate, endDate])) as { type: string; amount: number; currency: string }[]

  let monthlyIncome = 0
  let monthlyExpense = 0
  for (const tx of monthlyTransactions) {
    const amountKRW = tx.currency === 'AED' ? tx.amount * exchangeRate : tx.amount
    if (tx.type === 'income') monthlyIncome += amountKRW
    else monthlyExpense += amountKRW
  }

  // 이번 달 예산
  const budgetItemsResult = (await window.electronAPI.db.query(`
    SELECT base_amount as monthly_amount, currency
    FROM budget_items WHERE is_active = 1
  `)) as { monthly_amount: number; currency: string }[]

  let monthlyBudget = 0
  for (const budget of budgetItemsResult) {
    monthlyBudget += budget.currency === 'AED'
      ? budget.monthly_amount * exchangeRate
      : budget.monthly_amount
  }

  // 최근 거래 10건
  const recentTransactions = (await window.electronAPI.db.query(`
    SELECT t.id, t.type, t.amount, t.currency, t.date, t.description, c.name as category_name
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT 10
  `)) as unknown[]

  // 카테고리별 지출
  const categoryExpenses = (await window.electronAPI.db.query(`
    SELECT t.category_id, c.name as category_name, c.color,
           SUM(CASE WHEN t.currency = 'AED' THEN t.amount * ? ELSE t.amount END) as total
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.type = 'expense' AND t.date >= ? AND t.date < ? AND t.include_in_stats = 1
    GROUP BY t.category_id
    ORDER BY total DESC
    LIMIT 5
  `, [exchangeRate, startDate, endDate])) as unknown[]

  // 최근 3개월 예산 vs 지출
  const monthlyBudgetComparison: { month: string; budget: number; expense: number }[] = []
  for (let i = 2; i >= 0; i--) {
    const targetDate = new Date(year, month - 1 - i, 1)
    const targetYear = targetDate.getFullYear()
    const targetMonth = targetDate.getMonth() + 1
    const targetStartDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
    const targetEndDate = targetMonth === 12
      ? `${targetYear + 1}-01-01`
      : `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`

    const budgetResult = (await window.electronAPI.db.query(`
      SELECT SUM(CASE WHEN currency = 'AED' THEN base_amount * ? ELSE base_amount END) as total_budget
      FROM budget_items WHERE is_active = 1
    `, [exchangeRate])) as { total_budget: number | null }[]

    const expenseResult = (await window.electronAPI.db.query(`
      SELECT SUM(CASE WHEN currency = 'AED' THEN amount * ? ELSE amount END) as total_expense
      FROM transactions
      WHERE type = 'expense' AND date >= ? AND date < ? AND include_in_stats = 1
    `, [exchangeRate, targetStartDate, targetEndDate])) as { total_expense: number | null }[]

    monthlyBudgetComparison.push({
      month: `${targetMonth}월`,
      budget: budgetResult[0]?.total_budget || 0,
      expense: expenseResult[0]?.total_expense || 0,
    })
  }

  return {
    totalAccountBalance,
    totalAssets,
    totalLiabilities,
    netWorth: totalAccountBalance + totalAssets - totalLiabilities,
    monthlyIncome,
    monthlyExpense,
    monthlyBudget,
    recentTransactions,
    categoryExpenses,
    monthlyBudgetComparison,
  }
}
