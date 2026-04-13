export function formatDate(date: Date) {
  return date.toISOString().split('T')[0]
}

export function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function getDayName(date: Date) {
  return date.toLocaleDateString('pl-PL', { weekday: 'short' })
}
