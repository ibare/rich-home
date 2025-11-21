export interface ElectronAPI {
  db: {
    query: (sql: string, params?: unknown[]) => Promise<unknown>
    get: (sql: string, params?: unknown[]) => Promise<unknown>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
