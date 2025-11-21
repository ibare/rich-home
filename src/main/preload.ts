import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  db: {
    query: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:query', sql, params),
    get: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:get', sql, params),
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
