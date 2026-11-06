import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  localDateKey,
  memoriesCount,
  selectVisible,
  type JarMember,
  type Memory,
} from '../lib/memoryJar'
import { MemoryJar } from './MemoryJar'

// Сколько сердечко считается «падающим» (анимация 900 мс)
const FALL_MS = 1200

// Воспоминания, появившиеся после открытия банки: своё только что добавленное
// и пришедшее от второго участника через Realtime. Уже лежавшие не падают.
function useFalling(memories: Memory[]) {
  const seen = useRef<Set<string> | null>(null)
  const [falling, setFalling] = useState<ReadonlySet<string>>(() => new Set())

  // До отрисовки: иначе сердечко на миг показалось бы на своём месте до падения
  useLayoutEffect(() => {
    const ids = memories.map((m) => m.id)
    if (!seen.current) {
      seen.current = new Set(ids)
      return
    }
    const known = seen.current
    const fresh = ids.filter((id) => !known.has(id))
    if (fresh.length === 0) return
    for (const id of fresh) known.add(id)
    setFalling((prev) => new Set([...prev, ...fresh]))
    setTimeout(() => {
      setFalling((prev) => new Set([...prev].filter((id) => !fresh.includes(id))))
    }, FALL_MS)
  }, [memories])

  return falling
}

// ТР-13: банка с сердечками и подписью под ней. Отдельно от страницы, чтобы
// показывать её и без входа (страница-образец в режиме разработки)
export function JarScene({
  jarId,
  memories,
  members,
  onOpen,
  onLid,
  shaking,
}: {
  jarId: string
  memories: Memory[]
  members: JarMember[]
  onOpen?: (memory: Memory) => void
  onLid?: () => void
  shaking?: boolean
}) {
  const today = localDateKey()
  // Набор сердечек меняется раз в сутки; добавленные сегодня — всегда в банке
  const visible = useMemo(
    () =>
      selectVisible(
        memories,
        `${jarId}:${today}`,
        (m) => localDateKey(new Date(m.created_at)) === today,
      ),
    [memories, jarId, today],
  )
  const falling = useFalling(memories)

  return (
    <div className="flex w-full flex-col items-center">
      <MemoryJar
        memories={visible}
        members={members}
        onOpen={onOpen}
        onLid={onLid}
        falling={falling}
        shaking={shaking}
        className="h-auto w-[min(100%,340px,calc(62dvh*0.85))] sm:w-[min(100%,600px,calc(70dvh*0.85))]"
      />
      <p className="mt-3 text-center text-sm text-jar-ink-muted">
        {memories.length === 0
          ? 'Положите первое воспоминание'
          : `В банке ${memoriesCount(memories.length)}`}
      </p>
    </div>
  )
}
