import { useCallback, useMemo, useState } from 'react'
import {
  AUTO_SKU_PAD_LENGTH,
  AUTO_SKU_PREFIX,
  MOVEMENT_WINDOW_DAYS,
} from '../constants.js'
import {
  createTemplateWorkbook,
  createUpdatedWorkbook,
  parseInventoryWorkbook,
} from '../utils/excel.js'
import { parseNumericInput } from '../utils/numbers.js'

const normaliseManualString = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).trim()
}

const formatAutoSku = (counter) => {
  const number = String(counter).padStart(AUTO_SKU_PAD_LENGTH, '0')
  return `${AUTO_SKU_PREFIX}${number}`
}

const extractSkuNumber = (sku) => {
  if (!sku) {
    return null
  }
  const match = String(sku).match(/(\d+)(?!.*\d)/)
  return match ? Number.parseInt(match[1], 10) : null
}

const computeNextSkuNumber = (items, fallback = 1) => {
  let max = fallback - 1
  items.forEach((item) => {
    const candidate = extractSkuNumber(item.sku)
    if (candidate && candidate > max) {
      max = candidate
    }
  })
  return max + 1
}

const buildHistoryEntry = (item, sold, received, nextCount, timestamp, meta) => {
  const delta = nextCount - item.currentCount
  if (delta === 0 && sold === 0 && received === 0) {
    return null
  }
  return {
    id: `${item.id}-${timestamp}`,
    itemId: item.id,
    sku: item.sku,
    name: item.name,
    category: item.category,
    previousCount: item.currentCount,
    newCount: nextCount,
    sold,
    received,
    delta,
    unitCost: item.unitCost,
    performedBy: meta?.performedBy || '',
    notes: meta?.notes || '',
    timestamp,
  }
}

const parseAdjustment = (value) => {
  const parsed = parseNumericInput(value, 0)
  if (!Number.isFinite(parsed)) {
    return 0
  }
  return Math.max(0, parsed)
}

