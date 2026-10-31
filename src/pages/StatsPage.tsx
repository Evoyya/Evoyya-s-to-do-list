import { useMemo, useState, type ReactNode } from 'react'
import { ColorDot } from '../components/ColorPicker'
import { PeriodPicker } from '../components/PeriodPicker'
import { useLabelsFor } from '../hooks/useLabels'
import { useMembersByNote } from '../hooks/useMembers'
import { useArchivedNotes } from '../hooks/useNotes'
import {
  computeStats,
  defaultPeriod,
  formatDuration,
  inPeriod,
  periodLabel,
  type Period,
} from '../lib/archiveStats'

type Scope = 'all' | 'mine' | 'shared'

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'mine', label: 'Мои' },
  { value: 'shared', label: 'Общие' },
]

// ТР-10: что и сколько отправлено в архив за период
export function StatsPage() {
  const { data: archived = [], isPending, error } = useArchivedNotes()
  const labelsFor = useLabelsFor()
  const membersByNote = useMembersByNote()
  const [period, setPeriod] = useState<Period>(defaultPeriod)
  const [scope, setScope] = useState<Scope>('all')

  const notes = useMemo(
    () =>
      archived.filter((note) => {
        if (!inPeriod(note, period)) return false
        if (scope === 'all') return true
        const shared = (membersByNote.get(note.id)?.length ?? 1) > 1
        return scope === 'shared' ? shared : !shared
      }),
    [archived, period, scope, membersByNote],
  )
  const stats = useMemo(() => computeStats(notes, labelsFor), [notes, labelsFor])
  const maxLabel = Math.max(1, ...stats.byLabel.map((r) => r.count))
  const maxUrgency = Math.max(1, ...stats.byUrgency.map((r) => r.count))
  const maxWeek = Math.max(1, ...stats.byWeek.map((r) => r.count))
  const temporaryCount = stats.total - stats.permanent

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-xs font-medium tracking-wider text-text-muted uppercase">
          Статистика архива
        </h1>
        <PeriodPicker value={period} onChange={setPeriod} />
        <div role="radiogroup" aria-label="Какие заметки" className="flex gap-1">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={scope === s.value}
              onClick={() => setScope(s.value)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                scope === s.value
                  ? 'border-accent/60 bg-accent/20 text-accent'
                  : 'border-border/60 text-text-muted hover:border-border hover:text-text'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400">Не удалось загрузить архив: {error.message}</p>}
      {isPending && <p className="text-text-muted">Загрузка…</p>}

      {!isPending && !error && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile value={String(stats.total)} label={`в архиве ${periodLabel(period)}`} />
            <Tile
              value={stats.avgMs === null ? '—' : formatDuration(stats.avgMs)}
              label="в среднем от создания до архива"
            />
            <Tile value={`${temporaryCount} / ${stats.permanent}`} label="временных / постоянных" />
          </div>

          {stats.total === 0 ? (
            <p className="text-sm text-text-muted">За этот период в архиве ничего нет.</p>
          ) : (
            <>
              <Card
                title="По ярлыкам"
                note="Заметка с несколькими ярлыками учитывается в каждом, поэтому сумма может быть больше общего числа."
              >
                {stats.byLabel.map(({ label, count }) => (
                  <Bar
                    key={label?.id ?? 'none'}
                    name={label?.name ?? 'Без ярлыка'}
                    color={label?.color ?? '#5f6368'}
                    count={count}
                    max={maxLabel}
                  />
                ))}
              </Card>

              <Card
                title="По срочности"
                note={`Только временные задачи (${temporaryCount}), срочность — на момент архивации. Справа — среднее время до архива.`}
              >
                {stats.byUrgency.map((row) => (
                  <Bar
                    key={row.urgency}
                    name={row.label}
                    color={row.color}
                    count={row.count}
                    max={maxUrgency}
                    extra={row.avgMs === null ? undefined : formatDuration(row.avgMs)}
                  />
                ))}
              </Card>

              <Card title="Закрыто по неделям">
                <div className="flex h-32 items-end gap-1.5" role="list">
                  {stats.byWeek.map(({ start, count }) => (
                    <div
                      key={start.getTime()}
                      role="listitem"
                      title={`Неделя с ${start.toLocaleDateString('ru', { day: 'numeric', month: 'short' })}: ${count}`}
                      className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                    >
                      <span className="text-xs text-text-muted">{count || ''}</span>
                      <div
                        className="w-full rounded-t bg-accent/60"
                        style={{ height: `${(count / maxWeek) * 100}%`, minHeight: count ? 4 : 1 }}
                      />
                      <span className="text-[10px] whitespace-nowrap text-text-muted">
                        {start.toLocaleDateString('ru', { day: 'numeric', month: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-surface-raised p-3">
      <span className="text-2xl font-medium">{value}</span>
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  )
}

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 rounded-lg border border-border/60 p-4"
    >
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
      {note && <p className="text-xs text-text-muted">{note}</p>}
    </section>
  )
}

function Bar({
  name,
  color,
  count,
  max,
  extra,
}: {
  name: string
  color: string
  count: number
  max: number
  extra?: string
}) {
  return (
    <div className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,11rem)_1fr_auto]">
      <span className="flex min-w-0 items-center gap-2">
        <ColorDot color={color} className="size-2.5" />
        <span className="truncate">{name}</span>
      </span>
      <div className="h-3 overflow-hidden rounded-full bg-surface-raised">
        <div
          className="h-full rounded-full"
          style={{ width: `${(count / max) * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-24 text-right whitespace-nowrap tabular-nums">
        {count}
        {extra && <span className="block text-xs text-text-muted">{extra}</span>}
      </span>
    </div>
  )
}
