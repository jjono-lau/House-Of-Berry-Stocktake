import { Dot } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { APP_PAGES } from './constants.js'
import { useInventory } from './hooks/useInventory.js'
import { DemoPage } from './pages/DemoPage.jsx'
import { HistoryPage } from './pages/HistoryPage.jsx'
import { StatsPage } from './pages/StatsPage.jsx'
import { StocktakePage } from './pages/StocktakePage.jsx'
import { classNames } from './utils/classNames.js'

const PAGE_COMPONENTS = {
  demo: DemoPage,
  stocktake: StocktakePage,
  history: HistoryPage,
  stats: StatsPage,
}

const BRAND_NAME = "Jacqueline's Trash Accounting"

export default function App() {
  const inventoryApi = useInventory()
  const [activePage, setActivePage] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '')
      if (APP_PAGES.some((page) => page.id === hash)) {
        return hash
      }
    }
    return APP_PAGES[0].id
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '')
      if (APP_PAGES.some((page) => page.id === hash)) {
        setActivePage(hash)
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.hash = activePage
    }
  }, [activePage])

  const CurrentPage = useMemo(() => PAGE_COMPONENTS[activePage] ?? DemoPage, [activePage])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-16 pt-10 sm:px-10">
        <header className="flex flex-col gap-4 border-b border-white/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500 shadow-sm">
              <span>Inventory</span>
              <Dot aria-hidden className="h-3 w-3 text-indigo-400" strokeWidth={3} />
              <span>Toolkit</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{BRAND_NAME}</h1>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
                Import your workbook, capture the latest stocktake, and export clean audit trails with insights on how stock moves.
              </p>
            </div>
          </div>
          {inventoryApi.metadata?.sourceFileName ? (
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-5 py-3 text-right text-xs text-slate-500 shadow-sm">
              <p className="font-semibold text-slate-700">{inventoryApi.metadata.sourceFileName}</p>
              {inventoryApi.metadata.sheetName ? <p>Sheet: {inventoryApi.metadata.sheetName}</p> : null}
            </div>
          ) : null}
        </header>

        <nav className="mt-6 flex gap-3 overflow-x-auto pb-2">
          {APP_PAGES.map((page) => {
            const isActive = page.id === activePage
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => setActivePage(page.id)}
                className={classNames(
                  'flex min-w-[140px] flex-col items-start gap-2 rounded-3xl border px-5 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300',
                  isActive ? 'border-indigo-200 bg-white shadow-sm'
                    : 'border-transparent bg-white/60 text-slate-600',
                )}
              >
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">{page.label}</span>
                <span className="text-sm font-medium text-slate-800">{page.tagline}</span>
              </button>
            )
          })}
        </nav>

        <main className="mt-10 flex-1">
          <CurrentPage {...inventoryApi} navigate={setActivePage} />
        </main>

        <footer className="mt-16 border-t border-white/60 pt-6 text-xs text-slate-500">
          <p>Built to fix "organised" chaos. All processing stays on your device.</p>
        </footer>
      </div>
    </div>
  )
}