export const useInventory = () => {
  const [inventory, setInventory] = useState([])
  const [history, setHistory] = useState([])
  const [metadata, setMetadata] = useState({
    sourceFileName: '',
    lastImportedAt: null,
    lastStocktakeAt: null,
    sheetName: null,
    nextSkuNumber: 1,
  })
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadFromFile = useCallback(async (file) => {
    setIsLoading(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const { inventory: parsedInventory, workbookMeta } = parseInventoryWorkbook(buffer)
      setInventory(parsedInventory)
      setHistory([])
      setMetadata((prev) => ({
        ...prev,
        sourceFileName: file.name,
        sheetName: workbookMeta.sheetName,
        lastImportedAt: workbookMeta.importedAt,
        lastStocktakeAt: null,
        nextSkuNumber: computeNextSkuNumber(parsedInventory),
      }))
      return parsedInventory.length
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateDraftAdjustment = useCallback((id, field, rawValue) => {
    if (!['draftSold', 'draftReceived'].includes(field)) {
      return
    }
    setInventory((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: rawValue,
            }
          : item,
      ),
    )
  }, [])

  const resetDrafts = useCallback(() => {
    setInventory((prev) =>
      prev.map((item) => ({
        ...item,
        draftSold: '',
        draftReceived: '',
      })),
    )
  }, [])

  const applyStocktake = useCallback((meta = {}) => {
    const timestamp = new Date().toISOString()
    const pendingHistory = []
    setInventory((prev) =>
      prev.map((item) => {
        const sold = parseAdjustment(item.draftSold)
        const received = parseAdjustment(item.draftReceived)
        const nextCount = item.currentCount - sold + received
        const historyEntry = buildHistoryEntry(item, sold, received, nextCount, timestamp, meta)
        if (historyEntry) {
          pendingHistory.push(historyEntry)
        }
        return {
          ...item,
          lastCount: item.currentCount,
          currentCount: nextCount,
          draftSold: '',
          draftReceived: '',
          lastUpdated: historyEntry ? timestamp : item.lastUpdated,
        }
      }),
    )
    if (pendingHistory.length) {
      setHistory((prev) => [...pendingHistory, ...prev])
      setMetadata((prev) => ({ ...prev, lastStocktakeAt: timestamp }))
    }
    return pendingHistory
  }, [])

  const clearInventory = useCallback(() => {
    setInventory([])
    setHistory([])
    setMetadata({
      sourceFileName: '',
      lastImportedAt: null,
      lastStocktakeAt: null,
      sheetName: null,
      nextSkuNumber: 1,
    })
    setError(null)
  }, [])

  const addManualItem = useCallback((partial = {}) => {
    const timestamp = new Date().toISOString()
    const nextSkuNumber = metadata.nextSkuNumber ?? 1
    const sku = formatAutoSku(nextSkuNumber)
    const name = normaliseManualString(partial.name) || `Manual Item ${nextSkuNumber}`
    const category = normaliseManualString(partial.category) || 'Uncategorised'
    const unitCost = parseNumericInput(partial.unitCost, 0)
    const currentCount = parseAdjustment(partial.currentCount)
    const newItem = {
      id: `${sku}-${Math.random().toString(36).slice(2, 8)}`,
      sku,
      name,
      category,
      unitCost,
      currentCount,
      lastCount: 0,
      draftSold: '',
      draftReceived: '',
      lastUpdated: timestamp,
    }
    setInventory((prev) => [newItem, ...prev])
    setHistory((prev) => [
      {
        id: `${newItem.id}-${timestamp}`,
        itemId: newItem.id,
        sku: newItem.sku,
        name: newItem.name,
        category: newItem.category,
        previousCount: 0,
        newCount: newItem.currentCount,
        sold: 0,
        received: newItem.currentCount,
        delta: newItem.currentCount,
        unitCost: newItem.unitCost,
        performedBy: partial.performedBy || 'Manual entry',
        notes: partial.notes || 'Added manually',
        timestamp,
      },
      ...prev,
    ])
    setMetadata((prev) => ({
      ...prev,
      lastStocktakeAt: timestamp,
      nextSkuNumber: nextSkuNumber + 1,
    }))
    return newItem
  }, [metadata.nextSkuNumber])

  const hasInventory = inventory.length > 0
  const hasDrafts = useMemo(
    () => inventory.some((item) => parseAdjustment(item.draftSold) > 0 || parseAdjustment(item.draftReceived) > 0),
    [inventory],
  )

  const draftSummary = useMemo(() => {
    return inventory.reduce(
      (acc, item) => {
        const sold = parseAdjustment(item.draftSold)
        const received = parseAdjustment(item.draftReceived)
        if (sold === 0 && received === 0) {
          return acc
        }
        acc.items += 1
        acc.sold += sold
        acc.received += received
        acc.value += (received - sold) * item.unitCost
        return acc
      },
      { items: 0, sold: 0, received: 0, value: 0 },
    )
  }, [inventory])

  const totals = useMemo(() => {
    const totalSkus = inventory.length
    const totalCurrent = inventory.reduce((acc, item) => acc + item.currentCount, 0)
    const totalLast = inventory.reduce((acc, item) => acc + item.lastCount, 0)
    const totalValue = inventory.reduce((acc, item) => acc + item.currentCount * item.unitCost, 0)
    return {
      totalSkus,
      totalCurrent,
      totalLast,
      totalDelta: totalCurrent - totalLast,
      totalValue,
    }
  }, [inventory])

  const recentMovements = useMemo(() => {
    if (!history.length) {
      return []
    }
    const windowMs = MOVEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000
    const threshold = Date.now() - windowMs
    return history.filter((entry) => {
      const timestamp = new Date(entry.timestamp).getTime()
      return Number.isFinite(timestamp) && timestamp >= threshold
    })
  }, [history])

  const generateTemplateBytes = useCallback(() => createTemplateWorkbook(), [])

  const exportWorkbookBytes = useCallback(
    () => createUpdatedWorkbook(inventory, metadata, history),
    [inventory, metadata, history],
  )

  return {
    inventory,
    history,
    metadata,
    totals,
    draftSummary,
    recentMovements,
    hasInventory,
    hasDrafts,
    isLoading,
    error,
    loadFromFile,
    updateDraftAdjustment,
    resetDrafts,
    applyStocktake,
    clearInventory,
    addManualItem,
    generateTemplateBytes,
    exportWorkbookBytes,
  }
}
