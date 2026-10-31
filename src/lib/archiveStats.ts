import type { LabelView } from '../hooks/useLabels'
import type { ChecklistItem } from './checklist'
import type { Label } from './labels'
import type { Note } from './notes'
import { URGENCIES, type Urgency } from './urgency'

// ТР-10: статистика и выгрузка считаются по заметкам в архиве за период
// (по дате архивации; у временной задачи — дате в своём архиве)

export type PeriodPreset = 'week' | 'month' | 'all' | 'custom'
export type Period = { preset: PeriodPreset; from: string; to: string } // from/to — «ГГГГ-ММ-ДД»

const DAY = 24 * 60 * 60 * 1000

export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function defaultPeriod(): Period {
  const today = new Date()
  return {
    preset: 'month',
    from: toDateInput(new Date(Date.now() - 30 * DAY)),
    to: toDateInput(today),
  }
}

// Границы периода; null — без границы
export function periodRange(period: Period): { from: Date | null; to: Date | null } {
  if (period.preset === 'all') return { from: null, to: null }
  if (period.preset === 'week') return { from: new Date(Date.now() - 7 * DAY), to: null }
  if (period.preset === 'month') return { from: new Date(Date.now() - 30 * DAY), to: null }
  // Свой период: с начала первого дня до конца последнего, по местному времени
  const from = period.from ? new Date(`${period.from}T00:00:00`) : null
  const to = period.to ? new Date(`${period.to}T23:59:59.999`) : null
  return { from, to }
}

export function inPeriod(note: Note, period: Period) {
  if (!note.archived_at) return false
  const at = new Date(note.archived_at)
  const { from, to } = periodRange(period)
  return (!from || at >= from) && (!to || at <= to)
}

export const periodLabel = (period: Period) =>
  ({
    week: 'за последние 7 дней',
    month: 'за последние 30 дней',
    all: 'за всё время',
    custom: `с ${formatDate(period.from)} по ${formatDate(period.to)}`,
  })[period.preset]

function formatDate(value: string) {
  if (!value) return '…'
  return new Date(`${value}T00:00:00`).toLocaleDateString('ru', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// Время от создания до архива
export const lifetimeMs = (note: Note) =>
  new Date(note.archived_at!).getTime() - new Date(note.created_at).getTime()

// «3 ч», «1,5 дн», «12 дн»
export function formatDuration(ms: number) {
  const hours = ms / (60 * 60 * 1000)
  if (hours < 1) return 'меньше часа'
  if (hours < 24) return `${Math.round(hours)} ч`
  const days = hours / 24
  return `${days < 10 ? days.toFixed(1).replace('.', ',').replace(',0', '') : Math.round(days)} дн`
}

const average = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null

export type ArchiveStats = {
  total: number
  byLabel: { label: Label | null; count: number }[] // null — «Без ярлыка»
  permanent: number
  byUrgency: {
    urgency: Urgency
    label: string
    color: string
    count: number
    avgMs: number | null
  }[]
  avgMs: number | null
  byWeek: { start: Date; count: number }[]
}

// Понедельник недели, в которую попадает дата
function weekStart(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

export function computeStats(notes: Note[], labelsFor: (note: Note) => LabelView): ArchiveStats {
  // По ярлыкам: заметка с несколькими ярлыками считается в каждом
  const labelCounts = new Map<string, { label: Label; count: number }>()
  let unlabeled = 0
  for (const note of notes) {
    const { labels } = labelsFor(note)
    if (labels.length === 0) unlabeled++
    for (const label of labels) {
      const entry = labelCounts.get(label.id) ?? { label, count: 0 }
      entry.count++
      labelCounts.set(label.id, entry)
    }
  }
  const byLabel: ArchiveStats['byLabel'] = [...labelCounts.values()].sort(
    (a, b) => b.count - a.count || a.label.name.localeCompare(b.label.name, 'ru'),
  )
  if (unlabeled > 0) byLabel.push({ label: null, count: unlabeled })

  // По срочности — только временные задачи: у постоянных заметок столбца нет
  const temporary = notes.filter((n) => n.kind === 'temporary')
  const byUrgency = URGENCIES.map((u) => {
    const group = temporary.filter((n) => n.urgency === u.value)
    return {
      urgency: u.value,
      label: u.label,
      color: u.color,
      count: group.length,
      avgMs: average(group.map(lifetimeMs)),
    }
  })

  // По неделям: от недели первой заметки до текущей, не больше 12 последних
  const weekCounts = new Map<number, number>()
  for (const note of notes) {
    const key = weekStart(new Date(note.archived_at!)).getTime()
    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1)
  }
  const byWeek: ArchiveStats['byWeek'] = []
  if (notes.length > 0) {
    const first = Math.min(...weekCounts.keys())
    const current = weekStart(new Date())
    for (
      let d = new Date(current);
      d.getTime() >= first && byWeek.length < 12;
      d.setDate(d.getDate() - 7)
    ) {
      byWeek.unshift({ start: new Date(d), count: weekCounts.get(d.getTime()) ?? 0 })
    }
  }

  return {
    total: notes.length,
    byLabel,
    permanent: notes.length - temporary.length,
    byUrgency,
    avgMs: average(notes.map(lifetimeMs)),
    byWeek,
  }
}

// ---------------------------------------------------------------
// Выгрузка в Markdown — удобно передать нейросети
// ---------------------------------------------------------------

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('ru', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export function archiveToMarkdown(
  notes: Note[],
  period: Period,
  itemsByNote: Map<string, ChecklistItem[]>,
  labelsFor: (note: Note) => LabelView,
) {
  const lines = [
    `# Архив заметок ${periodLabel(period)}`,
    '',
    `Всего заметок: ${notes.length}.`,
    '',
  ]
  // Старые сверху: так легче читать как историю
  const ordered = [...notes].sort((a, b) => a.archived_at!.localeCompare(b.archived_at!))
  for (const note of ordered) {
    const { labels } = labelsFor(note)
    const urgency = URGENCIES.find((u) => u.value === note.urgency)?.label
    const meta = [
      labels.length ? `Ярлыки: ${labels.map((l) => l.name).join(', ')}` : 'Без ярлыка',
      note.kind === 'temporary' ? `Срочность: ${urgency}` : 'Постоянная заметка',
    ]
    lines.push(`## ${note.title}`, '')
    lines.push(meta.join(' · '))
    lines.push(
      `Создана ${dateTime(note.created_at)} → в архиве ${dateTime(note.archived_at!)} (${formatDuration(lifetimeMs(note))})`,
    )
    if (note.description) lines.push('', note.description)
    const items = itemsByNote.get(note.id) ?? []
    if (items.length > 0) {
      lines.push('')
      // Сначала невыполненные, как в самой заметке
      for (const item of [...items].sort((a, b) => Number(a.is_done) - Number(b.is_done))) {
        lines.push(`- [${item.is_done ? 'x' : ' '}] ${item.text}`)
      }
    }
    lines.push('')
  }
  return lines.join('\n')
}

export function exportFileName(period: Period) {
  const { from, to } = periodRange(period)
  const part = (d: Date | null, fallback: string) => (d ? toDateInput(d) : fallback)
  return `архив_${part(from, 'начало')}_${part(to ?? new Date(), 'сегодня')}.md`
}
