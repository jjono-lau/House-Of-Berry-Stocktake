import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { MetricCard } from '../components/MetricCard.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { AUTO_SKU_PAD_LENGTH, AUTO_SKU_PREFIX } from '../constants.js'
import { triggerWorkbookDownload } from '../utils/excel.js'
import {
  formatCurrency,
  formatDate,
  formatDelta,
  formatNumber,
} from '../utils/format.js'

const nextSkuPreview = (number) => {
  const count = number ?? 1
  return `${AUTO_SKU_PREFIX}${String(count).padStart(AUTO_SKU_PAD_LENGTH, '0')}`
}

const ManualItemForm = ({ onSubmit, nextSku }) => {
  const [form, setForm] = useState({
    name: '',
    category: '',
    unitCost: '',
    currentCount: '',
    performedBy: '',
    notes: '',
  })

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit(form)
    setForm({ name: '', category: '', unitCost: '', currentCount: '', performedBy: '', notes: '' })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white/70 p-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">SKU (auto)</span>
          <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">
            {nextSku}
          </div>
        </div>
        <label className="space-y-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Item name</span>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Item"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            required
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Category</span>
          <input
            name="category"
            value={form.category}
            onChange={handleChange}
            placeholder="Category"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Current count</span>
          <input
            name="currentCount"
            value={form.currentCount}
            onChange={handleChange}
            type="number"
            min="0"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            required
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Unit cost</span>
          <input
            name="unitCost"
            value={form.unitCost}
            onChange={handleChange}
            type="number"
            step="any"
            min="0"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Identifier (ID)</span>
          <input
            required
            name="performedBy"
            value={form.performedBy}
            onChange={handleChange}
            placeholder="e.g. Name / Location / Purpose etc."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>
      </div>
      <label className="space-y-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Notes</span>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={3}
          placeholder="Optional context for this item"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </label>
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="submit" variant="primary">
          Register item
        </Button>
      </div>
    </form>
  )
}

