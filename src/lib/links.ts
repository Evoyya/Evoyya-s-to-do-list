import type { Note, Place } from './notes'
import type { Urgency } from './urgency'

// ТР-11: связанные задачи. Блок — задачи с одинаковым link_group, которые
// стоят в одном столбце подряд. Связи у каждого пользователя свои.

// Как byPosition в notes.ts (здесь без импорта клиента базы — логика проверяется тестами)
const byPosition = (a: Note, b: Note) =>
  a.position - b.position || b.created_at.localeCompare(a.created_at)

// Единица раскладки: одиночная задача (group = null) или блок из 2+ задач
export type Unit = { group: string | null; ids: string[] }

// Задачи, которые сейчас на доске: временные и не в архиве
export const onBoard = (notes: Note[]) =>
  notes.filter((n) => n.kind === 'temporary' && !n.archived_at)

// Действующие задачи блока на доске, по порядку
export function blockMates(notes: Note[], group: string | null): Note[] {
  if (!group) return []
  return onBoard(notes)
    .filter((n) => n.link_group === group)
    .sort(byPosition)
}

// Список задач (уже по порядку) → единицы. Задачи блока собираются на месте первой из них,
// даже если их порядок в базе перемешан: так блок всегда выглядит цельным.
// Работает и для столбца доски, и для архива.
export function toUnits(notes: Note[]): Unit[] {
  const count = new Map<string, number>()
  for (const n of notes)
    if (n.link_group) count.set(n.link_group, (count.get(n.link_group) ?? 0) + 1)
  const units: Unit[] = []
  const done = new Set<string>()
  for (const n of notes) {
    const group = n.link_group
    if (!group || (count.get(group) ?? 0) < 2) {
      units.push({ group: null, ids: [n.id] })
    } else if (!done.has(group)) {
      done.add(group)
      units.push({ group, ids: notes.filter((m) => m.link_group === group).map((m) => m.id) })
    }
  }
  return units
}

// Подряд идущие задачи одного блока (раскладка во время перетаскивания)
export function runs(ids: string[], groupOf: (id: string) => string | null): Unit[] {
  const units: Unit[] = []
  for (const id of ids) {
    const group = groupOf(id)
    const last = units.at(-1)
    if (group && last && last.ids.length > 0 && groupOf(last.ids[0]) === group) {
      last.ids.push(id)
      last.group = group
    } else {
      units.push({ group: null, ids: [id] })
    }
  }
  return units
}

// Столбец доски в том порядке, в каком он виден (блоки подряд)
export function columnOrder(notes: Note[], urgency: Urgency): string[] {
  const column = onBoard(notes)
    .filter((n) => n.urgency === urgency)
    .sort(byPosition)
  return toUnits(column).flatMap((u) => u.ids)
}

// Новые позиции для задач столбца в порядке order. Задачи из moved получают новое место
// всегда, остальные — только если их позиция не укладывается в порядок. Возвращает
// только изменившиеся позиции (и все из moved).
export function assignPositions(
  order: string[],
  positionOf: (id: string) => number,
  moved: Set<string>,
): Map<string, number> {
  const keep = order.map(() => false)
  let last = -Infinity
  order.forEach((id, i) => {
    const p = positionOf(id)
    if (!moved.has(id) && p > last) {
      keep[i] = true
      last = p
    }
  })

  const result = new Map<string, number>()
  let i = 0
  while (i < order.length) {
    if (keep[i]) {
      i++
      continue
    }
    let j = i
    while (j < order.length && !keep[j]) j++
    const prev = i > 0 ? positionOf(order[i - 1]) : undefined
    const next = j < order.length ? positionOf(order[j]) : undefined
    const k = j - i
    for (let t = 0; t < k; t++) {
      const id = order[i + t]
      let p: number
      if (prev === undefined && next === undefined) p = t
      else if (prev === undefined) p = next! - (k - t)
      else if (next === undefined) p = prev + t + 1
      else p = prev + ((next - prev) * (t + 1)) / (k + 1)
      if (moved.has(id) || p !== positionOf(id)) result.set(id, p)
    }
    i = j
  }
  return result
}

// Индекс вставки не должен попасть внутрь чужого блока: тогда — перед этим блоком
function outsideBlocks(list: string[], index: number, groupOf: (id: string) => string | null) {
  let i = index
  while (i > 0 && i < list.length) {
    const g = groupOf(list[i])
    if (!g || groupOf(list[i - 1]) !== g) break
    i--
  }
  return i
}

