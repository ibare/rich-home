import type BetterSqlite3 from 'better-sqlite3'

export interface Migration {
  version: number
  name: string
  up: (db: BetterSqlite3.Database) => void
}

// 마이그레이션 목록 (버전 순서대로)
import { migration001 } from './001_initial_schema'
import { migration002 } from './002_amount_to_real'
import { migration003 } from './003_monthly_closings'

export const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,
]

export function runMigrations(db: BetterSqlite3.Database): void {
  // 마이그레이션 버전 테이블 생성
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // 기존 DB 감지: schema_migrations는 비어있지만 다른 테이블이 존재하는 경우
  const migrationCount = (db.prepare('SELECT COUNT(*) as count FROM schema_migrations').get() as { count: number }).count

  if (migrationCount === 0) {
    // accounts 테이블 존재 여부로 기존 DB인지 확인
    const tableExists = db.prepare(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='accounts'"
    ).get() as { count: number }

    if (tableExists.count > 0) {
      // 기존 DB: migration 001은 이미 적용된 것으로 표시
      console.log('Existing database detected, marking migration 001 as applied')
      db.prepare(
        'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
      ).run(1, 'initial_schema (existing)')
    }
  }

  // 현재 적용된 버전 확인
  const appliedVersions = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[])
      .map(row => row.version)
  )

  // 미적용 마이그레이션 실행
  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue
    }

    console.log(`Running migration ${migration.version}: ${migration.name}`)

    try {
      // 트랜잭션으로 마이그레이션 실행
      db.transaction(() => {
        migration.up(db)

        // 마이그레이션 버전 기록
        db.prepare(
          'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
        ).run(migration.version, migration.name)
      })()

      console.log(`Migration ${migration.version} completed`)
    } catch (error) {
      console.error(`Migration ${migration.version} failed:`, error)
      throw error
    }
  }

  console.log('All migrations completed')
}
