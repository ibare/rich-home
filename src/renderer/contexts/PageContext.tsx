import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface PageContextType {
  pageTitle: string
  setPageTitle: (title: string) => void
  onAdd: (() => void) | null
  setOnAdd: (callback: (() => void) | null) => void
}

const PageContext = createContext<PageContextType | null>(null)

export function PageProvider({ children }: { children: ReactNode }) {
  const [pageTitle, setPageTitle] = useState('')
  const [onAdd, setOnAddState] = useState<(() => void) | null>(null)

  const setOnAdd = useCallback((callback: (() => void) | null) => {
    setOnAddState(() => callback)
  }, [])

  return (
    <PageContext.Provider value={{ pageTitle, setPageTitle, onAdd, setOnAdd }}>
      {children}
    </PageContext.Provider>
  )
}

export function usePageContext() {
  const context = useContext(PageContext)
  if (!context) {
    throw new Error('usePageContext must be used within a PageProvider')
  }
  return context
}