const placesFrom = (
  order: string[],
  notes: Map<string, Note>,
  moved: Set<string>,
  extra: (id: string) => Partial<Place> = () => ({}),
): Place[] => {
  const positions = assignPositions(order, (id) => notes.get(id)!.position, moved)
  const ids = new Set([...moved, ...positions.keys()])
  return [...ids].map((id) => ({
    note_id: id,
    ...(positions.has(id) ? { position: positions.get(id) } : {}),
    ...extra(id),
  }))
}

// Применить изменения мест к списку заметок (для мгновенного отображения)
export function applyPlaces(notes: Note[], places: Place[]): Note[] {
  const byId = new Map(places.map((p) => [p.note_id, p]))
  return notes.map((n) => {
    const place = byId.get(n.id)
    if (!place) return n
    const { note_id: _, ...fields } = place
    return { ...n, ...fields }
  })
}

// ---------------------------------------------------------------
// Перетаскивание
// ---------------------------------------------------------------

export type Columns = Record<Urgency, string[]>

// Карточку отпустили. columns — раскладка в момент отпускания: activeId уже стоит
// на новом месте. Задача из блока внутри блока меняет порядок, за его пределами —
// тащит за собой весь блок (и в другой столбец тоже).
export function planDrop(
  notes: Note[],
  columns: Columns,
  activeId: string,
): { columns: Columns; places: Place[] } | null {
  const byId = new Map(notes.map((n) => [n.id, n]))
  const note = byId.get(activeId)
  const column = (Object.keys(columns) as Urgency[]).find((u) => columns[u].includes(activeId))
  if (!note || !column) return null
  const groupOf = (id: string) => byId.get(id)?.link_group ?? null

  const list = columns[column]
  const mates = blockMates(notes, note.link_group)
  let order: string[]
  let moved: Set<string>

  if (mates.length < 2) {
    // Одиночная задача: в середину чужого блока не встаёт, только перед ним
    const without = list.filter((id) => id !== activeId)
    const at = outsideBlocks(without, list.indexOf(activeId), groupOf)
    order = [...without.slice(0, at), activeId, ...without.slice(at)]
    moved = new Set([activeId])
  } else {
    const mateIds = new Set(mates.map((m) => m.id))
    const indexes = list.flatMap((id, i) => (mateIds.has(id) ? [i] : []))
    const together =
      indexes.length === mates.length && indexes.at(-1)! - indexes[0] === mates.length - 1
    if (together) {
      // Порядок внутри блока
      order = list
      moved = new Set([activeId])
    } else {
      // Весь блок встаёт туда, куда отпустили карточку, в прежнем порядке
      const others = list.filter((id) => !mateIds.has(id))
      const before = list.slice(0, list.indexOf(activeId)).filter((id) => !mateIds.has(id)).length
      const at = outsideBlocks(others, before, groupOf)
      order = [...others.slice(0, at), ...mates.map((m) => m.id), ...others.slice(at)]
      moved = mateIds
    }
  }

  const unchanged =
    [...moved].every((id) => byId.get(id)!.urgency === column) &&
    order.join() === columnOrder(notes, column).join()
  if (unchanged) return null

  const next = { ...columns }
  for (const u of Object.keys(next) as Urgency[]) {
    next[u] = u === column ? order : next[u].filter((id) => !moved.has(id))
  }
  return {
    columns: next,
    places: placesFrom(order, byId, moved, (id) =>
      moved.has(id) && byId.get(id)!.urgency !== column ? { urgency: column } : {},
    ),
  }
}

// ---------------------------------------------------------------
// Связывание, отвязывание, смена столбца, восстановление
// ---------------------------------------------------------------

// Связать задачу noteId с выбранными задачами столбца urgency. Если кто-то уже
// в блоке, вступают в него (выбранные блоки объединяются). Задачи собираются
// на месте верхней из них. notes должны включать и саму задачу, даже новую.
export function planLink(
  notes: Note[],
  noteId: string,
  selectedIds: string[],
  urgency: Urgency,
  newGroup: () => string,
  // Новая задача ещё не стояла в столбце: она встаёт в конец блока
  isNew = false,
): Place[] {
  const byId = new Map(notes.map((n) => [n.id, n]))
  const note = byId.get(noteId)
  if (!note || selectedIds.length === 0) return []

  // Кто будет в блоке: задача, выбранные и все, с кем они уже связаны
  const targets = new Set<string>([noteId])
  for (const id of [noteId, ...selectedIds]) {
    targets.add(id)
    for (const mate of blockMates(notes, byId.get(id)?.link_group ?? null)) targets.add(mate.id)
  }
  const group =
    [noteId, ...selectedIds].map((id) => byId.get(id)?.link_group).find((g) => !!g) ?? newGroup()

  const list = columnOrder(notes, urgency)
  const present = list.filter((id) => targets.has(id) && !(isNew && id === noteId))
  const missing = [...targets].filter((id) => !present.includes(id))
  const others = list.filter((id) => !targets.has(id))
  // Сколько чужих задач стоит выше верхней из связываемых
  const firstIndex = present.length ? list.indexOf(present[0]) : 0
  const at = list.slice(0, firstIndex).filter((id) => !targets.has(id)).length
  // Задачи, которых в столбце не было (новая, из другого столбца), — в конец блока
  const order = [...others.slice(0, at), ...present, ...missing, ...others.slice(at)]

  return placesFrom(order, byId, targets, (id) =>
    targets.has(id) ? { link_group: group, urgency } : {},
  )
}

