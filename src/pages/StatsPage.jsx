import { useMemo } from 'react'
import { MetricCard } from '../components/MetricCard.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { MOVEMENT_WINDOW_DAYS } from '../constants.js'
import {
  formatCurrency,
  formatDelta,
  formatNumber,
  formatPercent,
} from '../utils/format.js'

const MovementsList = ({ title, items, emptyLabel, highlight = 'neutral' }) => (
  <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
    <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">{title}</h3>
    <div className="mt-4 space-y-4">
      {items.length ? (
        items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-800">{item.name}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {item.sku || 'No SKU'} . {item.category || 'Uncategorised'}
              </p>
            </div>
            <div className="text-right text-sm font-semibold">
              <p
                className={
                  highlight === 'outflow'
                    ? 'text-rose-500'
                    : highlight === 'calm'
                      ? 'text-slate-500'
                      : 'text-emerald-600'
                }
              >
                {formatNumber(item.sold)}
              </p>
              <p className="text-xs text-slate-400">{formatCurrency(item.soldValue)}</p>
            </div>
          </div>
        ))
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          {emptyLabel}
        </p>
      )}
    </div>
  </div>
)

export const StatsPage = ({ inventory, totals, recentMovements }) => {
  const movementsSummary = useMemo(() => {
    return recentMovements.reduce(
      (acc, entry) => {
        const sold = entry.sold ?? 0
        const received = entry.received ?? 0
        const unitCost = entry.unitCost ?? 0
        if (sold > 0 || received > 0) {
          acc.entries += 1
        }
        acc.sold += sold
        acc.received += received
        acc.valueOut += sold * unitCost
        acc.valueIn += received * unitCost
        return acc
      },
      { entries: 0, sold: 0, received: 0, valueOut: 0, valueIn: 0 },
    )
  }, [recentMovements])

  const moverTotals = useMemo(() => {
    const map = new Map()
    inventory.forEach((item) => {
      map.set(item.id, {
        id: item.id,
        sku: item.sku,
        name: item.name,
        category: item.category,
        sold: 0,
        soldValue: 0,
        received: 0,
        receivedValue: 0,
      })
    })
    recentMovements.forEach((entry) => {
      const key = entry.itemId || entry.sku || entry.name
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          sku: entry.sku,
          name: entry.name,
          category: entry.category,
          sold: 0,
          soldValue: 0,
          received: 0,
          receivedValue: 0,
        })
      }
      const bucket = map.get(key)
      const sold = entry.sold ?? 0
      const received = entry.received ?? 0
      const unitCost = entry.unitCost ?? 0
      bucket.sold += sold
      bucket.received += received
      bucket.soldValue += sold * unitCost
      bucket.receivedValue += received * unitCost
    })
    return Array.from(map.values())
  }, [inventory, recentMovements])

  const topOutflow = useMemo(
    () => moverTotals.filter((item) => item.sold > 0).sort((a, b) => b.sold - a.sold).slice(0, 4),
    [moverTotals],
  )

  const leastMoved = useMemo(() => {
    const sorted = [...moverTotals].sort((a, b) => a.sold - b.sold)
    return sorted.slice(0, 4)
  }, [moverTotals])

  const categoryBreakdown = useMemo(() => {
    const map = new Map()
    inventory.forEach((item) => {
      const key = item.category || 'Uncategorised'
      if (!map.has(key)) {
        map.set(key, { units: 0, value: 0 })
      }
      const bucket = map.get(key)
      bucket.units += item.currentCount
      bucket.value += item.currentCount * item.unitCost
    })
    const totalValue = Array.from(map.values()).reduce((acc, bucket) => acc + bucket.value, 0)
    return Array.from(map.entries())
      .map(([category, bucket]) => ({
        category,
        units: bucket.units,
        value: bucket.value,
        valueShare: totalValue ? bucket.value / totalValue : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [inventory])

  if (!inventory.length) {
    return (
      <EmptyState
        title="Insights unlock after your first import"
        message="Upload a workbook and record at least one stocktake to see category breakdowns, movers, and valuation stats."
      />
    )
  }

  const netUnits = movementsSummary.received - movementsSummary.sold
  const netValue = movementsSummary.valueIn - movementsSummary.valueOut

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Insights"
        title="How your stock is moving"
        description={`We analyse the last ${MOVEMENT_WINDOW_DAYS}-day movement window to surface trends, top outflows, and category breakdowns.`}
      />

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Units on hand" value={formatNumber(totals.totalCurrent)} />
        <MetricCard label="Inventory value" value={formatCurrency(totals.totalValue)} />
        <MetricCard
          label="Units sold"
          value={formatNumber(movementsSummary.sold)}
          delta={formatDelta(netUnits, { showZero: true })}
          deltaLabel="Net units"
          positive={netUnits >= 0}
        />
        <MetricCard
          label="Value out"
          value={formatCurrency(movementsSummary.valueOut)}
          delta={formatDelta(netValue, { currency: true, showZero: true })}
          deltaLabel="Net value"
          positive={netValue >= 0}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <MovementsList
          title="Top outflow"
          items={topOutflow}
          emptyLabel="No sold items in the selected window."
          highlight="outflow"
        />
        <MovementsList
          title="Least moved"
          items={leastMoved}
          emptyLabel="Everything moved at least once in this window."
          highlight="calm"
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
        <h2 className="text-lg font-semibold text-slate-900">Category breakdown</h2>
        <p className="mt-2 text-sm text-slate-600">
          Share of units and value across your current inventory snapshot.
        </p>
        <div className="mt-6 space-y-4">
          {categoryBreakdown.map((bucket) => (
            <div key={bucket.category} className="space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span className="font-medium text-slate-700">{bucket.category}</span>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {formatPercent(bucket.valueShare)} value
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-400"
                  style={{ width: `${Math.max(4, bucket.valueShare * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{formatNumber(bucket.units)} units</span>
                <span>{formatCurrency(bucket.value)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
