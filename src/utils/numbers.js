export const parseNumericInput = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(numeric) ? numeric : fallback
}
