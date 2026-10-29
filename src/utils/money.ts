const pln = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatPrice(grosze: number): string {
  return pln.format(grosze / 100)
}

export function formatServicePrice(service: { priceGrosze: number; priceFrom: boolean }): string {
  const price = formatPrice(service.priceGrosze)
  return service.priceFrom ? `od ${price}` : price
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
