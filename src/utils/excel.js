import * as XLSX from 'xlsx'
import {
  DEFAULT_TEMPLATE_ROWS,
  EXCEL_MIME_TYPE,
  EXCEL_SHEET_NAME,
  HISTORY_SHEET_NAME,
  TEMPLATE_HEADERS,
  REQUIRED_COLUMNS,
  SUMMARY_SHEET_NAME,
} from '../constants.js'

const normaliseString = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).trim()
}

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return 0
  }
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(numeric) ? numeric : 0
}

const parseCurrency = parseNumber

const toIsoTimestamp = (value) => {
  if (!value && value !== 0) {
    return null
  }
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString()
  }
  if (typeof value === 'number') {
    const excelDate = XLSX.SSF.parse_date_code(value)
    if (excelDate) {
      const date = new Date(Date.UTC(
        excelDate.y,
        excelDate.m - 1,
        excelDate.d,
        excelDate.H,
        excelDate.M,
        Math.floor(excelDate.S ?? 0),
      ))
      return date.toISOString()
    }
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString()
}

const ensureHeaders = (worksheet) => {
  const headerRow = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    blankrows: false,
    range: 0,
  })[0] || []
  const headerSet = new Set(headerRow.map((header) => normaliseString(header).toLowerCase()))
  const missingHeaders = Object.values(REQUIRED_COLUMNS).filter(
    (header) => !headerSet.has(header.toLowerCase()),
  )
  if (missingHeaders.length) {
    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`)
  }
}

export const parseInventoryWorkbook = (arrayBuffer) => {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const [sheetName] = workbook.SheetNames
  if (!sheetName) {
    throw new Error('No sheets found in the workbook.')
  }
  const worksheet = workbook.Sheets[sheetName]
  ensureHeaders(worksheet)
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  })
  const seenIds = new Set()
  const inventory = rows.map((row, index) => {
    const sku = normaliseString(row[REQUIRED_COLUMNS.sku])
    const name = normaliseString(row[REQUIRED_COLUMNS.name]) || `Item ${index + 1}`
    const baseId = sku || name || `row-${index + 1}`
    let id = baseId
    let suffix = 1
    while (seenIds.has(id)) {
      id = `${baseId}-${suffix++}`
    }
    seenIds.add(id)
    const currentCount = parseNumber(row[REQUIRED_COLUMNS.count])
    return {
      id,
      sku,
      name,
      category: normaliseString(row[REQUIRED_COLUMNS.category]) || 'Uncategorised',
      unitCost: parseCurrency(row[REQUIRED_COLUMNS.unitCost]),
      currentCount,
      lastCount: currentCount,
      draftSold: '',
      draftReceived: '',
      lastUpdated: toIsoTimestamp(row[REQUIRED_COLUMNS.lastUpdated]),
    }
  })
  return {
    inventory,
    workbookMeta: {
      sheetName,
      importedAt: new Date().toISOString(),
    },
  }
}

export const createTemplateWorkbook = () => {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(DEFAULT_TEMPLATE_ROWS)
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 26 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
  ]
  XLSX.utils.book_append_sheet(workbook, worksheet, EXCEL_SHEET_NAME)
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellDates: true })
}

export const createBlankTemplateWorkbook = () => {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS])
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 26 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
  ]
  XLSX.utils.book_append_sheet(workbook, worksheet, EXCEL_SHEET_NAME)
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellDates: true })
}

const createSummarySheet = (inventory, metadata = {}) => {
  const totalUnits = inventory.reduce((acc, item) => acc + item.currentCount, 0)
  const totalValue = inventory.reduce((acc, item) => acc + item.currentCount * item.unitCost, 0)
  const summaryRows = [
    ['Stocktake Inventory Tool'],
    ['Generated At', new Date()],
    ['Source File', metadata.sourceFileName || ''],
    ['Imported At', metadata.lastImportedAt ? new Date(metadata.lastImportedAt) : ''],
    ['Last Stocktake', metadata.lastStocktakeAt ? new Date(metadata.lastStocktakeAt) : ''],
    ['Total SKUs', inventory.length],
    ['Units On Hand', totalUnits],
    ['Inventory Value', totalValue],
  ]
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)
  summarySheet['!cols'] = [{ wch: 20 }, { wch: 28 }]
  return summarySheet
}

const createMovementsSheet = (history) => {
  if (!history.length) {
    return null
  }
  const rows = history.map((entry) => ({
    SKU: entry.sku,
    Item: entry.name,
    Category: entry.category,
    'Previous Count': entry.previousCount,
    Sold: entry.sold ?? 0,
    Received: entry.received ?? 0,
    'New Count': entry.newCount,
    Delta: entry.delta,
    'Unit Cost': entry.unitCost ?? '',
    'Value Change': entry.unitCost ? entry.unitCost * entry.delta : '',
    'Performed By': entry.performedBy || '',
    Notes: entry.notes || '',
    Timestamp: entry.timestamp ? new Date(entry.timestamp) : '',
  }))
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      'SKU',
      'Item',
      'Category',
      'Previous Count',
      'Sold',
      'Received',
      'New Count',
      'Delta',
      'Unit Cost',
      'Value Change',
      'Performed By',
      'Notes',
      'Timestamp',
    ],
  })
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 26 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 28 },
    { wch: 22 },
  ]
  return worksheet
}

export const createUpdatedWorkbook = (inventory, metadata = {}, history = []) => {
  const workbook = XLSX.utils.book_new()
  const rows = inventory.map((item) => ({
    [REQUIRED_COLUMNS.sku]: item.sku,
    [REQUIRED_COLUMNS.name]: item.name,
    [REQUIRED_COLUMNS.category]: item.category,
    [REQUIRED_COLUMNS.count]: item.currentCount,
    [REQUIRED_COLUMNS.unitCost]: item.unitCost,
    [REQUIRED_COLUMNS.lastUpdated]: item.lastUpdated ? new Date(item.lastUpdated) : '',
  }))
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: Object.values(REQUIRED_COLUMNS),
  })
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
  ]
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    metadata.sheetName || EXCEL_SHEET_NAME,
  )
  const movementsSheet = createMovementsSheet(history)
  if (movementsSheet) {
    XLSX.utils.book_append_sheet(workbook, movementsSheet, HISTORY_SHEET_NAME)
  }
  XLSX.utils.book_append_sheet(
    workbook,
    createSummarySheet(inventory, metadata),
    SUMMARY_SHEET_NAME,
  )
  return XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    cellDates: true,
  })
}

export const triggerWorkbookDownload = (workbookBytes, fileName) => {
  const blob = new Blob([workbookBytes], { type: EXCEL_MIME_TYPE })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
