import * as XLSX from 'xlsx-js-style'
import {
  DEFAULT_TEMPLATE_ROWS,
  EXCEL_MIME_TYPE,
  EXCEL_SHEET_NAME,
  HISTORY_SHEET_NAME,
  TEMPLATE_HEADERS,
  REQUIRED_COLUMNS,
  SUMMARY_SHEET_NAME,
  OPTIONAL_COLUMNS,
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

const MOVEMENT_HEADERS = [
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
  'Item Note',
  'Timestamp',
]

const ensureFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

const calculateLayersQuantity = (layers = []) =>
  layers.reduce((acc, layer) => acc + ensureFiniteNumber(layer?.quantity, 0), 0)

const calculateLayersValue = (layers = []) =>
  layers.reduce(
    (acc, layer) => acc + ensureFiniteNumber(layer?.quantity, 0) * ensureFiniteNumber(layer?.unitCost, 0),
    0,
  )

const calculateAverageLayerCost = (layers = [], fallback = 0) => {
  const quantity = calculateLayersQuantity(layers)
  if (quantity === 0) {
    return ensureFiniteNumber(fallback, 0)
  }
  return calculateLayersValue(layers) / quantity
}

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
      itemNote: normaliseString(row[OPTIONAL_COLUMNS.itemNote]),
    }
  })
  let history = []
  const movementsSheet = workbook.Sheets[HISTORY_SHEET_NAME]
  if (movementsSheet) {
    const movementRows = XLSX.utils.sheet_to_json(movementsSheet, {
      header: MOVEMENT_HEADERS,
      range: 1,
      defval: '',
      raw: false,
    })
    history = movementRows
      .filter((row) => normaliseString(row.SKU) || normaliseString(row.Item))
      .map((row, index) => {
        const sku = normaliseString(row.SKU)
        const name = normaliseString(row.Item) || 'Unnamed item'
        const category = normaliseString(row.Category) || 'Uncategorised'
        const previousCount = parseNumber(row['Previous Count'])
        const sold = parseNumber(row.Sold)
        const received = parseNumber(row.Received)
        const hasNewCount = row['New Count'] !== ''
        const newCount = hasNewCount ? parseNumber(row['New Count']) : previousCount - sold + received
        const hasDelta = row.Delta !== ''
        const delta = hasDelta ? parseNumber(row.Delta) : newCount - previousCount
        const unitCost = parseCurrency(row['Unit Cost'])
        const rawValueChange = parseCurrency(row['Value Change'])
        const performedBy = normaliseString(row['Performed By'])
        const notes = normaliseString(row.Notes)
        const itemNote = normaliseString(row['Item Note'])
        const timestamp = toIsoTimestamp(row.Timestamp)
        const soldValue = sold * unitCost
        const receivedValue = received * unitCost
        const valueImpact =
          rawValueChange !== 0 || row['Value Change'] === 0
            ? rawValueChange
            : receivedValue - soldValue
        const soldUnitCost = sold > 0 ? soldValue / sold : 0
        const receivedUnitCost = received > 0 ? receivedValue / received : 0
        return {
          id: `${sku || name || 'movement'}-${index}`,
          itemId: sku || name || `movement-${index}`,
          sku,
          name,
          category,
          previousCount,
          sold,
          received,
          newCount,
          delta,
          unitCost,
          soldValue,
          receivedValue,
          soldUnitCost,
          receivedUnitCost,
          valueImpact,
          performedBy,
          notes,
          itemNote,
          timestamp,
        }
      })
  }
  const lastStocktakeAt = history.reduce((latest, entry) => {
    if (!entry.timestamp) {
      return latest
    }
    const value = new Date(entry.timestamp).getTime()
    return Number.isFinite(value) && value > latest ? value : latest
  }, 0)
  return {
    inventory,
    history,
    workbookMeta: {
      sheetName,
      importedAt: new Date().toISOString(),
      lastStocktakeAt: lastStocktakeAt ? new Date(lastStocktakeAt).toISOString() : null,
    },
  }
}

const HEADER_CELL_STYLE = {
  fill: { patternType: 'solid', fgColor: { rgb: '4F46E5' } },
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: 'E2E8F0' } },
    bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
    left: { style: 'thin', color: { rgb: 'E2E8F0' } },
    right: { style: 'thin', color: { rgb: 'E2E8F0' } },
  },
}

const LABEL_CELL_STYLE = {
  font: { bold: true, color: { rgb: '1F2937' } },
}

const VALUE_CELL_STYLE = {
  alignment: { horizontal: 'left', vertical: 'center' },
}

