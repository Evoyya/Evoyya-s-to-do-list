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
import { usePlaces } from '../hooks/useNotes'
import type { ChecklistItem } from '../lib/checklist'
import type { LabelView } from '../hooks/useLabels'
import { blockMates, columnOrder, planDrop, runs, type Columns } from '../lib/links'
import type { Note } from '../lib/notes'
import { URGENCIES, type Urgency } from '../lib/urgency'
import { BlockFrame } from './BlockFrame'
import { NoteCard } from './NoteCard'

const NO_ITEMS: ChecklistItem[] = []

// Столбцы в том виде, как они на экране: задачи блока подряд (ТР-11)
function groupByUrgency(notes: Note[]): Columns {
  const columns = {} as Columns
  for (const u of URGENCIES) columns[u.value] = columnOrder(notes, u.value)
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
  allNotes,
  itemsByNote,
  labelsFor,
  onOpen,
  onArchive,
}: {
  notes: Note[]
  // Все задачи доски без фильтра: блок переносится целиком, даже если часть скрыта фильтром
  allNotes: Note[]
  itemsByNote: Map<string, ChecklistItem[]>
  labelsFor: (note: Note) => LabelView
  onOpen: (id: string) => void
  onArchive: (note: Note) => void
}) {
  const places = usePlaces()
  const byId = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes])
  const derived = useMemo(() => groupByUrgency(notes), [notes])

  // Раскладка во время перетаскивания и сразу после него. Пока карточку тащат, действует
  // всегда: доска могла перерисоваться (пришли данные с другого устройства), и без этого
  // перенос в другой столбец терялся. После отпускания — пока не обновился список заметок,
  // иначе карточка на миг прыгала бы на старое место.
  const [override, setOverride] = useState<{ columns: Columns; notes: Note[] } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const columns =
    override && (activeId !== null || override.notes === notes) ? override.columns : derived

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

    // ТР-11: задача блока за его пределами тащит за собой весь блок
    const plan = planDrop(allNotes, { ...columns, [column]: list }, activeKey)
    if (!plan) {
      setOverride(null)
      return
    }
    setOverride({ columns: plan.columns, notes })
    places.mutate(plan.places)
  }

  const groupOf = (id: string) => byId.get(id)?.link_group ?? null
  const activeNote = activeId ? byId.get(activeId) : undefined
  const activeMates = activeNote ? blockMates(allNotes, activeNote.link_group).length : 0

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
      {/* Телефон: группы строками сверху вниз, от «Критично» до «Без дедлайна», между ними линии.
          Ноутбук: четыре столбца рядом, между ними тонкие линии. */}
      <div className="flex flex-col divide-y divide-border/60 md:grid md:grid-cols-4 md:divide-x md:divide-y-0">
        {URGENCIES.map((u) => (
          <Column
            key={u.value}
            id={u.value}
            label={u.label}
            color={u.color}
            count={columns[u.value].length}
          >
            <SortableContext items={columns[u.value]} strategy={verticalListSortingStrategy}>
              {runs(columns[u.value], groupOf).map((unit) => {
                const cards = unit.ids.map((id) => {
                  const note = byId.get(id)
                  if (!note) return null
                  return (
                    <SortableNote key={id} id={id}>
                      <NoteCard
                        note={note}
                        items={itemsByNote.get(id) ?? NO_ITEMS}
                        view={labelsFor(note)}
                        onOpen={() => onOpen(id)}
                        onArchive={() => onArchive(note)}
                      />
                    </SortableNote>
                  )
                })
                if (!unit.group) return cards
                // ТР-11: связанные задачи друг под другом в общей рамке
                return (
                  <li key={`block:${unit.ids[0]}`}>
                    <BlockFrame>{cards}</BlockFrame>
                  </li>
                )
              })}
            </SortableContext>
          </Column>
        ))}
      </div>

      <DragOverlay>
        {activeNote && (
          <div className="relative rotate-2 shadow-2xl">
            <NoteCard
              note={activeNote}
              items={itemsByNote.get(activeNote.id) ?? NO_ITEMS}
              view={labelsFor(activeNote)}
            />
            {activeMates > 1 && (
              // Вне блока карточка тащит за собой остальные задачи блока
              <span className="absolute -top-2 -right-2 rounded-full border-2 border-text bg-surface px-2 py-0.5 text-xs font-medium text-text">
                +{activeMates - 1}
              </span>
            )}
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
      // Телефон: группы друг под другом, между ними тонкие линии; ПК: столбцы с линиями между ними
      className="flex min-w-0 flex-col gap-3 py-4 first:pt-0 last:pb-0 md:px-3 md:py-0 md:first:pl-0 md:last:pr-0"
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
