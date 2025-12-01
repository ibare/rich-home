# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Rich Home** is a personal finance management desktop application built with Electron, React, and TypeScript. It helps track income/expenses, manage budgets, and analyze financial data with multi-currency support (KRW/AED).

## Tech Stack

- **Framework**: Electron (main + renderer process architecture)
- **Frontend**: React 19 + TypeScript
- **UI Library**: MUI (Material-UI) v7 with @mui/x-data-grid
- **Charts**: Recharts
- **Database**: SQLite via better-sqlite3
- **Bundler**: Vite (renderer), tsc (main process)
- **Routing**: react-router-dom (HashRouter)

## Build and Development Commands

```bash
# Development (runs both main and renderer processes)
npm run dev

# Build for production
npm run build

# Build specific parts
npm run build:main      # Build main process only
npm run build:renderer  # Build renderer process only

# Package the app
npm run package
```

## Project Structure

```
src/
├── main/                    # Electron main process
│   ├── index.ts            # Main entry, IPC handlers, window creation
│   ├── database.ts         # SQLite database initialization and path management
│   ├── preload.ts          # Context bridge for renderer-main IPC
│   └── migrations/         # Database schema migrations
│       ├── index.ts        # Migration runner
│       └── 00X_*.ts        # Individual migrations
│
├── renderer/               # React frontend (Vite)
│   ├── App.tsx            # Main app with routing
│   ├── main.tsx           # React entry point
│   ├── theme.ts           # MUI theme configuration
│   ├── pages/             # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Transactions.tsx
│   │   ├── Budget.tsx
│   │   ├── Statistics.tsx
│   │   ├── Accounts.tsx
│   │   ├── AccountBalanceHistory.tsx
│   │   ├── Assets.tsx
│   │   ├── Liabilities.tsx
│   │   ├── Categories.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── layout/        # Sidebar, Header
│   │   ├── modals/        # Dialog components
│   │   └── shared/        # Reusable components (AmountText, MonthNavigation)
│   └── contexts/          # React contexts (PageContext)
│
└── shared/                # Shared types
```

## Architecture Patterns

### IPC Communication
The app uses Electron's contextBridge for secure main-renderer communication:

```typescript
// Renderer: Access via window.electronAPI
await window.electronAPI.db.query('SELECT * FROM transactions WHERE date >= ?', [startDate])
await window.electronAPI.db.get('SELECT * FROM settings WHERE key = ?', ['exchange_rate'])
```

### Database Queries
- Use `db.query()` for SELECT (returns array) and INSERT/UPDATE/DELETE (returns run result)
- Use `db.get()` for single row SELECT
- SQLite datetime: Always use single quotes: `datetime('now')` not `datetime("now")`

### Multi-Currency Support
- Two currencies supported: KRW (Korean Won) and AED (UAE Dirham)
- Exchange rate stored in settings table (`key: 'exchange_rate'`)
- All totals and comparisons should convert AED to KRW using the exchange rate

```typescript
const totalKRW = items.reduce((sum, item) => {
  return sum + (item.currency === 'AED' ? item.amount * exchangeRate : item.amount)
}, 0)
```

## Database Schema (Key Tables)

- **accounts**: Bank accounts with owner (self/spouse/child), type, currency
- **account_balances**: Balance history snapshots
- **transactions**: Income/expense records with category_id, date, currency, include_in_stats flag
- **categories**: Income/expense categories with expense_type (fixed/variable)
- **budget_items**: Budget templates with budget_type (fixed_monthly, variable_monthly, distributed)
  - `distributed` type uses `valid_from` and `valid_to` for date-based budget distribution
  - Budget items can be grouped via `group_name` for aggregated spending tracking
- **budget_item_categories**: M:N mapping between budget items and categories
- **assets**: Real estate and stocks
- **liabilities**: Loans and debts
- **settings**: Key-value configuration (exchange_rate, etc.)

## Database Migrations

Migrations are in `src/main/migrations/` and run automatically on app startup.

To add a new migration:
1. Create `src/main/migrations/00X_description.ts`
2. Export a `Migration` object with `version`, `name`, and `up` function
3. Import and add to the `migrations` array in `index.ts`

## Key Implementation Notes

- **Page titles**: Set via `usePageContext()` hook's `setPageTitle()`
- **Add buttons**: Header shows "+" button when page sets `setOnAdd()` callback
- **Data loading**: Pages typically load data in `useEffect` based on selected year/month
- **Amount display**: Use `<AmountText>` component for consistent currency formatting
- **Month navigation**: Use `<MonthNavigation>` component for year/month selection with data indicators

## Database Bundling

The app bundles a default database file (`data/rich-home.db`) which is copied to the user's data directory on first run. This is configured in `package.json` under `build.extraResources`.

- Development: Uses `data/rich-home.db` in project root
- Production: Copies from `resources/data/rich-home.db` to user data directory

## Language

The application UI is in Korean. Code comments may be in Korean.
