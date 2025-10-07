export const APP_PAGES = [
  {
    id: 'demo',
    label: 'Demo',
    tagline: 'Import your workbook & get the template',
  },
  {
    id: 'stocktake',
    label: 'Stocktake',
    tagline: 'Capture this round of counts',
  },
  {
    id: 'history',
    label: 'History',
    tagline: 'See every adjustment made',
  },
  {
    id: 'stats',
    label: 'Insights',
    tagline: 'How your stock is moving',
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
  ['DEMO-001', 'Shampoo', 'Bath', 120, 6.5, '2025-01-01'],
  ['DEMO-002', 'Conditioner', 'Bath', 85, 6.5, '2025-01-01'],
  ['DEMO-003', 'Soap Bar', 'Bath', 220, 2.5, '2025-01-01'],
]

export const EXCEL_SHEET_NAME = 'Stocktake'
export const HISTORY_SHEET_NAME = 'Movements'
export const SUMMARY_SHEET_NAME = 'Summary'

export const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const MOVEMENT_WINDOW_DAYS = 30

export const AUTO_SKU_PREFIX = 'SKU-'
export const AUTO_SKU_PAD_LENGTH = 4
