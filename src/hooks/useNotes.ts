import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import {
  byItemPosition,
  insertChecklistItems,
  makeItem,
  type ChecklistItem,
} from '../lib/checklist'
import {
  byPosition,
  deleteNote,
  fetchArchivedNotes,
  fetchNotes,
  insertNote,
  updateMyPlaces,
  updateNote,
  updateSharedNote,
  type Note,
  type NoteKind,
  type NotePatch,
  type Place,
} from '../lib/notes'
import { applyPlaces, labelTargets, missingLabelRows, planLink, planRestore } from '../lib/links'
import type { Urgency } from '../lib/urgency'
import { insertNoteLabels, type NoteLabel } from '../lib/labels'
import { useToast } from '../components/Toast'
import { useOptimisticList } from './optimistic'
import { ITEMS_KEY } from './useChecklist'
import { LABELS_SCOPE, NOTE_LABELS_KEY } from './useLabels'

const NOTES_KEY = ['notes'] as const

export function useNotes() {
  return useQuery({ queryKey: NOTES_KEY, queryFn: fetchNotes })
}

export type NewNote = {
  title: string
  description: string | null
  kind: NoteKind
  urgency: Urgency
  // ТР-2: дедлайн временной задачи, «ГГГГ-ММ-ДД» или null
  dueDate: string | null
  items: string[]
  labelIds: string[]
  primaryLabelId: string | null
  // ТР-11: задачи того же столбца, с которыми связать новую
  linkIds: string[]
}

// Заметка и её пункты создаются вместе: сначала заметка, потом пункты (им нужна заметка)
export function useCreateNote() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    // В очереди с ярлыками: ярлык, созданный прямо в форме, должен сохраниться раньше
    scope: LABELS_SCOPE,
    mutationFn: async ({
      note,
      items,
      labels,
      places,
    }: {
      note: Note
      items: ChecklistItem[]
      labels: NoteLabel[]
      places: Place[]
    }) => {
      // Основной ярлык ссылается на связь заметки с ярлыком, поэтому ставится последним
      await insertNote(note)
      await insertChecklistItems(items)
      await insertNoteLabels(labels)
      if (note.primary_label_id) {
        await updateSharedNote(note.id, { primary_label_id: note.primary_label_id })
      }
      // Блок связанных задач — когда у заметки уже есть своё место
      await updateMyPlaces(places)
    },
    onMutate: async ({ note, items, labels, places }) => {
      await queryClient.cancelQueries({ queryKey: NOTES_KEY })
      await queryClient.cancelQueries({ queryKey: ITEMS_KEY })
      await queryClient.cancelQueries({ queryKey: NOTE_LABELS_KEY })
      const previousNotes = queryClient.getQueryData<Note[]>(NOTES_KEY)
      const previousItems = queryClient.getQueryData<ChecklistItem[]>(ITEMS_KEY)
      const previousLabels = queryClient.getQueryData<NoteLabel[]>(NOTE_LABELS_KEY)
      queryClient.setQueryData<Note[]>(NOTES_KEY, (old = []) =>
        applyPlaces([...old, note], places).sort(byPosition),
      )
      queryClient.setQueryData<ChecklistItem[]>(ITEMS_KEY, (old = []) =>
        [...old, ...items].sort(byItemPosition),
      )
      queryClient.setQueryData<NoteLabel[]>(NOTE_LABELS_KEY, (old = []) => [...old, ...labels])
      return { previousNotes, previousItems, previousLabels }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousNotes) queryClient.setQueryData(NOTES_KEY, context.previousNotes)
      if (context?.previousItems) queryClient.setQueryData(ITEMS_KEY, context.previousItems)
      if (context?.previousLabels) queryClient.setQueryData(NOTE_LABELS_KEY, context.previousLabels)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTES_KEY })
      void queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      void queryClient.invalidateQueries({ queryKey: NOTE_LABELS_KEY })
    },
  })

  return (input: NewNote) => {
    const notes = queryClient.getQueryData<Note[]>(NOTES_KEY) ?? []
    const now = new Date().toISOString()
    const note: Note = {
      id: crypto.randomUUID(),
      owner_id: session!.user.id,
      title: input.title,
      description: input.description,
      kind: input.kind,
      urgency: input.urgency,
      due_date: input.dueDate,
      // Новая заметка встаёт первой
      position: Math.min(0, ...notes.map((n) => n.position)) - 1,
      primary_label_id: input.primaryLabelId,
      archived_at: null,
      link_group: null,
      created_at: now,
      updated_at: now,
    }
    // ТР-11: новая задача встаёт в конец блока, задачи блока собираются рядом
    const places =
      input.kind === 'temporary' && input.linkIds.length > 0
        ? planLink(
            [...notes, note],
            note.id,
            input.linkIds,
            note.urgency,
            () => crypto.randomUUID(),
            true,
          )
        : []
    const own = places.find((p) => p.note_id === note.id)
    if (own?.position !== undefined) note.position = own.position
    const items = input.items.map((text, i) => makeItem(note.id, text, i))
    const labels = input.labelIds.map((label_id) => ({ note_id: note.id, label_id }))
    // ТР-11: ярлыки новой задачи получают и остальные свои задачи её блока
    if (places.length > 0) {
      const linked = applyPlaces([...notes, note], places)
      const mates = labelTargets(linked, note.id, note.owner_id).filter((id) => id !== note.id)
      const rows = queryClient.getQueryData<NoteLabel[]>(NOTE_LABELS_KEY) ?? []
      labels.push(...missingLabelRows(mates, input.labelIds, rows))
    }
    mutation.mutate({ note, items, labels, places })
  }
}

