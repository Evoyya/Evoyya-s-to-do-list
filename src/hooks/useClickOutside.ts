import { useEffect, useRef, type RefObject } from 'react'

// Клик мышью мимо элементов закрывает редактор, как в Keep на ПК.
// Касания пальцем не считаются: на телефоне так начинается прокрутка страницы.
// Закрываем после клика, а не при нажатии: иначе редактор исчезает раньше,
// чем сработал клик, окно меняет высоту, и кнопка уезжает из-под курсора.
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
    const isOutside = (e: Event) => !refs.some((ref) => ref.current?.contains(e.target as Node))

    // Нажали мышью снаружи — запоминаем; если и отпустили снаружи, закрываем.
    // Выделение текста, начатое внутри, редактор не закрывает.
    let pressedOutside = false
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = e.pointerType === 'mouse' && e.button === 0 && isOutside(e)
    }
    // Документ получает клик последним — кнопка, по которой кликнули, уже сработала
    const onClick = (e: MouseEvent) => {
      if (pressedOutside && isOutside(e)) handler.current()
      pressedOutside = false
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('click', onClick)
    }
    // refs — стабильные объекты useRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
}