// Отвязать задачу: блок остаётся, задача встаёт сразу под ним
export function planUnlink(notes: Note[], noteId: string): Place[] {
  const byId = new Map(notes.map((n) => [n.id, n]))
  const note = byId.get(noteId)
  if (!note?.link_group) return []
  if (blockMates(notes, note.link_group).length < 2) return [{ note_id: noteId, link_group: null }]
  const after = applyPlaces(notes, [{ note_id: noteId, link_group: null }])
  const order = columnOrder(after, note.urgency)
  const mates = blockMates(after, note.link_group).map((m) => m.id)
  const without = order.filter((id) => id !== noteId)
  const at = Math.max(...mates.map((id) => without.indexOf(id))) + 1
  const final = [...without.slice(0, at), noteId, ...without.slice(at)]
  const places = placesFrom(final, new Map(after.map((n) => [n.id, n])), new Set([noteId]))
  return places.map((p) => (p.note_id === noteId ? { ...p, link_group: null } : p))
}

// Смена столбца у задачи из блока: остальные задачи блока переезжают с ней
export function planMoveBlock(notes: Note[], noteId: string, urgency: Urgency): Place[] {
  const note = notes.find((n) => n.id === noteId)
  return blockMates(notes, note?.link_group ?? null)
    .filter((m) => m.id !== noteId && m.urgency !== urgency)
    .map((m) => ({ note_id: m.id, urgency }))
}

// Восстановление из архива: в конец своего блока и в его столбец, если блок ещё на доске.
// notes — задачи доски (без восстанавливаемой).
export function planRestore(
  notes: Note[],
  note: Note,
): { patch: { urgency?: Urgency; position?: number }; others: Place[] } {
  const mates = blockMates(notes, note.link_group)
  if (note.kind !== 'temporary' || mates.length === 0) return { patch: {}, others: [] }
  const urgency = mates[0].urgency
  const restored = { ...note, archived_at: null, urgency }
  const all = [...notes.filter((n) => n.id !== note.id), restored]
  const list = columnOrder(all, urgency).filter((id) => id !== note.id)
  const lastMate = Math.max(
    ...mates.filter((m) => m.urgency === urgency).map((m) => list.indexOf(m.id)),
  )
  const order = [...list.slice(0, lastMate + 1), note.id, ...list.slice(lastMate + 1)]
  const places = placesFrom(order, new Map(all.map((n) => [n.id, n])), new Set([note.id]))
  return {
    patch: { urgency, position: places.find((p) => p.note_id === note.id)!.position },
    others: places.filter((p) => p.note_id !== note.id),
  }
}

// Ярлык, поставленный или снятый на задаче блока, меняется у всех задач блока.
// Ярлыки ставит создатель заметки (ТР-9), поэтому чужие общие задачи блока не трогаем.
export function labelTargets(notes: Note[], noteId: string, me: string): string[] {
  const note = notes.find((n) => n.id === noteId)
  const mates = blockMates(notes, note?.link_group ?? null)
    .filter((m) => m.id !== noteId && m.owner_id === me)
    .map((m) => m.id)
  return [noteId, ...mates]
}

// Строки ярлыков, которых не хватает задачам ids (без повторов)
export function missingLabelRows(
  ids: string[],
  labelIds: string[],
  rows: { note_id: string; label_id: string }[],
) {
  const has = new Set(rows.map((r) => `${r.note_id}:${r.label_id}`))
  return ids.flatMap((note_id) =>
    labelIds
      .filter((label_id) => !has.has(`${note_id}:${label_id}`))
      .map((label_id) => ({ note_id, label_id })),
  )
}

// Названия связанных задач — для выгрузки и подписей
export function linkedTitles(note: Note, all: Note[]): string[] {
  if (!note.link_group) return []
  return all.filter((n) => n.id !== note.id && n.link_group === note.link_group).map((n) => n.title)
}
