import { describe, expect, it } from 'vitest'
import {
  cleanDraft,
  draftError,
  groupByMonth,
  heartColor,
  heartSize,
  JAR_INSIDE,
  layoutHearts,
  memoriesCount,
  pickRandom,
  selectVisible,
  shortDate,
  type JarMember,
  type Memory,
} from './memoryJar'

const memory = (n: number, patch: Partial<Memory> = {}): Memory => ({
  id: `m${String(n).padStart(3, '0')}`,
  jar_id: 'jar',
  author_id: 'a',
  title: null,
  body: `Воспоминание ${n}`,
  memory_date: `2026-01-${String((n % 28) + 1).padStart(2, '0')}`,
  created_at: `2026-02-01T10:00:${String(n % 60).padStart(2, '0')}Z`,
  updated_at: '2026-02-01T10:00:00Z',
  ...patch,
})

const many = (count: number) => Array.from({ length: count }, (_, i) => memory(i))
const never = () => false

describe('selectVisible: 30 сердечек в банке', () => {
  it('если воспоминаний не больше 30 — видны все, старые внизу', () => {
    const list = [
      memory(1, { memory_date: '2026-05-01' }),
      memory(2, { memory_date: '2025-01-01' }),
    ]
    expect(selectVisible(list, 'jar:2026-11-06', never).map((m) => m.id)).toEqual(['m002', 'm001'])
  })

  it('из 40 выбирает 30, одинаково для того же дня при любом порядке', () => {
    const list = many(40)
    const a = selectVisible(list, 'jar:2026-11-06', never)
    const b = selectVisible([...list].reverse(), 'jar:2026-11-06', never)
    expect(a).toHaveLength(30)
    expect(b.map((m) => m.id)).toEqual(a.map((m) => m.id))
  })

  it('на следующий день набор другой', () => {
    const list = many(60)
    const today = selectVisible(list, 'jar:2026-11-06', never).map((m) => m.id)
    const tomorrow = selectVisible(list, 'jar:2026-11-07', never).map((m) => m.id)
    expect(tomorrow).not.toEqual(today)
  })

  it('добавленные сегодня всегда в банке', () => {
    const list = many(100)
    const fresh = new Set(['m097', 'm098', 'm099'])
    for (const day of ['2026-11-06', '2026-11-07', '2026-11-08']) {
      const ids = selectVisible(list, `jar:${day}`, (m) => fresh.has(m.id)).map((m) => m.id)
      expect(ids).toHaveLength(30)
      for (const id of fresh) expect(ids).toContain(id)
    }
  })
})

describe('pickRandom: «Встряхнуть»', () => {
  it('в пустой банке ничего', () => {
    expect(pickRandom([], null)).toBeNull()
  })

  it('то же воспоминание не выпадает два раза подряд', () => {
    const list = many(3)
    for (let i = 0; i < 20; i++) {
      expect(pickRandom(list, 'm001', () => i / 20)?.id).not.toBe('m001')
    }
  })

  it('единственное воспоминание выпадает всегда', () => {
    expect(pickRandom([memory(1)], 'm001')?.id).toBe('m001')
  })
})

describe('layoutHearts: куча в банке', () => {
  it('одно сердечко — крупное, внизу по центру', () => {
    const [place] = layoutHearts(['m1'])
    expect(place.size).toBe(64)
    expect(Math.abs(place.x - (JAR_INSIDE.left + JAR_INSIDE.right) / 2)).toBeLessThan(10)
    expect(place.y).toBeGreaterThan(330)
  })

  it('чем больше сердечек, тем они мельче', () => {
    expect(heartSize(30)).toBeLessThan(heartSize(20))
    expect(heartSize(20)).toBeLessThanOrEqual(heartSize(2))
  })

  it('30 сердечек помещаются внутри банки', () => {
    const ids = many(30).map((m) => m.id)
    const places = layoutHearts(ids)
    expect(places).toHaveLength(30)
    for (const p of places) {
      const half = (0.84 * p.size) / 2
      expect(p.x - half).toBeGreaterThan(JAR_INSIDE.left - 0.1 * p.size)
      expect(p.x + half).toBeLessThan(JAR_INSIDE.right + 0.1 * p.size)
      expect(p.y + 0.39 * p.size).toBeLessThan(JAR_INSIDE.bottom + 0.06 * p.size)
      expect(p.y - 0.39 * p.size).toBeGreaterThan(JAR_INSIDE.top - 0.06 * p.size)
    }
  })

  it('место сердечка не меняется при повторной раскладке', () => {
    const ids = many(12).map((m) => m.id)
    expect(layoutHearts(ids)).toEqual(layoutHearts(ids))
  })
})

describe('подписи и цвета', () => {
  it('дата на сердечке — ДД.ММ', () => {
    expect(shortDate('2026-11-06')).toBe('06.11')
  })

  it('сердечки владельца и второго участника разного цвета', () => {
    const members: JarMember[] = [
      { jar_id: 'jar', user_id: 'a', role: 'owner', profile: null },
      { jar_id: 'jar', user_id: 'b', role: 'editor', profile: null },
    ]
    expect(heartColor('a', members)).not.toBe(heartColor('b', members))
  })

  it('счётчик склоняется', () => {
    expect(memoriesCount(1)).toBe('1 воспоминание')
    expect(memoriesCount(3)).toBe('3 воспоминания')
    expect(memoriesCount(11)).toBe('11 воспоминаний')
    expect(memoriesCount(25)).toBe('25 воспоминаний')
  })
})

describe('форма и список под крышкой', () => {
  const draft = { title: '', body: 'Гуляли до ночи', memory_date: '2026-11-06' }

  it('без текста и с будущей датой сохранить нельзя', () => {
    expect(draftError(draft, '2026-11-06')).toBeNull()
    expect(draftError({ ...draft, body: '   ' }, '2026-11-06')).not.toBeNull()
    expect(draftError({ ...draft, memory_date: '2026-11-07' }, '2026-11-06')).not.toBeNull()
    expect(draftError({ ...draft, body: 'а'.repeat(281) }, '2026-11-06')).not.toBeNull()
  })

  it('пустое название не хранится, пробелы обрезаются', () => {
    expect(cleanDraft({ ...draft, title: '  ', body: ' Снег ' })).toEqual({
      title: null,
      body: 'Снег',
      memory_date: '2026-11-06',
    })
  })

  it('список — новые сверху, по месяцам', () => {
    const groups = groupByMonth([
      memory(1, { memory_date: '2026-10-03' }),
      memory(2, { memory_date: '2026-11-05' }),
      memory(3, { memory_date: '2026-10-20' }),
    ])
    expect(groups.map((g) => g.month)).toEqual(['2026-11', '2026-10'])
    expect(groups[0].label).toBe('Ноябрь 2026')
    expect(groups[1].items.map((m) => m.id)).toEqual(['m003', 'm001'])
  })
})
