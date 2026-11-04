import { describe, expect, it } from 'vitest'
import { archiveToMarkdown, computeLinkStats } from './archiveStats'
import {
  applyPlaces,
  columnOrder,
  labelTargets,
  missingLabelRows,
  planDrop,
  planLink,
  planMoveBlock,
  planRestore,
  planUnlink,
  toUnits,
  type Columns,
} from './links'
import type { Note, Place } from './notes'

const task = (id: string, position: number, patch: Partial<Note> = {}): Note => ({
  id,
  owner_id: 'me',
  title: id.toUpperCase(),
  description: null,
  due_date: null,
  kind: 'temporary',
  urgency: 'urgent',
  position,
  primary_label_id: null,
  archived_at: null,
  link_group: null,
  sprint_id: null,
  sprint_position: null,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
  ...patch,
})

const columnsOf = (notes: Note[]): Columns => ({
  critical: columnOrder(notes, 'critical'),
  urgent: columnOrder(notes, 'urgent'),
  not_urgent: columnOrder(notes, 'not_urgent'),
  no_deadline: columnOrder(notes, 'no_deadline'),
})

// Порядок по позициям в базе — должен совпадать с тем, что на экране
const byStoredPosition = (notes: Note[], urgency: Note['urgency']) =>
  notes
    .filter((n) => n.urgency === urgency && !n.archived_at)
    .sort((p, q) => p.position - q.position)
    .map((n) => n.id)

const apply = (notes: Note[], places: Place[]) => applyPlaces(notes, places)

describe('ТР-11: раскладка блоков', () => {
  it('задачи блока стоят подряд на месте первой, даже если в базе их перемешали', () => {
    const notes = [
      task('a', 1, { link_group: 'g' }),
      task('x', 2),
      task('b', 3, { link_group: 'g' }),
    ]
    expect(columnOrder(notes, 'urgent')).toEqual(['a', 'b', 'x'])
    expect(toUnits(notes)).toEqual([
      { group: 'g', ids: ['a', 'b'] },
      { group: null, ids: ['x'] },
    ])
  })

  it('одна задача с блоком — не блок, рамки нет', () => {
    expect(toUnits([task('a', 1, { link_group: 'g' })])).toEqual([{ group: null, ids: ['a'] }])
  })

  it('архивные задачи не на доске', () => {
    const notes = [task('a', 1), task('b', 2, { archived_at: '2026-11-02T10:00:00Z' })]
    expect(columnOrder(notes, 'urgent')).toEqual(['a'])
  })
})

describe('ТР-11: связывание', () => {
  it('задачи собираются на месте верхней, остальные сохраняют порядок', () => {
    const notes = [task('a', 1), task('x', 2), task('b', 3), task('y', 4)]
    const result = apply(
      notes,
      planLink(notes, 'b', ['a'], 'urgent', () => 'g'),
    )
    expect(columnOrder(result, 'urgent')).toEqual(['a', 'b', 'x', 'y'])
    expect(byStoredPosition(result, 'urgent')).toEqual(['a', 'b', 'x', 'y'])
    expect(result.filter((n) => n.link_group === 'g').map((n) => n.id)).toEqual(['a', 'b'])
  })

  it('выбранная задача из блока приводит с собой весь блок', () => {
    const notes = [
      task('a', 1, { link_group: 'g1' }),
      task('b', 2, { link_group: 'g1' }),
      task('x', 3),
      task('c', 4),
    ]
    const result = apply(
      notes,
      planLink(notes, 'c', ['b'], 'urgent', () => 'new'),
    )
    expect(result.filter((n) => n.link_group === 'g1').map((n) => n.id)).toEqual(['a', 'b', 'c'])
    expect(columnOrder(result, 'urgent')).toEqual(['a', 'b', 'c', 'x'])
  })

  it('новая задача встаёт в конец блока, а не наверх столбца', () => {
    const notes = [task('x', 1), task('a', 2), task('new', 0)]
    const result = apply(
      notes,
      planLink(notes, 'new', ['a'], 'urgent', () => 'g', true),
    )
    expect(columnOrder(result, 'urgent')).toEqual(['x', 'a', 'new'])
    expect(byStoredPosition(result, 'urgent')).toEqual(['x', 'a', 'new'])
  })

  it('отвязанная задача встаёт сразу под блоком', () => {
    const notes = [
      task('a', 1, { link_group: 'g' }),
      task('b', 2, { link_group: 'g' }),
      task('c', 3, { link_group: 'g' }),
      task('x', 4),
    ]
    const result = apply(notes, planUnlink(notes, 'a'))
    expect(columnOrder(result, 'urgent')).toEqual(['b', 'c', 'a', 'x'])
    expect(result.find((n) => n.id === 'a')!.link_group).toBeNull()
  })
})

