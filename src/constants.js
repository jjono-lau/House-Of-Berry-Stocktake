export const APP_PAGES = [
  {
    id: 'demo',
    label: 'Getting Started',
    tagline: 'Import your workbook and download the template',
  },
  {
    id: 'stocktake',
    label: 'Stocktake',
    tagline: 'Record sold and received quantities',
  },
  {
    id: 'history',
    label: 'History',
    tagline: 'Review every adjustment completed',
  },
  {
    id: 'stats',
    label: 'Analytics',
    tagline: 'Monitor stock performance trends',
  },
]

export const REQUIRED_COLUMNS = {
  sku: 'SKU',
  name: 'Item',
  category: 'Category',
  count: 'Count',
  unitCost: 'Unit Cost',
  lastUpdated: 'Last Updated',
}

export const OPTIONAL_COLUMNS = {
  itemNote: 'Notes',
}

export const TEMPLATE_HEADERS = [
  'SKU',
  'Item',
  'Category',
  'Count',
  'Unit Cost',
  'Last Updated',
]

export const DEFAULT_TEMPLATE_ROWS = [
  TEMPLATE_HEADERS,
  ['SAMPLE-001', 'Sample Item A', 'Category A', 120, 6.5, '2025-01-01'],
  ['SAMPLE-002', 'Sample Item B', 'Category B', 85, 12.4, '2025-01-01'],
  ['SAMPLE-003', 'Sample Item C', 'Category C', 220, 5.2, '2025-01-01'],
]

export const EXCEL_SHEET_NAME = 'Stocktake'
export const HISTORY_SHEET_NAME = 'Movements'
export const SUMMARY_SHEET_NAME = 'Summary'

export const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const MOVEMENT_WINDOW_DAYS = 30

export const AUTO_SKU_PREFIX = 'SKU-'
export const AUTO_SKU_PAD_LENGTH = 4
