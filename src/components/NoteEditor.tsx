import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import {
  useAddNoteLabel,
  useLabelsFor,
  useNoteLabelRows,
  useRemoveNoteLabel,
  useSetPrimaryLabel,
} from '../hooks/useLabels'
import {
  useArchive,
  useNotes,
  usePlaces,
  useSprintNotes,
  useSprintPlaces,
  useUpdateNote,
} from '../hooks/useNotes'
import { useSprintLists } from '../hooks/useSprints'
import { addLabelTargets, numberChoices, planJoin, planLeave, sprintNumber } from '../lib/sprints'
import {
  blockMates,
  labelTargets,
  missingLabelRows,
  onBoard,
  planLink,
  planMoveBlock,
  planUnlink,
} from '../lib/links'
import { cardStyle } from '../lib/color'
import type { Note, NoteKind, NotePatch } from '../lib/notes'
import { ChecklistEditor } from './ChecklistEditor'
import { ArchiveIcon, LabelIcon, LinkIcon, PersonAddIcon } from './icons'
import { LinkedList, LinkPicker } from './LinkPicker'
import { LabelChips, LabelPicker } from './LabelPicker'
import { MissingLabels } from './MissingLabels'
import { SharePanel } from './SharePanel'
import type { Urgency } from '../lib/urgency'
import { KindToggle } from './KindToggle'
import { UrgencySelect } from './UrgencySelect'
import { DeadlineInput } from './DeadlineInput'
import { SprintField } from './SprintField'

