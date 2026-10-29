/**
 * Polska odmiana po liczebniku: 1 termin, 2-4 terminy, 5-21 terminów, 22-24 terminy...
 * forms = [jeden, kilka, wiele], np. ['termin', 'terminy', 'terminów'].
 */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const abs = Math.abs(n)
  if (abs === 1) return forms[0]
  const lastDigit = abs % 10
  const lastTwo = abs % 100
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return forms[1]
  return forms[2]
}

export function countLabel(n: number, forms: readonly [string, string, string]): string {
  return `${n} ${plural(n, forms)}`
}
