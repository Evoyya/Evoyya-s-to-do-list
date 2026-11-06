import type { Tables } from './database.types'
import type { Profile } from './members'
import { supabase } from './supabase'

// ТР-13: банка воспоминаний. Отдельный раздел, с задачами не связан.

export const JAR_KEY = ['memory-jar'] as const

export type Memory = Tables<'memories'>
export type JarMember = Pick<Tables<'memory_jar_members'>, 'jar_id' | 'user_id' | 'role'> & {
  profile: Profile | null
}
export type Jar = { id: string; members: JarMember[]; memories: Memory[] }

// В банке рисуется не больше стольких сердечек (ТР-13)
export const VISIBLE_LIMIT = 30

// Банка пользователя (при первом заходе создаётся), её участники и воспоминания
export async function fetchJar(): Promise<Jar> {
  const { data: id, error } = await supabase.rpc('ensure_my_jar')
  if (error) throw error
  const [members, memories] = await Promise.all([
    supabase
      .from('memory_jar_members')
      .select('jar_id, user_id, role, profile:profiles(id, email, display_name, avatar_url)')
      .eq('jar_id', id)
      .order('created_at'),
    supabase.from('memories').select('*').eq('jar_id', id).order('memory_date').order('created_at'),
  ])
  if (members.error) throw members.error
  if (memories.error) throw memories.error
  return { id, members: members.data, memories: memories.data }
}

export type MemoryDraft = Pick<Memory, 'title' | 'body' | 'memory_date'>
export type NewMemory = MemoryDraft & Pick<Memory, 'id' | 'jar_id'>

// Автор ставится в базе сам (auth.uid()); id создаётся заранее для мгновенного показа
export async function insertMemory(memory: NewMemory) {
  const { error } = await supabase.from('memories').insert(memory)
  if (error) throw error
}

export async function updateMemory(id: string, patch: MemoryDraft) {
  const { error } = await supabase.from('memories').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteMemory(id: string) {
  const { error } = await supabase.from('memories').delete().eq('id', id)
  if (error) throw error
}

// Ошибки из share_jar написаны для человека — показываем как есть
export async function shareJar(email: string) {
  const { error } = await supabase.rpc('share_jar', { p_email: email })
  if (error) throw new Error(error.message)
}

// Владелец закрывает доступ второму участнику, или участник выходит сам
export async function removeJarMember(jarId: string, userId: string) {
  const { error } = await supabase
    .from('memory_jar_members')
    .delete()
    .eq('jar_id', jarId)
    .eq('user_id', userId)
  if (error) throw error
}

export const jarMemberName = (m: JarMember) =>
  m.profile?.display_name || m.profile?.email || 'Участник'

// Пустое название не хранится: в базе это null
export function cleanDraft(draft: MemoryDraft): MemoryDraft {
  const title = draft.title?.trim() ?? ''
  return { title: title || null, body: draft.body.trim(), memory_date: draft.memory_date }
}

export const TITLE_MAX = 40
export const BODY_MAX = 280

// Почему воспоминание нельзя сохранить (или null, если можно)
export function draftError(draft: MemoryDraft, today: string): string | null {
  if (!draft.body.trim()) return 'Напишите, что случилось'
  if (draft.body.length > BODY_MAX) return `Текст длиннее ${BODY_MAX} символов`
  if ((draft.title?.trim().length ?? 0) > TITLE_MAX) return `Название длиннее ${TITLE_MAX} символов`
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.memory_date)) return 'Укажите дату'
  if (draft.memory_date > today) return 'Дата не может быть в будущем'
  return null
}

// Список под крышкой: новые сверху, по месяцам («Ноябрь 2026»)
export function groupByMonth(memories: Memory[]) {
  const sorted = [...memories].sort(
    (a, b) =>
      b.memory_date.localeCompare(a.memory_date) || b.created_at.localeCompare(a.created_at),
  )
  const groups: { month: string; label: string; items: Memory[] }[] = []
  for (const m of sorted) {
    const month = m.memory_date.slice(0, 7)
    let group = groups.at(-1)
    if (group?.month !== month) {
      const label = new Date(`${month}-01T00:00:00`).toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
      })
      group = {
        month,
        label: label.charAt(0).toUpperCase() + label.slice(1).replace(' г.', ''),
        items: [],
      }
      groups.push(group)
    }
    group.items.push(m)
  }
  return groups
}

// ------------------------------------------------------------
// Случайность с зерном: одинаковый результат на всех устройствах
// ------------------------------------------------------------

