import { describe, expect, it } from 'vitest'
import { applyPlaces } from './links'
import type { Note } from './notes'
import {
  addLabelTargets,
  freeShapes,
  mergePlaces,
  numberChoices,
  planJoin,
  planLeave,
  planReorder,
  sprintNumber,
  sprintTasks,
  type Sprint,
} from './sprints'

const task = (id: string, patch: Partial<Note> = {}): Note => ({
  id,
  owner_id: 'me',
  title: id.toUpperCase(),
  description: null,
  due_date: null,
  kind: 'temporary',
  urgency: 'urgent',
  position: 0,
  primary_label_id: null,
  archived_at: null,
  link_group: null,
  sprint_id: null,
  sprint_position: null,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
  ...patch,
})

const sprint = (id: string, patch: Partial<Sprint> = {}): Sprint => ({
  id,
  owner_id: 'me',
  title: id,
  description: null,
  due_date: null,
  shape: 'circle',
  completed_at: null,
  created_at: '2026-11-01T10:00:00Z',
  ...patch,
})

const inSprint = (id: string, position: number, patch: Partial<Note> = {}) =>
  task(id, { sprint_id: 's', sprint_position: position, ...patch })

const numbers = (notes: Note[]) => sprintTasks(notes, 's').map((n) => n.id)

describe('ТР-12: номера задач в спринте', () => {
  it('задачи из разных столбцов идут по порядку номеров', () => {
    const notes = [
      inSprint('b', 2, { urgency: 'not_urgent' }),
      inSprint('a', 1, { urgency: 'critical' }),
      task('c'),
    ]
    expect(numbers(notes)).toEqual(['a', 'b'])
    expect(sprintNumber(notes, notes[0])).toBe(2)
    expect(sprintNumber(notes, notes[2])).toBeNull()
  })

  it('архивная задача сохраняет номер, номера остальных не меняются', () => {
    const notes = [inSprint('a', 1, { archived_at: '2026-11-02T10:00:00Z' }), inSprint('b', 2)]
    expect(sprintNumber(notes, notes[1])).toBe(2)
  })

  it('без номера задача встаёт в конец', () => {
    const notes = [inSprint('a', 1), inSprint('b', 2), task('c')]
    const places = planJoin(notes, 'c', 's')
    expect(places).toEqual([{ note_id: 'c', sprint_id: 's', sprint_position: 3 }])
  })

  it('выбранный номер ставит задачу на это место, остальные сдвигаются', () => {
    const notes = [inSprint('a', 1), inSprint('b', 2), task('c')]
    const after = applyPlaces(notes, planJoin(notes, 'c', 's', 1))
    expect(numbers(after)).toEqual(['c', 'a', 'b'])
    expect(sprintTasks(after, 's').map((n) => n.sprint_position)).toEqual([1, 2, 3])
  })

  it('номер больше числа задач — в конец; меньше 1 — в начало', () => {
    const notes = [inSprint('a', 1), task('c')]
    expect(numbers(applyPlaces(notes, planJoin(notes, 'c', 's', 9)))).toEqual(['a', 'c'])
    expect(numbers(applyPlaces(notes, planJoin(notes, 'c', 's', 0)))).toEqual(['c', 'a'])
  })

  it('смена номера внутри спринта — перестановка', () => {
    const notes = [inSprint('a', 1), inSprint('b', 2), inSprint('c', 3)]
    const after = applyPlaces(notes, planJoin(notes, 'a', 's', 3))
    expect(numbers(after)).toEqual(['b', 'c', 'a'])
  })

  it('номера в базе с пропусками выравниваются при следующем изменении', () => {
    const notes = [inSprint('a', 1), inSprint('b', 5)]
    const places = planReorder(notes, 's', ['b', 'a'])
    expect(places).toEqual([
      { note_id: 'b', sprint_id: 's', sprint_position: 1 },
      { note_id: 'a', sprint_id: 's', sprint_position: 2 },
    ])
  })

  it('перестановка возвращает только изменившиеся места', () => {
    const notes = [inSprint('a', 1), inSprint('b', 2), inSprint('c', 3)]
    expect(planReorder(notes, 's', ['a', 'c', 'b'])).toEqual([
      { note_id: 'c', sprint_id: 's', sprint_position: 2 },
      { note_id: 'b', sprint_id: 's', sprint_position: 3 },
    ])
  })

  it('задача выходит из спринта, номера остальных сдвигаются', () => {
    const notes = [inSprint('a', 1), inSprint('b', 2), inSprint('c', 3)]
    const after = applyPlaces(notes, planLeave('a'))
    expect(sprintNumber(after, after[2])).toBe(2)
    expect(after[0].sprint_id).toBeNull()
  })

  it('переход из другого спринта: задача уходит из старого', () => {
    const notes = [inSprint('a', 1), task('x', { sprint_id: 'old', sprint_position: 1 })]
    const after = applyPlaces(notes, planJoin(notes, 'x', 's', 1))
    expect(numbers(after)).toEqual(['x', 'a'])
    expect(sprintTasks(after, 'old')).toEqual([])
  })

  it('варианты номера: для новой задачи — N+1, для своей — N', () => {
    const notes = [inSprint('a', 1), inSprint('b', 2), task('c')]
    expect(numberChoices(notes, 'c', 's')).toBe(3)
    expect(numberChoices(notes, 'a', 's')).toBe(2)
    expect(numberChoices(notes, 'a', null)).toBe(0)
  })

  it('постоянная заметка в спринт не входит', () => {
    const notes = [inSprint('a', 1, { kind: 'permanent' })]
    expect(numbers(notes)).toEqual([])
  })
})

