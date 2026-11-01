import { describe, expect, it } from 'vitest'
import type { LabelView } from '../hooks/useLabels'
import {
  archiveToMarkdown,
  computeStats,
  formatDuration,
  inPeriod,
  type Period,
} from './archiveStats'
import { makeItem, positionBetween } from './checklist'
import { normalizeHex, readableText } from './color'
import { freeColor, labelProblem, orderLabels, PALETTE, type Label } from './labels'
import type { Note } from './notes'

const label = (id: string, name: string, color: string): Label => ({
  id,
  name,
  color,
  owner_id: 'me',
  created_at: '2026-11-01T00:00:00Z',
})

const note = (patch: Partial<Note>): Note => ({
  id: 'n1',
  owner_id: 'me',
  title: 'Заметка',
  description: null,
  due_date: null,
  kind: 'temporary',
  urgency: 'no_deadline',
  position: 0,
  primary_label_id: null,
  archived_at: null,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
  ...patch,
})

describe('positionBetween — порядок карточек и пунктов', () => {
  it('ставит между соседями, в начало и в конец', () => {
    expect(positionBetween(1, 3)).toBe(2)
    expect(positionBetween(undefined, 5)).toBe(4)
    expect(positionBetween(5, undefined)).toBe(6)
    expect(positionBetween(undefined, undefined)).toBe(0)
  })
})

describe('цвета', () => {
  it('ТР-5: на тёмном фоне светлый текст, на ярком — тёмный', () => {
    expect(readableText('#202124').text).toBe('#e8eaed')
    expect(readableText('#e7ba51').text).toBe('#202124')
  })

  it('приводит код цвета к виду, который принимает база', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('#FBBC04')).toBe('#fbbc04')
  })
})

describe('ярлыки', () => {
  const labels = [label('1', 'ДЗ', PALETTE[0]), label('2', 'Ученики', PALETTE[1])]

  it('ТР-6: название уникально без учёта регистра и пробелов', () => {
    expect(labelProblem(labels, ' дз ', PALETTE[5])).toBe('Ярлык с таким названием уже есть')
    expect(labelProblem(labels, 'ДЗ', PALETTE[0], '1')).toBeNull()
  })

  it('ТР-6: цвет одного ярлыка нельзя взять для другого', () => {
    expect(labelProblem(labels, 'Новый', PALETTE[1])).toBe('Цвет уже у ярлыка «Ученики»')
    expect(labelProblem(labels, '   ', PALETTE[5])).toBe('Введите название')
  })

  it('новому ярлыку достаётся первый свободный цвет палитры', () => {
    expect(freeColor(labels)).toBe(PALETTE[2])
  })

  it('ТР-5: основной ярлык идёт первым, по нему красится карточка', () => {
    const ordered = orderLabels(note({ primary_label_id: '2' }), labels)
    expect(ordered.map((l) => l.name)).toEqual(['Ученики', 'ДЗ'])
  })
})

describe('ТР-10: статистика архива', () => {
  const dz = label('1', 'ДЗ', PALETTE[0])
  const pupils = label('2', 'Ученики', PALETTE[1])
  const labelsOf: Record<string, Label[]> = { a: [dz, pupils], b: [dz], c: [] }
  const labelsFor = (n: Note): LabelView => ({ labels: labelsOf[n.id] ?? [], missing: [] })

  const archived = [
    note({
      id: 'a',
      urgency: 'critical',
      due_date: '2026-11-05',
      archived_at: '2026-11-01T12:00:00Z',
    }),
    note({ id: 'b', urgency: 'critical', archived_at: '2026-11-03T10:00:00Z' }),
    note({ id: 'c', kind: 'permanent', archived_at: '2026-11-01T11:00:00Z' }),
  ]

  it('заметка с двумя ярлыками считается в обоих, без ярлыка — отдельно', () => {
    const stats = computeStats(archived, labelsFor)
    expect(stats.total).toBe(3)
    expect(stats.byLabel.map((r) => [r.label?.name ?? 'Без ярлыка', r.count])).toEqual([
      ['ДЗ', 2],
      ['Ученики', 1],
      ['Без ярлыка', 1],
    ])
  })

  it('срочность — только у временных задач, со средним временем до архива', () => {
    const stats = computeStats(archived, labelsFor)
    const critical = stats.byUrgency.find((r) => r.urgency === 'critical')!
    expect(critical.count).toBe(2)
    expect(stats.permanent).toBe(1)
    // 2 ч и 48 ч → в среднем 25 ч
    expect(critical.avgMs).toBe(25 * 60 * 60 * 1000)
  })

  it('свой период включает оба крайних дня целиком', () => {
    const period: Period = { preset: 'custom', from: '2026-11-03', to: '2026-11-03' }
    expect(archived.filter((n) => inPeriod(n, period)).map((n) => n.id)).toEqual(['b'])
  })

  it('время до архива — понятными словами', () => {
    expect(formatDuration(30 * 60 * 1000)).toBe('меньше часа')
    expect(formatDuration(5 * 60 * 60 * 1000)).toBe('5 ч')
    expect(formatDuration(36 * 60 * 60 * 1000)).toBe('1,5 дн')
    expect(formatDuration(48 * 60 * 60 * 1000)).toBe('2 дн')
  })

  it('выгрузка в Markdown: ярлыки, срочность, пункты с отметками', () => {
    const items = new Map([['a', [makeItem('a', 'сделано', 0), makeItem('a', 'не сделано', 1)]]])
    items.get('a')![0].is_done = true
    const all: Period = { preset: 'all', from: '', to: '' }
    const md = archiveToMarkdown([archived[0]], all, items, labelsFor)
    expect(md).toContain('# Архив заметок за всё время')
    expect(md).toContain('Ярлыки: ДЗ, Ученики · Срочность: Критично · Дедлайн: 05.11.2026')
    // Невыполненные пункты — первыми, как в самой заметке
    expect(md.indexOf('- [ ] не сделано')).toBeLessThan(md.indexOf('- [x] сделано'))
  })
})
