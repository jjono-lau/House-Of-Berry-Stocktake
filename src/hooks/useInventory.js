import { useCallback, useMemo, useState } from 'react'
import {
  AUTO_SKU_PAD_LENGTH,
  AUTO_SKU_PREFIX,
  MOVEMENT_WINDOW_DAYS,
  OPTIONAL_COLUMNS,
} from '../constants.js'
import {
  createBlankTemplateWorkbook,
  createTemplateWorkbook,
  createUpdatedWorkbook,
  parseInventoryWorkbook,
} from '../utils/excel.js'
import { parseNumericInput } from '../utils/numbers.js'

const INITIAL_METADATA = {
  sourceFileName: '',
  lastImportedAt: null,
  lastStocktakeAt: null,
  sheetName: null,
  nextSkuNumber: 1,
}

const EPSILON = 1e-9

const ensureFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const normaliseUnitCost = (value) => ensureFiniteNumber(value, 0)

const createInitialCostLayers = (quantity, unitCost, acquiredAt = null) => {
  const normalisedQuantity = ensureFiniteNumber(quantity, 0)
  if (normalisedQuantity <= EPSILON) {
    return []
  }
  return [
    {
      quantity: normalisedQuantity,
      unitCost: normaliseUnitCost(unitCost),
      acquiredAt,
    },
  ]
}

const mergeCostLayers = (layers = []) => {
  return layers.reduce((acc, layer) => {
    const quantity = ensureFiniteNumber(layer.quantity, 0)
    if (quantity <= EPSILON) {
      return acc
    }
    const unitCost = normaliseUnitCost(layer.unitCost)
    const acquiredAt = layer.acquiredAt || null
    const previous = acc[acc.length - 1]
    if (
      previous &&
      Math.abs(previous.unitCost - unitCost) <= EPSILON &&
      ((previous.acquiredAt && acquiredAt && previous.acquiredAt === acquiredAt) ||
        !previous.acquiredAt ||
        !acquiredAt)
    ) {
      previous.quantity += quantity
      return acc
    }
    acc.push({
      quantity,
      unitCost,
      acquiredAt,
    })
    return acc
  }, [])
}

const calculateLayersQuantity = (layers = []) =>
  layers.reduce((acc, layer) => acc + ensureFiniteNumber(layer.quantity, 0), 0)

const calculateLayersValue = (layers = []) =>
  layers.reduce(
    (acc, layer) =>
      acc + ensureFiniteNumber(layer.quantity, 0) * normaliseUnitCost(layer.unitCost),
    0,
  )

const computeCostMovement = ({
  layers = [],
  sold = 0,
  received = 0,
  unitCost = 0,
  timestamp = null,
}) => {
  const workingLayers = layers
    .map((layer) => ({
      quantity: ensureFiniteNumber(layer.quantity, 0),
      unitCost: normaliseUnitCost(layer.unitCost),
      acquiredAt: layer.acquiredAt || null,
    }))
    .filter((layer) => layer.quantity > EPSILON)

  let remainingSold = Math.max(0, ensureFiniteNumber(sold, 0))
  let soldValue = 0
  const remainderLayers = []

  workingLayers.forEach((layer) => {
    if (remainingSold <= EPSILON) {
      remainderLayers.push({ ...layer })
      return
    }
    const consume = Math.min(layer.quantity, remainingSold)
    if (consume > EPSILON) {
      soldValue += consume * layer.unitCost
      remainingSold -= consume
    }
    const leftover = layer.quantity - consume
    if (leftover > EPSILON) {
      remainderLayers.push({
        quantity: leftover,
        unitCost: layer.unitCost,
        acquiredAt: layer.acquiredAt,
      })
    }
  })

  if (remainingSold > EPSILON) {
    const fallbackCost = remainderLayers.length
      ? remainderLayers[remainderLayers.length - 1].unitCost
      : normaliseUnitCost(unitCost)
    soldValue += remainingSold * fallbackCost
    remainingSold = 0
  }

  const receivedQuantity = Math.max(0, ensureFiniteNumber(received, 0))
  const receivedUnitCost = normaliseUnitCost(unitCost)
  let receivedValue = 0
  if (receivedQuantity > EPSILON) {
    receivedValue = receivedQuantity * receivedUnitCost
    remainderLayers.push({
      quantity: receivedQuantity,
      unitCost: receivedUnitCost,
      acquiredAt: timestamp,
    })
  }

  const mergedLayers = mergeCostLayers(remainderLayers)
  const totalQuantity = calculateLayersQuantity(mergedLayers)
  const soldUnitCost = sold > EPSILON ? soldValue / sold : 0

  return {
    layers: mergedLayers,
    totalQuantity,
    soldValue,
    soldUnitCost,
    receivedValue,
    receivedUnitCost: receivedQuantity > EPSILON ? receivedUnitCost : 0,
  }
}

const summariseCostImpact = (item, sold, received, timestamp = null) =>
  computeCostMovement({
    layers: item?.costLayers ?? [],
    sold,
    received,
    unitCost: item?.unitCost ?? 0,
    timestamp,
  })

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

