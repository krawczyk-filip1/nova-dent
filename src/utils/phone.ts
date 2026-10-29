export function formatPhone(phone: string): string {
  const match = /^(\+48)?(\d{3})(\d{3})(\d{3})$/.exec(phone)
  if (!match) return phone
  const [, prefix, a, b, c] = match
  return `${prefix ? `${prefix} ` : ''}${a} ${b} ${c}`
}
