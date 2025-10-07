const DEFAULT_LOCALE = 'en-AU'

const numberFormatters = new Map()
const getNumberFormatter = (options) => {
  const key = JSON.stringify(options)
  if (!numberFormatters.has(key)) {
    numberFormatters.set(key, new Intl.NumberFormat(DEFAULT_LOCALE, options))
  }
  return numberFormatters.get(key)
}

const baseCurrencyFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 2,
})

export const formatNumber = (value, options = {}) => {
  if (value === null || value === undefined) {
    return '—'
  }
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return '—'
  }
  const formatter = getNumberFormatter({
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
  })
  return formatter.format(numericValue)
}

export const formatCurrency = (value) => {
  if (value === null || value === undefined) {
    return '—'
  }
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return '—'
  }
  return baseCurrencyFormatter.format(numericValue)
}

export const formatDelta = (value, { currency = false, showZero = false } = {}) => {
  if (value === 0 && !showZero) {
    return '—'
  }
  const formatter = currency ? formatCurrency : (val) => formatNumber(val, { maximumFractionDigits: 0 })
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return '—'
  }
  const prefix = numericValue > 0 ? '+' : ''
  return `${prefix}${formatter(numericValue)}`
}

const dateFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, { dateStyle: 'medium' })
const dateTimeFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export const formatDate = (value) => {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return '—'
  }
  return dateFormatter.format(date)
}

export const formatDateTime = (value) => {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return '—'
  }
  return dateTimeFormatter.format(date)
}

const relativeTimeFormatter = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: 'auto' })
const relativeUnits = [
  ['year', 1000 * 60 * 60 * 24 * 365],
  ['month', 1000 * 60 * 60 * 24 * 30],
  ['week', 1000 * 60 * 60 * 24 * 7],
  ['day', 1000 * 60 * 60 * 24],
  ['hour', 1000 * 60 * 60],
  ['minute', 1000 * 60],
]

export const formatRelativeTime = (value) => {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return '—'
  }
  const deltaMs = date.getTime() - Date.now()
  for (const [unit, unitMs] of relativeUnits) {
    if (Math.abs(deltaMs) >= unitMs || unit === 'minute') {
      return relativeTimeFormatter.format(Math.round(deltaMs / unitMs), unit)
    }
  }
  return 'just now'
}

export const formatPercent = (value, { maximumFractionDigits = 1 } = {}) => {
  if (value === null || value === undefined) {
    return '—'
  }
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return '—'
  }
  const formatter = getNumberFormatter({
    style: 'percent',
    maximumFractionDigits,
    minimumFractionDigits: 0,
  })
  return formatter.format(numericValue)
}
