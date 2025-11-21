import * as path from 'path'
import { app } from 'electron'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3')

import type BetterSqlite3 from 'better-sqlite3'
import { runMigrations } from './migrations'

let db: BetterSqlite3.Database | null = null

export function getDatabase(): BetterSqlite3.Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'rich-home.db')

  console.log('Database path:', dbPath)

  const database = new Database(dbPath) as BetterSqlite3.Database
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')

  // 마이그레이션 실행
  runMigrations(database)

  db = database
}
