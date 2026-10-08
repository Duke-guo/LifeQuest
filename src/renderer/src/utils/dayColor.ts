import type { Mood, Weather } from '../../../shared/types'

/**
 * 日历格子的配色算法
 *
 *   色相(Hue)        ← 忙碌程度：冷灰 → 绿 → 黄 → 橙 → 红（热力图式）
 *   饱和度(Saturation) ← 心情：好心情更鲜艳，差心情发灰
 *   明度(Lightness)   ← 天气：晴更亮更暖，雨雪更冷更淡
 *
 * 三者相乘得到每天的底色，避免整月一片同色。
 */

interface BusyStop {
  /** 时长上限（小时），落在第一个满足的档位 */
  max: number
  tier: string
  hue: number
  sat: number
  /** 底色明度 */
  light: number
}

const BUSY_STOPS: BusyStop[] = [
  { max: 0, tier: '空闲', hue: 214, sat: 14, light: 96 },
  { max: 2.5, tier: '轻松', hue: 152, sat: 40, light: 92 },
  { max: 4.5, tier: '一般', hue: 44, sat: 62, light: 90 },
  { max: 7, tier: '较忙', hue: 24, sat: 74, light: 88 },
  { max: Infinity, tier: '好忙', hue: 356, sat: 64, light: 86 }
]

/** 心情 → 饱和度倍率 */
const MOOD_SAT: Record<Mood, number> = {
  great: 1.35,
  good: 1.15,
  ok: 0.95,
  low: 0.7,
  bad: 0.45
}

/** 天气 → 色相偏移 / 饱和度倍率 / 明度偏移 */
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
  /** 格子底色（浅） */
  bg: string
  /** 忙碌标签底色 */
  chipBg: string
  /** 忙碌标签文字 */
  chipFg: string
  /** 左侧/边框强调色 */
  line: string
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

export function computeDayColor(
  hours: number,
  count: number,
  mood: Mood | null | undefined,
  weather: Weather | null | undefined
): DayColor {
  const stop = BUSY_STOPS.find((s) => hours <= s.max) ?? BUSY_STOPS[BUSY_STOPS.length - 1]

  const idle = count === 0
  const moodF = mood ? MOOD_SAT[mood] : 1
  const w = weather ? WEATHER_ADJ[weather] : { hue: 0, sat: 1, light: 0 }

  const hue = ((stop.hue + w.hue) % 360 + 360) % 360
  const sat = clamp(stop.sat * moodF * w.sat, idle ? 6 : 14, 92)
  const light = clamp(stop.light + w.light, 80, 97)

  // 标签底：同色相、更深一点；文字：再深一档保证对比
  const chipBg = `hsl(${hue} ${clamp(sat * 0.9, 10, 88)}% ${clamp(light - 12, 62, 86)}%)`
  const chipFg = `hsl(${hue} ${clamp(sat + 8, 12, 92)}% ${clamp(light - 58, 22, 40)}%)`
  const line = `hsl(${hue} ${clamp(sat, 12, 90)}% ${clamp(light - 26, 45, 75)}%)`

  return {
    tier: idle ? '空闲' : stop.tier,
    bg: `hsl(${hue} ${sat}% ${light}%)`,
    chipBg,
    chipFg,
    line
  }
}
