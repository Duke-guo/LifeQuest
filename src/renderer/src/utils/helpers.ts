export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** 本地日期 YYYY-MM-DD */
export function todayStr(): string {
  const d = new Date()
  return toDateStr(d)
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 2025-09-15 -> 9月15日 */
export function formatDate(date: string): string {
  const [, m, day] = date.split('-')
  return `${Number(m)}月${Number(day)}日`
}
