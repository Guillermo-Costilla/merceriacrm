/**
 * Formatea un importe en centavos a pesos argentinos (ARS).
 * Ejemplo: 125050 -> "$ 1.250,50"
 */
export function formatCurrency(cents: number): string {
  if (isNaN(cents)) return '$ 0,00'
  const pesos = cents / 100
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos)
}

/**
 * Convierte centavos a pesos con formato argentino para campos de importe.
 * Ejemplo: 125050 -> "1250,50"
 */
export function centsToDecimalString(cents: number): string {
  if (isNaN(cents)) return ''
  return new Intl.NumberFormat('es-AR', {
    useGrouping: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function parseLocalizedQuantity(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,3})?$/.test(normalized)) return null
  const quantity = Number(normalized)
  return Number.isFinite(quantity) ? quantity : null
}

export function formatLocalizedQuantity(value: number): string {
  if (!Number.isFinite(value)) return ''
  return new Intl.NumberFormat('es-AR', {
    useGrouping: false,
    maximumFractionDigits: 3,
  }).format(value)
}

export function parseCurrencyToCents(value: string): number | null {
  const trimmed = value.trim().replace(/^\$\s*/, '')
  if (!trimmed) return null

  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(?:\.\d{3})+$/.test(trimmed)
      ? trimmed.replace(/\./g, '')
      : trimmed
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null

  const amount = Number(normalized)
  return Number.isFinite(amount) ? Math.round(amount * 100) : null
}

/**
 * Convierte una entrada decimal a centavos enteros.
 * Ejemplo: "1250.50", "1250,50" o "1.250,50" -> 125050
 */
export function decimalStringToCents(val: string | number): number {
  if (typeof val === 'number') return Math.round(val * 100)
  return parseCurrencyToCents(val) ?? 0
}

/**
 * Formatea una cantidad con su unidad de medida.
 * Ejemplo: 1.25, "metro" -> "1,25 m"
 */
export function formatQuantity(qty: number, unit: string = 'unidad'): string {
  if (isNaN(qty)) return '0'
  const formattedNum = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: qty % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 3,
  }).format(qty)

  const abbreviations: Record<string, string> = {
    unidad: 'u.',
    metro: 'm',
    paquete: 'paq.',
    rollo: 'rollo',
    centimetro: 'cm',
    gramo: 'g',
  }

  const abbr = abbreviations[unit.toLowerCase()] || unit
  return `${formattedNum} ${abbr}`
}

/**
 * Zona horaria oficial para fechas y períodos del comercio.
 */
export const BUSINESS_TIME_ZONE = 'America/Argentina/Tucuman'

export function getBusinessYearMonth(date: Date = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date)

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
  }
}

/**
 * Formatea fecha y hora en la zona horaria oficial del comercio.
 */
export function formatDateTime(isoString: string): string {
  if (!isoString) return '-'
  try {
    const normalizedTimestamp = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(isoString)
      ? `${isoString.replace(' ', 'T')}Z`
      : isoString

    return new Date(normalizedTimestamp).toLocaleString('es-AR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      hourCycle: 'h23',
      timeZone: BUSINESS_TIME_ZONE,
    })
  } catch {
    return isoString
  }
}