export const StocktakePage = ({
  inventory,
  hasInventory,
  hasImported,
  hasDrafts,
  updateDraftAdjustment,
  updateUnitCost,
  previewDraftImpact,
  resetDrafts,
  applyStocktake,
  exportWorkbookBytes,
  draftSummary,
  totals,
  metadata,
  addManualItem,
}) => {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [performedBy, setPerformedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('')
  const [manualStatus, setManualStatus] = useState('')

  const categories = useMemo(() => {
    const unique = new Set(inventory.map((item) => item.category).filter(Boolean))
    return ['all', ...unique]
  }, [inventory])

  const filteredInventory = useMemo(() => {
    const query = search.trim().toLowerCase()
    return inventory.filter((item) => {
      const matchesQuery =
        !query ||
        item.name.toLowerCase().includes(query) ||
        (item.sku && item.sku.toLowerCase().includes(query))
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
      return matchesQuery && matchesCategory
    })
  }, [inventory, search, categoryFilter])

  const handleExport = () => {
    const bytes = exportWorkbookBytes()
    const fileName = metadata?.sourceFileName
      ? metadata.sourceFileName.replace(/\.xlsx?$/i, '')
      : 'stocktake-control'
    triggerWorkbookDownload(bytes, `${fileName}-updated.xlsx`)
    setStatus('Generated the latest workbook, including movement history and summary tabs.')
  }

  const handleApply = () => {
    if (!performedBy.trim()) {
      setStatus('Enter the name of the person responsible before committing the stocktake.')
      return
    }
    const historyEntries = applyStocktake({ performedBy: performedBy.trim(), notes })
    if (historyEntries.length) {
      setStatus(`Recorded ${historyEntries.length} adjustments.`)
    } else {
      setStatus('No adjustments were detected. Capture sold or received units before committing.')
    }
    setPerformedBy('')
    setNotes('')
  }

  const handleManualAdd = (form) => {
    const newItem = addManualItem(form)
    setManualStatus(`Registered ${newItem.name} (${newItem.sku}) in the inventory register.`)
    setStatus('')
  }

  const netUnits = draftSummary.received - draftSummary.sold
  const draftBanner = draftSummary?.items > 0
    ? `Pending adjustments: ${draftSummary.items} lines - sold ${formatNumber(draftSummary.sold)} units, received ${formatNumber(draftSummary.received)} units (net ${formatDelta(netUnits, { showZero: true })}, ${formatDelta(draftSummary.value, { currency: true, showZero: true })}).`
    : null

  if (!hasImported) {
    return (
      <EmptyState
        title="Import a workbook to initialise your stocktake"
        message="Upload your current stocktake to stage adjustments, maintain an audit trail, and export reconciled results."
      />
    )
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Stocktake"
        title="Perform stocktake adjustments"
        description="Record sold and received quantities for each SKU, then confirm the updates when ready."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={resetDrafts}>
              Clear entries
            </Button>
            <Button variant="primary" onClick={handleApply} disabled={!hasDrafts || !performedBy.trim()}>
              Commit updates
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              Export workbook
            </Button>
          </div>
        }
      />
      {!hasInventory ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm text-slate-600">
          No inventory records are currently loaded. Register items below to establish opening balances.
        </p>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-4">
        <MetricCard label="Total SKUs" value={formatNumber(totals.totalSkus)} />
        <MetricCard
          label="Units on hand"
          value={formatNumber(totals.totalCurrent)}
          delta={formatDelta(totals.totalDelta, { showZero: true })}
          deltaLabel="vs last stocktake"
          positive={totals.totalDelta >= 0}
        />
        <MetricCard label="Inventory value" value={formatCurrency(totals.totalValue)} />
        <MetricCard
          label="Previous stocktake"
          value={totals.totalLast ? formatNumber(totals.totalLast) : ''}
          delta={metadata?.lastStocktakeAt ? formatDate(metadata.lastStocktakeAt) : ''}
          deltaLabel={metadata?.lastStocktakeAt ? 'Last performed' : ''}
        />
      </section>

      {draftBanner ? (
        <p className="rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-3 text-sm text-indigo-700">{draftBanner}</p>
      ) : null}
      {status ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm text-slate-600">{status}</p>
      ) : null}

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full max-w-md items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2">
            <Search aria-hidden className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by SKU or item"
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

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">Current</th>
                <th className="px-4 py-3 text-left">Unit cost</th>
                <th className="px-4 py-3 text-left">Sold</th>
                <th className="px-4 py-3 text-left">Received</th>
                <th className="px-4 py-3 text-left">Variance (units)</th>
                <th className="px-4 py-3 text-left">Value impact</th>
                <th className="px-4 py-3 text-left">Last updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
                {filteredInventory.map((item) => {
                  const costPreview = previewDraftImpact(item)
                  const nextCount =
                    typeof costPreview.totalQuantity === 'number'
                      ? costPreview.totalQuantity
                      : item.currentCount
                  const delta = nextCount - item.currentCount
                  const valueImpact = costPreview.receivedValue - costPreview.soldValue
                  const layerValue = (item.costLayers ?? []).reduce((acc, layer) => {
                    const quantity = Number(layer?.quantity ?? 0)
                    const cost = Number(layer?.unitCost ?? 0)
                    if (!Number.isFinite(quantity) || !Number.isFinite(cost)) {
                      return acc
                    }
                    return acc + quantity * cost
                  }, 0)
                  const layerQuantity = (item.costLayers ?? []).reduce((acc, layer) => {
                    const quantity = Number(layer?.quantity ?? 0)
                    return Number.isFinite(quantity) ? acc + quantity : acc
                  }, 0)
                  const averageCost =
                    layerQuantity > 0 ? layerValue / layerQuantity : item.unitCost ?? 0

                  return (
                    <tr key={item.id} className="transition hover:bg-indigo-50/40">
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-800">{item.name}</p>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                            {item.sku || 'No SKU'} | {item.category || 'Uncategorised'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatNumber(item.currentCount)}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <input
                            value={item.unitCost ?? ''}
                            onChange={(event) => updateUnitCost(item.id, event.target.value)}
                            type="number"
                            min="0"
                            step="any"
                            inputMode="decimal"
                            className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            placeholder="0.00"
                          />
                      
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={item.draftSold}
                          onChange={(event) => updateDraftAdjustment(item.id, 'draftSold', event.target.value)}
                          type="number"
                          min="0"
                          className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={item.draftReceived}
                          onChange={(event) => updateDraftAdjustment(item.id, 'draftReceived', event.target.value)}
                          type="number"
                          min="0"
                          className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          placeholder="0"
                        />
                      </td>
                      <td
                        className={`px-4 py-3 font-semibold ${
                          delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-500' : 'text-slate-500'
                        }`}
                      >
                        {formatDelta(delta, { showZero: true })}
                      </td>
                      <td
                        className={`px-4 py-3 font-medium ${
                          valueImpact > 0 ? 'text-emerald-600' : valueImpact < 0 ? 'text-rose-500' : 'text-slate-500'
                        }`}
                      >
                        {formatDelta(valueImpact, { currency: true, showZero: true })}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(item.lastUpdated)}</td>
                    </tr>
                  )
                })}
                {!filteredInventory.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                      No inventory records available. Register items below to begin tracking.
                    </td>
                  </tr>
                ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white/60 p-6 shadow-sm backdrop-blur">
        <h2 className="text-lg font-semibold text-slate-900">Apply adjustments</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Identifier (ID)</span>
            <input
              value={performedBy}
              onChange={(event) => setPerformedBy(event.target.value)}
              placeholder="e.g. Name / Location / Purpose etc."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Notes</span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional context for this stocktake"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={handleApply} disabled={!hasDrafts || !performedBy.trim()}>
            Commit stocktake
          </Button>
          <Button variant="ghost" onClick={resetDrafts}>
            Clear entries
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Every time you apply, we snapshot the previous counts and log a row in history so audits stay painless.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Register a new item</h2>
          {manualStatus ? (
            <p className="text-xs text-emerald-600">{manualStatus}</p>
          ) : null}
        </div>
        <ManualItemForm onSubmit={handleManualAdd} nextSku={nextSkuPreview(metadata?.nextSkuNumber)} />
      </section>
    </div>
  )
}



