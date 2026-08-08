type DateFormatOptions = Intl.DateTimeFormatOptions

function readStoredLocale() {
  if (typeof window === 'undefined') return 'en-KE'
  return (
    localStorage.getItem('mathia-locale') ||
    document.documentElement.lang ||
    navigator.language ||
    'en-KE'
  )
}

function readStoredCurrency() {
  if (typeof window === 'undefined') return 'KES'
  return localStorage.getItem('mathia-currency') || 'KES'
}

export function getUiLocale() {
  return readStoredLocale()
}

export function getUiCurrency() {
  return readStoredCurrency()
}

export function formatDate(
  value: string | number | Date,
  options?: DateFormatOptions,
  locale = readStoredLocale(),
) {
  return new Intl.DateTimeFormat(locale, options).format(new Date(value))
}

export function formatTime(
  value: string | number | Date,
  options?: DateFormatOptions,
  locale = readStoredLocale(),
) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  }).format(new Date(value))
}

export function formatDateTime(
  value: string | number | Date,
  options?: DateFormatOptions,
  locale = readStoredLocale(),
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(new Date(value))
}

export function formatNumber(value: number, locale = readStoredLocale()) {
  return new Intl.NumberFormat(locale).format(value)
}

export function formatCurrency(
  value: number,
  currency = readStoredCurrency(),
  locale = readStoredLocale(),
) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCompactNumber(value: number, locale = readStoredLocale()) {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function isRtlLocale(locale: string) {
  return /^(ar|fa|he|ur)\b/i.test(locale)
}
