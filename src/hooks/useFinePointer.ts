import { useSyncExternalStore } from 'react'

const QUERY = '(pointer: fine)'

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

// Есть ли мышь или тачпад (ноутбук, ПК). На телефоне — false: там часть
// мелких кнопок не показываем, чтобы не нажать случайно при прокрутке.
export function useFinePointer() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches)
}
