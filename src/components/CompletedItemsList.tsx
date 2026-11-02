import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useDeleteCompletedItem } from '../hooks/useCompletedItems'
import { useMembers } from '../hooks/useMembers'
import type { CompletedItem } from '../lib/completedItems'
import { memberName } from '../lib/members'
import { Checkbox } from './Checkbox'
import { ConfirmDialog } from './ConfirmDialog'
import { TrashIcon } from './icons'

// Имя того, кто зачеркнул пункт; себя не подписываем
export function useCompletedByName() {
  const { session } = useAuth()
  const { data: members = [] } = useMembers()
  return useMemo(() => {
    const names = new Map(members.map((m) => [m.user_id, memberName(m)]))
    return (userId: string | null) =>
      userId && userId !== session?.user.id ? (names.get(userId) ?? null) : null
  }, [members, session])
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })

// Архив выполненных пунктов постоянных заметок: по дням, новые сверху
export function CompletedItemsList({ items }: { items: CompletedItem[] }) {
  const nameOf = useCompletedByName()
  const deleteItem = useDeleteCompletedItem()
  const [deleting, setDeleting] = useState<CompletedItem | null>(null)

  const days = useMemo(() => {
    const map = new Map<string, CompletedItem[]>()
    for (const item of items) {
      const key = new Date(item.completed_at).toDateString()
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return [...map.values()]
  }, [items])

  return (
    <div className="flex flex-col gap-5">
      {days.map((day) => (
        <section key={day[0].completed_at} aria-label={dayLabel(day[0].completed_at)}>
          <h2 className="mb-2 text-sm font-medium first-letter:uppercase">
            {dayLabel(day[0].completed_at)}
          </h2>
          <ul className="flex flex-col divide-y divide-border/40 rounded-lg border border-border/60">
            {day.map((item) => {
              const who = nameOf(item.completed_by)
              return (
                <li key={item.id} className="group flex items-center gap-3 px-3 py-2">
                  <Checkbox checked label={item.text} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-muted line-through">{item.text}</p>
                    <p className="truncate text-xs text-text-muted">
                      {item.noteTitle} · {time(item.completed_at)}
                      {who && ` · ${who}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleting(item)}
                    title="Удалить из архива"
                    aria-label={`Удалить из архива: ${item.text}`}
                    className="rounded-full p-1.5 text-text-muted transition-opacity hover:bg-surface-raised hover:text-text pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
                  >
                    <TrashIcon />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {deleting && (
        <ConfirmDialog
          title="Удалить из архива?"
          message={`Запись «${deleting.text}» из заметки «${deleting.noteTitle}» пропадёт из архива и статистики. В самой заметке пункт останется.`}
          confirmLabel="Удалить"
          onConfirm={() => {
            deleteItem.mutate(deleting)
            setDeleting(null)
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
