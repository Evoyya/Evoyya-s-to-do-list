import { useMemo } from 'react'
import {
  localDateKey,
  memoriesCount,
  selectVisible,
  type JarMember,
  type Memory,
} from '../lib/memoryJar'
import { MemoryJar } from './MemoryJar'

// ТР-13: банка с сердечками и подписью под ней. Отдельно от страницы, чтобы
// показывать её и без входа (страница-образец в режиме разработки)
export function JarScene({
  jarId,
  memories,
  members,
  onOpen,
  onLid,
}: {
  jarId: string
  memories: Memory[]
  members: JarMember[]
  onOpen?: (memory: Memory) => void
  onLid?: () => void
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

  return (
    <div className="flex flex-col items-center">
      <MemoryJar
        memories={visible}
        members={members}
        onOpen={onOpen}
        onLid={onLid}
        className="h-auto max-h-[62dvh] w-full max-w-[340px]"
      />
      <p className="mt-3 text-center text-sm text-jar-ink-muted">
        {memories.length === 0
          ? 'Положите первое воспоминание'
          : `В банке ${memoriesCount(memories.length)}`}
      </p>
    </div>
  )
}
