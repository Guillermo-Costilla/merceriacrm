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
 * Convierte un número en centavos a un string para inputs numéricos.
 * Ejemplo: 125050 -> "1250.50"
 */
export function centsToDecimalString(cents: number): string {
  if (isNaN(cents) || cents === 0) return '0.00'
  return (cents / 100).toFixed(2)
}

/**
 * Convierte una entrada decimal a centavos enteros.
 * Ejemplo: "1250.50" o "1250,50" -> 125050
 */
export function decimalStringToCents(val: string | number): number {
  if (typeof val === 'number') return Math.round(val * 100)
  if (!val) return 0
  const normalized = val.replace(/\$/g, '').replace(/\./g, '').replace(',', '.').trim()
  const num = parseFloat(normalized)
  return isNaN(num) ? 0 : Math.round(num * 100)
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
 * Formatea fecha y hora en zona horaria local de Argentina.
 */
export function formatDateTime(isoString: string): string {
  if (!isoString) return '-'
  try {
    return new Date(isoString).toLocaleString('es-AR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return isoString
  }
}