describe('ТР-11: перенос', () => {
  const block = () => [
    task('a', 1, { link_group: 'g' }),
    task('b', 2, { link_group: 'g' }),
    task('x', 3),
    task('y', 4),
  ]

  it('в другой столбец переезжает весь блок', () => {
    const notes = block()
    const columns = columnsOf(notes)
    // Карточку b перетащили в «Критично»
    columns.urgent = columns.urgent.filter((id) => id !== 'b')
    columns.critical = ['b']
    const plan = planDrop(notes, columns, 'b')!
    const result = apply(notes, plan.places)
    expect(columnOrder(result, 'critical')).toEqual(['a', 'b'])
    expect(columnOrder(result, 'urgent')).toEqual(['x', 'y'])
    expect(plan.columns.critical).toEqual(['a', 'b'])
    expect(plan.columns.urgent).toEqual(['x', 'y'])
  })

  it('внутри блока меняется только порядок', () => {
    const notes = block()
    const columns = columnsOf(notes)
    columns.urgent = ['b', 'a', 'x', 'y']
    const result = apply(notes, planDrop(notes, columns, 'b')!.places)
    expect(columnOrder(result, 'urgent')).toEqual(['b', 'a', 'x', 'y'])
    expect(result.find((n) => n.id === 'b')!.link_group).toBe('g')
  })

  it('за пределы блока в том же столбце — едет весь блок', () => {
    const notes = block()
    const columns = columnsOf(notes)
    columns.urgent = ['b', 'x', 'y', 'a']
    const result = apply(notes, planDrop(notes, columns, 'a')!.places)
    expect(columnOrder(result, 'urgent')).toEqual(['x', 'y', 'a', 'b'])
    expect(byStoredPosition(result, 'urgent')).toEqual(['x', 'y', 'a', 'b'])
  })

  it('чужая задача не встаёт в середину блока — только перед ним', () => {
    const notes = block()
    const columns = columnsOf(notes)
    columns.urgent = ['a', 'y', 'b', 'x']
    const result = apply(notes, planDrop(notes, columns, 'y')!.places)
    expect(columnOrder(result, 'urgent')).toEqual(['y', 'a', 'b', 'x'])
  })

  it('отпустили на том же месте — ничего не меняется', () => {
    const notes = block()
    expect(planDrop(notes, columnsOf(notes), 'a')).toBeNull()
  })

  it('смена столбца в окне задачи переносит остальной блок', () => {
    expect(planMoveBlock(block(), 'a', 'critical')).toEqual([{ note_id: 'b', urgency: 'critical' }])
    expect(planMoveBlock(block(), 'x', 'critical')).toEqual([])
  })
})

describe('ТР-11: архив, статистика, выгрузка', () => {
  it('восстановленная задача возвращается в конец своего блока и в его столбец', () => {
    const board = [
      task('a', 1, { link_group: 'g', urgency: 'critical' }),
      task('b', 2, { link_group: 'g', urgency: 'critical' }),
      task('x', 3, { urgency: 'critical' }),
    ]
    const archived = task('c', 0, { link_group: 'g', archived_at: '2026-11-03T10:00:00Z' })
    const { patch, others } = planRestore(board, archived)
    expect(patch.urgency).toBe('critical')
    const result = apply([...board, { ...archived, ...patch, archived_at: null }], others)
    expect(columnOrder(result, 'critical')).toEqual(['a', 'b', 'c', 'x'])
  })

  it('если блока на доске нет — задача восстанавливается как обычно', () => {
    const archived = task('c', 5, { link_group: 'g', archived_at: '2026-11-03T10:00:00Z' })
    expect(planRestore([task('x', 1)], archived)).toEqual({ patch: {}, others: [] })
  })

  it('задачи блока считаются отдельно, блок закрыт, когда все его задачи в архиве', () => {
    const archived = [
      task('a', 1, { link_group: 'g', archived_at: '2026-11-02T10:00:00Z' }),
      task('b', 2, { link_group: 'g', archived_at: '2026-11-03T10:00:00Z' }),
      task('c', 3, { link_group: 'h', archived_at: '2026-11-03T10:00:00Z' }),
      task('s', 4, { archived_at: '2026-11-03T10:00:00Z' }),
    ]
    const board = [task('d', 5, { link_group: 'h' })]
    const stats = computeLinkStats(archived, archived, board)
    expect(stats.linked).toBe(3)
    expect(stats.single).toBe(1)
    expect(stats.closedBlocks).toBe(1)
    expect(stats.avgBlockSize).toBe(2)
    // От создания a (1 ноября 10:00) до архива b (3 ноября 10:00)
    expect(stats.avgBlockMs).toBe(2 * 24 * 60 * 60 * 1000)
  })

  it('выгрузка: у связанной задачи указано, с чем она связана', () => {
    const md = archiveToMarkdown(
      [task('a', 1, { archived_at: '2026-11-02T10:00:00Z' })],
      { preset: 'all', from: '', to: '' },
      new Map(),
      () => ({ labels: [], missing: [] }),
      [],
      () => null,
      () => ['«B»', '«C» (ещё на доске)'],
    )
    expect(md).toContain('Связанные задачи: «B», «C» (ещё на доске)')
  })
})

describe('ТР-11: ярлыки блока', () => {
  it('ярлык меняется у всех своих задач блока, чужие общие не трогаются', () => {
    const notes = [
      task('a', 1, { link_group: 'g' }),
      task('b', 2, { link_group: 'g' }),
      task('shared', 3, { link_group: 'g', owner_id: 'partner' }),
      task('x', 4),
    ]
    expect(labelTargets(notes, 'a', 'me')).toEqual(['a', 'b'])
    expect(labelTargets(notes, 'x', 'me')).toEqual(['x'])
  })

  it('ставит ярлык только тем задачам, у которых его ещё нет', () => {
    const rows = [{ note_id: 'a', label_id: 'l1' }]
    expect(missingLabelRows(['a', 'b'], ['l1', 'l2'], rows)).toEqual([
      { note_id: 'a', label_id: 'l2' },
      { note_id: 'b', label_id: 'l1' },
      { note_id: 'b', label_id: 'l2' },
    ])
  })
})