// Окно редактирования. Как в Keep: закрытие (Esc, клик мимо, «Готово») сохраняет изменения.
export function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const updateNote = useUpdateNote()
  const { archive: archiveNote } = useArchive()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [title, setTitle] = useState(note.title)
  const [description, setDescription] = useState(note.description ?? '')
  const [kind, setKind] = useState<NoteKind>(note.kind)
  const [urgency, setUrgency] = useState<Urgency>(note.urgency)
  const [dueDate, setDueDate] = useState(note.due_date ?? '')
  const [titleError, setTitleError] = useState(false)

  // ТР-5: ярлыки сохраняются сразу, окно перекрашивается под основной
  const { session } = useAuth()
  const view = useLabelsFor()(note)
  const labels = view.labels
  const [labelsOpen, setLabelsOpen] = useState(false)
  const labelsButtonRef = useRef<HTMLButtonElement>(null)
  // ТР-9: совместный доступ
  const [shareOpen, setShareOpen] = useState(false)
  const shareButtonRef = useRef<HTMLButtonElement>(null)
  // Окно закрывается кликом по затемнению, только если и нажали, и отпустили мимо окна:
  // выделение текста, начатое внутри и законченное снаружи, окно не закрывает
  const pressedOutside = useRef(false)
  const addNoteLabel = useAddNoteLabel()
  const removeNoteLabel = useRemoveNoteLabel()
  const setPrimaryLabel = useSetPrimaryLabel()
  // На общей заметке ярлыки ставит её создатель (ТР-9)
  const canLabel = note.owner_id === session?.user.id

  // ТР-11: связанные задачи. Связывание и «Отвязать» сохраняются сразу, как ярлыки.
  const { data: boardNotes = [] } = useNotes()
  const places = usePlaces()
  const mates = blockMates(boardNotes, note.link_group).filter((m) => m.id !== note.id)
  const mateIds = new Set(mates.map((m) => m.id))
  const linkCandidates = onBoard(boardNotes).filter(
    (n) => n.urgency === urgency && n.id !== note.id && !mateIds.has(n.id),
  )
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkSelection, setLinkSelection] = useState<string[]>([])
  const linkButtonRef = useRef<HTMLButtonElement>(null)
  // ТР-11: ярлык ставится и снимается сразу у всех своих задач блока.
  // ТР-12: поставленный ярлык получают и задачи действующего спринта; снятие их не трогает.
  const { data: labelRows = [] } = useNoteLabelRows()
  const toggleLabel = (labelId: string, on: boolean) => {
    const temporary = kind === 'temporary'
    if (on) {
      const ids = temporary
        ? addLabelTargets(
            boardNotes,
            note.id,
            session!.user.id,
            new Set(activeSprints.map((s) => s.id)),
          )
        : [note.id]
      for (const row of missingLabelRows(ids, [labelId], labelRows)) addNoteLabel.mutate(row)
    } else {
      const ids = temporary ? labelTargets(boardNotes, note.id, session!.user.id) : [note.id]
      for (const row of labelRows) {
        if (row.label_id === labelId && ids.includes(row.note_id)) removeNoteLabel.mutate(row)
      }
    }
  }

  // ТР-12: спринт и номер задачи. Как и связи, сохраняются сразу.
  const { active: activeSprints } = useSprintLists()
  const sprintNotes = useSprintNotes()
  const sprintPlaces = useSprintPlaces()
  const fresh = sprintNotes.find((n) => n.id === note.id) ?? note
  // Задача завершённого спринта считается вне спринта
  const sprint = activeSprints.find((s) => s.id === fresh.sprint_id) ?? null
  const changeSprint = (sprintId: string | null, number: number | null) => {
    sprintPlaces.mutate(
      sprintId ? planJoin(sprintNotes, note.id, sprintId, number) : planLeave(note.id),
    )
  }

  const applyLink = () => {
    places.mutate(planLink(boardNotes, note.id, linkSelection, urgency, () => crypto.randomUUID()))
    setLinkSelection([])
    setLinkOpen(false)
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    // showModal ставит фокус в первое поле, и на телефоне сразу выезжает клавиатура.
    // Фокус на самом окне: клавиатура не открывается, а Esc по-прежнему закрывает окно.
    dialog.focus()
  }, [])

  // Изменённые поля; null — если название пустое и сохранять нельзя
  // Сравниваем с тем, что было при открытии, а не с текущей заметкой: если поле
  // тем временем изменили на другом устройстве, а здесь его не трогали — не затираем
  const initial = useRef(note).current
  const collectChanges = (): NotePatch | null => {
    const trimmed = title.trim()
    if (!trimmed) {
      setTitleError(true)
      return null
    }
    const patch: NotePatch = {}
    if (trimmed !== initial.title) patch.title = trimmed
    const desc = description.trim() || null
    if (desc !== initial.description) patch.description = desc
    if (kind !== initial.kind) patch.kind = kind
    if (urgency !== initial.urgency) patch.urgency = urgency
    // У постоянной заметки дедлайна нет
    const due = kind === 'temporary' && dueDate ? dueDate : null
    if (due !== (initial.due_date ?? null)) patch.due_date = due
    return patch
  }

  const save = () => {
    const patch = collectChanges()
    if (!patch) return
    if (Object.keys(patch).length > 0) updateNote.mutate({ note, patch })
    // ТР-11: задача блока переезжает в другой столбец вместе со всем блоком
    if (patch.urgency && kind === 'temporary') {
      const moves = planMoveBlock(boardNotes, note.id, patch.urgency)
      if (moves.length > 0) places.mutate(moves)
    }
    onClose()
  }

  // ТР-8: архивация обратима, поэтому без подтверждения
  const archive = () => {
    archiveNote(note, collectChanges() ?? {})
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-label="Редактирование заметки"
      onCancel={(e) => {
        e.preventDefault()
        save()
      }}
      onPointerDown={(e) => {
        pressedOutside.current = e.target === dialogRef.current
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current && pressedOutside.current) save()
      }}
      style={cardStyle(view.color)}
      className="m-auto max-h-[90dvh] w-[min(36rem,calc(100%-2rem))] overflow-y-auto rounded-xl border border-border bg-surface-raised p-0 text-text shadow-2xl outline-none backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-2 p-4">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setTitleError(false)
          }}
          placeholder="Название"
          aria-label="Название"
          aria-invalid={titleError}
          className="bg-transparent px-1 py-1 text-lg font-medium outline-none placeholder:text-text-muted"
        />
        {titleError && <p className="px-1 text-sm text-red-400">Название не может быть пустым</p>}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Описание (необязательно)"
          aria-label="Описание"
          rows={3}
          className="field-sizing-content max-h-[40dvh] min-h-10 resize-none bg-transparent px-1 py-1 text-base outline-none placeholder:text-text-muted"
        />
        <ChecklistEditor noteId={note.id} />
        <LabelChips labels={labels} onClick={canLabel ? () => setLabelsOpen(true) : undefined} />
        <MissingLabels missing={view.missing} />
        {kind === 'temporary' && (
          <LinkedList
            titles={mates.map((m) => m.title)}
            onUnlink={() => places.mutate(planUnlink(boardNotes, note.id))}
          />
        )}
        {kind === 'temporary' && !note.archived_at && (activeSprints.length > 0 || sprint) && (
          <SprintField
            sprints={activeSprints}
            sprintId={sprint?.id ?? null}
            number={sprint ? sprintNumber(sprintNotes, fresh) : null}
            choices={numberChoices(sprintNotes, note.id, sprint?.id ?? null)}
            onChange={changeSprint}
          />
        )}
        {linkOpen && kind === 'temporary' && (
          <LinkPicker
            candidates={linkCandidates}
            selected={linkSelection}
            onToggle={(id, on) =>
              setLinkSelection((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)))
            }
            onApply={applyLink}
            onClose={() => setLinkOpen(false)}
            toggleRef={linkButtonRef}
          />
        )}
        {labelsOpen && (
          <LabelPicker
            selected={labels.map((l) => l.id)}
            primaryId={labels[0]?.id ?? null}
            onToggle={toggleLabel}
            onSetPrimary={(labelId) => setPrimaryLabel.mutate({ noteId: note.id, labelId })}
            onClose={() => setLabelsOpen(false)}
            toggleRef={labelsButtonRef}
          />
        )}
        {shareOpen && (
          <SharePanel
            note={note}
            onLeft={onClose}
            onClose={() => setShareOpen(false)}
            toggleRef={shareButtonRef}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <KindToggle value={kind} onChange={setKind} />
            {kind === 'temporary' && (
              <UrgencySelect
                value={urgency}
                onChange={(value) => {
                  setUrgency(value)
                  // Связать можно только с задачами того же столбца
                  setLinkSelection([])
                }}
              />
            )}
            {kind === 'temporary' && <DeadlineInput value={dueDate} onChange={setDueDate} />}
            {kind === 'temporary' && !note.archived_at && (
              <button
                ref={linkButtonRef}
                type="button"
                onClick={() => setLinkOpen(!linkOpen)}
                aria-expanded={linkOpen}
                title="Связать с задачами этого столбца"
                aria-label="Связать"
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-surface hover:text-text"
              >
                <LinkIcon />
                <span className="hidden sm:inline">Связать</span>
              </button>
            )}
            {canLabel && (
              <button
                ref={labelsButtonRef}
                type="button"
                onClick={() => setLabelsOpen(!labelsOpen)}
                aria-expanded={labelsOpen}
                title="Ярлыки"
                aria-label="Ярлыки"
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-surface hover:text-text"
              >
                <LabelIcon />
                <span className="hidden sm:inline">Ярлыки</span>
              </button>
            )}
            <button
              ref={shareButtonRef}
              type="button"
              onClick={() => setShareOpen(!shareOpen)}
              aria-expanded={shareOpen}
              title="Совместный доступ"
              aria-label="Совместный доступ"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-surface hover:text-text"
            >
              <PersonAddIcon />
              <span className="hidden sm:inline">Доступ</span>
            </button>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={archive}
              title="В архив"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-surface hover:text-text"
            >
              <ArchiveIcon />В архив
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-full bg-accent/20 px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent/30"
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
