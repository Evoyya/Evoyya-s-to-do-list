import { useEffect, useRef, type RefObject } from 'react'

// Нажатие мышью мимо элементов закрывает редактор, как в Keep на ПК.
// Касания пальцем не считаются: на телефоне так начинается прокрутка страницы.
export function useClickOutside(
  refs: RefObject<HTMLElement | null>[],
  onOutside: () => void,
  enabled = true,
) {
  // Последний обработчик без пересоздания подписки на каждый рендер
  const handler = useRef(onOutside)
  useEffect(() => {
    handler.current = onOutside
  })

  useEffect(() => {
    if (!enabled) return
    const listener = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      const target = e.target as Node
      if (refs.some((ref) => ref.current?.contains(target))) return
      handler.current()
    }
    document.addEventListener('pointerdown', listener)
    return () => document.removeEventListener('pointerdown', listener)
    // refs — стабильные объекты useRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
}