const buildHistoryEntry = (
  item,
  sold,
  received,
  nextCount,
  timestamp,
  meta,
  costSummary = {},
) => {
  const delta = nextCount - item.currentCount
  if (delta === 0 && sold === 0 && received === 0) {
    return null
  }
  const soldValue = ensureFiniteNumber(
    costSummary.soldValue,
    sold * normaliseUnitCost(item.unitCost),
  )
  const receivedValue = ensureFiniteNumber(
    costSummary.receivedValue,
    received * normaliseUnitCost(item.unitCost),
  )
  const soldUnitCost = sold > EPSILON ? soldValue / sold : 0
  const receivedUnitCost =
    received > EPSILON ? receivedValue / received : costSummary.receivedUnitCost ?? 0
  const valueImpact = receivedValue - soldValue
  const unitCost =
    delta !== 0
      ? valueImpact / delta
      : costSummary.receivedUnitCost || costSummary.soldUnitCost || item.unitCost
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
    unitCost,
    soldValue,
    receivedValue,
    soldUnitCost,
    receivedUnitCost,
    valueImpact,
    performedBy: meta?.performedBy || '',
    notes: meta?.notes || '',
    itemNote: item?.itemNote || '',
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
  const [metadata, setMetadata] = useState(INITIAL_METADATA)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadFromFile = useCallback(async (file) => {
    setIsLoading(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const {
        inventory: parsedInventory,
        history: parsedHistory = [],
        workbookMeta,
      } = parseInventoryWorkbook(buffer)

      const normalisedInventory = parsedInventory.map((item) => {
        const currentCount = Number.isFinite(item.currentCount) ? item.currentCount : 0
        const unitCost = normaliseUnitCost(item.unitCost)
        const lastCount = Number.isFinite(item.lastCount) ? item.lastCount : currentCount
        const itemNote = normaliseManualString(
          item.itemNote || item.note || item[OPTIONAL_COLUMNS.itemNote] || '',
        )
        const layerSourceTimestamp =
          item.lastUpdated || workbookMeta.lastStocktakeAt || workbookMeta.importedAt || null
        const initialLayers =
          Array.isArray(item.costLayers) && item.costLayers.length
            ? mergeCostLayers(item.costLayers)
            : createInitialCostLayers(currentCount, unitCost, layerSourceTimestamp)
        const layerQuantity = calculateLayersQuantity(initialLayers)
        const costLayers =
          Math.abs(layerQuantity - currentCount) > EPSILON
            ? createInitialCostLayers(currentCount, unitCost, layerSourceTimestamp)
            : initialLayers
        return {
          ...item,
          currentCount,
          lastCount,
          unitCost,
          costLayers,
          draftSold: '',
          draftReceived: '',
          itemNote,
        }
      })
      const normalisedHistory = parsedHistory.map((entry) => {
        const sold = ensureFiniteNumber(entry.sold, 0)
        const received = ensureFiniteNumber(entry.received, 0)
        const unitCost = normaliseUnitCost(entry.unitCost)
        const soldValue =
          entry.soldValue !== undefined
            ? ensureFiniteNumber(entry.soldValue, sold * unitCost)
            : sold * unitCost
        const receivedValue =
          entry.receivedValue !== undefined
            ? ensureFiniteNumber(entry.receivedValue, received * unitCost)
            : received * unitCost
        const soldUnitCost =
          entry.soldUnitCost !== undefined
            ? ensureFiniteNumber(entry.soldUnitCost, sold > EPSILON ? soldValue / sold : 0)
            : sold > EPSILON
              ? soldValue / sold
              : 0
        const receivedUnitCost =
          entry.receivedUnitCost !== undefined
            ? ensureFiniteNumber(entry.receivedUnitCost, received > EPSILON ? receivedValue / received : 0)
            : received > EPSILON
              ? receivedValue / received
              : 0
        const valueImpact =
          entry.valueImpact !== undefined
            ? ensureFiniteNumber(entry.valueImpact, receivedValue - soldValue)
            : receivedValue - soldValue
        return {
          ...entry,
          soldValue,
          receivedValue,
          soldUnitCost,
          receivedUnitCost,
          valueImpact,
        }
      })

      setInventory(normalisedInventory)
      setHistory(normalisedHistory)
      setMetadata({
        ...INITIAL_METADATA,
        sourceFileName: file.name,
        sheetName: workbookMeta.sheetName,
        lastImportedAt: workbookMeta.importedAt,
        lastStocktakeAt: workbookMeta.lastStocktakeAt ?? (normalisedHistory[0]?.timestamp ?? null),
        nextSkuNumber: computeNextSkuNumber(normalisedInventory),
      })
      return normalisedInventory.length
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

  const previewDraftImpact = useCallback((item) => {
    if (!item) {
      return {
        layers: item?.costLayers ?? [],
        totalQuantity: calculateLayersQuantity(item?.costLayers ?? []),
        soldValue: 0,
        soldUnitCost: 0,
        receivedValue: 0,
        receivedUnitCost: 0,
      }
    }
    const sold = parseAdjustment(item.draftSold)
    const received = parseAdjustment(item.draftReceived)
    return summariseCostImpact(item, sold, received)
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
    const operator = normaliseManualString(meta?.performedBy)
    if (!operator) {
      return []
    }
    const notes = normaliseManualString(meta?.notes)
    const timestamp = new Date().toISOString()
    let computedHistory = []
      setInventory((prev) => {
        const historyEntries = []
        const nextInventory = prev.map((item) => {
          const sold = parseAdjustment(item.draftSold)
          const received = parseAdjustment(item.draftReceived)
          const costSummary = summariseCostImpact(item, sold, received, timestamp)
          const nextCount = costSummary.totalQuantity
          const historyEntry = buildHistoryEntry(
            item,
            sold,
            received,
            nextCount,
            timestamp,
            {
              performedBy: operator,
              notes,
            },
            costSummary,
          )
          if (historyEntry) {
            historyEntries.push(historyEntry)
          }
          return {
            ...item,
            lastCount: item.currentCount,
            currentCount: nextCount,
            draftSold: '',
            draftReceived: '',
            lastUpdated: historyEntry ? timestamp : item.lastUpdated,
            costLayers: costSummary.layers,
          }
        })
        computedHistory = historyEntries
          return nextInventory
      })
    let historyToAdd = computedHistory
    if (!computedHistory.length) {
      historyToAdd = inventory
        .filter((item) => (item.lastCount ?? 0) === 0 && item.currentCount > 0)
        .map((item) => ({
          id: `${item.id}-${timestamp}-new`,
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          category: item.category,
          previousCount: 0,
          newCount: item.currentCount,
          sold: 0,
          received: item.currentCount,
          delta: item.currentCount,
          unitCost: item.unitCost,
          soldValue: 0,
          receivedValue: item.currentCount * item.unitCost,
          soldUnitCost: 0,
          receivedUnitCost: item.unitCost,
          valueImpact: item.currentCount * item.unitCost,
          performedBy: operator,
          notes: notes || 'New item',
          itemNote: item.itemNote || '',
          timestamp,
        }))
    }
    setHistory((prev) => [...historyToAdd, ...prev])
    setMetadata((prev) => ({ ...prev, lastStocktakeAt: timestamp }))
    return historyToAdd
  }, [])

  const updateUnitCost = useCallback((id, rawValue) => {
    setInventory((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item
        }
        const parsed = parseNumericInput(rawValue, item.unitCost ?? 0)
        const nextUnitCost = Math.max(0, ensureFiniteNumber(parsed, item.unitCost ?? 0))
        return {
          ...item,
          unitCost: nextUnitCost,
        }
      }),
    )
  }, [])

  const updateItemNote = useCallback((id, rawValue) => {
    setInventory((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              itemNote: normaliseManualString(rawValue),
            }
          : item,
      ),
    )
  }, [])

  const clearInventory = useCallback(() => {
    setInventory([])
    setHistory([])
    setMetadata(INITIAL_METADATA)
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
    const performedBy = normaliseManualString(partial.performedBy) || 'Manual entry'
    const notes = normaliseManualString(partial.notes)
    const initialLayers = createInitialCostLayers(currentCount, unitCost, timestamp)
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
      costLayers: initialLayers,
      itemNote: notes,
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
        soldValue: 0,
        receivedValue: newItem.currentCount * newItem.unitCost,
        soldUnitCost: 0,
        receivedUnitCost: newItem.unitCost,
        valueImpact: newItem.currentCount * newItem.unitCost,
        performedBy,
        notes,
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
  const hasImported = Boolean(metadata.sourceFileName)
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
        const costPreview = summariseCostImpact(item, sold, received)
        acc.value += costPreview.receivedValue - costPreview.soldValue
        return acc
      },
      { items: 0, sold: 0, received: 0, value: 0 },
    )
  }, [inventory])

  const totals = useMemo(() => {
    const totalSkus = inventory.length
    const totalCurrent = inventory.reduce((acc, item) => acc + item.currentCount, 0)
    const totalLast = inventory.reduce((acc, item) => acc + item.lastCount, 0)
    const totalValue = inventory.reduce(
      (acc, item) => acc + calculateLayersValue(item.costLayers ?? []),
      0,
    )
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

  const generateBlankTemplateBytes = useCallback(() => createBlankTemplateWorkbook(), [])
  const generateTemplateBytes = useCallback(() => createTemplateWorkbook(), [])

  const exportWorkbookBytes = useCallback(
    (overrides = {}) => {
      const nextInventory = overrides.inventory ?? inventory
      const nextMetadata = overrides.metadata ?? metadata
      const nextHistory = overrides.history ?? history
      return createUpdatedWorkbook(nextInventory, nextMetadata, nextHistory)
    },
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
    hasImported,
    hasDrafts,
    isLoading,
    error,
    loadFromFile,
    updateDraftAdjustment,
    updateUnitCost,
    updateItemNote,
    previewDraftImpact,
    resetDrafts,
    applyStocktake,
    clearInventory,
    addManualItem,
    generateBlankTemplateBytes,
    generateTemplateBytes,
    exportWorkbookBytes,
  }
}