// FNV-1a: строка → 32-битное число
export function hashString(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// mulberry32: генератор чисел 0…1 из зерна
export function seededRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Дата по местному времени в виде «2026-11-06»
export function localDateKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ------------------------------------------------------------
// Какие сердечки лежат в банке
// ------------------------------------------------------------

const byDate = (a: Memory, b: Memory) =>
  a.memory_date.localeCompare(b.memory_date) || a.created_at.localeCompare(b.created_at)

// До limit воспоминаний для банки. Набор зависит только от зерна (банка + день),
// поэтому одинаков весь день и на всех устройствах. Добавленные сегодня (isNew)
// попадают всегда, чтобы только что положенное сердечко было видно.
// Порядок результата — по дате воспоминания: старые лежат внизу.
export function selectVisible(
  memories: Memory[],
  seed: string,
  isNew: (m: Memory) => boolean,
  limit = VISIBLE_LIMIT,
): Memory[] {
  if (memories.length <= limit) return [...memories].sort(byDate)
  const fresh = memories
    .filter(isNew)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
  const freshIds = new Set(fresh.map((m) => m.id))
  // Место в случайном порядке у каждого воспоминания своё и не зависит от остальных
  const rest = memories
    .filter((m) => !freshIds.has(m.id))
    .map((m) => ({ m, key: hashString(`${seed}:${m.id}`) }))
    .sort((a, b) => a.key - b.key || a.m.id.localeCompare(b.m.id))
    .slice(0, limit - fresh.length)
    .map(({ m }) => m)
  return [...fresh, ...rest].sort(byDate)
}

// Случайное воспоминание для «Встряхнуть»: то же не выпадает два раза подряд
export function pickRandom<T extends { id: string }>(
  items: T[],
  lastId: string | null,
  random: () => number = Math.random,
): T | null {
  if (items.length === 0) return null
  const pool = items.length > 1 ? items.filter((m) => m.id !== lastId) : items
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

// ------------------------------------------------------------
// Раскладка сердечек «кучей» внутри банки
// ------------------------------------------------------------

// Внутренность банки в координатах рисунка (viewBox 0 0 340 400)
export const JAR_INSIDE = {
  left: 52,
  right: 288,
  bottom: 374,
  // Выше начинаются «плечи» банки — ряды там короче
  shoulder: 172,
  // Верх самого верхнего сердечка
  top: 136,
} as const

// Сердечко в рисунке — квадрат size×size; само сердце занимает ~0.84 ширины и ~0.78 высоты
const HEART_W = 0.84
const HEART_H = 0.78
const STEP_X = HEART_W * 0.88
const STEP_Y = HEART_H * 0.76
const MAX_SIZE = 64
const MIN_SIZE = 28

export type HeartPlace = { x: number; y: number; size: number; rotate: number }

// Ряды снизу вверх: сколько сердечек помещается в каждом и где центр ряда по высоте
function rowsFor(size: number) {
  const width = JAR_INSIDE.right - JAR_INSIDE.left
  const full = Math.floor((width - HEART_W * size) / (STEP_X * size)) + 1
  const rows: { y: number; count: number }[] = []
  for (let r = 0; ; r++) {
    const y = JAR_INSIDE.bottom - (HEART_H / 2) * size - r * STEP_Y * size
    if (y - (HEART_H / 2) * size < JAR_INSIDE.top) break
    // Через ряд — на одно меньше и со сдвигом на полшага, как в настоящей куче
    let count = r % 2 === 0 ? full : full - 1
    if (y < JAR_INSIDE.shoulder) count -= 1
    if (count > 0) rows.push({ y, count })
  }
  return rows
}

// Самый крупный размер, при котором все n сердечек помещаются
export function heartSize(n: number) {
  for (let size = MAX_SIZE; size > MIN_SIZE; size--) {
    if (rowsFor(size).reduce((sum, r) => sum + r.count, 0) >= n) return size
  }
  return MIN_SIZE
}

// Места сердечек: по порядку списка снизу вверх, внутри ряда — по центру.
// Небольшой сдвиг и поворот зависят от id, поэтому сердечко не прыгает при обновлении.
export function layoutHearts(ids: string[]): HeartPlace[] {
  const size = heartSize(ids.length)
  const rows = rowsFor(size)
  const center = (JAR_INSIDE.left + JAR_INSIDE.right) / 2
  const places: HeartPlace[] = []
  let i = 0
  for (const row of rows) {
    if (i >= ids.length) break
    const count = Math.min(row.count, ids.length - i)
    for (let c = 0; c < count; c++, i++) {
      const rand = seededRandom(hashString(ids[i]))
      const x = center + (c - (count - 1) / 2) * STEP_X * size
      places.push({
        x: x + (rand() - 0.5) * 0.14 * size,
        y: row.y + (rand() - 0.5) * 0.1 * size,
        size,
        rotate: (rand() - 0.5) * 46,
      })
    }
  }
  return places
}

// ------------------------------------------------------------
// Подписи и цвета
// ------------------------------------------------------------

// «2026-11-06» → «06.11» (на сердечке)
export const shortDate = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`

// «2026-11-06» → «6 ноября 2026» (в окне воспоминания)
export const longDate = (date: string) =>
  new Date(`${date}T00:00:00`)
    .toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    .replace(' г.', '')

// Два оттенка розового: у владельца банки нежный, у второго участника насыщеннее
export const HEART_COLORS = { owner: '#f7b0c9', partner: '#ef86ac' } as const

export function heartColor(authorId: string | null, members: JarMember[]) {
  const owner = members.find((m) => m.role === 'owner')
  if (!authorId || !owner || authorId === owner.user_id) return HEART_COLORS.owner
  return HEART_COLORS.partner
}

// «В банке 5 воспоминаний»
export function memoriesCount(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  const word =
    mod10 === 1 && mod100 !== 11
      ? 'воспоминание'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'воспоминания'
        : 'воспоминаний'
  return `${n} ${word}`
}
