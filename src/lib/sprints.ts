import type { Tables, TablesInsert, TablesUpdate } from './database.types'
import { onBoard } from './links'
import type { Note, Place } from './notes'
import { supabase } from './supabase'

// ТР-12: спринты. Спринт личный и объединяет свои временные задачи из любых
// столбцов срочности. Номер задачи — её место в спринте (1, 2, 3… без пропусков).

// Ключ кэша спринтов (здесь, а не в хуке: его читают и хуки заметок)
export const SPRINTS_KEY = ['sprints'] as const

export type Sprint = Tables<'sprints'>
export type SprintShape = Sprint['shape']
export type SprintPatch = TablesUpdate<'sprints'>

export const SHAPES: { value: SprintShape; label: string }[] = [
  { value: 'circle', label: 'Круг' },
  { value: 'square', label: 'Квадрат' },
  { value: 'triangle', label: 'Треугольник' },
  { value: 'diamond', label: 'Ромб' },
  { value: 'hexagon', label: 'Шестиугольник' },
  { value: 'star', label: 'Звезда' },
  { value: 'heart', label: 'Сердце' },
  { value: 'shield', label: 'Щит' },
]

export const shapeLabel = (shape: SprintShape) =>
  SHAPES.find((s) => s.value === shape)?.label ?? shape

export const isActive = (sprint: Sprint) => !sprint.completed_at

// Действующие — по дате создания, завершённые — недавние сверху
export function splitSprints(sprints: Sprint[]) {
  const active = sprints.filter(isActive).sort((a, b) => a.created_at.localeCompare(b.created_at))
  const done = sprints
    .filter((s) => !isActive(s))
    .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))
  return { active, done }
}

// Фигуры, не занятые действующими спринтами. exceptId — сам редактируемый спринт.
export function freeShapes(sprints: Sprint[], exceptId?: string): SprintShape[] {
  const taken = new Set(sprints.filter((s) => isActive(s) && s.id !== exceptId).map((s) => s.shape))
  return SHAPES.map((s) => s.value).filter((shape) => !taken.has(shape))
}

// Задачи спринта по порядку номеров (и на доске, и в архиве)
export function sprintTasks(notes: Note[], sprintId: string | null): Note[] {
  if (!sprintId) return []
  return notes
    .filter((n) => n.sprint_id === sprintId && n.kind === 'temporary')
    .sort(
      (a, b) =>
        (a.sprint_position ?? 0) - (b.sprint_position ?? 0) ||
        a.created_at.localeCompare(b.created_at),
    )
}

// Номер задачи в спринте, начиная с 1; null — задача не в спринте
export function sprintNumber(notes: Note[], note: Note): number | null {
  const index = sprintTasks(notes, note.sprint_id).findIndex((n) => n.id === note.id)
  return index < 0 ? null : index + 1
}

// Номера по порядку order: каждая задача получает sprint_position = номер.
// Возвращаются только изменившиеся места (и всегда — задачи из always).
function renumber(
  order: string[],
  sprintId: string,
  current: Map<string, Note>,
  always: Set<string> = new Set(),
): Place[] {
  const places: Place[] = []
  order.forEach((id, i) => {
    const note = current.get(id)
    const position = i + 1
    if (always.has(id) || note?.sprint_id !== sprintId || note?.sprint_position !== position) {
      places.push({ note_id: id, sprint_id: sprintId, sprint_position: position })
    }
  })
  return places
}

// Поставить задачу в спринт на место number (1…N+1); без номера — в конец.
// Остальные задачи спринта сдвигаются. Если задача уже в этом спринте — перестановка.
export function planJoin(
  notes: Note[],
  noteId: string,
  sprintId: string,
  number?: number | null,
): Place[] {
  const others = sprintTasks(notes, sprintId)
    .map((n) => n.id)
    .filter((id) => id !== noteId)
  const at = Math.min(Math.max((number ?? others.length + 1) - 1, 0), others.length)
  const order = [...others.slice(0, at), noteId, ...others.slice(at)]
  return renumber(order, sprintId, new Map(notes.map((n) => [n.id, n])), new Set([noteId]))
}

