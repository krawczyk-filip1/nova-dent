// Kod rezerwacji, który pacjent przepisuje z ekranu lub e-maila, np. "BK-7F3K9Q".
// Bez znaków łatwych do pomylenia: 0/O i 1/I.
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6
export const CODE_PREFIX = 'BK-'

const CODE_PATTERN = new RegExp(`^${CODE_PREFIX}[${CODE_ALPHABET}]{${CODE_LENGTH}}$`)

export function generateBookingCode(taken: ReadonlySet<string> = new Set()): string {
  for (;;) {
    // crypto.getRandomValues zamiast Math.random - kody nie powinny być przewidywalne.
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
    // 256 dzieli się przez 32 bez reszty, więc każdy znak alfabetu jest równie prawdopodobny.
    const body = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
    const code = CODE_PREFIX + body
    if (!taken.has(code)) return code
  }
}

export function normalizeBookingCode(input: string): string {
  let code = input.toUpperCase().replace(/[\s-]/g, '')
  if (code.startsWith('BK')) code = code.slice(2)
  return CODE_PREFIX + code
}

export function isBookingCode(value: string): boolean {
  return CODE_PATTERN.test(value)
}