export function useUpdateNote() {
  return useOptimisticList<Note, { note: Note; patch: NotePatch }>(
    NOTES_KEY,
    ({ note, patch }) => updateNote(note, patch),
    (notes, { note, patch }) =>
      notes
        .map((n) => (n.id === note.id ? { ...n, ...patch } : n))
        // Заархивированная заметка сразу уходит с доски
        .filter((n) => !n.archived_at)
        .sort(byPosition),
  )
}

// ТР-11: места нескольких задач сразу — перенос блока, связывание, отвязывание
export function usePlaces() {
  return useOptimisticList<Note, Place[]>(NOTES_KEY, updateMyPlaces, (notes, places) =>
    applyPlaces(notes, places).sort(byPosition),
  )
}

// Ключ начинается с NOTES_KEY: любые изменения заметок обновляют и архив
const ARCHIVED_KEY = [...NOTES_KEY, 'archived'] as const

export function useArchivedNotes() {
  return useQuery({ queryKey: ARCHIVED_KEY, queryFn: fetchArchivedNotes })
}

export function useDeleteArchivedNote() {
  return useOptimisticList<Note, Note>(ARCHIVED_KEY, deleteNote, (notes, note) =>
    notes.filter((n) => n.id !== note.id),
  )
}

// ТР-8: в архив и обратно. Заметка сразу переезжает между доской и архивом,
// а в уведомлении можно отменить действие.
export function useArchive() {
  const queryClient = useQueryClient()
  const showToast = useToast()

  const mutation = useMutation({
    // По очереди: «Отменить» не должен обогнать на сервере само действие
    scope: { id: 'archive' },
    // note — заметка до изменения: по ней видно, где хранится её место
    mutationFn: async ({
      before,
      patch,
      others = [],
    }: {
      note: Note
      before: Note
      patch: NotePatch
      others?: Place[]
    }) => {
      await updateNote(before, patch)
      await updateMyPlaces(others)
    },
    onMutate: async ({ note, others = [] }) => {
      await queryClient.cancelQueries({ queryKey: NOTES_KEY })
      const previousBoard = queryClient.getQueryData<Note[]>(NOTES_KEY)
      const previousArchive = queryClient.getQueryData<Note[]>(ARCHIVED_KEY)
      const without = (old: Note[] = []) => applyPlaces(old, others).filter((n) => n.id !== note.id)
      if (note.archived_at) {
        queryClient.setQueryData<Note[]>(NOTES_KEY, without)
        queryClient.setQueryData<Note[]>(ARCHIVED_KEY, (old) => [note, ...without(old)])
      } else {
        queryClient.setQueryData<Note[]>(ARCHIVED_KEY, without)
        queryClient.setQueryData<Note[]>(NOTES_KEY, (old) =>
          [...without(old), note].sort(byPosition),
        )
      }
      return { previousBoard, previousArchive }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousBoard) queryClient.setQueryData(NOTES_KEY, context.previousBoard)
      if (context?.previousArchive) queryClient.setQueryData(ARCHIVED_KEY, context.previousArchive)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  })

  const setArchived = (
    note: Note,
    archived: boolean,
    extra: NotePatch = {},
    others: Place[] = [],
  ) => {
    const patch = { ...extra, archived_at: archived ? new Date().toISOString() : null }
    mutation.mutate({ note: { ...note, ...patch }, before: note, patch, others })
    return { ...note, ...patch }
  }

  // extra — несохранённые правки из окна заметки
  const archive = (note: Note, extra?: NotePatch) => {
    const archived = setArchived(note, true, extra)
    showToast('Заметка в архиве', {
      label: 'Отменить',
      onClick: () => setArchived(archived, false),
    })
  }

  // ТР-11: восстановленная задача возвращается в конец своего блока
  // board — задачи доски; если не переданы, берутся из кэша
  const restore = (note: Note, board?: Note[]) => {
    const { patch, others } = planRestore(
      board ?? queryClient.getQueryData<Note[]>(NOTES_KEY) ?? [],
      note,
    )
    const restored = setArchived(note, false, patch, others)
    showToast('Заметка восстановлена', {
      label: 'Отменить',
      onClick: () => setArchived(restored, true),
    })
  }

  return { archive, restore }
}
