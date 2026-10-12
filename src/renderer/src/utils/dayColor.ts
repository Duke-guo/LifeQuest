import type { Mood, Weather } from '../../../shared/types'

/**
 * 日历格子的配色算法
 *
 *   色相(Hue)        ← 忙碌程度打底（冷蓝 → 薄荷 → 琥珀 → 橙 → 红 的热力图），
 *                       再由心情做「大幅偏移」：好心情拉向绿色，差心情拉向冷灰；
 *                       空闲的周末另给一族淡紫，好和空闲的工作日分开
 *   饱和度(Saturation) ← 心情：好心情更艳，差心情几乎褪成灰
 *   明度(Lightness)   ← 天气：晴更亮更暖，雨雪更冷更淡
 *
 * 目标：忙但开心（偏绿）和闲但低落（灰）一眼可辨；周末不再留白。
 */

interface BusyStop {
  max: number
  tier: string
  hue: number
  sat: number
  light: number
}

const BUSY_STOPS: BusyStop[] = [
  { max: 0, tier: '空闲', hue: 205, sat: 34, light: 93 },
  { max: 3.5, tier: '轻松', hue: 158, sat: 46, light: 91 },
  { max: 7.5, tier: '适中', hue: 46, sat: 66, light: 89 },
  { max: 9.5, tier: '较忙', hue: 20, sat: 78, light: 87 },
  { max: Infinity, tier: '好忙', hue: 350, sat: 66, light: 85 }
]

/**
 * 忙碌档位的唯一判定处（日历格子、周横幅、首页都用它，避免阈值漂移）
 * 刻度参考真实课表：3 节课 ≈ 5.5h → 适中；5 节课 ≈ 9.2h → 较忙。
 * bump 用于「临近截止还没完成」时把当天档位抬高一档。
 * star 表示这天有 5 星事项（考试、重要活动）—— 那种日子再空也不能叫「空闲」。
 */
export function busyTier(hours: number, count: number, bump = 0, star = false): string {
  if (star) return '紧张'
  if (count === 0 && bump === 0) return '空闲'
  const idx = BUSY_STOPS.findIndex((s) => hours <= s.max)
  const i = Math.min(BUSY_STOPS.length - 1, (idx < 0 ? BUSY_STOPS.length - 1 : idx) + bump)
  return BUSY_STOPS[i].tier
}

/** 有空闲周末那种淡紫，也有「5 星日」的深红：视觉上一眼分得出考试日 */
const STAR_STOP: BusyStop = { max: 0, tier: '紧张', hue: 6, sat: 72, light: 86 }

/** 空闲周末：淡紫，和空闲工作日（淡蓝）区分开 */
const WEEKEND_STOP: BusyStop = { max: 0, tier: '空闲', hue: 266, sat: 42, light: 93 }

/** 心情：色相拉向哪里、拉多少，以及饱和度/明度调整 */
const MOOD_ADJ: Record<Mood, { blendTo: number; blend: number; sat: number; light: number }> = {
  // 好心情：明显偏向绿色
  great: { blendTo: 138, blend: 0.85, sat: 1.3, light: 2 },
  good: { blendTo: 156, blend: 0.5, sat: 1.15, light: 1 },
  ok: { blendTo: 0, blend: 0, sat: 0.95, light: 0 },
  // 差心情：拉向冷灰并几乎褪色
  low: { blendTo: 216, blend: 0.45, sat: 0.55, light: -1 },
  bad: { blendTo: 220, blend: 0.7, sat: 0.2, light: -2 }
}

const WEATHER_ADJ: Record<Weather, { hue: number; sat: number; light: number }> = {
  sunny: { hue: 8, sat: 1.18, light: 2 },
  cloudy: { hue: -2, sat: 0.82, light: -2 },
  rain: { hue: -18, sat: 0.88, light: -5 },
  snow: { hue: -8, sat: 0.55, light: 5 },
  wind: { hue: -10, sat: 0.8, light: 0 },
  fog: { hue: -6, sat: 0.4, light: 3 }
}

export interface DayColor {
  tier: string
  bg: string
  chipBg: string
  chipFg: string
  line: string
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** 在色相环上走最短路径插值 */
function mixHue(from: number, to: number, t: number): number {
  let diff = ((to - from + 540) % 360) - 180
  diff *= t
  return ((from + diff) % 360 + 360) % 360
}

/** 'YYYY-MM-DD' 是周末吗（本地时间，不做时区换算） */
export function isWeekend(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number)
  const wd = new Date(y, m - 1, d).getDay()
  return wd === 0 || wd === 6
}

export function computeDayColor(
  date: string,
  hours: number,
  count: number,
  mood: Mood | null | undefined,
  weather: Weather | null | undefined,
  bump = 0,
  star = false
): DayColor {
  const idle = count === 0 && bump === 0 && !star
  const weekend = isWeekend(date)
  const baseIdx = BUSY_STOPS.findIndex((s) => hours <= s.max)
  const idx = Math.min(
    BUSY_STOPS.length - 1,
    (baseIdx < 0 ? BUSY_STOPS.length - 1 : baseIdx) + bump
  )
  // 5 星日（考试/重要活动）→ 紧张色；空闲的周末 → 淡紫；其余按实际负担
  const stop = star ? STAR_STOP : idle && weekend ? WEEKEND_STOP : BUSY_STOPS[idx]

  const m = mood ? MOOD_ADJ[mood] : { blendTo: 0, blend: 0, sat: 1, light: 0 }
  const w = weather ? WEATHER_ADJ[weather] : { hue: 0, sat: 1, light: 0 }

  // 1) 色相：忙碌打底 → 心情大幅偏移 → 天气微调
  let hue = stop.hue
  if (m.blend > 0) hue = mixHue(hue, m.blendTo, m.blend)
  hue = ((hue + w.hue) % 360 + 360) % 360

  // 2) 饱和度：忙碌档位 × 心情 × 天气（空闲也给一点颜色，不留成灰）
  const sat = clamp(stop.sat * m.sat * w.sat, 14, 94)

  // 3) 明度
  const light = clamp(stop.light + m.light + w.light, 78, 97)

  const chipBg = `hsl(${hue} ${clamp(sat * 0.95, 12, 90)}% ${clamp(light - 13, 60, 86)}%)`
  const chipFg = `hsl(${hue} ${clamp(sat + 10, 14, 94)}% ${clamp(light - 58, 20, 40)}%)`
  const line = `hsl(${hue} ${clamp(sat, 14, 92)}% ${clamp(light - 26, 42, 74)}%)`

  return {
    tier: star ? '紧张' : idle ? '空闲' : stop.tier,
    bg: `hsl(${hue} ${sat}% ${light}%)`,
    chipBg,
    chipFg,
    line
  }
}
