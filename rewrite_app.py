from pathlib import Path
content = """import { useCallback, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'

const initialTable = { columns: [], rows: [] }
const initialStatus = {
  type: 'idle',
  message: 'Drop an .xlsx file or use the uploader to begin.',
}

const DEFAULT_USED_LABEL = 'Units Sold'
const DEFAULT_RECEIVED_LABEL = 'Units Received'

const templateColumns = [
  'Week',
  'SKU',
  'Item Name',
  'Category',
  'Opening Stock',
  DEFAULT_RECEIVED_LABEL,
  DEFAULT_USED_LABEL,
  'Closing Stock',
  'Notes',
]

const templateSeedRows = [
  {
    Week: 'Week 24',
    SKU: 'SKU-1001',
    'Item Name': 'Organic Cold Brew',
    Category: 'Beverage',
    'Opening Stock': 120,
    [DEFAULT_RECEIVED_LABEL]: 60,
    [DEFAULT_USED_LABEL]: 140,
    'Closing Stock': 40,
    Notes: 'Promotional week lift.',
  },
  {
    Week: 'Week 24',
    SKU: 'SKU-2045',
    'Item Name': 'Blueberry Muffin',
    Category: 'Bakery',
    'Opening Stock': 80,
    [DEFAULT_RECEIVED_LABEL]: 40,
    [DEFAULT_USED_LABEL]: 95,
    'Closing Stock': 25,
    Notes: 'Reorder threshold approaching.',
  },
  {
    Week: 'Week 24',
    SKU: 'SKU-3308',
    'Item Name': 'Granola Parfait',
    Category: 'Grab & Go',
    'Opening Stock': 65,
    [DEFAULT_RECEIVED_LABEL]: 25,
    [DEFAULT_USED_LABEL]: 70,
    'Closing Stock': 20,
    Notes: 'Strong weekend performance.',
  },
]

const createRowId = () =>
  globalThis.crypto?.randomUUID?.() ?? `row-${Date.now()}-${Math.random().toString(16).slice(2)}`

const normalizeColumns = (candidates = []) => {
  const seen = new Set()
  return candidates.map((candidate, index) => {
    const base = `${candidate ?? ''}`.trim() || `Column ${index + 1}`
    let name = base
    let counter = 1
    while (seen.has(name)) {
      name = `${base} ${++counter}`
    }
    seen.add(name)
    return name
  })
}

const ensureUniqueColumnName = (name, existing) => {
  const base = name.trim() || 'New Column'
  let candidate = base
  let suffix = 1
  while (existing.includes(candidate)) {
    candidate = `${base} ${++suffix}`
  }
  return candidate
}

const suggestNextWeekLabel = (value) => {
  if (!value) return ''
  const source = `${value}`
  const match = source.match(/(\d+)(?!.*\d)/)
  if (!match) return `${source} (next)`
  const nextNumber = Number.parseInt(match[1], 10) + 1
  return source.replace(/(\d+)(?!.*\d)/, nextNumber.toString())
}

const sanitizeFileFragment = (value) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'updated'

const coerceNumeric = (candidate) => {
  if (candidate === null || candidate === undefined || candidate === '') return 0
  const parsed = Number.parseFloat(candidate)
  return Number.isFinite(parsed) ? parsed : 0
}

const applyMovementDefaults = (columns, rows) => {
  const find = (regex) => columns.find((column) => regex.test(column))
  const usedColumn = find(/(used|sold|outgoing|shipped|consumed|spent)/i)
  const receivedColumn = find(/(received|added|incoming|brought|restock|purchased|bought)/i)

  rows.forEach((row) => {
    if (usedColumn && (row[usedColumn] === '' || row[usedColumn] === undefined)) {
      row[usedColumn] = 0
    }
    if (receivedColumn && (row[receivedColumn] === '' || row[receivedColumn] === undefined)) {
      row[receivedColumn] = 0
    }
  })
}

const buildTemplateTable = () => {
  const columns = [...templateColumns]
  const rows = templateSeedRows.map((seed) => {
    const row = { __rowId: createRowId() }
    columns.forEach((column) => {
      row[column] = seed[column] ?? (column === DEFAULT_RECEIVED_LABEL || column === DEFAULT_USED_LABEL ? 0 : '')
    })
    return row
  })
  const blankRow = { __rowId: createRowId() }
  columns.forEach((column) => {
    if (column === 'Week') {
      blankRow[column] = 'Week 25'
    } else if (column === DEFAULT_RECEIVED_LABEL || column === DEFAULT_USED_LABEL) {
      blankRow[column] = 0
    } else {
      blankRow[column] = ''
    }
  })
  return { columns, rows: [...rows, blankRow] }
}

function App() {
  const fileInputRef = useRef(null)
  const [view, setView] = useState('workspace')
  const [table, setTable] = useState(initialTable)
  const [status, setStatus] = useState(initialStatus)
  const [fileMeta, setFileMeta] = useState({ fileName: '', sheetName: '' })
  const [query, setQuery] = useState('')
  const [stockQuery, setStockQuery] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [nextWeekLabel, setNextWeekLabel] = useState('')
  const [pendingEdits, setPendingEdits] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')

  const weekColumn = useMemo(
    () => table.columns.find((column) => column.toLowerCase().includes('week')),
    [table.columns],
  )

  const numericColumnSet = useMemo(() => {
    const numericColumns = table.columns.filter((column) =>
      /(qty|quantity|count|stock|units|cost|price|amount|inventory|opening|closing|sold|received)/i.test(column),
    )
    return new Set(numericColumns)
  }, [table.columns])

  const columnMap = useMemo(() => {
    const find = (regex) => table.columns.find((column) => regex.test(column))
    const itemColumn = find(/(item|product|name|description)/i) || find(/(sku|code|id)/i)
    return {
      week: find(/week/i),
      item: itemColumn,
      sku: find(/(sku|item|product|code|id)/i),
      opening: find(/(opening|start|begin)/i),
      received: find(/(received|added|incoming|brought|restock|purchased|bought)/i),
      used: find(/(used|sold|outgoing|shipped|consumed|spent)/i),
      closing: find(/(closing|ending|final|remain|available|on\s?hand)/i),
    }
  }, [table.columns])

  const hasInventoryColumns = useMemo(
    () => table.rows.length > 0 && Boolean(columnMap.item || columnMap.sku || table.columns[0]),
    [columnMap.item, columnMap.sku, table.columns, table.rows],
  )

  const filteredRows = useMemo(() => {
    if (!query.trim()) return table.rows
    const needle = query.trim().toLowerCase()
    return table.rows.filter((row) =>
      table.columns.some((column) => `${row[column] ?? ''}`.toLowerCase().includes(needle)),
    )
  }, [query, table.columns, table.rows])

  const stocktakeRows = useMemo(() => {
    if (!table.rows.length) return []
    const descriptors = [columnMap.item, columnMap.sku].filter(Boolean)
    const columnsToSearch = descriptors.length ? descriptors : table.columns.slice(0, 1)
    if (!stockQuery.trim()) return table.rows
    const needle = stockQuery.trim().toLowerCase()
    return table.rows.filter((row) =>
      columnsToSearch.some((column) => `${row[column] ?? ''}`.toLowerCase().includes(needle)),
    )
  }, [columnMap.item, columnMap.sku, stockQuery, table.columns, table.rows])

  const stats = useMemo(() => {
    const quantityColumn = table.columns.find((column) => /(qty|quantity|count|stock|units|closing)/i.test(column))
    const skuColumn = table.columns.find((column) => /(sku|item|product|code|id)/i.test(column))

    const rowCount = table.rows.length
    const totalQuantity = quantityColumn
      ? table.rows.reduce((sum, row) => {
          const value = Number.parseFloat(row[quantityColumn])
          return Number.isFinite(value) ? sum + value : sum
        }, 0)
      : null
    const uniqueItems = skuColumn
      ? new Set(table.rows.map((row) => `${row[skuColumn] ?? ''}`.trim()).filter(Boolean)).size
      : null

    return {
      rowCount,
      totalQuantity,
      quantityColumn,
      uniqueItems,
      skuColumn,
    }
  }, [table.columns, table.rows])

  const hasData = table.rows.length > 0

  const downloadFileName = useMemo(() => {
    const base = fileMeta.fileName || 'inventory'
    const suffix = nextWeekLabel ? sanitizeFileFragment(nextWeekLabel) : 'updated'
    return `${base}-${suffix}.xlsx`
  }, [fileMeta.fileName, nextWeekLabel])

  const handleWorkbookLoad = useCallback(async (file) => {
    try {
      setStatus({ type: 'loading', message: `Reading ${file.name}...` })

      const isCsv = file.name.toLowerCase().endsWith('.csv')
      const data = isCsv ? await file.text() : await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: isCsv ? 'string' : 'array' })

      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]

      if (!sheet) {
        setStatus({ type: 'error', message: 'No readable sheets were found in this file.' })
        return
      }

      const rawObjects = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      let columns = []
      let rows = []

      if (rawObjects.length) {
        const columnSet = new Set()
        rawObjects.forEach((row) => {
          Object.keys(row).forEach((key, index) => {
            const label = `${key ?? ''}`.trim() || `Column ${index + 1}`
            columnSet.add(label)
          })
        })
        columns = normalizeColumns(Array.from(columnSet))
        rows = rawObjects.map((row) => {
          const shapedRow = { __rowId: createRowId() }
          columns.forEach((column) => {
            shapedRow[column] = row[column] ?? ''
          })
          return shapedRow
        })
      } else {
        const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        if (!matrix.length) {
          setStatus({ type: 'error', message: 'The sheet is empty. Please provide data to work with.' })
          return
        }
        const headerRow = matrix[0]
        columns = normalizeColumns(headerRow)
        rows = matrix.slice(1).map((excelRow) => {
          const shapedRow = { __rowId: createRowId() }
          columns.forEach((column, index) => {
            shapedRow[column] = excelRow[index] ?? ''
          })
          return shapedRow
        })
      }

      if (!columns.length) {
        setStatus({ type: 'error', message: 'No columns were detected. Please ensure the first row contains headers.' })
        return
      }

      applyMovementDefaults(columns, rows)

      setTable({ columns, rows })
      setFileMeta({ fileName: file.name.replace(/\.(xlsx|xls|csv)$/i, ''), sheetName })
      setQuery('')
      setStockQuery('')
      setPendingEdits(false)

      const weekCol = columns.find((column) => column.toLowerCase().includes('week'))
      if (weekCol) {
        const lastWeek = [...rows].reverse().map((row) => row[weekCol]).find((value) => `${value}`.trim())
        const suggestion = suggestNextWeekLabel(lastWeek)
        setNextWeekLabel(suggestion || `${lastWeek ?? ''}`)
      } else {
        setNextWeekLabel('')
      }

      setStatus({
        type: 'success',
        message: `Loaded ${rows.length.toLocaleString()} rows from \"${sheetName}\".`,
      })
      setView('workspace')
    } catch (error) {
      console.error(error)
      setStatus({ type: 'error', message: 'Could not read that file. Please verify the format and try again.' })
    } finally {
      setIsDragging(false)
    }
  }, [])

  const handleFiles = useCallback(
    (files) => {
      if (!files.length) return
      const [file] = files
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
        setStatus({ type: 'error', message: 'Unsupported format. Use .xlsx, .xls, or .csv files.' })
        return
      }
      void handleWorkbookLoad(file)
    },
    [handleWorkbookLoad],
  )

  const handleDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((event) => {
    event.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault()
      setIsDragging(false)
      const files = Array.from(event.dataTransfer.files)
      handleFiles(files)
    },
    [handleFiles],
  )

  const handleFileInputChange = useCallback(
    (event) => {
      const files = Array.from(event.target.files ?? [])
      handleFiles(files)
      event.target.value = ''
    },
    [handleFiles],
  )

  const handleCellChange = useCallback((rowId, column, value) => {
    setTable((current) => {
      const rows = current.rows.map((row) =>
        row.__rowId === rowId
          ? {
              ...row,
              [column]: value,
            }
          : row,
      )
      return { ...current, rows }
    })
    setPendingEdits(true)
  }, [])

  const handleAddRow = useCallback(() => {
    setTable((current) => {
      const nextRow = { __rowId: createRowId() }
      current.columns.forEach((column) => {
        if (column === weekColumn && nextWeekLabel) {
          nextRow[column] = nextWeekLabel
        } else if (/(used|sold|outgoing|shipped|consumed|spent)/i.test(column)) {
          nextRow[column] = 0
        } else if (/(received|added|incoming|brought|restock|purchased|bought)/i.test(column)) {
          nextRow[column] = 0
        } else {
          nextRow[column] = ''
        }
      })
      return { ...current, rows: [...current.rows, nextRow] }
    })
    setPendingEdits(true)
  }, [nextWeekLabel, weekColumn])

  const handleDuplicateRow = useCallback((rowId) => {
    setTable((current) => {
      const target = current.rows.find((row) => row.__rowId === rowId)
      if (!target) return current
      const duplicate = { __rowId: createRowId() }
      current.columns.forEach((column) => {
        duplicate[column] = target[column]
      })
      return { ...current, rows: [...current.rows, duplicate] }
    })
    setPendingEdits(true)
  }, [])

  const handleDeleteRow = useCallback((rowId) => {
    setTable((current) => ({
      columns: current.columns,
      rows: current.rows.filter((row) => row.__rowId !== rowId),
    }))
    setPendingEdits(true)
  }, [])

  const handleApplyWeekLabel = useCallback(() => {
    if (!weekColumn || !nextWeekLabel.trim()) return
    setTable((current) => {
      const rows = current.rows.map((row) => ({
        ...row,
        [weekColumn]: nextWeekLabel,
      }))
      return { ...current, rows }
    })
    setPendingEdits(true)
    setStatus({ type: 'success', message: `Applied \"${nextWeekLabel}\" to the ${weekColumn} column.` })
  }, [nextWeekLabel, weekColumn])

  const handleAddColumn = useCallback(
    (name) => {
      setTable((current) => {
        const uniqueName = ensureUniqueColumnName(name, current.columns)
        const columns = [...current.columns, uniqueName]
        const rows = current.rows.map((row) => ({
          ...row,
          [uniqueName]: '',
        }))
        return { columns, rows }
      })
      setPendingEdits(true)
      setStatus({ type: 'success', message: `Added \"${name}\" column.` })
    },
    [],
  )

  const handleAdjustmentChange = useCallback(
    (rowId, type, rawValue) => {
      const numericValue = Number.parseFloat(rawValue)
      const parsedValue =
        rawValue === ''
          ? ''
          : Number.isFinite(numericValue)
            ? Math.max(numericValue, 0)
            : 0

      const itemHeader = columnMap.item || columnMap.sku || table.columns[0]
      const sourceRow = table.rows.find((row) => row.__rowId === rowId)
      const itemName = itemHeader && sourceRow ? sourceRow[itemHeader] : ''

      setTable((current) => {
        const columns = [...current.columns]
        const newColumns = []
        const usedRegex = /(used|sold|outgoing|shipped|consumed|spent)/i
        const receivedRegex = /(received|added|incoming|brought|restock|purchased|bought)/i
        const openingRegex = /(opening|start|begin)/i
        const closingRegex = /(closing|ending|final|remain|available|on\s?hand)/i
        const weekRegex = /week/i

        const ensureColumn = (regex, fallbackLabel) => {
          let name = columns.find((column) => regex.test(column))
          if (!name && fallbackLabel) {
            name = ensureUniqueColumnName(fallbackLabel, columns)
            columns.push(name)
            newColumns.push(name)
          }
          return name
        }

        const targetColumn =
          type === 'used'
            ? ensureColumn(usedRegex, DEFAULT_USED_LABEL)
            : ensureColumn(receivedRegex, DEFAULT_RECEIVED_LABEL)

        if (!targetColumn) {
          return current
        }

        const openingColumn = ensureColumn(openingRegex, null)
        const closingColumn = ensureColumn(closingRegex, 'Closing Stock')
        const weekColumnName = ensureColumn(weekRegex, null)
        const usedColumn =
          ensureColumn(usedRegex, type === 'used' ? DEFAULT_USED_LABEL : null) ?? targetColumn
        const receivedColumn =
          ensureColumn(
            receivedRegex,
            type === 'received' ? DEFAULT_RECEIVED_LABEL : null,
          ) ?? targetColumn

        const fillDefaults = new Set([targetColumn, usedColumn, receivedColumn])

        const parseAmount = (value) => {
          const number = Number.parseFloat(value)
          return Number.isFinite(number) ? number : 0
        }

        const rows = current.rows.map((row) => {
          const next = { ...row }
          newColumns.forEach((column) => {
            if (!(column in next)) {
              next[column] = fillDefaults.has(column) ? 0 : ''
            }
          })

          if (row.__rowId !== rowId) {
            return next
          }

          next[targetColumn] = parsedValue === '' ? '' : Number(parsedValue)

          if (weekColumnName && nextWeekLabel) {
            next[weekColumnName] = nextWeekLabel
          }

          const openingValue = openingColumn ? parseAmount(next[openingColumn]) : 0
          const usedValue = usedColumn ? parseAmount(next[usedColumn]) : 0
          const receivedValue = receivedColumn ? parseAmount(next[receivedColumn]) : 0

          if (closingColumn) {
            const closingValue = Math.max(openingValue + receivedValue - usedValue, 0)
            next[closingColumn] = Number.isFinite(closingValue)
              ? Number(closingValue.toFixed(2))
              : next[closingColumn]
          }

          return next
        })

        return { columns, rows }
      })

      setPendingEdits(true)

      const movementLabel = type === 'used' ? 'used' : 'received'
      const suffix = itemName ? ` for ${itemName}` : ''
      const statusMessage =
        parsedValue === ''
          ? `Cleared ${movementLabel} value${suffix}.`
          : `Logged ${parsedValue} units ${movementLabel}${suffix}.`

      setStatus({ type: 'success', message: statusMessage })
    },
    [columnMap.item, columnMap.sku, nextWeekLabel, table.columns, table.rows],
  )

  const handleDownload = useCallback(() => {
    if (!table.columns.length) return
    const exportRows = table.rows.map(({ __rowId, ...row }) => row)
    const worksheet = XLSX.utils.json_to_sheet(exportRows, { header: table.columns })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, fileMeta.sheetName || 'Inventory')
    const blob = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = downloadFileName
    anchor.click()
    URL.revokeObjectURL(url)
    setStatus({ type: 'success', message: `Exported ${exportRows.length.toLocaleString()} rows.` })
    setPendingEdits(false)
  }, [downloadFileName, fileMeta.sheetName, table.columns, table.rows])

  const handleReset = useCallback(() => {
    setTable(initialTable)
    setStatus(initialStatus)
    setFileMeta({ fileName: '', sheetName: '' })
    setQuery('')
    setStockQuery('')
    setNextWeekLabel('')
    setPendingEdits(false)
    setNewColumnName('')
  }, [])

  const handleStartNewWorkbook = useCallback(() => {
    const template = buildTemplateTable()
    setTable(template)
    setFileMeta({ fileName: 'weekly-inventory', sheetName: 'Inventory Week' })
    const nextLabel = suggestNextWeekLabel(template.rows[0]?.Week ?? 'Week 1')
    setNextWeekLabel(nextLabel || 'Week 1')
    setStatus({
      type: 'success',
      message: 'Created a fresh weekly workbook template. Customize and export when ready.',
    })
    setView('workspace')
    setPendingEdits(false)
    setQuery('')
    setStockQuery('')
  }, [])

  const renderMovementCard = (row, index) => {
    const itemHeader = columnMap.item || columnMap.sku || table.columns[0]
    const fallbackName = `Item ${index + 1}`
    const itemName = itemHeader ? `${row[itemHeader] ?? fallbackName}` : fallbackName
    const openingValue =
      columnMap.opening && row[columnMap.opening] !== undefined
        ? coerceNumeric(row[columnMap.opening])
        : null
    const usedHeader = columnMap.used || DEFAULT_USED_LABEL
    const receivedHeader = columnMap.received || DEFAULT_RECEIVED_LABEL
    const usedValue = row[usedHeader] ?? row[columnMap.used] ?? 0
    const receivedValue = row[receivedHeader] ?? row[columnMap.received] ?? 0
    const closingHeader = columnMap.closing
    const closingRaw = closingHeader && row[closingHeader] !== undefined ? Number.parseFloat(row[closingHeader]) : null

    const formattedClosing =
      closingRaw === null || Number.isNaN(closingRaw)
        ? '\\u2014'
        : closingRaw.toLocaleString(undefined, { maximumFractionDigits: 2 })

    return (
      <div key={row.__rowId} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-slate-800">{itemName}</p>
            {openingValue !== null && (
              <p className="text-xs text-slate-500">
                Opening {openingValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            )}
          </div>
          {closingHeader && (
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              Closing {formattedClosing}
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="flex min-w-[140px] flex-1 flex-col gap-2 text-xs font-semibold text-slate-600">
            {usedHeader}
            <input
              type="number"
              inputMode="decimal"
              value={usedValue === '' ? '' : Number(usedValue)}
              onChange={(event) => handleAdjustmentChange(row.__rowId, 'used', event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              placeholder="0"
              min="0"
            />
          </label>
          <label className="flex min-w-[140px] flex-1 flex-col gap-2 text-xs font-semibold text-slate-600">
            {receivedHeader}
            <input
              type="number"
              inputMode="decimal"
              value={receivedValue === '' ? '' : Number(receivedValue)}
              onChange={(event) => handleAdjustmentChange(row.__rowId, 'received', event.target.value)}
              className="rounded-2x...
