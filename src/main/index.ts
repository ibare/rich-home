import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import { autoUpdater } from 'electron-updater'
import { initDatabase, getDatabase, getCurrentDbPath, getDefaultPath, changeDbPath, resetToDefaultPath } from './database'

let mainWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV === 'development'

// 자동 업데이트 설정
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

function createWindow() {
  // 아이콘 경로 설정
  const iconPath = isDev
    ? path.join(__dirname, '../../build/icon.png')
    : path.join(__dirname, '../../build/icon.png')

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: true,
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5200')
    // DevTools는 Cmd+Option+I로 수동으로 열기
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 로드 에러 처리
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // macOS Dock 아이콘 설정 (개발 모드에서만 - 프로덕션은 번들된 icns 사용)
  if (isDev && process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(app.getAppPath(), 'build/icon.png')
    try {
      app.dock.setIcon(iconPath)
    } catch (e) {
      console.error('Failed to set dock icon:', e)
    }
  }

  initDatabase()
  createWindow()

  // 프로덕션에서만 자동 업데이트 체크
  if (!isDev) {
    autoUpdater.checkForUpdates()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 자동 업데이트 이벤트 핸들러
autoUpdater.on('update-available', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: '업데이트 가능',
    message: `새 버전 ${info.version}이 있습니다. 다운로드하시겠습니까?`,
    buttons: ['다운로드', '나중에'],
    defaultId: 0,
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate()
    }
  })
})

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: '업데이트 준비 완료',
    message: '업데이트가 다운로드되었습니다. 지금 재시작하여 설치하시겠습니까?',
    buttons: ['재시작', '나중에'],
    defaultId: 0,
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall()
    }
  })
})

autoUpdater.on('error', (error) => {
  console.error('Auto-updater error:', error)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers - Database queries
ipcMain.handle('db:query', async (_event, sql: string, params?: unknown[]) => {
  const db = getDatabase()
  try {
    const stmt = db.prepare(sql)
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return params ? stmt.all(...params) : stmt.all()
    } else {
      return params ? stmt.run(...params) : stmt.run()
    }
  } catch (error) {
    console.error('Database error:', error)
    throw error
  }
})

ipcMain.handle('db:get', async (_event, sql: string, params?: unknown[]) => {
  const db = getDatabase()
  try {
    const stmt = db.prepare(sql)
    return params ? stmt.get(...params) : stmt.get()
  } catch (error) {
    console.error('Database error:', error)
    throw error
  }
})

// IPC Handlers - Database path management
ipcMain.handle('db:getPath', async () => {
  return {
    currentPath: getCurrentDbPath(),
    defaultPath: getDefaultPath(),
    isCustom: getCurrentDbPath() !== getDefaultPath(),
  }
})

ipcMain.handle('db:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: '데이터베이스 저장 위치 선택',
    buttonLabel: '선택',
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true }
  }

  return { canceled: false, path: result.filePaths[0] }
})

ipcMain.handle('db:changePath', async (_event, newPath: string, copyExisting: boolean) => {
  return changeDbPath(newPath, copyExisting)
})

ipcMain.handle('db:resetPath', async () => {
  return resetToDefaultPath()
})

// IPC Handler - App restart
ipcMain.handle('app:restart', async () => {
  app.relaunch()
  app.exit(0)
})
