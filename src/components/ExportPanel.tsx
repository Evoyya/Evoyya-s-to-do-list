import { useMemo, useState } from 'react'
import { useItemsByNote } from '../hooks/useChecklist'
import { useLabelsFor } from '../hooks/useLabels'
import {
  archiveToMarkdown,
  atInPeriod,
  defaultPeriod,
  exportFileName,
  inPeriod,
  type Period,
} from '../lib/archiveStats'
import type { CompletedItem } from '../lib/completedItems'
import { linkedTitles, onBoard } from '../lib/links'
import type { Note } from '../lib/notes'
import { useCompletedByName } from './CompletedItemsList'
import { PeriodPicker } from './PeriodPicker'
import { useToast } from './Toast'

// ТР-10: выгрузка архива за период в Markdown — например, чтобы обсудить с нейросетью.
// Файл собирается прямо в браузере, сервер не нужен.
export function ExportPanel({
  archived,
  board,
  completed,
  onClose,
}: {
  archived: Note[]
  // Задачи доски: в выгрузке видно, с какими ещё не выполненными задачами связана архивная
  board: Note[]
  // Выполненные пункты постоянных заметок — тоже попадают в выгрузку
  completed: CompletedItem[]
  onClose: () => void
}) {
  const nameOf = useCompletedByName()
  const itemsByNote = useItemsByNote()
  const labelsFor = useLabelsFor()
  const showToast = useToast()
  const [period, setPeriod] = useState<Period>(defaultPeriod)

  const notes = useMemo(() => archived.filter((n) => inPeriod(n, period)), [archived, period])
  const items = useMemo(
    () => completed.filter((i) => atInPeriod(i.completed_at, period)),
    [completed, period],
  )
  const nothing = notes.length === 0 && items.length === 0
  const linkedOf = (note: Note) => {
    const active = onBoard(board)
    return [
      ...linkedTitles(note, archived).map((title) => `«${title}»`),
      ...linkedTitles(note, active).map((title) => `«${title}» (ещё на доске)`),
    ]
  }
  const markdown = () =>
    archiveToMarkdown(notes, period, itemsByNote, labelsFor, items, nameOf, linkedOf)
  const file = () =>
    new File([markdown()], exportFileName(period), { type: 'text/markdown;charset=utf-8' })

  // Меню «Поделиться» есть на iPhone и в части браузеров на ПК
  const canShare =
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([''], 'x.md', { type: 'text/markdown' })] })

  const download = () => {
    const url = URL.createObjectURL(file())
    const a = document.createElement('a')
    a.href = url
    a.download = exportFileName(period)
    a.click()
    URL.revokeObjectURL(url)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown())
      showToast('Текст архива скопирован')
    } catch {
      showToast('Не удалось скопировать — попробуйте «Скачать .md»')
    }
  }

  const share = async () => {
    try {
      await navigator.share({ files: [file()], title: 'Архив заметок' })
    } catch {
      // Пользователь закрыл меню — ничего не делаем
    }
  }

  const button =
    'rounded-full bg-accent/20 px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-40'

  return (
    <section
      aria-label="Выгрузка архива"
      className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface-raised p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Выгрузить архив</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть выгрузку"
          className="rounded-full px-2 py-1 text-text-muted hover:bg-surface hover:text-text"
        >
          ✕
        </button>
      </div>
      <PeriodPicker value={period} onChange={setPeriod} />
      <p className="text-sm text-text-muted">
        Заметок за период: {notes.length}
        {items.length > 0 && `, выполненных пунктов из постоянных заметок: ${items.length}`}. В
        файле — название, описание, пункты списка, ярлыки, срочность и даты.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={download} disabled={nothing} className={button}>
          Скачать .md
        </button>
        <button type="button" onClick={() => void copy()} disabled={nothing} className={button}>
          Скопировать
        </button>
        {canShare && (
          <button type="button" onClick={() => void share()} disabled={nothing} className={button}>
            Поделиться
          </button>
        )}
      </div>
    </section>
  )
}
