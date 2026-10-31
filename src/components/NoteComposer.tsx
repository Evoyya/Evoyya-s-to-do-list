import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useMyLabels } from '../hooks/useLabels'
import { useCreateNote } from '../hooks/useNotes'
import { cardStyle } from '../lib/color'
import type { NoteKind } from '../lib/notes'
import { Checkbox } from './Checkbox'
import { LabelIcon } from './icons'
import { LabelChips, LabelPicker } from './LabelPicker'
import { DEFAULT_URGENCY, type Urgency } from '../lib/urgency'
import { KindToggle } from './KindToggle'
import { UrgencySelect } from './UrgencySelect'

// Форма создания заметки: свёрнута в строку «Заметка…», раскрывается по нажатию
export function NoteComposer() {
  const createNote = useCreateNote()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<NoteKind>('temporary')
  const [urgency, setUrgency] = useState<Urgency>(DEFAULT_URGENCY)
  // null — список не добавлен; иначе черновики пунктов
  const [items, setItems] = useState<string[] | null>(null)
  // ТР-5: ярлыки новой заметки; основной — выбранный звёздочкой или первый по алфавиту
  const myLabels = useMyLabels()
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [primaryId, setPrimaryId] = useState<string | null>(null)
  const [labelsOpen, setLabelsOpen] = useState(false)
  const chosen = myLabels.filter((l) => labelIds.includes(l.id))
  const primary = chosen.find((l) => l.id === primaryId) ?? chosen[0]
  const ordered = primary ? [primary, ...chosen.filter((l) => l !== primary)] : chosen

  const reset = () => {
    setOpen(false)
    setTitle('')
    setDescription('')
    setKind('temporary')
    setUrgency(DEFAULT_URGENCY)
    setItems(null)
    setLabelIds([])
    setPrimaryId(null)
    setLabelsOpen(false)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    createNote({
      title: trimmed,
      description: description.trim() || null,
      kind,
      urgency,
      items: (items ?? []).map((i) => i.trim()).filter(Boolean),
      labelIds,
      primaryLabelId: primary && primary.id === primaryId ? primary.id : null,
    })
    reset()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto block w-full max-w-xl rounded-lg border border-border/60 bg-surface-raised px-4 py-3 text-left text-text-muted shadow hover:border-border"
      >
        Заметка…
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={cardStyle(ordered[0]?.color)}
      className="mx-auto flex w-full max-w-xl flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3 shadow-lg"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Название"
        aria-label="Название"
        className="bg-transparent px-1 py-1 text-base font-medium outline-none placeholder:text-text-muted"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Описание (необязательно)"
        aria-label="Описание"
        rows={2}
        className="field-sizing-content min-h-12 resize-none bg-transparent px-1 py-1 text-base outline-none placeholder:text-text-muted"
      />
      {items && <DraftChecklist items={items} onChange={setItems} />}
      <LabelChips labels={ordered} onClick={() => setLabelsOpen(true)} />
      {labelsOpen && (
        <LabelPicker
          selected={labelIds}
          primaryId={primary?.id ?? null}
          onToggle={(id, on) =>
            setLabelIds((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)))
          }
          onSetPrimary={setPrimaryId}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <KindToggle value={kind} onChange={setKind} />
          {kind === 'temporary' && <UrgencySelect value={urgency} onChange={setUrgency} />}
          <button
            type="button"
            onClick={() => setLabelsOpen(!labelsOpen)}
            aria-expanded={labelsOpen}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-text-muted hover:bg-surface hover:text-text"
          >
            <LabelIcon />
            Ярлыки
          </button>
          {!items && (
            <button
              type="button"
              onClick={() => setItems([''])}
              className="rounded-full px-3 py-1 text-sm text-text-muted hover:bg-surface hover:text-text"
            >
              ☑ Список
            </button>
          )}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={reset}
            className="rounded-full px-4 py-1.5 text-sm text-text-muted hover:bg-surface"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="rounded-full bg-accent/20 px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-40"
          >
            Добавить
          </button>
        </div>
      </div>
    </form>
  )
}

// Пункты до сохранения заметки: Enter — новый пункт, Backspace в пустом — удалить
function DraftChecklist({
  items,
  onChange,
}: {
  items: string[]
  onChange: (items: string[]) => void
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  // Какой пункт сфокусировать после следующей отрисовки
  const pendingFocus = useRef<number | null>(0)

  useEffect(() => {
    if (pendingFocus.current === null) return
    inputs.current[pendingFocus.current]?.focus()
    pendingFocus.current = null
  })

  const setFocusIndex = (index: number) => {
    pendingFocus.current = index
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      // Не отправлять форму: Enter в пункте добавляет следующий
      e.preventDefault()
      onChange([...items.slice(0, index + 1), '', ...items.slice(index + 1)])
      setFocusIndex(index + 1)
    } else if (e.key === 'Backspace' && items[index] === '' && items.length > 1) {
      e.preventDefault()
      onChange(items.filter((_, i) => i !== index))
      setFocusIndex(Math.max(0, index - 1))
    }
  }

  return (
    <ul className="flex flex-col gap-1 px-1">
      {items.map((text, index) => (
        <li key={index} className="flex items-center gap-2">
          <Checkbox checked={false} label="Пункт списка" />
          <input
            ref={(el) => {
              inputs.current[index] = el
            }}
            value={text}
            onChange={(e) => onChange(items.map((t, i) => (i === index ? e.target.value : t)))}
            onKeyDown={(e) => handleKeyDown(e, index)}
            placeholder="Пункт списка"
            aria-label={`Пункт ${index + 1}`}
            className="min-w-0 flex-1 bg-transparent py-0.5 text-base outline-none placeholder:text-text-muted"
          />
        </li>
      ))}
    </ul>
  )
}
