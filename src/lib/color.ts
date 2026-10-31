import type { CSSProperties } from 'react'

// ТР-5: цвет текста под фон карточки — светлый или тёмный, смотря что контрастнее

const LIGHT = { text: '#e8eaed', muted: 'rgb(232 234 237 / 0.72)' }
const DARK = { text: '#202124', muted: 'rgb(32 33 36 / 0.72)' }

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

export function readableText(background: string) {
  const bg = luminance(background)
  return contrast(bg, luminance(LIGHT.text)) >= contrast(bg, luminance(DARK.text)) ? LIGHT : DARK
}

export const isHexColor = (value: string) => /^#[0-9a-f]{6}$/.test(value)

// «#ABC» или «#AABBCC» из поля ввода — к виду, который принимает база
export function normalizeHex(value: string) {
  const hex = value.replace('#', '').toLowerCase()
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  return `#${full}`
}

// Карточка в цвете ярлыка. Переменные темы переопределены, чтобы весь текст
// внутри (включая приглушённый) подстроился под фон.
export function cardStyle(color: string | undefined): CSSProperties | undefined {
  if (!color) return undefined
  const { text, muted } = readableText(color)
  return {
    backgroundColor: color,
    borderColor: 'transparent',
    color: text,
    '--color-text': text,
    '--color-text-muted': muted,
  } as CSSProperties
}
