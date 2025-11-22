import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  db: {
    query: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:query', sql, params),
    get: (sql: string, params?: unknown[]) => ipcRenderer.invoke('db:get', sql, params),
    getPath: () => ipcRenderer.invoke('db:getPath') as Promise<{
      currentPath: string
      defaultPath: string
      isCustom: boolean
    }>,
    selectFolder: () => ipcRenderer.invoke('db:selectFolder') as Promise<{
      canceled: boolean
      path?: string
    }>,
    changePath: (newPath: string, copyExisting: boolean) =>
      ipcRenderer.invoke('db:changePath', newPath, copyExisting) as Promise<{
        success: boolean
        error?: string
      }>,
    resetPath: () => ipcRenderer.invoke('db:resetPath') as Promise<{
      success: boolean
      error?: string
    }>,
  },
  app: {
    restart: () => ipcRenderer.invoke('app:restart'),
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
