import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState.jsx'
import { MetricCard } from '../components/MetricCard.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import {
  formatDateTime,
  formatDelta,
  formatNumber,
  formatRelativeTime,
} from '../utils/format.js'

const computeValueImpact = (entry) =>
  entry.valueImpact ??
  (entry.receivedValue ?? 0) -
    (entry.soldValue ?? (entry.sold ?? 0) * (entry.soldUnitCost ?? entry.unitCost ?? 0))

export const HistoryPage = ({ history }) => {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [noteModal, setNoteModal] = useState({ title: '', content: '' })

  const categories = useMemo(() => {
    const unique = new Set(history.map((entry) => entry.category).filter(Boolean))
    return ['all', ...unique]
  }, [history])

  const filteredHistory = useMemo(() => {
    const query = search.trim().toLowerCase()
    return history.filter((entry) => {
      const matchesQuery =
        !query ||
        entry.name.toLowerCase().includes(query) ||
        (entry.sku && entry.sku.toLowerCase().includes(query)) ||
        (entry.performedBy && entry.performedBy.toLowerCase().includes(query))
      const matchesCategory = categoryFilter === 'all' || entry.category === categoryFilter
      return matchesQuery && matchesCategory
    })
  }, [history, search, categoryFilter])

  const summary = useMemo(() => {
    return filteredHistory.reduce(
      (acc, entry) => {
        const sold = entry.sold ?? 0
        const received = entry.received ?? 0
        acc.adjustments += 1
        acc.sold += sold
        acc.received += received
        acc.units += entry.delta
        acc.value += computeValueImpact(entry)
        if (!acc.latest || new Date(entry.timestamp) > new Date(acc.latest)) {
          acc.latest = entry.timestamp
        }
        return acc
      },
      { adjustments: 0, sold: 0, received: 0, units: 0, value: 0, latest: null },
    )
  }, [filteredHistory])

  if (!history.length) {
    return (
      <EmptyState
        title="No adjustments recorded"
        message="Commit stocktake changes to begin capturing a full movement audit trail with user attribution and commentary."
      />
    )
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="History"
        title="Stock movement history"
        description="Comprehensive audit trail of stock movements, responsible users, variance totals, and supporting notes."
      />

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Adjustments"
          value={formatNumber(summary.adjustments)}
          delta={summary.latest ? formatRelativeTime(summary.latest) : '-'}
          deltaLabel={summary.latest ? 'Last adjustment' : ''}
        />
        <MetricCard label="Units sold" value={formatNumber(summary.sold)} positive={false} />
        <MetricCard label="Units received" value={formatNumber(summary.received)} positive={summary.received > 0} />
        <MetricCard
          label="Value impact"
          value={formatDelta(summary.value, { currency: true, showZero: true })}
          positive={summary.value >= 0}
        />
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full max-w-md items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2">
            <Search aria-hidden className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by SKU, item, or name"
              className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Category</label>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All categories' : category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[1000px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Timestamp</th>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Previous</th>
                <th className="px-3 py-2 text-left">Sold</th>
                <th className="px-3 py-2 text-left">Received</th>
                <th className="px-3 py-2 text-left">New</th>
                <th className="px-3 py-2 text-left">Δ Units</th>
                <th className="px-3 py-2 text-left">Value</th>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Item note</th>
                <th className="px-3 py-2 text-left">Adjustment note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredHistory.map((entry) => {
                const valueImpact = computeValueImpact(entry)
                return (
                  <tr key={entry.id} className="transition hover:bg-indigo-50/40">
                    <td className="px-3 py-2 text-xs text-slate-500">
                      <div className="space-y-1">
                        <p>{formatDateTime(entry.timestamp)}</p>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                          {formatRelativeTime(entry.timestamp)}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-800">{entry.name}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          {entry.sku || 'No SKU'} / {entry.category || 'Uncategorised'}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{formatNumber(entry.previousCount)}</td>
                    <td className="px-3 py-2 font-semibold text-rose-500">{formatNumber(entry.sold ?? 0)}</td>
                    <td className="px-3 py-2 font-semibold text-emerald-600">{formatNumber(entry.received ?? 0)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatNumber(entry.newCount)}</td>
                    <td
                      className={`px-3 py-2 font-semibold ${
                        entry.delta > 0 ? 'text-emerald-600' : entry.delta < 0 ? 'text-rose-500' : 'text-slate-500'
                      }`}
                    >
                      {formatDelta(entry.delta, { showZero: true })}
                    </td>
                    <td
                      className={`px-3 py-2 font-medium ${
                        valueImpact !== 0 ? (valueImpact > 0 ? 'text-emerald-600' : 'text-rose-500') : 'text-slate-500'
                      }`}
                    >
                      {formatDelta(valueImpact, { currency: true, showZero: true })}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-600">{entry.performedBy || '-'}</td>
                    <td className="px-3 py-2 text-sm text-slate-500">
                      <button
                        type="button"
                        onClick={() => setNoteModal({ title: 'Item note', content: entry.itemNote || '-' })}
                        className="max-w-[120px] truncate rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                        title={entry.itemNote || '-'}
                      >
                        {entry.itemNote || '-'}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-500">
                      <button
                        type="button"
                        onClick={() => setNoteModal({ title: 'Adjustment note', content: entry.notes || '-' })}
                        className="max-w-[120px] truncate rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                        title={entry.notes || '-'}
                      >
                        {entry.notes || '-'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {noteModal.content ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Note</p>
                <p className="text-sm font-semibold text-slate-800">{noteModal.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setNoteModal({ title: '', content: '' })}
                className="text-sm font-semibold text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap">
              {noteModal.content}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
