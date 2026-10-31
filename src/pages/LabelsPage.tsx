import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { ColorPicker } from '../components/ColorPicker'
import { TrashIcon } from '../components/icons'
import {
  useCreateLabel,
  useDeleteLabel,
  useLabels,
  useMyLabels,
  useNoteLabelRows,
  useUpdateLabel,
} from '../hooks/useLabels'
import { freeColor, labelProblem, makeLabel, type Label } from '../lib/labels'

// ТР-6: свои ярлыки — создать, переименовать, перекрасить, удалить
export function LabelsPage() {
  const { isPending, error } = useLabels()
  const labels = useMyLabels()
  const { data: rows = [] } = useNoteLabelRows()

  const countByLabel = new Map<string, number>()
  for (const row of rows) countByLabel.set(row.label_id, (countByLabel.get(row.label_id) ?? 0) + 1)

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="text-xs font-medium tracking-wider text-text-muted uppercase">Ярлыки</h1>
      <NewLabelForm labels={labels} />

      {error && <p className="text-red-400">Не удалось загрузить ярлыки: {error.message}</p>}
      {isPending && <p className="text-text-muted">Загрузка…</p>}
      {!isPending && !error && labels.length === 0 && (
        <p className="text-sm text-text-muted">
          Ярлыков пока нет. Создайте первый — например, «Яна Англ».
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {labels.map((label) => (
          <LabelRow
            key={label.id}
            label={label}
            labels={labels}
            count={countByLabel.get(label.id) ?? 0}
          />
        ))}
      </ul>
    </div>
  )
}

function NewLabelForm({ labels }: { labels: Label[] }) {
  const { session } = useAuth()
  const createLabel = useCreateLabel()
  const [name, setName] = useState('')
  // null — первый свободный цвет палитры
  const [chosen, setChosen] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const color = chosen ?? freeColor(labels)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const why = labelProblem(labels, name, color)
    if (why) {
      setProblem(why)
      return
    }
    createLabel.mutate(makeLabel(session!.user.id, name, color))
    setName('')
    setChosen(null)
    setPickerOpen(false)
    setProblem(null)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface-raised p-3"
    >
      <div className="flex items-center gap-2">
        <SwatchButton color={color} open={pickerOpen} onClick={() => setPickerOpen(!pickerOpen)} />
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setProblem(null)
          }}
          placeholder="Новый ярлык"
          aria-label="Название нового ярлыка"
          maxLength={50}
          className="min-w-0 flex-1 bg-transparent px-1 py-1 text-base outline-none placeholder:text-text-muted"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-full bg-accent/20 px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-40"
        >
          Создать
        </button>
      </div>
      {problem && <p className="px-1 text-sm text-red-400">{problem}</p>}
      {pickerOpen && (
        <ColorPicker
          value={color}
          onChange={(c) => {
            setChosen(c)
            setProblem(null)
          }}
          others={labels}
        />
      )}
    </form>
  )
}

function LabelRow({ label, labels, count }: { label: Label; labels: Label[]; count: number }) {
  const updateLabel = useUpdateLabel()
  const deleteLabel = useDeleteLabel()
  const [name, setName] = useState(label.name)
  const [color, setColor] = useState(label.color)
  const [pickerOpen, setPickerOpen] = useState(false)

  const others = labels.filter((l) => l.id !== label.id)
  const nameProblem =
    name.trim() === label.name ? null : labelProblem(labels, name, label.color, label.id)
  const colorProblem =
    color === label.color ? null : labelProblem(labels, label.name, color, label.id)

  // Переименование сохраняется по Enter или при уходе из поля; неверное название откатывается
  const commitName = () => {
    if (name.trim() === label.name) return setName(label.name)
    if (nameProblem) return setName(label.name)
    updateLabel.mutate({ id: label.id, patch: { name: name.trim() } })
  }

  const applyColor = () => {
    if (color !== label.color && !colorProblem) {
      updateLabel.mutate({ id: label.id, patch: { color } })
    }
    setPickerOpen(false)
  }

  const remove = () => {
    // Сами заметки остаются, поэтому спрашиваем, только если ярлык где-то висит
    if (
      count > 0 &&
      !window.confirm(`Удалить ярлык «${label.name}»? Он снимется с ${fromNotes(count)}.`)
    ) {
      return
    }
    deleteLabel.mutate(label.id)
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border/60 p-2">
      <div className="flex items-center gap-2">
        <SwatchButton
          color={pickerOpen ? color : label.color}
          open={pickerOpen}
          onClick={() => (pickerOpen ? applyColor() : setPickerOpen(true))}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setName(label.name)
          }}
          aria-label={`Название ярлыка ${label.name}`}
          maxLength={50}
          className="min-w-0 flex-1 rounded bg-transparent px-1 py-1 text-base outline-none focus:bg-surface-raised"
        />
        <span className="shrink-0 text-sm text-text-muted">{count > 0 && notesCount(count)}</span>
        <button
          type="button"
          onClick={remove}
          title="Удалить ярлык"
          aria-label={`Удалить ярлык ${label.name}`}
          className="rounded-full p-2 text-text-muted hover:bg-surface-raised hover:text-text"
        >
          <TrashIcon />
        </button>
      </div>
      {nameProblem && <p className="px-1 text-sm text-red-400">{nameProblem}</p>}
      {pickerOpen && (
        <>
          <ColorPicker value={color} onChange={setColor} others={others} />
          {colorProblem && <p className="px-1 text-sm text-red-400">{colorProblem}</p>}
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => {
                setColor(label.color)
                setPickerOpen(false)
              }}
              className="rounded-full px-4 py-1.5 text-sm text-text-muted hover:bg-surface-raised"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={applyColor}
              disabled={!!colorProblem}
              className="rounded-full bg-accent/20 px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-40"
            >
              Готово
            </button>
          </div>
        </>
      )}
    </li>
  )
}

function SwatchButton({
  color,
  open,
  onClick,
}: {
  color: string
  open: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      title="Цвет ярлыка"
      aria-label="Цвет ярлыка"
      style={{ backgroundColor: color }}
      className={`size-8 shrink-0 rounded-full border-2 ${open ? 'border-text' : 'border-transparent hover:border-text-muted'}`}
    />
  )
}

// «1 заметка», «3 заметки», «5 заметок»
function notesCount(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} заметка`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} заметки`
  return `${count} заметок`
}

// «снимется с 1 заметки», «… с 3 заметок»
function fromNotes(count: number) {
  return `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'заметки' : 'заметок'}`
}