// Новый порядок задач спринта после перетаскивания на вкладке «Спринты»
export function planReorder(notes: Note[], sprintId: string, order: string[]): Place[] {
  return renumber(order, sprintId, new Map(notes.map((n) => [n.id, n])))
}

// Задача выходит из спринта. Номера остальных сдвигаются сами: номер — это место по порядку.
export const planLeave = (noteId: string): Place[] => [
  { note_id: noteId, sprint_id: null, sprint_position: null },
]

// Сколько номеров можно выбрать для задачи в спринте (в конец — тоже вариант)
export function numberChoices(notes: Note[], noteId: string, sprintId: string | null): number {
  if (!sprintId) return 0
  const others = sprintTasks(notes, sprintId).filter((n) => n.id !== noteId)
  return others.length + 1
}

// Кому поставить ярлык, поставленный на задачу noteId: самой задаче, её блоку (ТР-11)
// и задачам её действующего спринта на доске (ТР-12). Цепочкой: блок задачи спринта
// тоже получает ярлык, иначе ярлыки внутри блока разошлись бы. Только свои задачи —
// на чужой общей задаче ярлыки ставит её создатель. Снятие ярлыка спринт не затрагивает.
export function addLabelTargets(
  notes: Note[],
  noteId: string,
  me: string,
  activeSprintIds: Set<string>,
): string[] {
  const board = onBoard(notes)
  const byId = new Map(notes.map((n) => [n.id, n]))
  const result = [noteId]
  const seen = new Set(result)
  for (let i = 0; i < result.length; i++) {
    const note = byId.get(result[i])
    if (!note) continue
    const sprint = note.sprint_id && activeSprintIds.has(note.sprint_id) ? note.sprint_id : null
    for (const mate of board) {
      if (seen.has(mate.id) || mate.owner_id !== me) continue
      const sameBlock = !!note.link_group && mate.link_group === note.link_group
      const sameSprint = !!sprint && mate.sprint_id === sprint
      if (sameBlock || sameSprint) {
        seen.add(mate.id)
        result.push(mate.id)
      }
    }
  }
  return result
}

// Места нескольких планов сразу: поля одной задачи объединяются
export function mergePlaces(...lists: Place[][]): Place[] {
  const byId = new Map<string, Place>()
  for (const place of lists.flat()) {
    byId.set(place.note_id, { ...byId.get(place.note_id), ...place })
  }
  return [...byId.values()]
}

// Заметки из двух источников: свежие (с экрана) поверх загруженных
export function mergeNotes(base: Note[], fresh: Note[]): Note[] {
  const byId = new Map(base.map((n) => [n.id, n]))
  for (const n of fresh) byId.set(n.id, n)
  return [...byId.values()]
}

// ---------------------------------------------------------------
// База
// ---------------------------------------------------------------

export async function fetchSprints(): Promise<Sprint[]> {
  const { data, error } = await supabase.from('sprints').select('*')
  if (error) throw error
  return data
}

export async function insertSprint(sprint: Sprint) {
  const { id, title, description, due_date, shape } = sprint
  const row: TablesInsert<'sprints'> = { id, title, description, due_date, shape }
  const { error } = await supabase.from('sprints').insert(row)
  if (error) throw error
}

export async function updateSprint(id: string, patch: SprintPatch) {
  const { error } = await supabase.from('sprints').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteSprint(id: string) {
  const { error } = await supabase.from('sprints').delete().eq('id', id)
  if (error) throw error
}

export function makeSprint(
  ownerId: string,
  fields: Pick<Sprint, 'title' | 'description' | 'due_date' | 'shape'>,
): Sprint {
  return {
    id: crypto.randomUUID(),
    owner_id: ownerId,
    completed_at: null,
    created_at: new Date().toISOString(),
    ...fields,
  }
}