describe('ТР-12: фигуры спринтов', () => {
  it('фигура действующего спринта занята, завершённого — свободна', () => {
    const sprints = [
      sprint('a', { shape: 'circle' }),
      sprint('b', { shape: 'star', completed_at: '2026-11-03T10:00:00Z' }),
    ]
    const free = freeShapes(sprints)
    expect(free).not.toContain('circle')
    expect(free).toContain('star')
    expect(free).toHaveLength(7)
  })

  it('при правке спринта его собственная фигура доступна', () => {
    expect(freeShapes([sprint('a', { shape: 'circle' })], 'a')).toContain('circle')
  })
})

describe('mergePlaces', () => {
  it('объединяет поля одной задачи из разных планов', () => {
    expect(
      mergePlaces(
        [{ note_id: 'a', position: 3 }],
        [{ note_id: 'a', sprint_id: 's', sprint_position: 1 }],
      ),
    ).toEqual([{ note_id: 'a', position: 3, sprint_id: 's', sprint_position: 1 }])
  })
})

describe('ТР-12: ярлык на задаче спринта', () => {
  const active = new Set(['s'])

  it('ставится всем задачам спринта на доске, из любых столбцов', () => {
    const notes = [
      inSprint('a', 1, { urgency: 'critical' }),
      inSprint('b', 2, { urgency: 'not_urgent' }),
      task('x'),
    ]
    expect(addLabelTargets(notes, 'a', 'me', active)).toEqual(['a', 'b'])
  })

  it('архивные задачи спринта не трогаются', () => {
    const notes = [inSprint('a', 1), inSprint('b', 2, { archived_at: '2026-11-02T10:00:00Z' })]
    expect(addLabelTargets(notes, 'a', 'me', active)).toEqual(['a'])
  })

  it('завершённый спринт ярлык не распространяет', () => {
    const notes = [inSprint('a', 1), inSprint('b', 2)]
    expect(addLabelTargets(notes, 'a', 'me', new Set())).toEqual(['a'])
  })

  it('чужая общая задача спринта не получает ярлык', () => {
    const notes = [inSprint('a', 1), inSprint('b', 2, { owner_id: 'other' })]
    expect(addLabelTargets(notes, 'a', 'me', active)).toEqual(['a'])
  })

  it('цепочкой: блок задачи спринта тоже получает ярлык', () => {
    const notes = [
      inSprint('a', 1),
      inSprint('b', 2, { link_group: 'g' }),
      task('c', { link_group: 'g' }),
      task('x'),
    ]
    expect(addLabelTargets(notes, 'a', 'me', active)).toEqual(['a', 'b', 'c'])
  })
})
