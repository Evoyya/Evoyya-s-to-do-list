import {
  closestCorners,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMemo, useState, type ReactNode } from 'react'
import { useUpdateNote } from '../hooks/useNotes'
import { positionBetween, type ChecklistItem } from '../lib/checklist'
import type { Note } from '../lib/notes'
import { URGENCIES, type Urgency } from '../lib/urgency'
import { NoteCard } from './NoteCard'

type Columns = Record<Urgency, string[]>

const NO_ITEMS: ChecklistItem[] = []

function groupByUrgency(notes: Note[]): Columns {
  const columns: Columns = { critical: [], urgent: [], not_urgent: [], no_deadline: [] }
  // notes уже отсортированы по position
  for (const note of notes) columns[note.urgency].push(note.id)
  return columns
}

const isColumnId = (id: string): id is Urgency => URGENCIES.some((u) => u.value === id)

function findColumn(id: string, columns: Columns): Urgency | undefined {
  if (isColumnId(id)) return id
  return URGENCIES.find((u) => columns[u.value].includes(id))?.value
}

// ТР-2: временные задачи в четырёх столбцах срочности с перетаскиванием
export function UrgencyBoard({
  notes,
  itemsByNote,
  onOpen,
}: {
  notes: Note[]
  itemsByNote: Map<string, ChecklistItem[]>
  onOpen: (id: string) => void
}) {
  const updateNote = useUpdateNote()
  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes])
  const derived = useMemo(() => groupByUrgency(notes), [notes])

  // Раскладка во время перетаскивания и сразу после него. Действует, пока не обновился
  // список заметок, — иначе карточка на миг прыгала бы на старое место.
  const [override, setOverride] = useState<{ columns: Columns; notes: Note[] } | null>(null)
  const columns = override && override.notes === notes ? override.columns : derived
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // На телефоне карточка захватывается после удержания, обычное касание её открывает
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    setOverride({ columns: derived, notes })
  }

  // Перенос в другой столбец показываем сразу, пока карточку ещё тащат
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const activeKey = String(active.id)
    const overKey = String(over.id)
    const from = findColumn(activeKey, columns)
    const to = findColumn(overKey, columns)
    if (!from || !to || from === to) return

    const target = [...columns[to]]
    const overIndex = target.indexOf(overKey)
    target.splice(overIndex >= 0 ? overIndex : target.length, 0, activeKey)
    setOverride({
      columns: { ...columns, [from]: columns[from].filter((id) => id !== activeKey), [to]: target },
      notes,
    })
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    const activeKey = String(active.id)
    const column = findColumn(activeKey, columns)
    if (!over || !column) {
      setOverride(null)
      return
    }

    let list = columns[column]
    const overKey = String(over.id)
    if (overKey !== activeKey && list.includes(overKey)) {
      list = arrayMove(list, list.indexOf(activeKey), list.indexOf(overKey))
    }

    const note = byId.get(activeKey)
    if (!note) return
    const unchanged = note.urgency === column && list.join() === derived[column].join()
    if (unchanged) {
      setOverride(null)
      return
    }

    const index = list.indexOf(activeKey)
    const position = positionBetween(
      byId.get(list[index - 1])?.position,
      byId.get(list[index + 1])?.position,
    )
    setOverride({ columns: { ...columns, [column]: list }, notes })
    updateNote.mutate({ id: activeKey, patch: { urgency: column, position } })
  }

  const activeNote = activeId ? byId.get(activeId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setOverride(null)
      }}
    >
      {/* Телефон: группы строками сверху вниз, от «Критично» до «Без дедлайна».
          Ноутбук: четыре столбца рядом, между ними тонкие линии. */}
      <div className="flex flex-col gap-6 md:grid md:grid-cols-4 md:gap-0 md:divide-x md:divide-border/60">
        {URGENCIES.map((u) => (
          <Column
            key={u.value}
            id={u.value}
            label={u.label}
            color={u.color}
            count={columns[u.value].length}
          >
            <SortableContext items={columns[u.value]} strategy={verticalListSortingStrategy}>
              {columns[u.value].map((id) => {
                const note = byId.get(id)
                if (!note) return null
                return (
                  <SortableNote key={id} id={id}>
                    <NoteCard
                      note={note}
                      items={itemsByNote.get(id) ?? NO_ITEMS}
                      onOpen={() => onOpen(id)}
                    />
                  </SortableNote>
                )
              })}
            </SortableContext>
          </Column>
        ))}
      </div>

      <DragOverlay>
        {activeNote && (
          <div className="rotate-2 shadow-2xl">
            <NoteCard note={activeNote} items={itemsByNote.get(activeNote.id) ?? NO_ITEMS} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function Column({
  id,
  label,
  color,
  count,
  children,
}: {
  id: Urgency
  label: string
  color: string
  count: number
  children: ReactNode
}) {
  // Столбец сам принимает карточку, даже если в нём пусто
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section
      aria-label={label}
      className="flex min-w-0 flex-col gap-3 md:px-3 md:first:pl-0 md:last:pr-0"
    >
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <span
          className="size-2.5 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        {label}
        <span className="text-text-muted">{count}</span>
      </h3>
      <ul
        ref={setNodeRef}
        className={`flex min-h-12 flex-col gap-3 rounded-lg border border-dashed p-1 transition-colors md:min-h-24 ${
          isOver ? 'border-border' : 'border-transparent'
        }`}
      >
        {children}
        {count === 0 && (
          // На телефоне пустая группа видна как тонкая строка, в неё можно бросить карточку
          <li className="px-2 py-2 text-sm text-text-muted/70 md:hidden">Пусто</li>
        )}
      </ul>
    </section>
  )
}

function SortableNote({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-30' : undefined}
      {...attributes}
      {...listeners}
      // Карточка сама открывается по Enter, а role="button" уже есть внутри
      role={undefined}
      tabIndex={undefined}
    >
      {children}
    </li>
  )
}
