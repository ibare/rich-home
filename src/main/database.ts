import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3')

import type BetterSqlite3 from 'better-sqlite3'
import { runMigrations } from './migrations'

let db: BetterSqlite3.Database | null = null
let currentDbPath: string = ''

// 설정 파일 경로 (DB 경로를 저장)
const getConfigPath = () => path.join(app.getPath('userData'), 'config.json')

// 기본 DB 경로
const getDefaultDbPath = () => path.join(app.getPath('userData'), 'rich-home.db')

interface AppConfig {
  dbPath?: string
}

function loadConfig(): AppConfig {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Failed to load config:', error)
  }
  return {}
}

function saveConfig(config: AppConfig): void {
  try {
    const configPath = getConfigPath()
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  } catch (error) {
    console.error('Failed to save config:', error)
  }
}

export function getDatabase(): BetterSqlite3.Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

export function getCurrentDbPath(): string {
  return currentDbPath
}

export function getDefaultPath(): string {
  return getDefaultDbPath()
}

export function initDatabase(customPath?: string): void {
  // 기존 DB 연결 닫기
  if (db) {
    db.close()
    db = null
  }

  // DB 경로 결정
  const config = loadConfig()
  const dbPath = customPath || config.dbPath || getDefaultDbPath()

  // 디렉토리 확인/생성
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  console.log('Database path:', dbPath)
  currentDbPath = dbPath

  const database = new Database(dbPath) as BetterSqlite3.Database
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')

  // 마이그레이션 실행
  runMigrations(database)

  db = database
}

export function changeDbPath(newPath: string, copyExisting: boolean): { success: boolean; error?: string } {
  try {
    const oldPath = currentDbPath
    const newDbPath = path.join(newPath, 'rich-home.db')

    // 새 경로에 이미 DB가 있는지 확인
    if (fs.existsSync(newDbPath) && newDbPath !== oldPath) {
      return { success: false, error: '선택한 폴더에 이미 데이터베이스 파일이 있습니다.' }
    }

    // 기존 DB 닫기
    if (db) {
      db.close()
      db = null
    }

    // 기존 DB 복사 또는 이동
    if (copyExisting && fs.existsSync(oldPath) && newDbPath !== oldPath) {
      // WAL 파일도 함께 처리
      fs.copyFileSync(oldPath, newDbPath)

      const walPath = oldPath + '-wal'
      const shmPath = oldPath + '-shm'
      if (fs.existsSync(walPath)) {
        fs.copyFileSync(walPath, newDbPath + '-wal')
      }
      if (fs.existsSync(shmPath)) {
        fs.copyFileSync(shmPath, newDbPath + '-shm')
      }
    }

    // 설정 저장
    const config = loadConfig()
    config.dbPath = newDbPath
    saveConfig(config)

    // 새 경로로 DB 초기화
    initDatabase(newDbPath)

    return { success: true }
  } catch (error) {
    console.error('Failed to change DB path:', error)
    // 실패시 기존 DB로 복구 시도
    try {
      initDatabase()
    } catch (e) {
      console.error('Failed to recover database:', e)
    }
    return { success: false, error: String(error) }
  }
}

export function resetToDefaultPath(): { success: boolean; error?: string } {
  try {
    const defaultPath = getDefaultDbPath()

    // 이미 기본 경로면 무시
    if (currentDbPath === defaultPath) {
      return { success: true }
    }

    // 기존 DB 닫기
    if (db) {
      db.close()
      db = null
    }

    // 설정에서 커스텀 경로 제거
    const config = loadConfig()
    delete config.dbPath
    saveConfig(config)

    // 기본 경로로 DB 초기화
    initDatabase(defaultPath)

    return { success: true }
  } catch (error) {
    console.error('Failed to reset DB path:', error)
    return { success: false, error: String(error) }
  }
}