const applyRowStyles = (worksheet, rowIndex, columnCount, style) => {
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })
    if (!worksheet[cellAddress]) {
      continue
    }
    worksheet[cellAddress].s = {
      ...(worksheet[cellAddress].s ?? {}),
      ...style,
    }
  }
}

const applyColumnStyles = (worksheet, columnIndex, rowCount, style) => {
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })
    if (!worksheet[cellAddress]) {
      continue
    }
    worksheet[cellAddress].s = {
      ...(worksheet[cellAddress].s ?? {}),
      ...style,
    }
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
  applyRowStyles(worksheet, 0, TEMPLATE_HEADERS.length, HEADER_CELL_STYLE)
  XLSX.utils.book_append_sheet(workbook, worksheet, EXCEL_SHEET_NAME)
  const movementsSheet = createEmptyMovementsSheet()
  XLSX.utils.book_append_sheet(workbook, movementsSheet, HISTORY_SHEET_NAME)
  const summarySheet = createSummarySheet(
    DEFAULT_TEMPLATE_ROWS.slice(1).map((row) => ({
      currentCount: parseNumber(row[3]),
      unitCost: parseCurrency(row[4]),
      category: row[2],
    })),
    {
      sourceFileName: 'Template workbook',
    },
  )
  XLSX.utils.book_append_sheet(workbook, summarySheet, SUMMARY_SHEET_NAME)
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
  applyRowStyles(worksheet, 0, TEMPLATE_HEADERS.length, HEADER_CELL_STYLE)
  XLSX.utils.book_append_sheet(workbook, worksheet, EXCEL_SHEET_NAME)
  const movementsSheet = createEmptyMovementsSheet()
  XLSX.utils.book_append_sheet(workbook, movementsSheet, HISTORY_SHEET_NAME)
  const summarySheet = createSummarySheet([], { sourceFileName: 'Blank workbook' })
  XLSX.utils.book_append_sheet(workbook, summarySheet, SUMMARY_SHEET_NAME)
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellDates: true })
}

const createSummarySheet = (inventory, metadata = {}) => {
  const totalUnits = inventory.reduce((acc, item) => acc + item.currentCount, 0)
  const totalValue = inventory.reduce(
    (acc, item) => acc + calculateLayersValue(item.costLayers ?? []),
    0,
  )
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
  applyRowStyles(summarySheet, 0, 2, HEADER_CELL_STYLE)
  applyColumnStyles(summarySheet, 0, summaryRows.length, LABEL_CELL_STYLE)
  applyColumnStyles(summarySheet, 1, summaryRows.length, VALUE_CELL_STYLE)
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
    'Value Change':
      entry.valueImpact ??
      (entry.receivedValue ?? 0) - (entry.soldValue ?? (entry.sold ?? 0) * (entry.soldUnitCost ?? entry.unitCost ?? 0)),
    'Performed By': entry.performedBy || '',
    Notes: entry.notes || '',
    'Item Note': entry.itemNote || '',
    Timestamp: entry.timestamp ? new Date(entry.timestamp) : '',
  }))
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: MOVEMENT_HEADERS,
  })
  applyRowStyles(worksheet, 0, MOVEMENT_HEADERS.length, HEADER_CELL_STYLE)
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
    [REQUIRED_COLUMNS.unitCost]: calculateAverageLayerCost(item.costLayers ?? [], item.unitCost),
    [REQUIRED_COLUMNS.lastUpdated]: item.lastUpdated ? new Date(item.lastUpdated) : '',
    [OPTIONAL_COLUMNS.itemNote]: item.itemNote || '',
  }))
  const requiredHeaders = Object.values(REQUIRED_COLUMNS)
  const optionalHeaders = [OPTIONAL_COLUMNS.itemNote]
  const headers = [...requiredHeaders, ...optionalHeaders]
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: headers,
  })
  applyRowStyles(worksheet, 0, headers.length, HEADER_CELL_STYLE)
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 28 },
  ]
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    metadata.sheetName || EXCEL_SHEET_NAME,
  )
  const movementsSheet = createMovementsSheet(history) || createEmptyMovementsSheet()
  XLSX.utils.book_append_sheet(workbook, movementsSheet, HISTORY_SHEET_NAME)
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

const createEmptyMovementsSheet = () => {
  const worksheet = XLSX.utils.aoa_to_sheet([MOVEMENT_HEADERS])
  applyRowStyles(worksheet, 0, MOVEMENT_HEADERS.length, HEADER_CELL_STYLE)
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



